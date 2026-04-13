-- Fix security definer view - change v_mushaf_page to use security invoker
-- This ensures the view respects RLS policies of the querying user
ALTER VIEW public.v_mushaf_page SET (security_invoker = on);