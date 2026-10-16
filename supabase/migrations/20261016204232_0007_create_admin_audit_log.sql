-- Migration 0007 — admin_audit_log table
-- Immutable audit trail. No UPDATE or DELETE policies or grants.

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
  WITH CHECK (
    public.is_admin()
    AND actor_id = auth.uid()
  );

-- No UPDATE policy: entries are immutable
-- No DELETE policy: entries cannot be deleted

-- Column-level privileges
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;

GRANT SELECT (id, actor_id, action, entity, entity_id, changes, created_at)
  ON public.admin_audit_log TO authenticated;

GRANT INSERT (actor_id, action, entity, entity_id, changes)
  ON public.admin_audit_log TO authenticated;

-- No UPDATE grant: immutable
-- No DELETE grant: immutable

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.admin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.admin_audit_log(entity);