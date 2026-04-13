-- Add session_id and page_number columns to mistakes table
ALTER TABLE public.mistakes
ADD COLUMN session_id uuid REFERENCES public.private_sessions(id) ON DELETE CASCADE,
ADD COLUMN page_number integer;

-- Update RLS policies for mistakes to work with sessions
DROP POLICY IF EXISTS "Users can view their own mistakes" ON public.mistakes;
DROP POLICY IF EXISTS "Users can insert their own mistakes" ON public.mistakes;
DROP POLICY IF EXISTS "Users can update their own mistakes" ON public.mistakes;
DROP POLICY IF EXISTS "Users can delete their own mistakes" ON public.mistakes;

-- New policies that work with both room_id and session_id
CREATE POLICY "Users can view mistakes in their sessions or rooms"
ON public.mistakes
FOR SELECT
USING (
  auth.uid() = reciter_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = mistakes.session_id
    AND sp.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.room_participants rp
    WHERE rp.room_id = mistakes.room_id
    AND rp.user_id = auth.uid()
  )
);

CREATE POLICY "Session participants can insert mistakes"
ON public.mistakes
FOR INSERT
WITH CHECK (
  auth.uid() = reciter_id
  OR
  EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = mistakes.session_id
    AND sp.user_id = auth.uid()
  )
);

CREATE POLICY "Session participants can update mistakes"
ON public.mistakes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = mistakes.session_id
    AND sp.user_id = auth.uid()
  )
);

CREATE POLICY "Session participants can delete mistakes"
ON public.mistakes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = mistakes.session_id
    AND sp.user_id = auth.uid()
  )
);