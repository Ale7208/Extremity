/*
# Add server-side admin verification function

## Purpose
The existing is_admin() function reads app_metadata.role from the JWT via auth.jwt().
However, the middleware and server components call supabase.auth.getUser() which
returns the user object with app_metadata populated from raw_app_meta_data.
The problem is that raw_app_meta_data does not have a 'role' key set for any user,
so the admin check always returns false.

This migration:
1. Creates a SECURITY DEFINER function `check_is_admin(p_user_id uuid)` that reads
   raw_app_meta_data directly from auth.users — a table only the service role can access.
2. Grants EXECUTE to authenticated so server-side code with a user session can call it.
3. Sets the existing user (jeffersongomez016@gmail.com) as admin by adding role='admin'
   to their raw_app_meta_data.

## Security
- The function is SECURITY DEFINER, owned by the postgres user, so it can read auth.users.
- It only reads and returns a boolean — no data leakage.
- EXECUTE is granted to authenticated only (not anon).
- The search_path is locked to 'public' to prevent path injection.
*/

-- Create a function that checks if a user is admin by reading auth.users directly
CREATE OR REPLACE FUNCTION public.check_is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (raw_app_meta_data ->> 'role') = 'admin',
    false
  )
  FROM auth.users
  WHERE id = p_user_id;
$$;

-- Only authenticated users can call this function
REVOKE EXECUTE ON FUNCTION public.check_is_admin(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_admin(uuid) TO authenticated;

-- Set the existing user as admin
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'::jsonb
)
WHERE email = 'jeffersongomez016@gmail.com';
