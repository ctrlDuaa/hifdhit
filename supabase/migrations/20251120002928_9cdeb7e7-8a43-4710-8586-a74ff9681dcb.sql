-- Enable full replica identity on mistakes table to get complete row data in DELETE events
ALTER TABLE mistakes REPLICA IDENTITY FULL;

-- Add the table to the realtime publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'mistakes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mistakes;
  END IF;
END $$;