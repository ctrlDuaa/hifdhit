-- Add session_ranges column to private_sessions to support multiple surah/ayah ranges
ALTER TABLE public.private_sessions 
ADD COLUMN IF NOT EXISTS session_ranges JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.private_sessions.session_ranges IS 'Array of {surah_number, starting_ayah, ending_ayah} objects for multi-surah sessions';