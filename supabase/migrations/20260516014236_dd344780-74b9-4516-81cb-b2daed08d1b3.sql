ALTER TABLE public.block_review_mistakes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.block_review_mistakes;