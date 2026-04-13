-- Drop the existing restrictive update policy
DROP POLICY IF EXISTS "Session participants can update mistakes" ON mistakes;

-- Create a new policy that allows updating mistakes if:
-- 1. User is a participant in the session the mistake belongs to, OR
-- 2. User is a participant in any session and is updating a mistake for a reciter they're in a session with
CREATE POLICY "Session participants can update mistakes in their sessions"
ON mistakes
FOR UPDATE
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