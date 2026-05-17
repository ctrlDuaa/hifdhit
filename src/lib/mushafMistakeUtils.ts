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

export const fetchCanonicalMistakeIdsForPageWord = async (
  reciterId: string,
  surahNumber: number,
  ayahNumber: number,
  pageNumber: number,
  page: PageLike | null | undefined,
  pageWordKey: string
): Promise<string[]> => {
  const pageWordKeys = buildPageWordKeySet(page);
  const { data, error } = await supabase
    .from('mistakes')
    .select('id, surah_number, ayah_number, word_index, page_number')
    .eq('reciter_id', reciterId)
    .eq('surah_number', surahNumber)
    .eq('ayah_number', ayahNumber);

  if (error) throw error;

  return (data ?? [])
    .filter((mistake) => mistake.page_number === pageNumber || mistake.page_number === null)
    .filter((mistake) => getNormalizedMistakeWordKey(
      mistake.surah_number,
      mistake.ayah_number,
      mistake.word_index,
      pageWordKeys
    ) === pageWordKey)
    .map((mistake) => mistake.id);
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

// ---------------------------------------------------------------------------
// Realtime consistency helpers
// ---------------------------------------------------------------------------

type MistakeMapValueLike = {
  category?: string;
  mistakeId?: string;
  note?: string;
  sessionId?: string;
};

/**
 * Stable signature of a highlighted-mistake map. Used to detect whether a
 * realtime refetch actually changed anything before triggering a re-render.
 */
export const computeMistakeMapSignature = (
  map: Map<string, MistakeMapValueLike> | null | undefined
): string => {
  if (!map || map.size === 0) return '';
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([k, v]) =>
        `${k}:${v.category ?? ''}:${v.mistakeId ?? ''}:${v.note ?? ''}:${v.sessionId ?? ''}`
    )
    .join('|');
};

export type MistakeMapDiff = {
  added: string[];
  removed: string[];
  changed: string[];
};

export const diffMistakeMaps = (
  prev: Map<string, MistakeMapValueLike> | null | undefined,
  next: Map<string, MistakeMapValueLike> | null | undefined
): MistakeMapDiff => {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  const prevMap = prev ?? new Map();
  const nextMap = next ?? new Map();

  nextMap.forEach((value, key) => {
    const prior = prevMap.get(key);
    if (!prior) added.push(key);
    else if (
      prior.category !== value.category ||
      prior.mistakeId !== value.mistakeId ||
      (prior.note ?? '') !== (value.note ?? '') ||
      (prior.sessionId ?? '') !== (value.sessionId ?? '')
    ) {
      changed.push(key);
    }
  });
  prevMap.forEach((_v, key) => {
    if (!nextMap.has(key)) removed.push(key);
  });
  return { added, removed, changed };
};

export const mistakeDiffHasChanges = (diff: MistakeMapDiff): boolean =>
  diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;

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