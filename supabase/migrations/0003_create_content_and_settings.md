/*
# Migration 0003 — Create site_content, site_settings, and announcements

## Purpose
- `site_content` stores editable text content shown on the public site
  (title, subtitle, season label, about text, etc.).
- `site_settings` stores internal configuration key-value pairs, including
  the `admin_user_id` entry that the `is_admin()` function reads.
- `announcements` stores news banners shown to visitors.

## New Tables

### 1. site_content
| Column      | Type         | Default | Description                                          |
|-------------|--------------|---------|------------------------------------------------------|
| key         | text (PK)    | —       | Identifier like 'site_title', 'site_subtitle'        |
| value       | text         | —       | The content value                                    |
| published   | boolean      | false   | Admin toggles visibility                             |
| updated_at  | timestamptz  | now()   | Last modification timestamp                          |

### 2. site_settings
| Column      | Type         | Default | Description                                          |
|-------------|--------------|---------|------------------------------------------------------|
| key         | text (PK)    | —       | Identifier like 'admin_user_id'                      |
| value       | text         | —       | The setting value                                    |
| updated_at  | timestamptz  | now()   | Last modification timestamp                          |

### 3. announcements
| Column        | Type         | Default          | Description                                        |
|---------------|--------------|------------------|----------------------------------------------------|
| id            | uuid (PK)    | gen_random_uuid()|                                                    |
| title         | text         | —                | Announcement headline                              |
| body          | text         | —                | Announcement content                               |
| published     | boolean      | false            | Admin toggles visibility                           |
| published_at  | timestamptz  | NULL             | When the announcement goes live                    |
| sort_order    | integer      | 0                | Manual ordering by admin                           |
| created_at    | timestamptz  | now()            |                                                    |

## Security — RLS

### site_content
- SELECT (public): anyone can read published content only.
- INSERT / UPDATE / DELETE: admin only.

### site_settings
- SELECT: admin only. The `admin_user_id` and other internal settings
  must never be exposed to the public. The `is_admin()` function has
  SECURITY DEFINER so it can read this table regardless of RLS.
- INSERT / UPDATE / DELETE: admin only.

### announcements
- SELECT (public): anyone can read published announcements only.
- INSERT / UPDATE / DELETE: admin only.

## Code alignment
- `server.ts` query: `site_content(key, value).eq('published', true)` ✓
- `server.ts` query: `site_content(key, value, published).order('key')` ✓
- `server.ts` query: `announcements(id, title, body, published_at).eq('published', true).order('sort_order').limit(5)` ✓
- `server.ts` query: `announcements(id, title, body, published, published_at, sort_order).order('sort_order')` ✓
- `server.ts` query: `site_settings(key, value).order('key')` ✓

## Important Notes
1. The `is_admin()` function (migration 0001) reads `site_settings` with
   SECURITY DEFINER privileges, bypassing RLS. This is intentional and
   necessary — the admin check must work even though the table is admin-only.
2. No demo data is inserted. The admin sets `admin_user_id` manually.
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

-- Public can read published content only
DROP POLICY IF EXISTS "public_read_published_content" ON public.site_content;
CREATE POLICY "public_read_published_content"
  ON public.site_content FOR SELECT
  TO anon, authenticated
  USING (published = true);

-- Admin can read all content
DROP POLICY IF EXISTS "admin_read_all_content" ON public.site_content;
CREATE POLICY "admin_read_all_content"
  ON public.site_content FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin can insert content
DROP POLICY IF EXISTS "admin_insert_content" ON public.site_content;
CREATE POLICY "admin_insert_content"
  ON public.site_content FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admin can update content
DROP POLICY IF EXISTS "admin_update_content" ON public.site_content;
CREATE POLICY "admin_update_content"
  ON public.site_content FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admin can delete content
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

-- Admin-only: no public SELECT on settings
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

-- Public can read published announcements only
DROP POLICY IF EXISTS "public_read_published_announcements" ON public.announcements;
CREATE POLICY "public_read_published_announcements"
  ON public.announcements FOR SELECT
  TO anon, authenticated
  USING (published = true);

-- Admin can read all announcements
DROP POLICY IF EXISTS "admin_read_all_announcements" ON public.announcements;
CREATE POLICY "admin_read_all_announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin can insert announcements
DROP POLICY IF EXISTS "admin_insert_announcements" ON public.announcements;
CREATE POLICY "admin_insert_announcements"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admin can update announcements
DROP POLICY IF EXISTS "admin_update_announcements" ON public.announcements;
CREATE POLICY "admin_update_announcements"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admin can delete announcements
DROP POLICY IF EXISTS "admin_delete_announcements" ON public.announcements;
CREATE POLICY "admin_delete_announcements"
  ON public.announcements FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_announcements_published ON public.announcements(published);
CREATE INDEX IF NOT EXISTS idx_announcements_sort ON public.announcements(sort_order);
