-- Add ending ayah field to private_sessions table
ALTER TABLE public.private_sessions 
ADD COLUMN ending_ayah integer;

-- Update existing sessions to have ending_ayah same as current_ayah
UPDATE public.private_sessions 
SET ending_ayah = current_ayah 
WHERE ending_ayah IS NULL;