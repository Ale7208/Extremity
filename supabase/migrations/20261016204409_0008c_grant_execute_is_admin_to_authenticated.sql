-- Grant EXECUTE on is_admin() back to authenticated only.
-- is_admin() is called inside RLS policies (USING/WITH CHECK), so authenticated users
-- need EXECUTE permission for policies to evaluate. anon does NOT need it — no anon
-- policy references is_admin().
-- promote_level_proposal() and reset_gd_verification() remain revoked from PUBLIC
-- because they are trigger functions, never called directly by users.

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;