-- Enable realtime for private_sessions table
ALTER TABLE public.private_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_sessions;

-- Enable realtime for progress table
ALTER TABLE public.progress REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.progress;