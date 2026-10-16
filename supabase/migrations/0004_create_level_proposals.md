/*
# Migration 0004 — level_proposals table

## Purpose
Stores proposed levels submitted by users when the level does not yet exist
in the levels table. Admin reviews proposals and decides whether to
incorporate them into the list.

## IMPORTANT: Trigger moved to migration 0005
The promote_level_proposal() trigger function references the records table,
which is not created until migration 0005. The trigger function and trigger
are therefore created at the end of migration 0005, after records exists.
This migration only creates the table, policies, and grants.

## Table: level_proposals
| Column        | Type            | Default    | Description                                          |
|---------------|-----------------|------------|------------------------------------------------------|
| id            | uuid (PK)       | gen_random |                                                      |
| proposed_by   | uuid            | —          | FK to profiles(id) ON DELETE CASCADE                 |
| name          | text            | —          | Level name provided by the user                      |
| gd_level_id   | integer UNIQUE  | —          | GD level ID. UNIQUE prevents duplicate proposals.    |
| status        | text            | 'pending'  | CHECK IN ('pending','approved','rejected')           |
| reviewed_by   | uuid            | NULL       | FK to auth.users(id) ON DELETE SET NULL              |
| reviewed_at   | timestamptz     | NULL       |                                                      |
| notes         | text            | NULL       | Internal admin notes, NOT public                     |
| created_at    | timestamptz     | now()      |                                                      |

## RLS + Column-level privileges
- SELECT: user reads own proposals. Admin reads all. anon: NO access.
  Granted columns to authenticated: (id, proposed_by, name, gd_level_id,
  status, created_at). reviewed_by, reviewed_at, notes are NOT granted.
  Admin uses service role key for those columns.
- INSERT: authenticated user with verified GD identity, status = 'pending'.
  Granted columns: (proposed_by, name, gd_level_id). status defaults to
  'pending'. reviewed_by, reviewed_at, notes default to NULL.
- UPDATE: admin ONLY (RLS). Granted columns include admin fields.
- DELETE: admin ONLY (RLS).

## No demo data inserted.
*/

CREATE TABLE IF NOT EXISTS public.level_proposals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name         text NOT NULL,
  gd_level_id  integer UNIQUE NOT NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at  timestamptz,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.level_proposals ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- SELECT: user reads own, admin reads all
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "user_read_own_proposals" ON public.level_proposals;
CREATE POLICY "user_read_own_proposals"
  ON public.level_proposals FOR SELECT
  TO authenticated
  USING (auth.uid() = proposed_by);

DROP POLICY IF EXISTS "admin_read_all_proposals" ON public.level_proposals;
CREATE POLICY "admin_read_all_proposals"
  ON public.level_proposals FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- INSERT: verified user, pending only
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "insert_own_proposal" ON public.level_proposals;
CREATE POLICY "insert_own_proposal"
  ON public.level_proposals FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = proposed_by
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.gd_identities gi
      WHERE gi.user_id = proposed_by
        AND gi.verification_status = 'verified'
    )
  );

-- ──────────────────────────────────────────────
-- UPDATE: admin only
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_update_proposals" ON public.level_proposals;
CREATE POLICY "admin_update_proposals"
  ON public.level_proposals FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ──────────────────────────────────────────────
-- DELETE: admin only
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_delete_proposals" ON public.level_proposals;
CREATE POLICY "admin_delete_proposals"
  ON public.level_proposals FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- Column-level privileges
-- Only safe columns granted to authenticated.
-- Admin uses service role key for reviewed_by, reviewed_at, notes.
-- ──────────────────────────────────────────────
REVOKE ALL ON public.level_proposals FROM anon, authenticated;

-- Users can read their own proposal's safe columns
GRANT SELECT (id, proposed_by, name, gd_level_id, status, created_at)
  ON public.level_proposals TO authenticated;

-- Users can INSERT only user-settable fields
-- status defaults to 'pending', reviewed_by/at/notes default to NULL
GRANT INSERT (proposed_by, name, gd_level_id)
  ON public.level_proposals TO authenticated;

-- UPDATE: admin fields granted to authenticated (RLS restricts to admin only)
GRANT UPDATE (status, reviewed_by, reviewed_at, notes)
  ON public.level_proposals TO authenticated;

-- DELETE: admin only via RLS
GRANT DELETE ON public.level_proposals TO authenticated;

-- ──────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.level_proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_proposed_by ON public.level_proposals(proposed_by);
