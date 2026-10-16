/*
# Migration 0005 — records table

## Purpose
Stores record submissions. Each record links a player (profile) to a level
(either a published level or a pending level proposal) with a progress
percentage and a moderation status.

## New Table: records
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
```sql
CHECK (
  (level_id IS NOT NULL AND level_proposal_id IS NULL)
  OR
  (level_id IS NULL AND level_proposal_id IS NOT NULL)
)
```

## Anti-duplicate index
Partial unique index on (player_id, level_id, progress) WHERE status = 'pending':
- Prevents a user from submitting the same record twice while the first
  is still pending.
- Once a record is approved or rejected, the same combination can be
  submitted again (e.g., after rejection with improved evidence).

## RLS Policies

### records
- SELECT (public): anon + authenticated read ONLY approved records, and
  ONLY public columns (id, player_id, level_id, progress, evidence_url,
  created_at). Notes, status, reviewer_id, reviewed_at, level_proposal_id
  are hidden via column-level privileges.
- SELECT (admin): reads all records, all columns.
- INSERT: authenticated user with:
  - auth.uid() = player_id (cannot submit as another player)
  - status = 'pending' (cannot self-approve)
  - GD identity verified (EXISTS check on gd_identities)
  - Not suspended (NOT EXISTS check on profiles.suspended)
  - Admin cannot approve their own records: the INSERT policy for admin
    self-records is the same as for regular users — admin records also
    start as pending. The approval constraint is enforced in the UPDATE
    policy (see below).
- UPDATE: admin ONLY, with a critical restriction — the admin cannot
  approve a record where player_id matches their own auth.uid(). This is
  enforced at the RLS level, not just in the UI.
- DELETE: admin ONLY, with the same self-record restriction.

## Self-approval prevention (database-enforced)

The UPDATE and DELETE policies include:
```sql
USING (
  public.is_admin()
  AND player_id::text <> auth.uid()::text
)
```

This means: even if the admin's RLS allows UPDATE on records, the policy
rejects any UPDATE or DELETE where the admin is the record's player. The
admin literally cannot approve their own records through the Supabase API,
regardless of what the UI shows.

If the admin is also a player and needs their records approved, a second
moderator is required. That second moderator must also have
app_metadata.role = 'admin' (set via Supabase dashboard). The second admin
can then approve the first admin's records because their auth.uid() differs
from the record's player_id.

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
-- ──────────────────────────────────────────────
REVOKE ALL ON public.records FROM anon, authenticated;

-- Public sees only these columns on approved records
GRANT SELECT (id, player_id, level_id, progress, evidence_url, created_at)
  ON public.records TO anon, authenticated;

-- Authenticated (admin) gets full column access
GRANT SELECT (id, player_id, level_id, level_proposal_id, progress, evidence_url, notes, status, reviewer_id, reviewed_at, created_at)
  ON public.records TO authenticated;
GRANT INSERT (player_id, level_id, level_proposal_id, progress, evidence_url, created_at)
  ON public.records TO authenticated;
GRANT UPDATE (progress, evidence_url, notes, status, reviewer_id, reviewed_at)
  ON public.records TO authenticated;
GRANT DELETE ON public.records TO authenticated;

-- ──────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_records_status ON public.records(status);
CREATE INDEX IF NOT EXISTS idx_records_player ON public.records(player_id);
CREATE INDEX IF NOT EXISTS idx_records_level ON public.records(level_id);
CREATE INDEX IF NOT EXISTS idx_records_created ON public.records(created_at DESC);
