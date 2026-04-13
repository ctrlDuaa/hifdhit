-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Users can update their participation" ON public.session_participants;

-- Create new UPDATE policy that allows session creators to update all participants in their sessions
CREATE POLICY "Users can update their own participation or creator can update all"
ON public.session_participants
FOR UPDATE
USING (
  -- Users can update their own participation
  auth.uid() = user_id
  OR
  -- Session creator can update any participant in their session
  (EXISTS (
    SELECT 1 FROM private_sessions ps
    WHERE ps.id = session_participants.session_id
    AND ps.created_by = auth.uid()
  ))
);