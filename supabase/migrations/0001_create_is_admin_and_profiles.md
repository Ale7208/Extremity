/*
# Migration 0001 — is_admin() function and profiles table

## Purpose
Creates the admin authorization function and the foundational profiles table
that links Supabase auth users to their Extremity player identity.

## Function: is_admin()
- Returns true if the current user's JWT contains app_metadata.role = 'admin'.
- Uses auth.jwt(), reading raw_app_meta_data which is only writable via the
  Supabase service role key (server-side or dashboard), never from the browser.
- SECURITY DEFINER, STABLE, search_path = public.
- Note: SECURITY DEFINER is not strictly required (the function only reads
  auth.jwt(), no tables) but is kept as a safety margin. It is harmless.

## Table: profiles
| Column        | Type         | Default | Description                                        |
|---------------|--------------|---------|----------------------------------------------------|
| id            | uuid (PK)    | —       | FK to auth.users(id) ON DELETE CASCADE             |
| display_name  | text UNIQUE  | —       | Player's visible name on Extremity                |
| badges        | jsonb        | '[]'    | Badge identifiers assigned by admin               |
| suspended     | boolean      | false   | Admin suspends to block record submissions        |
| created_at    | timestamptz  | now()   |                                                   |

## RLS + Column-level privileges

### profiles
- SELECT: public (anon + authenticated) — leaderboard needs display_name.
  Granted columns: (id, display_name, badges, suspended, created_at).
- INSERT: authenticated user creates ONLY their own profile (auth.uid() = id).
  Granted columns: (id, display_name) — badges and suspended use defaults
  ('[]' and false), preventing users from self-assigning badges or suspending.
- UPDATE: admin ONLY (RLS). Granted columns: (display_name, badges, suspended).
- DELETE: admin ONLY (RLS).

## Why users cannot self-admin
is_admin() reads app_metadata from the JWT. The Supabase client SDK has NO
method to modify app_metadata — it can only modify user_metadata (which is
user-writable and explicitly NOT used for authorization). Only the service
role key (server-side) or the Supabase dashboard can set
app_metadata.role = 'admin'.

## No demo data inserted.
*/

-- ──────────────────────────────────────────────
-- Function: is_admin()
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- Table: profiles
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text UNIQUE NOT NULL,
  badges       jsonb NOT NULL DEFAULT '[]'::jsonb,
  suspended    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Public can read profile display info
DROP POLICY IF EXISTS "public_read_profiles" ON public.profiles;
CREATE POLICY "public_read_profiles"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

-- User can insert only their own profile
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Only admin can update profiles
DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
CREATE POLICY "admin_update_profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Only admin can delete profiles
DROP POLICY IF EXISTS "admin_delete_profiles" ON public.profiles;
CREATE POLICY "admin_delete_profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- Column-level privileges (defense in depth)
-- ──────────────────────────────────────────────
REVOKE ALL ON public.profiles FROM anon, authenticated;

-- Public can read all profile columns (display_name, badges for leaderboard)
GRANT SELECT (id, display_name, badges, suspended, created_at)
  ON public.profiles TO anon, authenticated;

-- User can INSERT only id and display_name; badges defaults to '[]', suspended to false
GRANT INSERT (id, display_name)
  ON public.profiles TO authenticated;

-- Admin can UPDATE display_name, badges, suspended (RLS restricts to admin only)
GRANT UPDATE (display_name, badges, suspended)
  ON public.profiles TO authenticated;

-- Admin can DELETE (RLS restricts to admin only)
GRANT DELETE ON public.profiles TO authenticated;
