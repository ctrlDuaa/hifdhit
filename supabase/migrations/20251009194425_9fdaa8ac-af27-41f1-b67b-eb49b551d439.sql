-- Fix the infinite recursion in session_participants RLS policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view participants in their sessions" ON public.session_participants;

-- Recreate with correct logic that doesn't cause recursion
CREATE POLICY "Users can view participants in their sessions"
ON public.session_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM session_participants sp 
    WHERE sp.session_id = session_participants.session_id 
    AND sp.user_id = auth.uid()
  )
);