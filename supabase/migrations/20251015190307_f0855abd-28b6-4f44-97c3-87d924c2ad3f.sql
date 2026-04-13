-- Enable realtime for session_participants table
ALTER TABLE public.session_participants REPLICA IDENTITY FULL;

-- Add to realtime publication if not already there
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'session_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;
  END IF;
END
$$;