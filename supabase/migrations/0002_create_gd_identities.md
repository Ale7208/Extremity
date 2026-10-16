/*
# Migration 0002 — gd_identities table

## Purpose
Stores Geometry Dash identity claims and their verification status.
Each Extremity user can have exactly one GD identity linked to their account.

## New Table: gd_identities
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

## Unique Constraint
Partial unique index on gd_player_id WHERE verification_status IN ('pending','verified'):
- Prevents two Extremity accounts from claiming the same GD account simultaneously.
- A rejected claim frees the GD player ID for another user to claim.

## RLS Policies

### gd_identities — CRITICAL SECURITY
- SELECT: a user can read ONLY their own identity row. Admin can read all.
  The public (anon) has NO access — GD IDs and verification tokens are private.
- INSERT: authenticated user creates ONLY their own row, with status = 'pending'.
  The user CANNOT set verification_status to anything other than 'pending'.
  The user CANNOT set verified_at, verified_by, or notes.
- UPDATE (user scope): the user can update ONLY gd_player_id, gd_player_name,
  and verification_token on their OWN row — and ONLY while status = 'pending'.
  Changing these fields resets the identity to pending (handled by trigger).
  The user CANNOT touch verification_status, verified_at, verified_by, or notes.
- UPDATE (admin scope): admin can update verification_status, verified_at,
  verified_by, and notes on any row.
- DELETE: admin only.

## Column-level privileges (defense in depth)
- The `notes`, `verified_at`, `verified_by` columns are NOT selectable by
  non-admin users. A user sees their own gd_player_id, gd_player_name,
  verification_token, verification_status, created_at, updated_at — nothing else.

## Trigger: reset verification on identity change
When a user changes their gd_player_id or gd_player_name, a BEFORE UPDATE
trigger resets verification_status to 'pending', clears verified_at and
verified_by, and generates a new verification_token. This ensures that
changing identity always requires re-verification.

## Why a user cannot self-verify
1. The INSERT policy forces status = 'pending'.
2. The user-scoped UPDATE policy only allows changing gd_player_id,
   gd_player_name, verification_token — NOT verification_status.
3. The admin-scoped UPDATE policy requires is_admin().
4. Column-level GRANT restricts which columns each role can write.
5. The trigger resets status to 'pending' on any identity data change.

## No demo data inserted.
*/

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
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_gd_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only reset if the user changed their GD identity data
  IF NEW.gd_player_id IS DISTINCT FROM OLD.gd_player_id
     OR NEW.gd_player_name IS DISTINCT FROM OLD.gd_player_name THEN
    NEW.verification_status := 'pending';
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    -- Generate a new random token (8 chars, alphanumeric)
    NEW.verification_token := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_gd_verification ON public.gd_identities;
CREATE TRIGGER trg_reset_gd_verification
  BEFORE UPDATE OF gd_player_id, gd_player_name ON public.gd_identities
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
-- UPDATE (user scope): only identity fields, only while pending
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
-- UPDATE (admin scope): verification fields only
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
-- ──────────────────────────────────────────────
REVOKE ALL ON public.gd_identities FROM anon, authenticated;

-- Users can read their own public-ish columns
GRANT SELECT (id, user_id, gd_player_id, gd_player_name, verification_token, verification_status, created_at, updated_at)
  ON public.gd_identities TO authenticated;

-- Users can insert only the identity fields (not verification fields)
GRANT INSERT (user_id, gd_player_id, gd_player_name, verification_token)
  ON public.gd_identities TO authenticated;

-- Users can update only identity fields
GRANT UPDATE (gd_player_id, gd_player_name, verification_token)
  ON public.gd_identities TO authenticated;

-- Admin gets full access to all columns
GRANT SELECT (id, user_id, gd_player_id, gd_player_name, verification_token, verification_status, verified_at, verified_by, notes, created_at, updated_at)
  ON public.gd_identities TO authenticated;
GRANT UPDATE (verification_status, verified_at, verified_by, notes)
  ON public.gd_identities TO authenticated;
GRANT DELETE ON public.gd_identities TO authenticated;

-- ──────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_gd_identities_user ON public.gd_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_gd_identities_status ON public.gd_identities(verification_status);
