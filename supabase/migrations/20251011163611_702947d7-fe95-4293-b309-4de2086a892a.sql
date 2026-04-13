-- Enable RLS on pages and words tables (public Quran data)
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read pages and words (public Quran data)
CREATE POLICY "Anyone can view pages"
ON public.pages
FOR SELECT
USING (true);

CREATE POLICY "Anyone can view words"
ON public.words
FOR SELECT
USING (true);

-- Only authenticated users can modify (for import purposes)
CREATE POLICY "Authenticated users can insert pages"
ON public.pages
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert words"
ON public.words
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);