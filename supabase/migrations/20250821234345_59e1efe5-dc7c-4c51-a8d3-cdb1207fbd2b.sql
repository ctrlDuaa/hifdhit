-- Create enum for revision status
CREATE TYPE revision_status AS ENUM ('pending', 'revised', 'needsReview');

-- Create enum for room roles
CREATE TYPE room_role AS ENUM ('reciter', 'checker');

-- Create revision rooms table
CREATE TABLE public.revision_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  surah_number INTEGER NOT NULL CHECK (surah_number >= 1 AND surah_number <= 114),
  current_ayah INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create room participants table
CREATE TABLE public.room_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.revision_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role room_role NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Create progress table
CREATE TABLE public.progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surah_number INTEGER NOT NULL CHECK (surah_number >= 1 AND surah_number <= 114),
  ayah_number INTEGER NOT NULL CHECK (ayah_number >= 1),
  status revision_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, surah_number, ayah_number)
);

-- Create mistakes table
CREATE TABLE public.mistakes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reciter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surah_number INTEGER NOT NULL CHECK (surah_number >= 1 AND surah_number <= 114),
  ayah_number INTEGER NOT NULL CHECK (ayah_number >= 1),
  word_index INTEGER NOT NULL CHECK (word_index >= 0),
  room_id UUID REFERENCES public.revision_rooms(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(reciter_id, surah_number, ayah_number, word_index)
);

-- Create user profiles table
CREATE TABLE public.profiles (
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

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_revision_rooms_updated_at
  BEFORE UPDATE ON public.revision_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_progress_updated_at
  BEFORE UPDATE ON public.progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for tables
ALTER TABLE public.revision_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_participants REPLICA IDENTITY FULL;
ALTER TABLE public.mistakes REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER publication supabase_realtime ADD TABLE public.revision_rooms;
ALTER publication supabase_realtime ADD TABLE public.room_participants;
ALTER publication supabase_realtime ADD TABLE public.mistakes;