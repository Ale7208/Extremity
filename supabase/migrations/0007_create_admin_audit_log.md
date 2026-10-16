/*
# Migration 0007 — admin_audit_log table

## Purpose
Records every administrative action for accountability. Immutable: no UPDATE
or DELETE policies, no UPDATE or DELETE column grants.

## Table: admin_audit_log
| Column      | Type         | Default          | Description                                        |
|-------------|--------------|------------------|----------------------------------------------------|
| id          | uuid (PK)    | gen_random_uuid()|                                                    |
| actor_id    | uuid         | —                | FK to auth.users(id) ON DELETE RESTRICT            |
| action      | text         | —                | 'approve_record', 'reject_record', etc.           |
| entity      | text         | —                | 'records', 'levels', 'profiles', etc.             |
| entity_id   | uuid         | NULL             | ID of affected row                                 |
| changes     | jsonb        | NULL             | JSON snapshot of changes                           |
| created_at  | timestamptz  | now()            |                                                    |

## RLS + Column-level privileges
- SELECT: admin only.
- INSERT: admin only, AND actor_id must equal auth.uid() (prevents forging
  audit entries attributed to another admin).
- UPDATE: NO policy, NO grant — entries are immutable.
- DELETE: NO policy, NO grant — entries cannot be deleted.

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

-- Admin can read the audit log
DROP POLICY IF EXISTS "admin_read_audit_log" ON public.admin_audit_log;
CREATE POLICY "admin_read_audit_log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin can insert audit log entries, but actor_id must be their own
DROP POLICY IF EXISTS "admin_insert_audit_log" ON public.admin_audit_log;
CREATE POLICY "admin_insert_audit_log"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    AND actor_id = auth.uid()
  );

-- No UPDATE policy: audit entries are immutable
-- No DELETE policy: audit entries cannot be deleted

-- ──────────────────────────────────────────────
-- Column-level privileges
-- No UPDATE or DELETE grants — immutable at GRANT level too.
-- ──────────────────────────────────────────────
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;

-- Admin can read all columns
GRANT SELECT (id, actor_id, action, entity, entity_id, changes, created_at)
  ON public.admin_audit_log TO authenticated;

-- Admin can INSERT (created_at defaults to now(), actor_id enforced by RLS)
GRANT INSERT (actor_id, action, entity, entity_id, changes)
  ON public.admin_audit_log TO authenticated;

-- No UPDATE grant: immutable
-- No DELETE grant: immutable

-- ──────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.admin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.admin_audit_log(entity);
