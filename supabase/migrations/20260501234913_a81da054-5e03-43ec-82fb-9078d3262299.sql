
CREATE TABLE public.private_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  surah_number INTEGER NOT NULL, current_ayah INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_code TEXT UNIQUE, session_name TEXT NOT NULL DEFAULT 'Revision Session',
  current_page INTEGER DEFAULT 1,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '1 hour'),
  created_by UUID REFERENCES auth.users(id), ending_ayah INTEGER,
  starting_ayah INTEGER NOT NULL DEFAULT 1,
  session_ranges JSONB DEFAULT '[]'::jsonb
);
ALTER TABLE public.private_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_session_code ON private_sessions(session_code);
CREATE TRIGGER update_private_sessions_updated_at BEFORE UPDATE ON public.private_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.session_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.private_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('reciter', 'checker')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  has_been_reciter BOOLEAN DEFAULT FALSE,
  UNIQUE(session_id, user_id)
);
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view sessions" ON public.private_sessions FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
CREATE POLICY "create sessions" ON public.private_sessions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "update sessions" ON public.private_sessions FOR UPDATE USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM session_participants sp WHERE sp.session_id = private_sessions.id AND sp.user_id = auth.uid()));
CREATE POLICY "delete sessions" ON public.private_sessions FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "view participants" ON public.session_participants FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "join sessions" ON public.session_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update participation" ON public.session_participants FOR UPDATE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM private_sessions ps WHERE ps.id = session_participants.session_id AND ps.created_by = auth.uid()));
CREATE POLICY "leave sessions" ON public.session_participants FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION generate_session_code() RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE code TEXT; ec INTEGER;
BEGIN LOOP code := upper(substring(md5(random()::text) from 1 for 5)); SELECT COUNT(*) INTO ec FROM private_sessions WHERE session_code = code; IF ec = 0 THEN RETURN code; END IF; END LOOP; END; $$;
CREATE OR REPLACE FUNCTION set_session_code() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.session_code IS NULL THEN NEW.session_code := generate_session_code(); END IF; RETURN NEW; END; $$;
CREATE TRIGGER set_session_code_trigger BEFORE INSERT ON private_sessions FOR EACH ROW EXECUTE FUNCTION set_session_code();
CREATE OR REPLACE FUNCTION public.track_reciter_role() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN IF NEW.role = 'reciter' THEN NEW.has_been_reciter = TRUE; END IF; RETURN NEW; END; $$;
CREATE TRIGGER track_reciter_on_role_change BEFORE INSERT OR UPDATE OF role ON public.session_participants FOR EACH ROW EXECUTE FUNCTION public.track_reciter_role();

CREATE TABLE public.mistakes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reciter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surah_number INTEGER NOT NULL, ayah_number INTEGER NOT NULL, word_index INTEGER NOT NULL,
  room_id UUID REFERENCES public.revision_rooms(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id UUID REFERENCES public.private_sessions(id) ON DELETE CASCADE,
  page_number INTEGER,
  mistake_category TEXT CHECK (mistake_category IN ('incorrect', 'missed', 'tajweed', 'harakah')),
  note TEXT,
  UNIQUE(reciter_id, surah_number, ayah_number, word_index)
);
ALTER TABLE public.mistakes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_mistakes_category ON public.mistakes(mistake_category);
CREATE POLICY "view mistakes" ON public.mistakes FOR SELECT USING (auth.uid() = reciter_id OR EXISTS (SELECT 1 FROM session_participants sp WHERE sp.session_id = mistakes.session_id AND sp.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM room_participants rp WHERE rp.room_id = mistakes.room_id AND rp.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM session_participants sp WHERE sp.user_id = mistakes.reciter_id AND sp.session_id IN (SELECT session_id FROM session_participants WHERE user_id = auth.uid())));
CREATE POLICY "insert mistakes" ON public.mistakes FOR INSERT WITH CHECK (auth.uid() = reciter_id OR EXISTS (SELECT 1 FROM session_participants sp WHERE sp.session_id = mistakes.session_id AND sp.user_id = auth.uid()));
CREATE POLICY "update mistakes" ON public.mistakes FOR UPDATE USING (EXISTS (SELECT 1 FROM session_participants sp WHERE sp.session_id = mistakes.session_id AND sp.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM session_participants sp WHERE sp.user_id = auth.uid() AND mistakes.reciter_id IN (SELECT user_id FROM session_participants WHERE session_id = sp.session_id)));
CREATE POLICY "delete mistakes session" ON public.mistakes FOR DELETE USING (EXISTS (SELECT 1 FROM session_participants sp WHERE sp.session_id = mistakes.session_id AND sp.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM session_participants sp WHERE sp.user_id = auth.uid() AND mistakes.reciter_id IN (SELECT user_id FROM session_participants WHERE session_id = sp.session_id)));
CREATE POLICY "delete own mistakes" ON public.mistakes FOR DELETE USING (auth.uid() = reciter_id);

CREATE TABLE public.session_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, session_id UUID NOT NULL,
  surah_number INTEGER NOT NULL, starting_ayah INTEGER NOT NULL, ending_ayah INTEGER NOT NULL,
  ayat_revised INTEGER NOT NULL DEFAULT 0, mistake_count INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL, started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.session_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa insert" ON public.session_activity FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sa view" ON public.session_activity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sa update" ON public.session_activity FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "sa delete" ON public.session_activity FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_session_activity_user_id ON public.session_activity(user_id);
CREATE INDEX idx_session_activity_completed_at ON public.session_activity(completed_at DESC);
CREATE TRIGGER update_session_activity_updated_at BEFORE UPDATE ON public.session_activity FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.surah_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, surah_number INTEGER NOT NULL CHECK (surah_number >= 1 AND surah_number <= 114),
  rating TEXT NOT NULL CHECK (rating IN ('weak', 'moderate', 'strong')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, surah_number)
);
ALTER TABLE public.surah_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr view" ON public.surah_ratings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sr insert" ON public.surah_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sr update" ON public.surah_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "sr delete" ON public.surah_ratings FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_surah_ratings_user_id ON public.surah_ratings(user_id);
CREATE TRIGGER update_surah_ratings_updated_at BEFORE UPDATE ON public.surah_ratings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.feature_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_text TEXT NOT NULL, user_email TEXT, user_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fr insert" ON public.feature_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "fr view" ON public.feature_requests FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "fr update" ON public.feature_requests FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_feature_requests_updated_at BEFORE UPDATE ON public.feature_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.revision_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_participants REPLICA IDENTITY FULL;
ALTER TABLE public.mistakes REPLICA IDENTITY FULL;
ALTER TABLE public.private_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.session_participants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.revision_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mistakes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;
