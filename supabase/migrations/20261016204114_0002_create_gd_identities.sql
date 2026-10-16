-- Migration 0002 — gd_identities table
-- Stores Geometry Dash identity claims and their verification status.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.gd_identities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gd_player_id        integer NOT NULL,
  gd_player_name      text NOT NULL,
  verification_token  text NOT NULL,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verified_at         timestamptz,
  verified_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gd_identities ENABLE ROW LEVEL SECURITY;

-- Partial unique index: one active claim per GD player ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_gd_identities_active_player
  ON public.gd_identities(gd_player_id)
  WHERE verification_status IN ('pending', 'verified');

-- Trigger function: reset verification on identity data change
CREATE OR REPLACE FUNCTION public.reset_gd_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.gd_player_id IS DISTINCT FROM OLD.gd_player_id
     OR NEW.gd_player_name IS DISTINCT FROM OLD.gd_player_name THEN
    NEW.verification_status := 'pending';
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.verification_token := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_gd_verification ON public.gd_identities;
CREATE TRIGGER trg_reset_gd_verification
  BEFORE UPDATE ON public.gd_identities
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_gd_verification();

-- SELECT: user reads own row, admin reads all
DROP POLICY IF EXISTS "user_read_own_gd_identity" ON public.gd_identities;
CREATE POLICY "user_read_own_gd_identity"
  ON public.gd_identities FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_read_all_gd_identities" ON public.gd_identities;
CREATE POLICY "admin_read_all_gd_identities"
  ON public.gd_identities FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- INSERT: user creates own identity, pending only
DROP POLICY IF EXISTS "insert_own_gd_identity" ON public.gd_identities;
CREATE POLICY "insert_own_gd_identity"
  ON public.gd_identities FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND verification_status = 'pending'
  );

-- UPDATE (user scope): only while pending
DROP POLICY IF EXISTS "user_update_own_gd_identity" ON public.gd_identities;
CREATE POLICY "user_update_own_gd_identity"
  ON public.gd_identities FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND verification_status = 'pending'
  );

-- UPDATE (admin scope): verification fields
DROP POLICY IF EXISTS "admin_update_gd_identity" ON public.gd_identities;
CREATE POLICY "admin_update_gd_identity"
  ON public.gd_identities FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE: admin only
DROP POLICY IF EXISTS "admin_delete_gd_identity" ON public.gd_identities;
CREATE POLICY "admin_delete_gd_identity"
  ON public.gd_identities FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Column-level privileges
REVOKE ALL ON public.gd_identities FROM anon, authenticated;

GRANT SELECT (id, user_id, gd_player_id, gd_player_name, verification_token, verification_status, created_at, updated_at)
  ON public.gd_identities TO authenticated;

GRANT INSERT (user_id, gd_player_id, gd_player_name, verification_token)
  ON public.gd_identities TO authenticated;

GRANT UPDATE (gd_player_id, gd_player_name, verification_token, verification_status, verified_at, verified_by, notes)
  ON public.gd_identities TO authenticated;

GRANT DELETE ON public.gd_identities TO authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gd_identities_user ON public.gd_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_gd_identities_status ON public.gd_identities(verification_status);