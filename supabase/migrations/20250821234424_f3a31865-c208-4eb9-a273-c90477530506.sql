-- Create revision rooms table (if not exists)
CREATE TABLE IF NOT EXISTS public.revision_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  surah_number INTEGER NOT NULL CHECK (surah_number >= 1 AND surah_number <= 114),
  current_ayah INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create room participants table (if not exists)  
CREATE TABLE IF NOT EXISTS public.room_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.revision_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('reciter', 'checker')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Create progress table (if not exists)
CREATE TABLE IF NOT EXISTS public.progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surah_number INTEGER NOT NULL CHECK (surah_number >= 1 AND surah_number <= 114),
  ayah_number INTEGER NOT NULL CHECK (ayah_number >= 1),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'revised', 'needsReview')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, surah_number, ayah_number)
);

-- Create mistakes table (if not exists)
CREATE TABLE IF NOT EXISTS public.mistakes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reciter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surah_number INTEGER NOT NULL CHECK (surah_number >= 1 AND surah_number <= 114),
  ayah_number INTEGER NOT NULL CHECK (ayah_number >= 1),
  word_index INTEGER NOT NULL CHECK (word_index >= 0),
  room_id UUID REFERENCES public.revision_rooms(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(reciter_id, surah_number, ayah_number, word_index)
);

-- Create user profiles table (if not exists)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.revision_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mistakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view all rooms" ON public.revision_rooms;
    DROP POLICY IF EXISTS "Users can create rooms" ON public.revision_rooms;
    DROP POLICY IF EXISTS "Room creator can update room" ON public.revision_rooms;
    DROP POLICY IF EXISTS "Room creator can delete room" ON public.revision_rooms;
    
    DROP POLICY IF EXISTS "Users can view room participants" ON public.room_participants;
    DROP POLICY IF EXISTS "Users can join rooms" ON public.room_participants;
    DROP POLICY IF EXISTS "Users can update their participation" ON public.room_participants;
    DROP POLICY IF EXISTS "Users can leave rooms" ON public.room_participants;
    
    DROP POLICY IF EXISTS "Users can view their own progress" ON public.progress;
    DROP POLICY IF EXISTS "Users can insert their own progress" ON public.progress;
    DROP POLICY IF EXISTS "Users can update their own progress" ON public.progress;
    
    DROP POLICY IF EXISTS "Users can view their own mistakes" ON public.mistakes;
    DROP POLICY IF EXISTS "Users can insert their own mistakes" ON public.mistakes;
    DROP POLICY IF EXISTS "Users can update their own mistakes" ON public.mistakes;
    DROP POLICY IF EXISTS "Users can delete their own mistakes" ON public.mistakes;
    
    DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- RLS Policies for revision_rooms
CREATE POLICY "Users can view all rooms" ON public.revision_rooms FOR SELECT USING (true);
CREATE POLICY "Users can create rooms" ON public.revision_rooms FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Room creator can update room" ON public.revision_rooms FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Room creator can delete room" ON public.revision_rooms FOR DELETE USING (auth.uid() = created_by);

-- RLS Policies for room_participants
CREATE POLICY "Users can view room participants" ON public.room_participants FOR SELECT USING (true);
CREATE POLICY "Users can join rooms" ON public.room_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their participation" ON public.room_participants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can leave rooms" ON public.room_participants FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for progress
CREATE POLICY "Users can view their own progress" ON public.progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own progress" ON public.progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own progress" ON public.progress FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for mistakes
CREATE POLICY "Users can view their own mistakes" ON public.mistakes FOR SELECT USING (auth.uid() = reciter_id);
CREATE POLICY "Users can insert their own mistakes" ON public.mistakes FOR INSERT WITH CHECK (auth.uid() = reciter_id);
CREATE POLICY "Users can update their own mistakes" ON public.mistakes FOR UPDATE USING (auth.uid() = reciter_id);
CREATE POLICY "Users can delete their own mistakes" ON public.mistakes FOR DELETE USING (auth.uid() = reciter_id);

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);