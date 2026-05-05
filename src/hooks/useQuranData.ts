/**
 * React hooks for fetching Quran data through our secure backend.
 * Uses React Query for caching, deduplication, and background refresh.
 * Also writes to Supabase cache tables for offline/fast repeat access.
 */

import { useQuery } from '@tanstack/react-query';
import { quranApi, QuranChapter, QuranVerse } from '@/services/quranApi';
import { supabase } from '@/integrations/supabase/runtimeClient';
import { CACHE_TTL_MS, DEFAULT_TRANSLATION_ID } from '@/config/quranDefaults';

// ── Cache helpers ────────────────────────────────────────────

function isFresh(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() < CACHE_TTL_MS;
}

// ── useSurahList ─────────────────────────────────────────────

export function useSurahList() {
  return useQuery({
    queryKey: ['quran', 'chapters'],
    queryFn: async (): Promise<QuranChapter[]> => {
      // Try Supabase cache first
      const { data: cached } = await supabase
        .from('quran_chapters_cache')
        .select('*')
        .order('chapter_number');

      if (cached && cached.length === 114 && isFresh(cached[0].fetched_at)) {
        return cached.map(c => ({
          id: c.chapter_number,
          name_arabic: c.name_arabic,
          name_simple: c.name_simple,
          name_complex: c.name_english,
          revelation_place: c.revelation_place || '',
          verses_count: c.verses_count,
          pages: c.pages as number[] | undefined,
          translated_name: undefined,
        }));
      }

      // Fetch from API
      const result = await quranApi.getChapters();
      const chapters = result.chapters;

      // Write to cache (fire-and-forget)
      const rows = chapters.map((ch: any) => ({
        chapter_number: ch.id,
        name_arabic: ch.name_arabic,
        name_english: ch.name_complex || ch.name_simple,
        name_simple: ch.name_simple,
        revelation_place: ch.revelation_place,
        verses_count: ch.verses_count,
        pages: ch.pages,
        chapter_data: ch,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      supabase
        .from('quran_chapters_cache')
        .upsert(rows, { onConflict: 'chapter_number' })
        .then(({ error }) => { if (error) console.warn('Cache write error:', error); });

      return chapters;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000,
  });
}

// ── useSurah ─────────────────────────────────────────────────

export function useSurah(chapterNumber: number | undefined) {
  return useQuery({
    queryKey: ['quran', 'chapter', chapterNumber],
    queryFn: async () => {
      if (!chapterNumber) throw new Error('No chapter number');
      const result = await quranApi.getChapter(chapterNumber);
      return result.chapter;
    },
    enabled: !!chapterNumber,
    staleTime: 60 * 60 * 1000,
  });
}

// ── useVersesByChapter ───────────────────────────────────────

export function useVersesByChapter(
  chapterNumber: number | undefined,
  { page = 1, perPage = 286, translationId = DEFAULT_TRANSLATION_ID } = {}
) {
  return useQuery({
    queryKey: ['quran', 'verses', chapterNumber, page, perPage, translationId],
    queryFn: async (): Promise<QuranVerse[]> => {
      if (!chapterNumber) throw new Error('No chapter number');

      // Try cache
      const { data: cached } = await supabase
        .from('quran_verses_cache')
        .select('*')
        .eq('chapter_number', chapterNumber)
        .eq('translation_id', translationId)
        .order('verse_number');

      if (cached && cached.length > 0 && isFresh(cached[0].fetched_at)) {
        return cached.map(v => ({
          id: 0,
          verse_key: v.verse_key,
          verse_number: v.verse_number,
          text_uthmani: v.text_uthmani,
          words: v.words as any,
          translations: v.translation_text
            ? [{ id: translationId, text: v.translation_text, resource_id: translationId }]
            : undefined,
        }));
      }

      // Fetch from API
      const result = await quranApi.getVersesByChapter(chapterNumber, page, perPage, translationId);
      const verses = result.verses;

      // Cache
      const rows = verses.map((v: any) => ({
        chapter_number: chapterNumber,
        verse_number: v.verse_number || parseInt(v.verse_key.split(':')[1]),
        verse_key: v.verse_key,
        text_uthmani: v.text_uthmani,
        words: v.words,
        translation_id: translationId,
        translation_text: v.translations?.[0]?.text || null,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      supabase
        .from('quran_verses_cache')
        .upsert(rows, { onConflict: 'verse_key,translation_id' })
        .then(({ error }) => { if (error) console.warn('Verse cache error:', error); });

      return verses;
    },
    enabled: !!chapterNumber,
    staleTime: 30 * 60 * 1000,
  });
}

// ── useVerse ─────────────────────────────────────────────────

export function useVerse(verseKey: string | undefined) {
  return useQuery({
    queryKey: ['quran', 'verse', verseKey],
    queryFn: async () => {
      if (!verseKey) throw new Error('No verse key');
      const result = await quranApi.getVerse(verseKey);
      return result.verse;
    },
    enabled: !!verseKey,
    staleTime: 60 * 60 * 1000,
  });
}

// ── useVerseRange ────────────────────────────────────────────

export function useVerseRange(
  chapterNumber: number | undefined,
  startVerse: number | undefined,
  endVerse: number | undefined
) {
  return useQuery({
    queryKey: ['quran', 'verse-range', chapterNumber, startVerse, endVerse],
    queryFn: async (): Promise<QuranVerse[]> => {
      if (!chapterNumber || !startVerse || !endVerse) throw new Error('Missing params');

      // Try cache first
      const keys = Array.from(
        { length: endVerse - startVerse + 1 },
        (_, i) => `${chapterNumber}:${startVerse + i}`
      );

      const { data: cached } = await supabase
        .from('quran_verses_cache')
        .select('*')
        .in('verse_key', keys)
        .eq('translation_id', DEFAULT_TRANSLATION_ID)
        .order('verse_number');

      if (cached && cached.length === keys.length && isFresh(cached[0].fetched_at)) {
        return cached.map(v => ({
          id: 0,
          verse_key: v.verse_key,
          verse_number: v.verse_number,
          text_uthmani: v.text_uthmani,
          words: v.words as any,
          translations: v.translation_text
            ? [{ id: DEFAULT_TRANSLATION_ID, text: v.translation_text, resource_id: DEFAULT_TRANSLATION_ID }]
            : undefined,
        }));
      }

      const result = await quranApi.getVerseRange(chapterNumber, startVerse, endVerse);

      // Cache
      const rows = result.verses.map((v: any) => ({
        chapter_number: chapterNumber,
        verse_number: parseInt(v.verse_key.split(':')[1]),
        verse_key: v.verse_key,
        text_uthmani: v.text_uthmani,
        words: v.words,
        translation_id: DEFAULT_TRANSLATION_ID,
        translation_text: v.translations?.[0]?.text || null,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      supabase
        .from('quran_verses_cache')
        .upsert(rows, { onConflict: 'verse_key,translation_id' })
        .then(({ error }) => { if (error) console.warn('Range cache error:', error); });

      return result.verses;
    },
    enabled: !!chapterNumber && !!startVerse && !!endVerse,
    staleTime: 30 * 60 * 1000,
  });
}

// ── useVerseTafsir ───────────────────────────────────────────

export function useVerseTafsir(verseKey: string | undefined) {
  return useQuery({
    queryKey: ['quran', 'tafsir', verseKey],
    queryFn: async () => {
      if (!verseKey) throw new Error('No verse key');

      // Check cache
      const { data: cached } = await supabase
        .from('quran_tafsir_cache')
        .select('*')
        .eq('verse_key', verseKey)
        .maybeSingle();

      if (cached && isFresh(cached.fetched_at)) {
        return { text: cached.tafsir_text, data: cached.tafsir_data };
      }

      const result = await quranApi.getTafsir(verseKey);

      // Cache
      supabase
        .from('quran_tafsir_cache')
        .upsert({
          verse_key: verseKey,
          tafsir_text: result.tafsir?.text || result.text || '',
          tafsir_data: result,
          fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'verse_key,tafsir_id' })
        .then(({ error }) => { if (error) console.warn('Tafsir cache error:', error); });

      return result;
    },
    enabled: !!verseKey,
    staleTime: 60 * 60 * 1000,
  });
}

// ── useVerseAudio ────────────────────────────────────────────

export function useVerseAudio(chapterNumber: number | undefined) {
  return useQuery({
    queryKey: ['quran', 'verse-audio', chapterNumber],
    queryFn: async () => {
      if (!chapterNumber) throw new Error('No chapter number');
      return quranApi.getVerseAudio(chapterNumber);
    },
    enabled: !!chapterNumber,
    staleTime: 60 * 60 * 1000,
  });
}

// ── useChapterAudio ──────────────────────────────────────────

export function useChapterAudio(chapterNumber: number | undefined) {
  return useQuery({
    queryKey: ['quran', 'chapter-audio', chapterNumber],
    queryFn: async () => {
      if (!chapterNumber) throw new Error('No chapter number');
      return quranApi.getChapterAudio(chapterNumber);
    },
    enabled: !!chapterNumber,
    staleTime: 60 * 60 * 1000,
  });
}
