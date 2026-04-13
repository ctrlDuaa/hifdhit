-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view mistakes in their sessions or rooms" ON public.mistakes;

-- Create new SELECT policy that allows viewing mistakes for reciters in your current sessions
CREATE POLICY "Users can view mistakes in their sessions or for shared reciters"
ON public.mistakes
FOR SELECT
USING (
  -- Can see mistakes from sessions you're in
  (EXISTS (
    SELECT 1 FROM session_participants sp
    WHERE sp.session_id = mistakes.session_id 
    AND sp.user_id = auth.uid()
  ))
  OR
  -- Can see mistakes from rooms you're in
  (EXISTS (
    SELECT 1 FROM room_participants rp
    WHERE rp.room_id = mistakes.room_id 
    AND rp.user_id = auth.uid()
  ))
  OR
  -- Can see ALL mistakes for a reciter if you're in ANY session with them
  (EXISTS (
    SELECT 1 FROM session_participants sp
    WHERE sp.user_id = mistakes.reciter_id
    AND sp.session_id IN (
      SELECT session_id FROM session_participants
      WHERE user_id = auth.uid()
    )
  ))
  OR
  -- Can see your own mistakes
  auth.uid() = reciter_id
);