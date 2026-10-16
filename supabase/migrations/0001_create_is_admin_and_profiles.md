/*
# Migration 0001 — is_admin() function and profiles table

## Purpose
Creates the admin authorization function and the foundational profiles table
that links Supabase auth users to their Extremity player identity.

## New SQL Functions

### is_admin()
- Returns true if the current user's JWT contains `app_metadata.role = 'admin'`.
- Uses `auth.jwt()` (NOT `auth.uid()`), reading `raw_app_meta_data` which is
  only writable via the Supabase service role key (server-side or dashboard).
- SECURITY DEFINER, STABLE, search_path = public.
- Users CANNOT set their own admin flag from the browser — `raw_app_meta_data`
  is populated by the Supabase auth admin API, not by client-side writes.

## New Table: profiles
| Column        | Type         | Default | Description                                            |
|---------------|--------------|---------|--------------------------------------------------------|
| id            | uuid (PK)    | —       | FK to auth.users(id) ON DELETE CASCADE                 |
| display_name  | text UNIQUE  | —       | Player's visible name on Extremity                    |
| badges        | jsonb        | '[]'    | Badge identifiers assigned by admin                   |
| suspended     | boolean      | false   | Admin suspends to block record submissions            |
| created_at    | timestamptz  | now()   |                                                       |

## RLS Policies

### profiles
- SELECT: public (anon + authenticated) — leaderboard needs display_name.
- INSERT: authenticated user creates ONLY their own profile (auth.uid() = id).
  The user CANNOT set `badges` or `suspended` via insert — those default
  to '[]' and false respectively, and the WITH CHECK ensures auth.uid() = id.
- UPDATE: admin ONLY. Users cannot edit their own profile after creation
  (including display_name). Admin can edit badges, suspended, display_name.
- DELETE: admin ONLY.

## Why users cannot self-admin
The is_admin() function reads app_metadata from the JWT. The Supabase client
SDK has NO method to modify app_metadata — it can only modify user_metadata
(which is user-writable and explicitly NOT used for authorization). Only the
service role key (server-side) or the Supabase dashboard can set
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

-- User can insert only their own profile (defaults enforce badges=[], suspended=false)
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
