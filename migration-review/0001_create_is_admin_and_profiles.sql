-- Migration 0001 — is_admin() function and profiles table
-- Creates the admin authorization function and the foundational profiles table.

-- Function: is_admin()
-- Reads app_metadata.role from the JWT. Only writable via service role key.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- Table: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text UNIQUE NOT NULL,
  badges       jsonb NOT NULL DEFAULT '[]'::jsonb,
  suspended    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_profiles" ON public.profiles;
CREATE POLICY "public_read_profiles"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
CREATE POLICY "admin_update_profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_profiles" ON public.profiles;
CREATE POLICY "admin_delete_profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Column-level privileges
REVOKE ALL ON public.profiles FROM anon, authenticated;

GRANT SELECT (id, display_name, badges, suspended, created_at)
  ON public.profiles TO anon, authenticated;

GRANT INSERT (id, display_name)
  ON public.profiles TO authenticated;

GRANT UPDATE (display_name, badges, suspended)
  ON public.profiles TO authenticated;

GRANT DELETE ON public.profiles TO authenticated;
