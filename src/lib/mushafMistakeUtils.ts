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