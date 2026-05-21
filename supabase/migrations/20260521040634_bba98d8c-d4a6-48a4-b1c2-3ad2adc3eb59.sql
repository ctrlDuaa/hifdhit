ALTER TABLE public.mistakes ADD COLUMN IF NOT EXISTS word_id BIGINT;
CREATE INDEX IF NOT EXISTS mistakes_reciter_word_id_idx ON public.mistakes (reciter_id, word_id);
CREATE INDEX IF NOT EXISTS mistakes_word_id_idx ON public.mistakes (word_id);