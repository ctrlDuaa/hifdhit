
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type typ JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace WHERE typ.typname = 'mushaf_char_type') THEN
    CREATE TYPE public.mushaf_char_type AS ENUM ('word', 'end', 'pause', 'ruby', 'bismillah', 'sajdah', 'hamza', 'other');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.mushaf_pages (
  page_number INTEGER PRIMARY KEY, juz_number INTEGER, hizb_number INTEGER, rub_number INTEGER,
  surah_start INTEGER, ayah_start INTEGER, surah_end INTEGER, ayah_end INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.mushaf_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_number INTEGER NOT NULL REFERENCES public.mushaf_pages(page_number) ON DELETE CASCADE,
  line_number SMALLINT NOT NULL CHECK (line_number BETWEEN 1 AND 15),
  sort_order SMALLINT GENERATED ALWAYS AS (line_number) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (page_number, line_number)
);
CREATE TABLE IF NOT EXISTS public.mushaf_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_word_id BIGINT, external_ayah_key TEXT,
  page_number INTEGER NOT NULL REFERENCES public.mushaf_pages(page_number) ON DELETE CASCADE,
  line_number SMALLINT NOT NULL CHECK (line_number BETWEEN 1 AND 15),
  surah_number INTEGER NOT NULL, ayah_number INTEGER NOT NULL,
  position_in_ayah INTEGER, position_in_line INTEGER,
  text_uthmani TEXT NOT NULL, char_type public.mushaf_char_type DEFAULT 'word',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (page_number, line_number, position_in_line)
);
CREATE INDEX IF NOT EXISTS idx_mushaf_lines_page ON public.mushaf_lines(page_number);
CREATE INDEX IF NOT EXISTS idx_mushaf_words_page_line ON public.mushaf_words(page_number, line_number);
CREATE INDEX IF NOT EXISTS idx_mushaf_words_ayah ON public.mushaf_words(surah_number, ayah_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mushaf_words_external ON public.mushaf_words(external_word_id) WHERE external_word_id IS NOT NULL;

ALTER TABLE public.mushaf_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mushaf_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mushaf_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read mushaf_pages" ON public.mushaf_pages FOR SELECT USING (true);
CREATE POLICY "read mushaf_lines" ON public.mushaf_lines FOR SELECT USING (true);
CREATE POLICY "read mushaf_words" ON public.mushaf_words FOR SELECT USING (true);
CREATE POLICY "auth insert mushaf_pages" ON public.mushaf_pages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth insert mushaf_lines" ON public.mushaf_lines FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth insert mushaf_words" ON public.mushaf_words FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update mushaf_pages" ON public.mushaf_pages FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth update mushaf_lines" ON public.mushaf_lines FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth update mushaf_words" ON public.mushaf_words FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete mushaf_pages" ON public.mushaf_pages FOR DELETE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete mushaf_lines" ON public.mushaf_lines FOR DELETE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete mushaf_words" ON public.mushaf_words FOR DELETE USING (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS trg_mushaf_pages_updated_at ON public.mushaf_pages;
CREATE TRIGGER trg_mushaf_pages_updated_at BEFORE UPDATE ON public.mushaf_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_mushaf_lines_updated_at ON public.mushaf_lines;
CREATE TRIGGER trg_mushaf_lines_updated_at BEFORE UPDATE ON public.mushaf_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_mushaf_words_updated_at ON public.mushaf_words;
CREATE TRIGGER trg_mushaf_words_updated_at BEFORE UPDATE ON public.mushaf_words FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE VIEW public.v_mushaf_page AS
SELECT p.page_number, l.line_number, json_agg(json_build_object('id', w.id, 'external_word_id', w.external_word_id, 'surah_number', w.surah_number, 'ayah_number', w.ayah_number, 'position_in_ayah', w.position_in_ayah, 'position_in_line', w.position_in_line, 'text_uthmani', w.text_uthmani, 'char_type', w.char_type) ORDER BY w.position_in_line) AS words
FROM public.mushaf_pages p JOIN public.mushaf_lines l ON l.page_number = p.page_number LEFT JOIN public.mushaf_words w ON w.page_number = p.page_number AND w.line_number = l.line_number
GROUP BY p.page_number, l.line_number ORDER BY p.page_number, l.line_number;
ALTER VIEW public.v_mushaf_page SET (security_invoker = on);
