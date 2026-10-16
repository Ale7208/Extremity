/*
# Migration 0005 — records table + level proposal promotion trigger

## Purpose
Stores record submissions. Each record links a player (profile) to a level
(either a published level or a pending level proposal) with a progress
percentage and a moderation status.

Also creates the promote_level_proposal() trigger that was deferred from
migration 0004, since it references this table.

## Table: records
| Column              | Type         | Default    | Description                                           |
|---------------------|--------------|------------|-------------------------------------------------------|
| id                  | uuid (PK)    | gen_random |                                                       |
| player_id           | uuid         | —          | FK to profiles(id) ON DELETE CASCADE                  |
| level_id            | uuid         | NULL       | FK to levels(id) ON DELETE CASCADE. Null if proposal. |
| level_proposal_id   | uuid         | NULL       | FK to level_proposals(id) ON DELETE CASCADE.          |
| progress            | integer      | —          | 0–100, CHECK enforced                                 |
| evidence_url        | text         | NULL       | Link to video/image proof                             |
| notes               | text         | NULL       | Internal moderation notes, NOT public                 |
| status              | text         | 'pending'  | CHECK IN ('pending','approved','rejected')            |
| reviewer_id         | uuid         | NULL       | FK to auth.users(id) ON DELETE SET NULL               |
| reviewed_at         | timestamptz  | NULL       |                                                       |
| created_at          | timestamptz  | now()      |                                                       |

## CHECK constraint: exactly one level reference
(level_id IS NOT NULL AND level_proposal_id IS NULL)
OR (level_id IS NULL AND level_proposal_id IS NOT NULL)

## Anti-duplicate index
Partial unique index on (player_id, COALESCE(level_id, level_proposal_id), progress)
WHERE status = 'pending'. Prevents duplicate pending submissions.

## RLS + Column-level privileges

### records
- SELECT (public): anon + authenticated read ONLY approved records.
  Granted columns: (id, player_id, level_id, progress, evidence_url, created_at).
  notes, status, reviewer_id, reviewed_at, level_proposal_id are NOT granted.
  Admin uses service role key for those columns.
- INSERT: authenticated user with:
  - auth.uid() = player_id (cannot submit as another player)
  - status = 'pending' (cannot self-approve)
  - GD identity verified (EXISTS check on gd_identities)
  - Not suspended (NOT EXISTS check on profiles.suspended)
  Granted columns: (player_id, level_id, level_proposal_id, progress, evidence_url).
  status defaults to 'pending', notes/reviewer_id/reviewed_at default to NULL.
- UPDATE: admin ONLY, CANNOT approve own records.
  Granted columns: (progress, evidence_url, notes, status, reviewer_id, reviewed_at).
  RLS USING clause: is_admin() AND player_id <> auth.uid().
- DELETE: admin ONLY, same self-record restriction.

## Self-approval prevention (database-enforced)

The UPDATE and DELETE policies include:
  player_id::text <> auth.uid()::text

player_id references profiles(id), and profiles.id = auth.users.id (enforced
at profile creation via INSERT policy auth.uid() = id). So player_id for a
user's records equals their auth.uid(). The comparison is correct.

If the admin is also a player, a second admin (different auth.uid()) must
approve their records. The second admin is configured via Supabase dashboard
(raw_app_meta_data role = 'admin').

## Trigger: promote_level_proposal (deferred from migration 0004)

Created here because it references the records table. Fires BEFORE UPDATE OF
status ON level_proposals. When status transitions to 'approved':
1. INSERTs a new level (published = false, points = 0, difficulty = 'Unrated').
2. UPDATEs records referencing this proposal to point to the new level.
3. Sets reviewed_by and reviewed_at if not already set.

SECURITY DEFINER is required because the function INSERTs into levels and
UPDATEs records, which would be blocked by RLS for the calling user. The
function runs as the table owner (supabase_admin) with BYPASSRLS.

Security of the trigger:
- Only fires when status changes to 'approved' (condition: NEW.status = 'approved'
  AND OLD.status IS DISTINCT FROM 'approved').
- Only admin can UPDATE level_proposals (RLS admin_update_proposals checks
  is_admin()). Non-admin UPDATEs are rejected by RLS before the trigger fires.
- The new level is created with published = false (not visible to public).
- Records are relinked but remain 'pending' (not auto-approved).
- The UPDATE on records only changes level_id and level_proposal_id, never
  status — so the self-approval constraint is not bypassed.
- Re-approving an already-approved proposal fails due to UNIQUE on
  levels.gd_level_id — acceptable since the level already exists.

## No demo data inserted.
*/

