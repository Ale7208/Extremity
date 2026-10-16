-- Post-migration fix: revoke EXECUTE on SECURITY DEFINER functions from anon and authenticated.
-- These functions are only used internally (RLS policies and triggers), never called via REST API.

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_level_proposal() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_gd_verification() FROM anon, authenticated;