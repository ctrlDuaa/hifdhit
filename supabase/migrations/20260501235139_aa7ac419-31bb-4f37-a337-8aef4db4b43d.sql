
CREATE TABLE public.pages (
  id SERIAL PRIMARY KEY,
  page_number INTEGER NOT NULL,
  line_number INTEGER NOT NULL,
  line_type TEXT NOT NULL DEFAULT 'ayah',
  is_centered BOOLEAN NOT NULL DEFAULT false,
  first_word_id INTEGER,
  last_word_id INTEGER,
  surah_number INTEGER,
  UNIQUE(page_number, line_number)
);
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read pages" ON public.pages FOR SELECT USING (true);
CREATE POLICY "auth insert pages" ON public.pages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.words (
  id SERIAL PRIMARY KEY,
  location TEXT,
  surah INTEGER NOT NULL,
  ayah INTEGER NOT NULL,
  word INTEGER NOT NULL,
  text TEXT NOT NULL
);
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read words" ON public.words FOR SELECT USING (true);
CREATE POLICY "auth insert words" ON public.words FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_pages_page_number ON public.pages(page_number);
CREATE INDEX idx_words_surah_ayah ON public.words(surah, ayah);
