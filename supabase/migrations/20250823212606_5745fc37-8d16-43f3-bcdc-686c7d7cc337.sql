-- Add username to profiles table and make it unique
ALTER TABLE public.profiles 
ADD COLUMN username TEXT UNIQUE;

-- Create index for username lookups
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- Create invites table for revision invites
CREATE TABLE public.revision_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surah_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- Enable RLS on invites table
ALTER TABLE public.revision_invites ENABLE ROW LEVEL SECURITY;

-- RLS policies for invites
CREATE POLICY "Users can view invites sent to them or by them" 
ON public.revision_invites 
FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can create invites" 
ON public.revision_invites 
FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients can update invites" 
ON public.revision_invites 
FOR UPDATE 
USING (auth.uid() = recipient_id);

-- Create private_sessions table to replace revision_rooms
CREATE TABLE public.private_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_id UUID NOT NULL REFERENCES public.revision_invites(id) ON DELETE CASCADE,
  surah_number INTEGER NOT NULL,
  current_ayah INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on private_sessions
ALTER TABLE public.private_sessions ENABLE ROW LEVEL SECURITY;

-- Create session_participants table
CREATE TABLE public.session_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.private_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('reciter', 'checker')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- Enable RLS on session_participants
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

-- RLS policies for private_sessions
CREATE POLICY "Users can view their sessions" 
ON public.private_sessions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = id AND sp.user_id = auth.uid()
  )
);

CREATE POLICY "Session participants can update sessions" 
ON public.private_sessions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = id AND sp.user_id = auth.uid()
  )
);

-- RLS policies for session_participants
CREATE POLICY "Users can view participants in their sessions" 
ON public.session_participants 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.session_participants sp2
    WHERE sp2.session_id = session_id AND sp2.user_id = auth.uid()
  )
);

CREATE POLICY "Users can join sessions" 
ON public.session_participants 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their participation" 
ON public.session_participants 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can leave sessions" 
ON public.session_participants 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add updated_at trigger for invites
CREATE TRIGGER update_revision_invites_updated_at
BEFORE UPDATE ON public.revision_invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for private_sessions
CREATE TRIGGER update_private_sessions_updated_at
BEFORE UPDATE ON public.private_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-expire invites
CREATE OR REPLACE FUNCTION public.expire_old_invites()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.revision_invites 
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending' AND expires_at < now();
END;
$$;