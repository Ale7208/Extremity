/*
# Migration 0007 — admin_audit_log table

## Purpose
Records every administrative action for accountability. Immutable: no UPDATE
or DELETE policies exist, so entries cannot be modified or removed through
the Supabase API by any role.

## New Table: admin_audit_log
| Column      | Type         | Default          | Description                                        |
|-------------|--------------|------------------|----------------------------------------------------|
| id          | uuid (PK)    | gen_random_uuid()|                                                    |
| actor_id    | uuid         | —                | FK to auth.users(id) ON DELETE RESTRICT            |
| action      | text         | —                | 'approve_record', 'reject_record', etc.           |
| entity      | text         | —                | 'records', 'levels', 'profiles', etc.             |
| entity_id   | uuid         | NULL             | ID of affected row                                 |
| changes     | jsonb        | NULL             | JSON snapshot of changes                           |
| created_at  | timestamptz  | now()            |                                                    |

## RLS Policies
- SELECT: admin only.
- INSERT: admin only.
- UPDATE: NO policy — entries are immutable.
- DELETE: NO policy — entries cannot be deleted.

## No demo data inserted.
*/

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  uuid,
  changes    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_audit_log" ON public.admin_audit_log;
CREATE POLICY "admin_read_audit_log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_audit_log" ON public.admin_audit_log;
CREATE POLICY "admin_insert_audit_log"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- No UPDATE policy: audit entries are immutable
-- No DELETE policy: audit entries cannot be deleted

-- ──────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.admin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.admin_audit_log(entity);