CREATE TABLE IF NOT EXISTS public.records (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level_id           uuid REFERENCES public.levels(id) ON DELETE CASCADE,
  level_proposal_id  uuid REFERENCES public.level_proposals(id) ON DELETE CASCADE,
  progress           integer NOT NULL CHECK (progress >= 0 AND progress <= 100),
  evidence_url       text,
  notes              text,
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (level_id IS NOT NULL AND level_proposal_id IS NULL)
    OR
    (level_id IS NULL AND level_proposal_id IS NOT NULL)
  )
);

ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- Anti-duplicate: no two pending records for same player+level+progress
-- ──────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_no_duplicate_pending
  ON public.records(player_id, COALESCE(level_id, level_proposal_id), progress)
  WHERE status = 'pending';

-- ──────────────────────────────────────────────
-- SELECT: public reads approved only; admin reads all
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "public_read_approved_records" ON public.records;
CREATE POLICY "public_read_approved_records"
  ON public.records FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

DROP POLICY IF EXISTS "admin_read_all_records" ON public.records;
CREATE POLICY "admin_read_all_records"
  ON public.records FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- INSERT: verified, non-suspended user, pending only
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "insert_own_pending_record" ON public.records;
CREATE POLICY "insert_own_pending_record"
  ON public.records FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = player_id
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.gd_identities gi
      WHERE gi.user_id = player_id
        AND gi.verification_status = 'verified'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = player_id AND p.suspended = true
    )
  );

-- ──────────────────────────────────────────────
-- UPDATE: admin only, CANNOT approve own records
-- player_id references profiles(id) which equals auth.users(id)
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_update_records" ON public.records;
CREATE POLICY "admin_update_records"
  ON public.records FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    AND player_id::text <> auth.uid()::text
  )
  WITH CHECK (
    public.is_admin()
    AND player_id::text <> auth.uid()::text
  );

-- ──────────────────────────────────────────────
-- DELETE: admin only, CANNOT delete own records
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_delete_records" ON public.records;
CREATE POLICY "admin_delete_records"
  ON public.records FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    AND player_id::text <> auth.uid()::text
  );

-- ──────────────────────────────────────────────
-- Column-level privileges
-- Only public columns granted to authenticated and anon.
-- Admin uses service role key for sensitive columns.
-- ──────────────────────────────────────────────
REVOKE ALL ON public.records FROM anon, authenticated;

-- Public sees only these columns on approved records
GRANT SELECT (id, player_id, level_id, progress, evidence_url, created_at)
  ON public.records TO anon, authenticated;

-- INSERT: only user-settable columns
-- status defaults to 'pending', notes/reviewer_id/reviewed_at default to NULL
GRANT INSERT (player_id, level_id, level_proposal_id, progress, evidence_url)
  ON public.records TO authenticated;

-- UPDATE: admin fields (RLS restricts to admin AND non-own records)
GRANT UPDATE (progress, evidence_url, notes, status, reviewer_id, reviewed_at)
  ON public.records TO authenticated;

-- DELETE: admin only via RLS
GRANT DELETE ON public.records TO authenticated;

-- ──────────────────────────────────────────────
-- Trigger: promote_level_proposal (deferred from migration 0004)
-- Created here because it references the records table.
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.promote_level_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_level_id uuid;
BEGIN
  -- Only act when status transitions to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    -- Insert the new level (published = false, points = 0, difficulty = 'Unrated')
    INSERT INTO public.levels (name, gd_level_id)
    VALUES (NEW.name, NEW.gd_level_id)
    RETURNING id INTO new_level_id;

    -- Relink records from this proposal to the new level
    UPDATE public.records
    SET level_id = new_level_id,
        level_proposal_id = NULL
    WHERE level_proposal_id = NEW.id;

    -- Set reviewed_by and reviewed_at if not already set
    IF NEW.reviewed_by IS NULL THEN
      NEW.reviewed_by := auth.uid();
    END IF;
    IF NEW.reviewed_at IS NULL THEN
      NEW.reviewed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_level_proposal ON public.level_proposals;
CREATE TRIGGER trg_promote_level_proposal
  BEFORE UPDATE OF status ON public.level_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_level_proposal();

-- ──────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_records_status ON public.records(status);
CREATE INDEX IF NOT EXISTS idx_records_player ON public.records(player_id);
CREATE INDEX IF NOT EXISTS idx_records_level ON public.records(level_id);
CREATE INDEX IF NOT EXISTS idx_records_created ON public.records(created_at DESC);
