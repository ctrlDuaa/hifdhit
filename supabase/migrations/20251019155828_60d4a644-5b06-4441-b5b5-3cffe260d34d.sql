-- Add mistake_category column to mistakes table
ALTER TABLE public.mistakes 
ADD COLUMN IF NOT EXISTS mistake_category text CHECK (mistake_category IN ('tajweed', 'missed', 'harakah'));

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_mistakes_category ON public.mistakes(mistake_category);