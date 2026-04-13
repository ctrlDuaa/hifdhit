-- Enable full replica identity for session_participants table to ensure real-time updates work properly
ALTER TABLE public.session_participants REPLICA IDENTITY FULL;