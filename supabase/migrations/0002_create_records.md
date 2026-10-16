/*
# Migration 0002 — Create records table

## Purpose
Stores individual record submissions from players. Each record links a
player (profile) to a level with a progress percentage and a status that
tracks the moderation workflow.

## New Table: records
| Column        | Type         | Default          | Description                                                |
|---------------|--------------|------------------|------------------------------------------------------------|
| id            | uuid (PK)    | gen_random_uuid()|                                                            |
| player_id     | uuid (FK)    | —                | References profiles(id) ON DELETE CASCADE                  |
| level_id      | uuid (FK)    | —                | References levels(id) ON DELETE CASCADE                    |
| progress      | integer      | —                | 0–100, CHECK constraint enforces range                     |
| evidence_url  | text         | —                | Link to video/image proof                                  |
| notes         | text         | —                | Internal moderation notes, NOT exposed publicly            |
| status        | text         | 'pending'        | CHECK IN ('pending','approved','rejected')                 |
| reviewer_id   | uuid (FK)    | NULL             | References auth.users(id), set on review. ON DELETE SET NULL|
| reviewed_at   | timestamptz  | NULL             | Timestamp of review action                                 |
| created_at    | timestamptz  | now()            | When the record was submitted                              |

## Security — RLS

### Public visibility
- SELECT: anon + authenticated can read ONLY approved records (status = 'approved').
  Pending and rejected records are invisible to non-admin visitors.

### Submission
- INSERT: authenticated users can submit records for their own profile
  (auth.uid() = player_id) if not suspended. Status MUST be 'pending'.
  The WITH CHECK clause enforces status = 'pending' at the database level,
  so no visitor can self-approve a record.

### Moderation
- UPDATE: admin only. This is how records get approved/rejected.
  Non-admins cannot update records at all, including their own.
- DELETE: admin only.

### Column-level privileges (defense in depth)
- anon + authenticated: SELECT only on (id, player_id, level_id, progress, evidence_url, created_at).
- The notes, status, reviewer_id, reviewed_at columns are NOT selectable by non-admin roles.
- authenticated (admin): full column access via RLS policies.

## Code alignment
- `server.ts` query: `records(player_id, progress, created_at, profiles(display_name), levels(name, points)).eq('status','approved')` ✓
- `server.ts` query: `records(id, progress, evidence_url, notes, status, created_at, profiles(display_name), levels(name, points))` ✓
- `server.ts` query: `.eq('status','pending')` ✓
- `getPublicRankings()` logic: progress === 100 → full points, else proportional. Records count only when progress === 100. ✓

## Important Notes
1. The INSERT policy enforces `status = 'pending'` — visitors can never self-approve.
2. Only approved records are visible to the public. Only progress = 100 counts as a "record" in rankings (application logic).
3. No demo data is inserted.
*/

CREATE TABLE IF NOT EXISTS public.records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level_id     uuid NOT NULL REFERENCES public.levels(id) ON DELETE CASCADE,
  progress     integer NOT NULL CHECK (progress >= 0 AND progress <= 100),
  evidence_url text,
  notes        text,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- Public SELECT: only approved records
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "public_read_approved_records" ON public.records;
CREATE POLICY "public_read_approved_records"
  ON public.records FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

-- Admin can read all records (pending, approved, rejected)
DROP POLICY IF EXISTS "admin_read_all_records" ON public.records;
CREATE POLICY "admin_read_all_records"
  ON public.records FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- INSERT: authenticated users can submit their own records (pending only)
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "insert_own_pending_record" ON public.records;
CREATE POLICY "insert_own_pending_record"
  ON public.records FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = player_id
    AND status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = player_id AND p.suspended = true
    )
  );

-- ──────────────────────────────────────────────
-- UPDATE: admin only (approve / reject / edit notes)
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_update_records" ON public.records;
CREATE POLICY "admin_update_records"
  ON public.records FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ──────────────────────────────────────────────
-- DELETE: admin only
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_delete_records" ON public.records;
CREATE POLICY "admin_delete_records"
  ON public.records FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- Column-level privileges: hide moderation columns from non-admin
-- ──────────────────────────────────────────────
-- Revoke all defaults first
REVOKE ALL ON public.records FROM anon, authenticated;

-- Grant SELECT only on public columns to anon + authenticated
GRANT SELECT (id, player_id, level_id, progress, evidence_url, created_at)
  ON public.records TO anon, authenticated;

-- Authenticated (admin) gets full column access
GRANT SELECT (id, player_id, level_id, progress, evidence_url, notes, status, reviewer_id, reviewed_at, created_at)
  ON public.records TO authenticated;

GRANT INSERT (player_id, level_id, progress, evidence_url, notes, created_at)
  ON public.records TO authenticated;

GRANT UPDATE (progress, evidence_url, notes, status, reviewer_id, reviewed_at)
  ON public.records TO authenticated;

GRANT DELETE ON public.records TO authenticated;

-- ──────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_records_status ON public.records(status);
CREATE INDEX IF NOT EXISTS idx_records_player ON public.records(player_id);
CREATE INDEX IF NOT EXISTS idx_records_level ON public.records(level_id);
CREATE INDEX IF NOT EXISTS idx_records_created ON public.records(created_at DESC);
