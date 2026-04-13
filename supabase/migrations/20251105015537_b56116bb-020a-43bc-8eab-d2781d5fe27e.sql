-- Create session_activity table to track each participant's session activity
CREATE TABLE IF NOT EXISTS public.session_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL,
  surah_number INTEGER NOT NULL,
  starting_ayah INTEGER NOT NULL,
  ending_ayah INTEGER NOT NULL,
  ayat_revised INTEGER NOT NULL DEFAULT 0,
  mistake_count INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.session_activity ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own activity
CREATE POLICY "Users can insert their own session activity"
ON public.session_activity
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own activity
CREATE POLICY "Users can view their own session activity"
ON public.session_activity
FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to update their own activity
CREATE POLICY "Users can update their own session activity"
ON public.session_activity
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_session_activity_user_id ON public.session_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_session_activity_completed_at ON public.session_activity(completed_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_session_activity_updated_at
BEFORE UPDATE ON public.session_activity
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();