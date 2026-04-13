-- Drop the existing restrictive delete policy
DROP POLICY IF EXISTS "Session participants can delete mistakes" ON mistakes;

-- Create a new policy that allows deleting mistakes if:
-- 1. User is a participant in the session the mistake belongs to, OR
-- 2. User is a participant in any session and is deleting a mistake for a reciter they're in a session with
CREATE POLICY "Session participants can delete mistakes in their sessions"
ON mistakes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM session_participants sp
    WHERE sp.session_id = mistakes.session_id 
    AND sp.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM session_participants sp
    WHERE sp.user_id = auth.uid()
    AND mistakes.reciter_id IN (
      SELECT user_id FROM session_participants
      WHERE session_id = sp.session_id
    )
  )
);