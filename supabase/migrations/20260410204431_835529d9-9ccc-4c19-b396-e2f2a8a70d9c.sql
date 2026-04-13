
-- Memorization blocks: the main scheduling unit
CREATE TABLE public.memorization_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  surah_id integer NOT NULL,
  start_ayah integer NOT NULL,
  end_ayah integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  total_reviews integer NOT NULL DEFAULT 0,
  successful_reviews integer NOT NULL DEFAULT 0,
  perfect_reviews integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  interval_days integer NOT NULL DEFAULT 1,
  ease_factor numeric(4,2) NOT NULL DEFAULT 1.0,
  strength_score integer NOT NULL DEFAULT 40,
  priority_level text NOT NULL DEFAULT 'normal',
  overdue_count integer NOT NULL DEFAULT 0,
  last_session_rating text,
  total_mistakes integer NOT NULL DEFAULT 0,
  recent_mistakes_7d integer NOT NULL DEFAULT 0,
  repeated_problem_words_count integer NOT NULL DEFAULT 0,
  needs_focus_review boolean NOT NULL DEFAULT false,
  mastery_status text NOT NULL DEFAULT 'new',
  recent_ratings jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.memorization_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blocks" ON public.memorization_blocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own blocks" ON public.memorization_blocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own blocks" ON public.memorization_blocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own blocks" ON public.memorization_blocks FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_memorization_blocks_user ON public.memorization_blocks(user_id);
CREATE INDEX idx_memorization_blocks_next_review ON public.memorization_blocks(user_id, next_review_at);
CREATE INDEX idx_memorization_blocks_surah ON public.memorization_blocks(user_id, surah_id);
CREATE INDEX idx_memorization_blocks_priority ON public.memorization_blocks(user_id, priority_level);

-- Block reviews: history of each review session
CREATE TABLE public.block_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  block_id uuid NOT NULL REFERENCES public.memorization_blocks(id) ON DELETE CASCADE,
  session_rating text NOT NULL,
  block_mistake_score integer NOT NULL DEFAULT 0,
  normalized_mistake_score numeric(5,3) NOT NULL DEFAULT 0,
  total_words_in_block integer NOT NULL DEFAULT 0,
  mistake_count_incorrect integer NOT NULL DEFAULT 0,
  mistake_count_missed integer NOT NULL DEFAULT 0,
  mistake_count_tajweed integer NOT NULL DEFAULT 0,
  mistake_count_forgot integer NOT NULL DEFAULT 0,
  repeated_problem_words_count integer NOT NULL DEFAULT 0,
  strength_before integer NOT NULL DEFAULT 0,
  strength_after integer NOT NULL DEFAULT 0,
  interval_before integer NOT NULL DEFAULT 0,
  interval_after integer NOT NULL DEFAULT 0,
  ease_before numeric(4,2) NOT NULL DEFAULT 1.0,
  ease_after numeric(4,2) NOT NULL DEFAULT 1.0,
  entered_focus_review boolean NOT NULL DEFAULT false,
  override_applied text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.block_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reviews" ON public.block_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reviews" ON public.block_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_block_reviews_block ON public.block_reviews(block_id);
CREATE INDEX idx_block_reviews_user ON public.block_reviews(user_id, created_at DESC);

-- Word-level mistakes per review
CREATE TABLE public.block_review_mistakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  block_id uuid NOT NULL REFERENCES public.memorization_blocks(id) ON DELETE CASCADE,
  review_id uuid NOT NULL REFERENCES public.block_reviews(id) ON DELETE CASCADE,
  surah_id integer NOT NULL,
  ayah_number integer NOT NULL,
  word_index integer NOT NULL,
  word_text text NOT NULL DEFAULT '',
  mistake_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.block_review_mistakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own review mistakes" ON public.block_review_mistakes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own review mistakes" ON public.block_review_mistakes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_block_review_mistakes_review ON public.block_review_mistakes(review_id);
CREATE INDEX idx_block_review_mistakes_block ON public.block_review_mistakes(block_id);
CREATE INDEX idx_block_review_mistakes_word ON public.block_review_mistakes(block_id, ayah_number, word_index);

-- Per-ayah aggregated stats
CREATE TABLE public.block_ayah_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  block_id uuid NOT NULL REFERENCES public.memorization_blocks(id) ON DELETE CASCADE,
  ayah_number integer NOT NULL,
  total_reviews integer NOT NULL DEFAULT 0,
  total_mistakes integer NOT NULL DEFAULT 0,
  last_reviewed_at timestamptz,
  strength_score integer NOT NULL DEFAULT 40,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(block_id, ayah_number)
);

ALTER TABLE public.block_ayah_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ayah stats" ON public.block_ayah_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ayah stats" ON public.block_ayah_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ayah stats" ON public.block_ayah_stats FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_block_ayah_stats_block ON public.block_ayah_stats(block_id);

-- Per-word aggregated stats for identifying recurring problems
CREATE TABLE public.block_word_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  block_id uuid NOT NULL REFERENCES public.memorization_blocks(id) ON DELETE CASCADE,
  ayah_number integer NOT NULL,
  word_index integer NOT NULL,
  word_text text NOT NULL DEFAULT '',
  total_incorrect_count integer NOT NULL DEFAULT 0,
  total_missed_count integer NOT NULL DEFAULT 0,
  total_tajweed_count integer NOT NULL DEFAULT 0,
  total_forgot_count integer NOT NULL DEFAULT 0,
  last_mistake_at timestamptz,
  recent_mistake_count_7d integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(block_id, ayah_number, word_index)
);

ALTER TABLE public.block_word_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own word stats" ON public.block_word_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own word stats" ON public.block_word_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own word stats" ON public.block_word_stats FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_block_word_stats_block ON public.block_word_stats(block_id);
CREATE INDEX idx_block_word_stats_recent ON public.block_word_stats(block_id, recent_mistake_count_7d DESC);

-- Trigger for updated_at on memorization_blocks
CREATE TRIGGER update_memorization_blocks_updated_at
  BEFORE UPDATE ON public.memorization_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_block_ayah_stats_updated_at
  BEFORE UPDATE ON public.block_ayah_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_block_word_stats_updated_at
  BEFORE UPDATE ON public.block_word_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
