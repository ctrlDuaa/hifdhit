import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/runtimeClient';

export interface SupabaseWord {
  id: number;
  location: string;
  surah: number;
  ayah: number;
  word: number;
  text: string;
}

export interface SupabaseLine {
  page_number: number;
  line_number: number;
  line_type: 'ayah' | 'surah_name' | 'basmallah';
  is_centered: boolean;
  first_word_id: number | null;
  last_word_id: number | null;
  surah_number: number | null;
  words: SupabaseWord[];
}

export interface SupabasePage {
  page_number: number;
  lines: SupabaseLine[];
}

export const useSupabaseMushaf = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageCache = useRef<Map<number, SupabasePage>>(new Map());
  const loadingPages = useRef<Set<number>>(new Set());
  
  const fetchPageFromDB = useCallback(async (pageNumber: number): Promise<SupabasePage | null> => {
    try {
      // First, get all lines for this page
      const { data: linesData, error: linesError } = await (supabase as any)
        .from('pages')
        .select('*')
        .eq('page_number', pageNumber)
        .order('line_number');

      if (linesError) throw linesError;
      if (!linesData || linesData.length === 0) {
        throw new Error(`No data found for page ${pageNumber}`);
      }

      // Get all unique word IDs needed for this page
      const wordIds = new Set<number>();
      linesData.forEach((line: any) => {
        if (line.first_word_id && line.last_word_id) {
          for (let id = line.first_word_id; id <= line.last_word_id; id++) {
            wordIds.add(id);
          }
        }
      });

      // Batch fetch all words for the page in a single query
      let allWords: SupabaseWord[] = [];
      if (wordIds.size > 0) {
        const { data: wordsData, error: wordsError } = await (supabase as any)
          .from('words')
          .select('*')
          .in('id', Array.from(wordIds))
          .order('id');

        if (wordsError) throw wordsError;
        allWords = wordsData || [];
      }

      // Create a map for fast word lookup
      const wordsMap = new Map<number, SupabaseWord>();
      allWords.forEach(word => wordsMap.set(word.id, word));

      // Build lines with their words
      const lines: SupabaseLine[] = linesData.map((line: any) => {
        const lineWords: SupabaseWord[] = [];
        
        if (line.line_type === 'ayah' && line.first_word_id && line.last_word_id) {
          for (let id = line.first_word_id; id <= line.last_word_id; id++) {
            const word = wordsMap.get(id);
            if (word) {
              lineWords.push(word);
            }
          }
        }

        return {
          page_number: line.page_number,
          line_number: line.line_number,
          line_type: line.line_type,
          is_centered: line.is_centered,
          first_word_id: line.first_word_id,
          last_word_id: line.last_word_id,
          surah_number: line.surah_number,
          words: lineWords
        };
      });

      const page = {
        page_number: pageNumber,
        lines
      };

      // Cache the loaded page
      pageCache.current.set(pageNumber, page);
      return page;
    } catch (err) {
      console.error('Error loading page:', err);
      throw err;
    }
  }, []);

  const loadPage = useCallback(async (pageNumber: number): Promise<SupabasePage | null> => {
    setLoading(true);
    setError(null);

    try {
      // Check cache first
      const cachedPage = pageCache.current.get(pageNumber);
      if (cachedPage) {
        console.log(`📦 Page ${pageNumber} loaded from cache`);
        return cachedPage;
      }

      // Check if already loading
      if (loadingPages.current.has(pageNumber)) {
        console.log(`⏳ Page ${pageNumber} is already loading, waiting...`);
        // Wait for the loading to complete
        while (loadingPages.current.has(pageNumber)) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        return pageCache.current.get(pageNumber) || null;
      }

      // Mark as loading
      loadingPages.current.add(pageNumber);
      
      console.log(`🔄 Loading page ${pageNumber} from database`);
      const page = await fetchPageFromDB(pageNumber);
      
      // Remove from loading set
      loadingPages.current.delete(pageNumber);
      
      return page;
    } catch (err) {
      loadingPages.current.delete(pageNumber);
      console.error('Error loading page:', err);
      setError(err instanceof Error ? err.message : 'Failed to load page');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchPageFromDB]);

  const preloadAdjacentPages = useCallback(async (currentPage: number, totalPages: number) => {
    const pagesToPreload: number[] = [];
    
    // Preload previous page
    if (currentPage > 1) {
      pagesToPreload.push(currentPage - 1);
    }
    
    // Preload next page
    if (currentPage < totalPages) {
      pagesToPreload.push(currentPage + 1);
    }

    // Preload pages in background (don't await)
    pagesToPreload.forEach(async (pageNum) => {
      // Skip if already cached or loading
      if (pageCache.current.has(pageNum) || loadingPages.current.has(pageNum)) {
        return;
      }
      
      try {
        loadingPages.current.add(pageNum);
        console.log(`🔄 Preloading page ${pageNum} in background`);
        await fetchPageFromDB(pageNum);
        loadingPages.current.delete(pageNum);
        console.log(`✅ Page ${pageNum} preloaded successfully`);
      } catch (err) {
        loadingPages.current.delete(pageNum);
        console.error(`Error preloading page ${pageNum}:`, err);
      }
    });
  }, [fetchPageFromDB]);

  const getPageCount = useCallback(async (): Promise<number> => {
    try {
      const { data, error } = await (supabase as any)
        .from('pages')
        .select('page_number')
        .order('page_number', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data?.page_number || 0;
    } catch (err) {
      console.error('Error getting page count:', err);
      return 0;
    }
  }, []);

  const checkPageExists = useCallback(async (pageNumber: number): Promise<boolean> => {
    try {
      const { data, error } = await (supabase as any)
        .from('pages')
        .select('page_number')
        .eq('page_number', pageNumber)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    } catch (err) {
      console.error('Error checking page existence:', err);
      return false;
    }
  }, []);

  const getSurahStartPage = useCallback(async (surahNumber: number): Promise<number | null> => {
    try {
      // Find the first word of this surah
      const { data: firstWord, error: wordError } = await (supabase as any)
        .from('words')
        .select('id')
        .eq('surah', surahNumber)
        .order('ayah', { ascending: true })
        .order('word', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (wordError) throw wordError;
      if (!firstWord) return null;

      // Find which page contains this word
      const { data: page, error: pageError } = await (supabase as any)
        .from('pages')
        .select('page_number')
        .lte('first_word_id', firstWord.id)
        .gte('last_word_id', firstWord.id)
        .limit(1)
        .maybeSingle();

      if (pageError) throw pageError;
      return page?.page_number || null;
    } catch (err) {
      console.error('Error finding surah start page:', err);
      return null;
    }
  }, []);

  return {
    loadPage,
    getPageCount,
    checkPageExists,
    getSurahStartPage,
    preloadAdjacentPages,
    loading,
    error
  };
};