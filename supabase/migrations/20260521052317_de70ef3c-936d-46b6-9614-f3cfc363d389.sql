CREATE UNIQUE INDEX IF NOT EXISTS mistakes_canonical_word_unique
ON public.mistakes (reciter_id, surah_number, ayah_number, word_index)
WHERE session_id IS NULL AND room_id IS NULL;