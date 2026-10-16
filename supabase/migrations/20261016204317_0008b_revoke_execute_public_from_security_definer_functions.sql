-- Revoke EXECUTE on SECURITY DEFINER functions from PUBLIC (covers anon + authenticated inheritance).
-- These functions are only called internally by RLS policies and triggers, never via REST API.

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.promote_level_proposal() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_gd_verification() FROM PUBLIC;