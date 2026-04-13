-- Create table for storing user's surah memorization confidence ratings
CREATE TABLE IF NOT EXISTS public.surah_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  surah_number INTEGER NOT NULL CHECK (surah_number >= 1 AND surah_number <= 114),
  rating TEXT NOT NULL CHECK (rating IN ('weak', 'moderate', 'strong')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, surah_number)
);

-- Enable Row Level Security
ALTER TABLE public.surah_ratings ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own ratings" 
ON public.surah_ratings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ratings" 
ON public.surah_ratings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" 
ON public.surah_ratings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ratings" 
ON public.surah_ratings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_surah_ratings_updated_at
BEFORE UPDATE ON public.surah_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_surah_ratings_user_id ON public.surah_ratings(user_id);
CREATE INDEX idx_surah_ratings_surah_number ON public.surah_ratings(surah_number);