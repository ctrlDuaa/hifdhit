
-- Chapters cache
CREATE TABLE public.quran_chapters_cache (
  chapter_number INTEGER PRIMARY KEY,
  name_arabic TEXT NOT NULL,
  name_english TEXT NOT NULL,
  name_simple TEXT NOT NULL,
  revelation_place TEXT,
  verses_count INTEGER NOT NULL DEFAULT 0,
  pages JSONB,
  chapter_data JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quran_chapters_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chapters cache"
  ON public.quran_chapters_cache FOR SELECT USING (true);

CREATE POLICY "Authenticated users can upsert chapters cache"
  ON public.quran_chapters_cache FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update chapters cache"
  ON public.quran_chapters_cache FOR UPDATE
  TO authenticated USING (true);

-- Verses cache
CREATE TABLE public.quran_verses_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_number INTEGER NOT NULL,
  verse_number INTEGER NOT NULL,
  verse_key TEXT NOT NULL,
  text_uthmani TEXT NOT NULL,
  words JSONB,
  translation_id INTEGER NOT NULL DEFAULT 131,
  translation_text TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (verse_key, translation_id)
);

CREATE INDEX idx_verses_cache_chapter ON public.quran_verses_cache(chapter_number);
CREATE INDEX idx_verses_cache_key ON public.quran_verses_cache(verse_key);

ALTER TABLE public.quran_verses_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read verses cache"
  ON public.quran_verses_cache FOR SELECT USING (true);

CREATE POLICY "Authenticated users can upsert verses cache"
  ON public.quran_verses_cache FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update verses cache"
  ON public.quran_verses_cache FOR UPDATE
  TO authenticated USING (true);

-- Tafsir cache
CREATE TABLE public.quran_tafsir_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verse_key TEXT NOT NULL,
  tafsir_id INTEGER NOT NULL DEFAULT 169,
  tafsir_text TEXT,
  tafsir_data JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (verse_key, tafsir_id)
);

CREATE INDEX idx_tafsir_cache_key ON public.quran_tafsir_cache(verse_key);

ALTER TABLE public.quran_tafsir_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tafsir cache"
  ON public.quran_tafsir_cache FOR SELECT USING (true);

CREATE POLICY "Authenticated users can upsert tafsir cache"
  ON public.quran_tafsir_cache FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update tafsir cache"
  ON public.quran_tafsir_cache FOR UPDATE
  TO authenticated USING (true);

-- Audio cache
CREATE TABLE public.quran_audio_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_number INTEGER NOT NULL,
  verse_key TEXT,
  reciter_id INTEGER NOT NULL DEFAULT 7,
  audio_url TEXT NOT NULL,
  audio_data JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (verse_key, reciter_id)
);

CREATE INDEX idx_audio_cache_chapter ON public.quran_audio_cache(chapter_number);
CREATE INDEX idx_audio_cache_key ON public.quran_audio_cache(verse_key);

ALTER TABLE public.quran_audio_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read audio cache"
  ON public.quran_audio_cache FOR SELECT USING (true);

CREATE POLICY "Authenticated users can upsert audio cache"
  ON public.quran_audio_cache FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update audio cache"
  ON public.quran_audio_cache FOR UPDATE
  TO authenticated USING (true);
