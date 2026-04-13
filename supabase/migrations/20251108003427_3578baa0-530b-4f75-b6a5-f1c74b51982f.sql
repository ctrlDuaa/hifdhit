-- Add timezone field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN timezone TEXT DEFAULT 'UTC';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.timezone IS 'User timezone in IANA format (e.g., America/New_York, Europe/London)';

-- Add country field for reference
ALTER TABLE public.profiles 
ADD COLUMN country TEXT;