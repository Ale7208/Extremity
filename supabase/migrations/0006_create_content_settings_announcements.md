/*
# Migration 0006 — site_content, site_settings, and announcements

## Purpose
- site_content: editable public text (title, subtitle, season label, about).
- site_settings: internal configuration key-value pairs.
- announcements: news banners shown to visitors.

## Tables

### site_content
| Column      | Type         | Default | Description                                   |
|-------------|--------------|---------|-----------------------------------------------|
| key         | text (PK)    | —       | 'site_title', 'site_subtitle', etc.           |
| value       | text         | —       | Content value                                 |
| published   | boolean      | false   | Admin toggles visibility                      |
| updated_at  | timestamptz  | now()   |                                               |

### site_settings
| Column      | Type         | Default | Description                                   |
|-------------|--------------|---------|-----------------------------------------------|
| key         | text (PK)    | —       | Internal config keys                          |
| value       | text         | —       | Setting value                                 |
| updated_at  | timestamptz  | now()   |                                               |

### announcements
| Column        | Type         | Default          | Description                               |
|---------------|--------------|------------------|-------------------------------------------|
| id            | uuid (PK)    | gen_random_uuid()|                                           |
| title         | text         | —                | Headline                                  |
| body          | text         | —                | Content                                   |
| published     | boolean      | false            | Admin toggles visibility                  |
| published_at  | timestamptz  | NULL             | When it goes live                         |
| sort_order    | integer      | 0                | Manual ordering                           |
| created_at    | timestamptz  | now()            |                                           |

## RLS + Column-level privileges

### site_content
- SELECT (public): published content only.
- INSERT / UPDATE / DELETE: admin only.

### site_settings
- SELECT: admin only. NOT public.
- INSERT / UPDATE / DELETE: admin only.

### announcements
- SELECT (public): published only.
- INSERT / UPDATE / DELETE: admin only.

## No demo data inserted.
*/

-- ──────────────────────────────────────────────
-- Table: site_content
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_content (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  published  boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_published_content" ON public.site_content;
CREATE POLICY "public_read_published_content"
  ON public.site_content FOR SELECT
  TO anon, authenticated
  USING (published = true);

DROP POLICY IF EXISTS "admin_read_all_content" ON public.site_content;
CREATE POLICY "admin_read_all_content"
  ON public.site_content FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_content" ON public.site_content;
CREATE POLICY "admin_insert_content"
  ON public.site_content FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_content" ON public.site_content;
CREATE POLICY "admin_update_content"
  ON public.site_content FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_content" ON public.site_content;
CREATE POLICY "admin_delete_content"
  ON public.site_content FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- Table: site_settings
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_settings" ON public.site_settings;
CREATE POLICY "admin_read_settings"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_settings" ON public.site_settings;
CREATE POLICY "admin_insert_settings"
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_settings" ON public.site_settings;
CREATE POLICY "admin_update_settings"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_settings" ON public.site_settings;
CREATE POLICY "admin_delete_settings"
  ON public.site_settings FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- Table: announcements
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  body         text NOT NULL,
  published    boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_published_announcements" ON public.announcements;
CREATE POLICY "public_read_published_announcements"
  ON public.announcements FOR SELECT
  TO anon, authenticated
  USING (published = true);

DROP POLICY IF EXISTS "admin_read_all_announcements" ON public.announcements;
CREATE POLICY "admin_read_all_announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_announcements" ON public.announcements;
CREATE POLICY "admin_insert_announcements"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_announcements" ON public.announcements;
CREATE POLICY "admin_update_announcements"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_announcements" ON public.announcements;
CREATE POLICY "admin_delete_announcements"
  ON public.announcements FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- Column-level privileges (defense in depth)
-- ──────────────────────────────────────────────

-- site_content: public reads published rows, all columns are non-sensitive
REVOKE ALL ON public.site_content FROM anon, authenticated;
GRANT SELECT (key, value, published, updated_at)
  ON public.site_content TO anon, authenticated;
GRANT INSERT (key, value, published)
  ON public.site_content TO authenticated;
GRANT UPDATE (key, value, published)
  ON public.site_content TO authenticated;
GRANT DELETE ON public.site_content TO authenticated;

-- site_settings: admin only, no public access
REVOKE ALL ON public.site_settings FROM anon, authenticated;
GRANT SELECT (key, value, updated_at)
  ON public.site_settings TO authenticated;
GRANT INSERT (key, value)
  ON public.site_settings TO authenticated;
GRANT UPDATE (key, value)
  ON public.site_settings TO authenticated;
GRANT DELETE ON public.site_settings TO authenticated;

-- announcements: public reads published rows
REVOKE ALL ON public.announcements FROM anon, authenticated;
GRANT SELECT (id, title, body, published, published_at, sort_order, created_at)
  ON public.announcements TO anon, authenticated;
GRANT INSERT (title, body, published, published_at, sort_order)
  ON public.announcements TO authenticated;
GRANT UPDATE (title, body, published, published_at, sort_order)
  ON public.announcements TO authenticated;
GRANT DELETE ON public.announcements TO authenticated;

-- ──────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_announcements_published ON public.announcements(published);
CREATE INDEX IF NOT EXISTS idx_announcements_sort ON public.announcements(sort_order);
