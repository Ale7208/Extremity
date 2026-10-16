-- Migration 0005 — records table + level proposal promotion trigger
-- Stores record submissions. Also creates the promote_level_proposal()
-- trigger deferred from migration 0004.

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

-- Anti-duplicate: no two pending records for same player+level+progress
CREATE UNIQUE INDEX IF NOT EXISTS idx_no_duplicate_pending
  ON public.records(player_id, COALESCE(level_id, level_proposal_id), progress)
  WHERE status = 'pending';

-- SELECT: public reads approved only; admin reads all
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

-- INSERT: verified, non-suspended user, pending only
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

-- UPDATE: admin only, CANNOT approve own records
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

-- DELETE: admin only, CANNOT delete own records
DROP POLICY IF EXISTS "admin_delete_records" ON public.records;
CREATE POLICY "admin_delete_records"
  ON public.records FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    AND player_id::text <> auth.uid()::text
  );

-- Column-level privileges
REVOKE ALL ON public.records FROM anon, authenticated;

GRANT SELECT (id, player_id, level_id, progress, evidence_url, created_at)
  ON public.records TO anon, authenticated;

GRANT INSERT (player_id, level_id, level_proposal_id, progress, evidence_url)
  ON public.records TO authenticated;

GRANT UPDATE (progress, evidence_url, notes, status, reviewer_id, reviewed_at)
  ON public.records TO authenticated;

GRANT DELETE ON public.records TO authenticated;

-- Trigger: promote_level_proposal (deferred from migration 0004)
-- Fires BEFORE UPDATE OF status ON level_proposals.
-- When status transitions to 'approved': inserts a new level and relinks records.
CREATE OR REPLACE FUNCTION public.promote_level_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_level_id uuid;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.levels (name, gd_level_id)
    VALUES (NEW.name, NEW.gd_level_id)
    RETURNING id INTO new_level_id;

    UPDATE public.records
    SET level_id = new_level_id,
        level_proposal_id = NULL
    WHERE level_proposal_id = NEW.id;

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_records_status ON public.records(status);
CREATE INDEX IF NOT EXISTS idx_records_player ON public.records(player_id);
CREATE INDEX IF NOT EXISTS idx_records_level ON public.records(level_id);
CREATE INDEX IF NOT EXISTS idx_records_created ON public.records(created_at DESC);
