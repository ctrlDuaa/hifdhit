UPDATE public.mistakes
SET word_index = word_index + 1
WHERE session_id IS NULL
  AND room_id IS NULL
  AND created_at < now();