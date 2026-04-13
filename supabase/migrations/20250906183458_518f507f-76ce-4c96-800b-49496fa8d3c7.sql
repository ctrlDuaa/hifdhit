-- Schema for Mushaf layout (pages/lines/words)
-- Public read-only tables to store exact 15-line Mushaf structure

-- Create enum for character types if useful (word, end, pause, etc.)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type typ JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace WHERE typ.typname = 'mushaf_char_type') THEN
    CREATE TYPE public.mushaf_char_type AS ENUM ('word', 'end', 'pause', 'ruby', 'bismillah', 'sajdah', 'hamza', 'other');
  END IF;
END $$;

-- Pages table
CREATE TABLE IF NOT EXISTS public.mushaf_pages (
  page_number INTEGER PRIMARY KEY,
  juz_number INTEGER,
  hizb_number INTEGER,
  rub_number INTEGER,
  surah_start INTEGER,
  ayah_start INTEGER,
  surah_end INTEGER,
  ayah_end INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lines table (15 lines per page)
CREATE TABLE IF NOT EXISTS public.mushaf_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_number INTEGER NOT NULL REFERENCES public.mushaf_pages(page_number) ON DELETE CASCADE,
  line_number SMALLINT NOT NULL CHECK (line_number BETWEEN 1 AND 15),
  -- optional visual ordering key
  sort_order SMALLINT GENERATED ALWAYS AS (line_number) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (page_number, line_number)
);

-- Words table (one row per displayed token, including ayah end markers if provided)
CREATE TABLE IF NOT EXISTS public.mushaf_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- external stable identifiers when available (from QUL/Quran.com dataset)
  external_word_id BIGINT,
  external_ayah_key TEXT, -- e.g., "2:255"

  page_number INTEGER NOT NULL REFERENCES public.mushaf_pages(page_number) ON DELETE CASCADE,
  line_number SMALLINT NOT NULL CHECK (line_number BETWEEN 1 AND 15),

  surah_number INTEGER NOT NULL,
  ayah_number INTEGER NOT NULL,
  position_in_ayah INTEGER,  -- order within ayah
  position_in_line INTEGER,  -- order within the line

  text_uthmani TEXT NOT NULL,
  char_type public.mushaf_char_type DEFAULT 'word'::public.mushaf_char_type,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (page_number, line_number, position_in_line)
);

-- Indexes for fast page rendering and ayah lookup
CREATE INDEX IF NOT EXISTS idx_mushaf_lines_page ON public.mushaf_lines(page_number);
CREATE INDEX IF NOT EXISTS idx_mushaf_words_page_line ON public.mushaf_words(page_number, line_number);
CREATE INDEX IF NOT EXISTS idx_mushaf_words_ayah ON public.mushaf_words(surah_number, ayah_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mushaf_words_external ON public.mushaf_words(external_word_id) WHERE external_word_id IS NOT NULL;

-- Timestamp trigger function (shared)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers
DROP TRIGGER IF EXISTS trg_mushaf_pages_updated_at ON public.mushaf_pages;
CREATE TRIGGER trg_mushaf_pages_updated_at
BEFORE UPDATE ON public.mushaf_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_mushaf_lines_updated_at ON public.mushaf_lines;
CREATE TRIGGER trg_mushaf_lines_updated_at
BEFORE UPDATE ON public.mushaf_lines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_mushaf_words_updated_at ON public.mushaf_words;
CREATE TRIGGER trg_mushaf_words_updated_at
BEFORE UPDATE ON public.mushaf_words
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS and set policies (public read-only)
ALTER TABLE public.mushaf_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mushaf_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mushaf_words ENABLE ROW LEVEL SECURITY;

-- SELECT allowed for everyone
DROP POLICY IF EXISTS "Anyone can view mushaf_pages" ON public.mushaf_pages;
CREATE POLICY "Anyone can view mushaf_pages" ON public.mushaf_pages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view mushaf_lines" ON public.mushaf_lines;
CREATE POLICY "Anyone can view mushaf_lines" ON public.mushaf_lines FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view mushaf_words" ON public.mushaf_words;
CREATE POLICY "Anyone can view mushaf_words" ON public.mushaf_words FOR SELECT USING (true);

-- No INSERT/UPDATE/DELETE policies provided => write operations denied by default under RLS

-- Optional: helper view to get page with 15 lines and ordered words
CREATE OR REPLACE VIEW public.v_mushaf_page AS
SELECT
  p.page_number,
  l.line_number,
  json_agg(
    json_build_object(
      'id', w.id,
      'external_word_id', w.external_word_id,
      'surah_number', w.surah_number,
      'ayah_number', w.ayah_number,
      'position_in_ayah', w.position_in_ayah,
      'position_in_line', w.position_in_line,
      'text_uthmani', w.text_uthmani,
      'char_type', w.char_type
    )
    ORDER BY w.position_in_line
  ) AS words
FROM public.mushaf_pages p
JOIN public.mushaf_lines l ON l.page_number = p.page_number
LEFT JOIN public.mushaf_words w ON w.page_number = p.page_number AND w.line_number = l.line_number
GROUP BY p.page_number, l.line_number
ORDER BY p.page_number, l.line_number;