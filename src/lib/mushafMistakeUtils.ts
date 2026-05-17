import { supabase } from '@/integrations/supabase/client';

type PageWordLike = {
  surah?: number | null;
  ayah?: number | null;
  word?: number | null;
};

type PageLineLike = {
  words?: PageWordLike[] | null;
};

type PageLike = {
  lines?: PageLineLike[] | null;
};

export const buildPageWordKeySet = (page: PageLike | null | undefined): Set<string> => {
  const keys = new Set<string>();

  page?.lines?.forEach((line) => {
    line.words?.forEach((word) => {
      if (
        typeof word.surah === 'number' &&
        typeof word.ayah === 'number' &&
        typeof word.word === 'number'
      ) {
        keys.add(`${word.surah}-${word.ayah}-${word.word}`);
      }
    });
  });

  return keys;
};

export const getSurahsOnPage = (page: PageLike | null | undefined): number[] => {
  const surahs = new Set<number>();

  page?.lines?.forEach((line) => {
    line.words?.forEach((word) => {
      if (typeof word.surah === 'number') surahs.add(word.surah);
    });
  });

  return [...surahs];
};

export const fetchCanonicalMistakesForPage = async (
  reciterId: string,
  pageNumber: number,
  page: PageLike | null | undefined
) => {
  const surahsOnPage = getSurahsOnPage(page);

  const { data: pageMistakes, error: pageError } = await supabase
    .from('mistakes')
    .select('*')
    .eq('reciter_id', reciterId)
    .eq('page_number', pageNumber);

  if (pageError) throw pageError;

  if (surahsOnPage.length === 0) {
    return pageMistakes ?? [];
  }

  const { data: noPageMistakes, error: noPageError } = await supabase
    .from('mistakes')
    .select('*')
    .eq('reciter_id', reciterId)
    .is('page_number', null)
    .in('surah_number', surahsOnPage);

  if (noPageError) throw noPageError;

  return [...(pageMistakes ?? []), ...(noPageMistakes ?? [])];
};

export const getNormalizedMistakeWordKey = (
  surahNumber: number | null | undefined,
  ayahNumber: number | null | undefined,
  wordIndex: number | null | undefined,
  pageWordKeys?: Set<string>
): string | null => {
  if (
    typeof surahNumber !== 'number' ||
    typeof ayahNumber !== 'number' ||
    typeof wordIndex !== 'number'
  ) {
    return null;
  }

  const candidates = [...new Set([wordIndex, wordIndex + 1].filter((value) => value >= 1))];

  if (!pageWordKeys || pageWordKeys.size === 0) {
    return `${surahNumber}-${ayahNumber}-${candidates[0]}`;
  }

  for (const candidate of candidates) {
    const key = `${surahNumber}-${ayahNumber}-${candidate}`;
    if (pageWordKeys.has(key)) {
      return key;
    }
  }

  return null;
};

export const getPageWordIndexCandidates = (
  wordIndex: number | null | undefined,
  options?: { preferOneBased?: boolean }
): number[] => {
  if (typeof wordIndex !== 'number') {
    return [];
  }

  const baseCandidates = [wordIndex, wordIndex + 1].filter((value) => value >= 1);

  if (options?.preferOneBased) {
    return [...new Set([wordIndex + 1, wordIndex, ...baseCandidates].filter((value) => value >= 1))];
  }

  return [...new Set(baseCandidates)];
};