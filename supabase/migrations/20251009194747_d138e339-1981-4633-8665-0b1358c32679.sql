-- Fix infinite recursion by simplifying RLS policies
-- Drop all existing policies first
DROP POLICY IF EXISTS "Users can view participants in their sessions" ON public.session_participants;
DROP POLICY IF EXISTS "Users can view their sessions" ON public.private_sessions;
DROP POLICY IF EXISTS "Session participants can update sessions" ON public.private_sessions;

-- For session_participants: Allow SELECT for all authenticated users
CREATE POLICY "Authenticated users can view all session participants"
ON public.session_participants
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- For private_sessions: Allow SELECT for all authenticated users
CREATE POLICY "Authenticated users can view active sessions"
ON public.private_sessions
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

-- For private_sessions UPDATE: Only participants can update
CREATE POLICY "Participants can update their sessions"
ON public.private_sessions
FOR UPDATE
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1
    FROM session_participants sp
    WHERE sp.session_id = private_sessions.id
    AND sp.user_id = auth.uid()
  )
);

-- Drop the security definer function as it's no longer needed
DROP FUNCTION IF EXISTS public.user_in_session(uuid, uuid);