-- Add column to track if user has ever been a reciter in this session
ALTER TABLE public.session_participants 
ADD COLUMN has_been_reciter BOOLEAN DEFAULT FALSE;

-- Update existing reciter participants to mark them as having been reciters
UPDATE public.session_participants 
SET has_been_reciter = TRUE 
WHERE role = 'reciter';

-- Create trigger to automatically set has_been_reciter when role changes to reciter
CREATE OR REPLACE FUNCTION public.track_reciter_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.role = 'reciter' THEN
    NEW.has_been_reciter = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER track_reciter_on_role_change
  BEFORE INSERT OR UPDATE OF role ON public.session_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.track_reciter_role();