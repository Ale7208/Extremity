-- Migration 0004 — level_proposals table
-- Stores proposed levels submitted by users. Admin reviews and decides.
-- The promote_level_proposal() trigger is deferred to migration 0005
-- because it references the records table.

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

-- SELECT: user reads own, admin reads all
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

-- INSERT: verified user, pending only
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

-- UPDATE: admin only
DROP POLICY IF EXISTS "admin_update_proposals" ON public.level_proposals;
CREATE POLICY "admin_update_proposals"
  ON public.level_proposals FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE: admin only
DROP POLICY IF EXISTS "admin_delete_proposals" ON public.level_proposals;
CREATE POLICY "admin_delete_proposals"
  ON public.level_proposals FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Column-level privileges
REVOKE ALL ON public.level_proposals FROM anon, authenticated;

GRANT SELECT (id, proposed_by, name, gd_level_id, status, created_at)
  ON public.level_proposals TO authenticated;

GRANT INSERT (proposed_by, name, gd_level_id)
  ON public.level_proposals TO authenticated;

GRANT UPDATE (status, reviewed_by, reviewed_at, notes)
  ON public.level_proposals TO authenticated;

GRANT DELETE ON public.level_proposals TO authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.level_proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_proposed_by ON public.level_proposals(proposed_by);