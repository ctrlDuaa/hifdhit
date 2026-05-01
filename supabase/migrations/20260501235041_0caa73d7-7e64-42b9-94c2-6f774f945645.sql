
CREATE TABLE public.quran_chapters_cache (
  chapter_number INTEGER PRIMARY KEY, name_arabic TEXT NOT NULL, name_english TEXT NOT NULL, name_simple TEXT NOT NULL,
  revelation_place TEXT, verses_count INTEGER NOT NULL DEFAULT 0, pages JSONB, chapter_data JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quran_chapters_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read chapters" ON public.quran_chapters_cache FOR SELECT USING (true);
CREATE POLICY "auth insert chapters" ON public.quran_chapters_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update chapters" ON public.quran_chapters_cache FOR UPDATE TO authenticated USING (true);

CREATE TABLE public.quran_verses_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), chapter_number INTEGER NOT NULL, verse_number INTEGER NOT NULL,
  verse_key TEXT NOT NULL, text_uthmani TEXT NOT NULL, words JSONB,
  translation_id INTEGER NOT NULL DEFAULT 131, translation_text TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (verse_key, translation_id)
);
CREATE INDEX idx_verses_cache_chapter ON public.quran_verses_cache(chapter_number);
CREATE INDEX idx_verses_cache_key ON public.quran_verses_cache(verse_key);
ALTER TABLE public.quran_verses_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read verses" ON public.quran_verses_cache FOR SELECT USING (true);
CREATE POLICY "auth insert verses" ON public.quran_verses_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update verses" ON public.quran_verses_cache FOR UPDATE TO authenticated USING (true);

CREATE TABLE public.quran_tafsir_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), verse_key TEXT NOT NULL, tafsir_id INTEGER NOT NULL DEFAULT 169,
  tafsir_text TEXT, tafsir_data JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (verse_key, tafsir_id)
);
CREATE INDEX idx_tafsir_cache_key ON public.quran_tafsir_cache(verse_key);
ALTER TABLE public.quran_tafsir_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read tafsir" ON public.quran_tafsir_cache FOR SELECT USING (true);
CREATE POLICY "auth insert tafsir" ON public.quran_tafsir_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update tafsir" ON public.quran_tafsir_cache FOR UPDATE TO authenticated USING (true);

CREATE TABLE public.quran_audio_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), chapter_number INTEGER NOT NULL, verse_key TEXT,
  reciter_id INTEGER NOT NULL DEFAULT 7, audio_url TEXT NOT NULL, audio_data JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (verse_key, reciter_id)
);
CREATE INDEX idx_audio_cache_key ON public.quran_audio_cache(verse_key);
ALTER TABLE public.quran_audio_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read audio" ON public.quran_audio_cache FOR SELECT USING (true);
CREATE POLICY "auth insert audio" ON public.quran_audio_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update audio" ON public.quran_audio_cache FOR UPDATE TO authenticated USING (true);

-- Memorization blocks
CREATE TABLE public.memorization_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, surah_id integer NOT NULL,
  start_ayah integer NOT NULL, end_ayah integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz, next_review_at timestamptz,
  total_reviews integer NOT NULL DEFAULT 0, successful_reviews integer NOT NULL DEFAULT 0,
  perfect_reviews integer NOT NULL DEFAULT 0, current_streak integer NOT NULL DEFAULT 0,
  interval_days integer NOT NULL DEFAULT 1, ease_factor numeric(4,2) NOT NULL DEFAULT 1.0,
  strength_score integer NOT NULL DEFAULT 40, priority_level text NOT NULL DEFAULT 'normal',
  overdue_count integer NOT NULL DEFAULT 0, last_session_rating text,
  total_mistakes integer NOT NULL DEFAULT 0, recent_mistakes_7d integer NOT NULL DEFAULT 0,
  repeated_problem_words_count integer NOT NULL DEFAULT 0, needs_focus_review boolean NOT NULL DEFAULT false,
  mastery_status text NOT NULL DEFAULT 'new', recent_ratings jsonb NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE public.memorization_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mb view" ON public.memorization_blocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mb insert" ON public.memorization_blocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mb update" ON public.memorization_blocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "mb delete" ON public.memorization_blocks FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_memorization_blocks_user ON public.memorization_blocks(user_id);
