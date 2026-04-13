-- Fix search path for the expire_old_invites function
CREATE OR REPLACE FUNCTION public.expire_old_invites()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.revision_invites 
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending' AND expires_at < now();
END;
$$;