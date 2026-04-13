-- Add DELETE policy for progress table to allow users to delete their own progress
CREATE POLICY "Users can delete their own progress"
ON public.progress
FOR DELETE
USING (auth.uid() = user_id);

-- Add DELETE policy for private_sessions table to allow creators to delete their sessions
CREATE POLICY "Session creators can delete their sessions"
ON public.private_sessions
FOR DELETE
USING (auth.uid() = created_by);