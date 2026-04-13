-- Add unique constraint to prevent duplicate progress entries
ALTER TABLE progress 
ADD CONSTRAINT progress_user_surah_ayah_unique 
UNIQUE (user_id, surah_number, ayah_number);