CREATE INDEX idx_memorization_blocks_next_review ON public.memorization_blocks(user_id, next_review_at);
CREATE INDEX idx_memorization_blocks_surah ON public.memorization_blocks(user_id, surah_id);
CREATE TRIGGER update_memorization_blocks_updated_at BEFORE UPDATE ON public.memorization_blocks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Block reviews
CREATE TABLE public.block_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  block_id uuid NOT NULL REFERENCES public.memorization_blocks(id) ON DELETE CASCADE,
  session_rating text NOT NULL, block_mistake_score integer NOT NULL DEFAULT 0,
  normalized_mistake_score numeric(5,3) NOT NULL DEFAULT 0, total_words_in_block integer NOT NULL DEFAULT 0,
  mistake_count_incorrect integer NOT NULL DEFAULT 0, mistake_count_missed integer NOT NULL DEFAULT 0,
  mistake_count_tajweed integer NOT NULL DEFAULT 0, mistake_count_forgot integer NOT NULL DEFAULT 0,
  repeated_problem_words_count integer NOT NULL DEFAULT 0,
  strength_before integer NOT NULL DEFAULT 0, strength_after integer NOT NULL DEFAULT 0,
  interval_before integer NOT NULL DEFAULT 0, interval_after integer NOT NULL DEFAULT 0,
  ease_before numeric(4,2) NOT NULL DEFAULT 1.0, ease_after numeric(4,2) NOT NULL DEFAULT 1.0,
  entered_focus_review boolean NOT NULL DEFAULT false, override_applied text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.block_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "br view" ON public.block_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "br insert" ON public.block_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "br delete" ON public.block_reviews FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_block_reviews_block ON public.block_reviews(block_id);
CREATE INDEX idx_block_reviews_user ON public.block_reviews(user_id, created_at DESC);

-- Block review mistakes
CREATE TABLE public.block_review_mistakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  block_id uuid NOT NULL REFERENCES public.memorization_blocks(id) ON DELETE CASCADE,
  review_id uuid NOT NULL REFERENCES public.block_reviews(id) ON DELETE CASCADE,
  surah_id integer NOT NULL, ayah_number integer NOT NULL, word_index integer NOT NULL,
  word_text text NOT NULL DEFAULT '', mistake_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.block_review_mistakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brm view" ON public.block_review_mistakes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "brm insert" ON public.block_review_mistakes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "brm delete" ON public.block_review_mistakes FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_block_review_mistakes_review ON public.block_review_mistakes(review_id);
CREATE INDEX idx_block_review_mistakes_block ON public.block_review_mistakes(block_id);
CREATE INDEX idx_block_review_mistakes_word ON public.block_review_mistakes(block_id, ayah_number, word_index);

-- Block ayah stats
CREATE TABLE public.block_ayah_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  block_id uuid NOT NULL REFERENCES public.memorization_blocks(id) ON DELETE CASCADE,
  ayah_number integer NOT NULL, total_reviews integer NOT NULL DEFAULT 0,
  total_mistakes integer NOT NULL DEFAULT 0, last_reviewed_at timestamptz,
  strength_score integer NOT NULL DEFAULT 40, updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(block_id, ayah_number)
);
ALTER TABLE public.block_ayah_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bas view" ON public.block_ayah_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bas insert" ON public.block_ayah_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bas update" ON public.block_ayah_stats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "bas delete" ON public.block_ayah_stats FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_block_ayah_stats_block ON public.block_ayah_stats(block_id);
CREATE TRIGGER update_block_ayah_stats_updated_at BEFORE UPDATE ON public.block_ayah_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Block word stats
CREATE TABLE public.block_word_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  block_id uuid NOT NULL REFERENCES public.memorization_blocks(id) ON DELETE CASCADE,
  ayah_number integer NOT NULL, word_index integer NOT NULL,
  word_text text NOT NULL DEFAULT '',
  total_incorrect_count integer NOT NULL DEFAULT 0, total_missed_count integer NOT NULL DEFAULT 0,
  total_tajweed_count integer NOT NULL DEFAULT 0, total_forgot_count integer NOT NULL DEFAULT 0,
  last_mistake_at timestamptz, recent_mistake_count_7d integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(block_id, ayah_number, word_index)
);
ALTER TABLE public.block_word_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bws view" ON public.block_word_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bws insert" ON public.block_word_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bws update" ON public.block_word_stats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "bws delete" ON public.block_word_stats FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_block_word_stats_block ON public.block_word_stats(block_id);
CREATE TRIGGER update_block_word_stats_updated_at BEFORE UPDATE ON public.block_word_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- LOCAL BOOKMARKS (new feature)
CREATE TABLE public.local_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.local_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lc all" ON public.local_collections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.local_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  collection_id uuid REFERENCES public.local_collections(id) ON DELETE CASCADE NOT NULL,
  surah_id integer NOT NULL, ayah_number integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (collection_id, surah_id, ayah_number)
);
ALTER TABLE public.local_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lb all" ON public.local_bookmarks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
