import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MushafWord {
  id: string;
  external_word_id?: number;
  external_ayah_key?: string;
  page_number: number;
  line_number: number;
  surah_number: number;
  ayah_number: number;
  position_in_ayah?: number;
  position_in_line: number;
  text_uthmani: string;
  char_type: 'word' | 'end' | 'pause' | 'ruby' | 'bismillah' | 'sajdah' | 'hamza' | 'other';
}

interface MushafLine {
  line_number: number;
  words: MushafWord[];
}

interface MushafPage {
  page_number: number;
  juz_number?: number;
  hizb_number?: number;
  rub_number?: number;
  surah_start?: number;
  ayah_start?: number;
  surah_end?: number;
  ayah_end?: number;
  lines: MushafLine[];
}

interface PageCache {
  [pageNumber: number]: MushafPage;
}

export const useMushafDatabase = () => {
  const [pageCache, setPageCache] = useState<PageCache>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load a single page from database
  const loadPage = useCallback(async (pageNumber: number): Promise<MushafPage | null> => {
    // Return from cache if available
    if (pageCache[pageNumber]) {
      return pageCache[pageNumber];
    }

    setLoading(true);
    setError(null);

    try {
      // Get page metadata
      const { data: pageData, error: pageError } = await supabase
        .from('mushaf_pages')
        .select('*')
        .eq('page_number', pageNumber)
        .single();

      if (pageError) throw pageError;

      // Get page content with line-by-line structure
      const { data: lineData, error: lineError } = await supabase
        .from('v_mushaf_page')
        .select('*')
        .eq('page_number', pageNumber)
        .order('line_number');

      if (lineError) throw lineError;

      // Build the page structure
      const page: MushafPage = {
        page_number: pageNumber,
        juz_number: pageData?.juz_number,
        hizb_number: pageData?.hizb_number,
        rub_number: pageData?.rub_number,
        surah_start: pageData?.surah_start,
        ayah_start: pageData?.ayah_start,
        surah_end: pageData?.surah_end,
        ayah_end: pageData?.ayah_end,
        lines: lineData?.map((line) => ({
          line_number: line.line_number,
          words: Array.isArray(line.words) ? line.words as unknown as MushafWord[] : []
        })) || []
      };

      // Cache the page
      setPageCache(prev => ({
        ...prev,
        [pageNumber]: page
      }));

      return page;
    } catch (err) {
      console.error('Error loading page:', err);
      setError(err instanceof Error ? err.message : 'Failed to load page');
      return null;
    } finally {
      setLoading(false);
    }
  }, [pageCache]);

  // Preload adjacent pages for smooth navigation
  const preloadPages = useCallback(async (currentPage: number) => {
    const promises = [];
    
    // Preload next page
    if (currentPage < 604 && !pageCache[currentPage + 1]) {
      promises.push(loadPage(currentPage + 1));
    }
    
    // Preload previous page
    if (currentPage > 1 && !pageCache[currentPage - 1]) {
      promises.push(loadPage(currentPage - 1));
    }

    // Execute preloading in background
    if (promises.length > 0) {
      Promise.allSettled(promises).catch(console.error);
    }
  }, [pageCache, loadPage]);

  // Check if page exists in database
  const checkPageExists = useCallback(async (pageNumber: number): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('mushaf_pages')
        .select('page_number')
        .eq('page_number', pageNumber)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    } catch (err) {
      console.error('Error checking page:', err);
      return false;
    }
  }, []);

  // Get page count
  const getPageCount = useCallback(async (): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('mushaf_pages')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.error('Error getting page count:', err);
      return 0;
    }
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    setPageCache({});
  }, []);

  return {
    loadPage,
    preloadPages,
    checkPageExists,
    getPageCount,
    clearCache,
    pageCache,
    loading,
    error,
    isPageCached: (pageNumber: number) => !!pageCache[pageNumber]
  };
};