-- Add starting_ayah column to track the initial starting position
ALTER TABLE private_sessions 
ADD COLUMN starting_ayah integer NOT NULL DEFAULT 1;

-- Update existing sessions to set starting_ayah equal to current_ayah
UPDATE private_sessions 
SET starting_ayah = current_ayah 
WHERE starting_ayah = 1;