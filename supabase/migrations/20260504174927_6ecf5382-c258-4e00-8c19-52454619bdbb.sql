-- Force schema cache refresh by adding a comment
COMMENT ON TABLE public.local_collections IS 'User-created verse collections';
COMMENT ON TABLE public.local_bookmarks IS 'Saved verses within collections';