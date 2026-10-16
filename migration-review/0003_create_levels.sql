-- Migration 0003 — levels table
-- Stores demon levels reviewed and published by the admin.

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

DROP POLICY IF EXISTS "public_read_published_levels" ON public.levels;
CREATE POLICY "public_read_published_levels"
  ON public.levels FOR SELECT
  TO anon, authenticated
  USING (published = true);

DROP POLICY IF EXISTS "admin_read_all_levels" ON public.levels;
CREATE POLICY "admin_read_all_levels"
  ON public.levels FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_levels" ON public.levels;
CREATE POLICY "admin_insert_levels"
  ON public.levels FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_levels" ON public.levels;
CREATE POLICY "admin_update_levels"
  ON public.levels FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_levels" ON public.levels;
CREATE POLICY "admin_delete_levels"
  ON public.levels FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Column-level privileges
REVOKE ALL ON public.levels FROM anon, authenticated;

GRANT SELECT (id, name, gd_level_id, difficulty, points, published, created_at)
  ON public.levels TO anon, authenticated;

GRANT INSERT (name, gd_level_id, difficulty, points, published)
  ON public.levels TO authenticated;

GRANT UPDATE (name, gd_level_id, difficulty, points, published)
  ON public.levels TO authenticated;

GRANT DELETE ON public.levels TO authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_levels_published ON public.levels(published);
CREATE INDEX IF NOT EXISTS idx_levels_points ON public.levels(points DESC);
