-- Switch memorization mistake uniqueness from positional (word_index) to canonical word.id
ALTER TABLE public.mistakes
  DROP CONSTRAINT IF EXISTS mistakes_reciter_id_surah_number_ayah_number_word_index_key;

CREATE UNIQUE INDEX IF NOT EXISTS mistakes_reciter_word_id_unique
  ON public.mistakes (reciter_id, word_id)
  WHERE word_id IS NOT NULL AND session_id IS NULL AND room_id IS NULL;

CREATE INDEX IF NOT EXISTS mistakes_word_id_idx ON public.mistakes (word_id);