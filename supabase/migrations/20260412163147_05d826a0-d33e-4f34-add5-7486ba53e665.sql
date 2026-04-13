-- Allow users to delete their own session activity
CREATE POLICY "Users can delete their own session activity"
ON public.session_activity
FOR DELETE
USING (auth.uid() = user_id);

-- Allow users to delete their own block reviews
CREATE POLICY "Users can delete own reviews"
ON public.block_reviews
FOR DELETE
USING (auth.uid() = user_id);

-- Allow users to delete their own block review mistakes
CREATE POLICY "Users can delete own review mistakes"
ON public.block_review_mistakes
FOR DELETE
USING (auth.uid() = user_id);

-- Allow users to delete their own block ayah stats
CREATE POLICY "Users can delete own ayah stats"
ON public.block_ayah_stats
FOR DELETE
USING (auth.uid() = user_id);

-- Allow users to delete their own block word stats
CREATE POLICY "Users can delete own word stats"
ON public.block_word_stats
FOR DELETE
USING (auth.uid() = user_id);

-- Add a direct reciter-based delete policy for mistakes (so reset works)
CREATE POLICY "Users can delete own mistakes as reciter"
ON public.mistakes
FOR DELETE
USING (auth.uid() = reciter_id);
