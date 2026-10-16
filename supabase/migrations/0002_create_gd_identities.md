/*
# Migration 0002 — gd_identities table

## Purpose
Stores Geometry Dash identity claims and their verification status.
Each Extremity user can have exactly one GD identity linked to their account.

## Extension required
Uses gen_random_bytes() for token generation, which requires pgcrypto.

## Table: gd_identities
| Column               | Type         | Default    | Description                                         |
|----------------------|--------------|------------|-----------------------------------------------------|
| id                   | uuid (PK)    | gen_random |                                                     |
| user_id              | uuid UNIQUE  | —          | FK to profiles(id) ON DELETE CASCADE                |
| gd_player_id         | integer      | —          | GD account ID (numeric, stable across name changes) |
| gd_player_name       | text         | —          | GD player name at time of request                   |
| verification_token   | text         | —          | Random code the player puts in their GD bio         |
| verification_status  | text         | 'pending'  | CHECK IN ('pending','verified','rejected')          |
| verified_at          | timestamptz  | NULL       | When admin confirmed the identity                   |
| verified_by          | uuid         | NULL       | FK to auth.users(id) ON DELETE SET NULL             |
| notes                | text         | NULL       | Internal moderation notes, NOT public               |
| created_at           | timestamptz  | now()      |                                                     |
| updated_at           | timestamptz  | now()      |                                                     |

## Unique constraint
Partial unique index on gd_player_id WHERE verification_status IN ('pending','verified'):
- Prevents two Extremity accounts from claiming the same GD account simultaneously.
- A rejected claim frees the GD player ID for another user to claim.

## RLS + Column-level privileges

### gd_identities — CRITICAL SECURITY
- SELECT: user reads ONLY their own row. Admin reads all. anon: NO access.
  Granted columns to authenticated: (id, user_id, gd_player_id, gd_player_name,
  verification_token, verification_status, created_at, updated_at).
  The columns verified_at, verified_by, notes are NOT granted to authenticated.
  Admin must use the service role key (server-side) to read those columns.
- INSERT: authenticated user creates own row, status = 'pending'.
  Granted columns: (user_id, gd_player_id, gd_player_name, verification_token).
  verification_status defaults to 'pending'; verified_at, verified_by, notes
  default to NULL — user cannot set them.
- UPDATE: two RLS policies (user scope and admin scope), both TO authenticated.
  Granted columns: (gd_player_id, gd_player_name, verification_token,
  verification_status, verified_at, verified_by, notes).
  RLS is the guard: user-scope requires auth.uid() = user_id AND status = 'pending';
  admin-scope requires is_admin(). The GRANT allows both, RLS distinguishes.
- DELETE: admin only (RLS).

## Trigger: reset verification on identity change
A BEFORE UPDATE trigger fires on ALL updates. The function:
- Always sets NEW.updated_at := now().
- Only resets verification (status to 'pending', clears verified_at/verified_by,
  generates new token) when gd_player_id or gd_player_name actually changed.
This ensures updated_at is current for both user and admin actions.

## Why a user cannot self-verify
1. INSERT policy forces status = 'pending'.
2. User-scoped UPDATE WITH CHECK forces status = 'pending'.
3. GRANT INSERT does not include verification_status (defaults to 'pending').
4. GRANT INSERT does not include verified_at, verified_by, notes (defaults to NULL).
5. Trigger resets status to 'pending' on identity data change.
6. Only admin-scope UPDATE policy (is_admin()) allows changing verification_status.

## No demo data inserted.
*/

-- Ensure pgcrypto is available for gen_random_bytes()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.gd_identities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gd_player_id        integer NOT NULL,
  gd_player_name      text NOT NULL,
  verification_token  text NOT NULL,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verified_at         timestamptz,
  verified_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gd_identities ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- Partial unique index: one active claim per GD player ID
-- ──────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_gd_identities_active_player
  ON public.gd_identities(gd_player_id)
  WHERE verification_status IN ('pending', 'verified');

-- ──────────────────────────────────────────────
-- Trigger function: reset verification on identity data change
-- Fires on ALL UPDATEs; only resets when identity fields actually changed.
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_gd_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Always update updated_at
  NEW.updated_at := now();

  -- Only reset verification if the user changed their GD identity data
  IF NEW.gd_player_id IS DISTINCT FROM OLD.gd_player_id
     OR NEW.gd_player_name IS DISTINCT FROM OLD.gd_player_name THEN
    NEW.verification_status := 'pending';
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    -- Generate a new random token (8 chars, hex)
    NEW.verification_token := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_gd_verification ON public.gd_identities;
CREATE TRIGGER trg_reset_gd_verification
  BEFORE UPDATE ON public.gd_identities
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_gd_verification();

-- ──────────────────────────────────────────────
-- SELECT: user reads own row, admin reads all
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "user_read_own_gd_identity" ON public.gd_identities;
CREATE POLICY "user_read_own_gd_identity"
  ON public.gd_identities FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_read_all_gd_identities" ON public.gd_identities;
CREATE POLICY "admin_read_all_gd_identities"
  ON public.gd_identities FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- INSERT: user creates own identity, pending only
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "insert_own_gd_identity" ON public.gd_identities;
CREATE POLICY "insert_own_gd_identity"
  ON public.gd_identities FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND verification_status = 'pending'
  );

-- ──────────────────────────────────────────────
-- UPDATE (user scope): only while pending
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "user_update_own_gd_identity" ON public.gd_identities;
CREATE POLICY "user_update_own_gd_identity"
  ON public.gd_identities FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND verification_status = 'pending'
  );

-- ──────────────────────────────────────────────
-- UPDATE (admin scope): verification fields
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_update_gd_identity" ON public.gd_identities;
CREATE POLICY "admin_update_gd_identity"
  ON public.gd_identities FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ──────────────────────────────────────────────
-- DELETE: admin only
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_delete_gd_identity" ON public.gd_identities;
CREATE POLICY "admin_delete_gd_identity"
  ON public.gd_identities FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ──────────────────────────────────────────────
-- Column-level privileges
-- Only safe columns are granted to authenticated.
-- Admin uses service role key (server-side) for sensitive columns.
-- ──────────────────────────────────────────────
REVOKE ALL ON public.gd_identities FROM anon, authenticated;

-- Users can read their own safe columns (RLS restricts to own row)
GRANT SELECT (id, user_id, gd_player_id, gd_player_name, verification_token, verification_status, created_at, updated_at)
  ON public.gd_identities TO authenticated;

-- Users can insert only identity fields
-- verification_status defaults to 'pending', verified_at/by/notes default to NULL
GRANT INSERT (user_id, gd_player_id, gd_player_name, verification_token)
  ON public.gd_identities TO authenticated;

-- UPDATE: both user and admin columns granted to authenticated.
-- RLS distinguishes: user-scope requires auth.uid()=user_id AND status='pending';
-- admin-scope requires is_admin().
GRANT UPDATE (gd_player_id, gd_player_name, verification_token, verification_status, verified_at, verified_by, notes)
  ON public.gd_identities TO authenticated;

-- DELETE: admin only via RLS
GRANT DELETE ON public.gd_identities TO authenticated;

-- ──────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_gd_identities_user ON public.gd_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_gd_identities_status ON public.gd_identities(verification_status);
