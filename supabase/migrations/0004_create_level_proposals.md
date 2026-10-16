/*
# Migration 0004 — level_proposals table

## Purpose
Stores proposed levels submitted by users when the level does not yet exist
in the `levels` table. Admin reviews proposals and decides whether to
incorporate them into the list.

## New Table: level_proposals
| Column        | Type         | Default    | Description                                          |
|---------------|--------------|------------|------------------------------------------------------|
| id            | uuid (PK)    | gen_random |                                                      |
| proposed_by   | uuid         | —          | FK to profiles(id) ON DELETE CASCADE                 |
| name          | text         | —          | Level name provided by the user                      |
| gd_level_id   | integer UNIQUE | —        | GD level ID. UNIQUE prevents duplicate proposals.    |
| status        | text         | 'pending'  | CHECK IN ('pending','approved','rejected')           |
| reviewed_by   | uuid         | NULL       | FK to auth.users(id) ON DELETE SET NULL              |
| reviewed_at   | timestamptz  | NULL       |                                                      |
| notes         | text         | NULL       | Internal admin notes, NOT public                     |
| created_at    | timestamptz  | now()      |                                                      |

## RLS Policies

### level_proposals
- SELECT: user reads their own proposals. Admin reads all. Public: NO access.
- INSERT: authenticated user with verified GD identity, status = 'pending'.
  The gd_level_id must not already exist in the `levels` table (enforced by
  the application server before insert; the unique constraint on gd_level_id
  in both tables prevents collision).
- UPDATE: admin ONLY. Admin sets status, reviewed_by, reviewed_at, notes.
- DELETE: admin ONLY.

## Trigger: promote proposal to level on approval
When admin sets status = 'approved' on a level_proposal, a BEFORE UPDATE
trigger:
1. Creates a new row in `levels` with the proposal's name and gd_level_id.
   difficulty defaults to 'Unrated', points to 0, published to false.
   The admin will configure difficulty and points afterwards.
2. Updates all `records` that referenced this proposal (via level_proposal_id)
   to now reference the new `levels` row (via level_id), setting
   level_proposal_id to NULL.
3. The operation is atomic because the trigger runs within the same
   transaction as the UPDATE that triggered it.

## Why this is safe
- Only admin can set status = 'approved' (RLS UPDATE policy checks is_admin()).
- The new level is created with published = false. It is NOT automatically
  visible to the public or submittable in new records until the admin
  explicitly publishes it.
- The admin must manually set difficulty and points before publishing.
- Records that referenced the proposal are automatically relinked to the
  new level, but they remain in 'pending' status — the admin still reviews
  each record individually.

## No demo data inserted.
*/

CREATE TABLE IF NOT EXISTS public.level_proposals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name         text NOT NULL,
  gd_level_id  integer UNIQUE NOT NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at  timestamptz,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.level_proposals ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- Trigger: promote proposal to level when approved
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
-- SELECT: user reads own, admin reads all
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "user_read_own_proposals" ON public.level_proposals;
CREATE POLICY "user_read_own_proposals"
  ON public.level_proposals FOR SELECT
  TO authenticated
  USING (auth.uid() = proposed_by);

DROP POLICY IF EXISTS "admin_read_all_proposals" ON public.level_proposals;
CREATE POLICY "admin_read_all_proposals"
  ON public.level_proposals FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- INSERT: verified user, pending only
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "insert_own_proposal" ON public.level_proposals;
CREATE POLICY "insert_own_proposal"
  ON public.level_proposals FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = proposed_by
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.gd_identities gi
      WHERE gi.user_id = proposed_by
        AND gi.verification_status = 'verified'
    )
  );

-- ──────────────────────────────────────────────
-- UPDATE: admin only
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_update_proposals" ON public.level_proposals;
CREATE POLICY "admin_update_proposals"
  ON public.level_proposals FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ──────────────────────────────────────────────
-- DELETE: admin only
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_delete_proposals" ON public.level_proposals;
CREATE POLICY "admin_delete_proposals"
  ON public.level_proposals FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- Column-level privileges
-- ──────────────────────────────────────────────
REVOKE ALL ON public.level_proposals FROM anon, authenticated;

GRANT SELECT (id, proposed_by, name, gd_level_id, status, created_at)
  ON public.level_proposals TO authenticated;

GRANT INSERT (proposed_by, name, gd_level_id)
  ON public.level_proposals TO authenticated;

GRANT SELECT (id, proposed_by, name, gd_level_id, status, reviewed_by, reviewed_at, notes, created_at)
  ON public.level_proposals TO authenticated;
GRANT UPDATE (status, reviewed_by, reviewed_at, notes)
  ON public.level_proposals TO authenticated;
GRANT DELETE ON public.level_proposals TO authenticated;

-- ──────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.level_proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_proposed_by ON public.level_proposals(proposed_by);
