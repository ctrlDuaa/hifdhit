-- Add created_by column to private_sessions to track session creator
ALTER TABLE public.private_sessions 
ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Set created_by for existing sessions based on first participant who joined
UPDATE public.private_sessions ps
SET created_by = (
  SELECT sp.user_id 
  FROM session_participants sp 
  WHERE sp.session_id = ps.id 
  ORDER BY sp.joined_at ASC 
  LIMIT 1
)
WHERE created_by IS NULL;