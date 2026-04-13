-- Create a security definer function to check if user is in a session
CREATE OR REPLACE FUNCTION public.user_in_session(_session_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM session_participants
    WHERE session_id = _session_id
    AND user_id = _user_id
  )
$$;

-- Drop and recreate the problematic policies
DROP POLICY IF EXISTS "Users can view participants in their sessions" ON public.session_participants;

CREATE POLICY "Users can view participants in their sessions"
ON public.session_participants
FOR SELECT
USING (public.user_in_session(session_id, auth.uid()));

-- Also fix the sessions view policy
DROP POLICY IF EXISTS "Users can view their sessions" ON public.private_sessions;

CREATE POLICY "Users can view their sessions"
ON public.private_sessions
FOR SELECT
USING (public.user_in_session(id, auth.uid()));