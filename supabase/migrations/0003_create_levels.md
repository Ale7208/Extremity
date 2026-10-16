/*
# Migration 0003 — levels table

## Purpose
Stores demon levels that have been reviewed and published by the admin.

## New Table: levels
| Column       | Type         | Default          | Description                                        |
|--------------|--------------|------------------|----------------------------------------------------|
| id           | uuid (PK)    | gen_random_uuid()|                                                    |
| name         | text NOT NULL| —                | Level name                                         |
| gd_level_id  | integer UNIQUE | —              | GD level ID. Prevents duplicates.                 |
| difficulty   | text         | 'Unrated'        | Assigned manually by admin                         |
| points       | integer      | 0                | Points for 100% completion. Admin-configured.      |
| published    | boolean      | false            | Admin toggles public visibility                    |
| created_at   | timestamptz  | now()            |                                                    |

## RLS Policies

### levels
- SELECT: public reads only published levels. Admin reads all.
- INSERT / UPDATE / DELETE: admin ONLY.
  Users cannot create, publish, or modify levels or their points/difficulty.

## No demo data inserted.
*/

CREATE TABLE IF NOT EXISTS public.levels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  gd_level_id integer UNIQUE NOT NULL,
  difficulty  text NOT NULL DEFAULT 'Unrated',
  points      integer NOT NULL DEFAULT 0,
  published   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;

-- Public can read only published levels
DROP POLICY IF EXISTS "public_read_published_levels" ON public.levels;
CREATE POLICY "public_read_published_levels"
  ON public.levels FOR SELECT
  TO anon, authenticated
  USING (published = true);

-- Admin can read all levels
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

-- Admin can update levels
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
