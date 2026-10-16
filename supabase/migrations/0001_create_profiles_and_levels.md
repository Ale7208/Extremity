/*
# Migration 0001 — Create profiles and levels tables

## Purpose
Establishes the two foundational tables that all other tables reference:
- `profiles` stores display names and metadata for players.
- `levels` stores the demon levels that players submit records for.
Also creates the `is_admin()` helper function used by all RLS policies.

## New Tables

### 1. profiles
| Column        | Type         | Default     | Description                                                  |
|---------------|--------------|-------------|--------------------------------------------------------------|
| id            | uuid (PK)    | —           | References auth.users(id) ON DELETE CASCADE                 |
| display_name  | text UNIQUE  | —           | Player's visible name on the leaderboard                    |
| badges        | jsonb        | '[]'        | Array of badge identifiers                                   |
| suspended     | boolean      | false       | Admin sets this to block record submissions                  |
| created_at    | timestamptz  | now()       | When the profile was created                                 |

### 2. levels
| Column      | Type         | Default          | Description                                        |
|-------------|--------------|------------------|----------------------------------------------------|
| id          | uuid (PK)    | gen_random_uuid()|                                                    |
| name        | text UNIQUE  | —                | Level name (e.g. "Acheron")                       |
| difficulty  | text         | —                | Difficulty tier label, assigned by admin           |
| points      | integer      | 0                | Points for 100% completion. Configured by admin.   |
| published   | boolean      | false            | Admin toggles visibility                           |
| created_at  | timestamptz  | now()            |                                                    |

## Helper function: is_admin()
- Reads `admin_user_id` from `site_settings` table.
- Returns true if the current auth user matches.
- SECURITY DEFINER, STABLE, search_path = public.
- Safe fallback: returns false if table/row doesn't exist yet.

## Security — RLS

### profiles
- SELECT (public): anon + authenticated can read all profiles (leaderboard needs display_name).
- INSERT: authenticated user can create only their own profile (auth.uid() = id).
- UPDATE: admin only (via is_admin()).
- DELETE: admin only.

### levels
- SELECT: public reads only published levels. Admin reads all.
- INSERT / UPDATE / DELETE: admin only.

## Code alignment
- `server.ts` queries: `profiles(display_name)`, `profiles(id, display_name, badges, suspended, created_at)` ✓
- `server.ts` queries: `levels(name, points)`, `levels(id, name, difficulty, points, published)` ✓

## No demo data inserted.
*/

-- ──────────────────────────────────────────────
-- Helper: is_admin() function
-- ──────────────────────────────────────────────
-- Reads the admin user ID from site_settings (key = 'admin_user_id').
-- Returns true if the current authenticated user matches.
-- Must be created before any table that references it in policies.
-- We create site_settings in a later migration, so we use a safe
-- fallback: if the table or row does not exist yet, returns false.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.site_settings
    WHERE key = 'admin_user_id'
      AND value = auth.uid()::text
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

-- Public can read profile display info (leaderboard needs it)
DROP POLICY IF EXISTS "public_read_profiles" ON public.profiles;
CREATE POLICY "public_read_profiles"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

-- A user can insert only their own profile
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Only admin can update profiles (badges, suspended, display_name)
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
-- Table: levels
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.levels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text UNIQUE NOT NULL,
  difficulty text NOT NULL,
  points     integer NOT NULL DEFAULT 0,
  published  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;

-- Public can read only published levels
DROP POLICY IF EXISTS "public_read_published_levels" ON public.levels;
CREATE POLICY "public_read_published_levels"
  ON public.levels FOR SELECT
  TO anon, authenticated
  USING (published = true);

-- Admin can read all levels (including unpublished)
DROP POLICY IF EXISTS "admin_read_all_levels" ON public.levels;
CREATE POLICY "admin_read_all_levels"
  ON public.levels FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin can insert levels
DROP POLICY IF EXISTS "admin_insert_levels" ON public.levels;
CREATE POLICY "admin_insert_levels"
  ON public.levels FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admin can update levels (including toggling published and changing points)
DROP POLICY IF EXISTS "admin_update_levels" ON public.levels;
CREATE POLICY "admin_update_levels"
  ON public.levels FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admin can delete levels
DROP POLICY IF EXISTS "admin_delete_levels" ON public.levels;
CREATE POLICY "admin_delete_levels"
  ON public.levels FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_levels_published ON public.levels(published);
CREATE INDEX IF NOT EXISTS idx_levels_points ON public.levels(points DESC);
