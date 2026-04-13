-- Temporarily enable write access for authenticated users to import Mushaf data
-- This will be reverted after import is complete

-- Allow authenticated users to insert mushaf_pages
CREATE POLICY "Authenticated users can insert mushaf_pages" 
ON public.mushaf_pages 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to insert mushaf_lines
CREATE POLICY "Authenticated users can insert mushaf_lines" 
ON public.mushaf_lines 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to insert mushaf_words
CREATE POLICY "Authenticated users can insert mushaf_words" 
ON public.mushaf_words 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Also allow updates for data corrections
CREATE POLICY "Authenticated users can update mushaf_pages" 
ON public.mushaf_pages 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update mushaf_lines" 
ON public.mushaf_lines 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update mushaf_words" 
ON public.mushaf_words 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Allow delete for clearing data if needed
CREATE POLICY "Authenticated users can delete mushaf_pages" 
ON public.mushaf_pages 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete mushaf_lines" 
ON public.mushaf_lines 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete mushaf_words" 
ON public.mushaf_words 
FOR DELETE 
USING (auth.uid() IS NOT NULL);