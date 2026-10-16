/*
# Migration 0004 — Create admin_audit_log table

## Purpose
Records every administrative action (approve/reject record, edit level points,
suspend player, publish announcement, etc.) for accountability and traceability.

## New Table: admin_audit_log
| Column      | Type         | Default          | Description                                                  |
|-------------|--------------|------------------|--------------------------------------------------------------|
| id          | uuid (PK)    | gen_random_uuid()|                                                              |
| actor_id    | uuid (FK)    | —                | References auth.users(id) ON DELETE RESTRICT                 |
| action      | text         | —                | Verb: 'approve_record', 'update_level', 'suspend_profile'   |
| entity      | text         | —                | Table affected: 'records', 'levels', 'profiles'              |
| entity_id   | uuid         | NULL             | ID of the affected row                                       |
| changes     | jsonb        | NULL             | JSON snapshot of changes (before/after values)               |
| created_at  | timestamptz  | now()            | When the action occurred                                     |

## Security — RLS

### admin_audit_log
- SELECT: admin only. The audit log contains internal moderation actions.
- INSERT: admin only. The `writeAudit()` server function checks for a
  logged-in user before inserting; RLS enforces it at the database level.
- UPDATE: NO policy. Audit entries are immutable once written — not even
  the admin can modify them. This preserves audit trail integrity.
- DELETE: NO policy. Audit entries cannot be deleted through the API.

## Code alignment
- `server.ts` query: `admin_audit_log(id, action, entity, entity_id, changes, created_at).order('created_at',{ascending:false}).limit(50)` ✓
- `server.ts` insert: `admin_audit_log.insert({ actor_id: user.id, action, entity, entity_id, changes })` ✓

## Important Notes
1. Lack of UPDATE/DELETE policies means audit rows cannot be modified or
   removed through the Supabase API by any role. Intentional for integrity.
2. `actor_id` uses ON DELETE RESTRICT to prevent deleting an admin account
   that has audit entries. Account deletion requires manual DB intervention.
3. No demo data is inserted.
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

-- Admin can insert audit log entries
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
