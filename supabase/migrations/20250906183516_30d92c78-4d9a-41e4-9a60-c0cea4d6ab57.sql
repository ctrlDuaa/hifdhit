-- Fix the security definer view by removing SECURITY DEFINER
-- Re-create the view without SECURITY DEFINER to use the querying user's permissions

DROP VIEW IF EXISTS public.v_mushaf_page;

CREATE VIEW public.v_mushaf_page AS
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