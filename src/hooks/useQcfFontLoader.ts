import { useEffect, useState } from 'react';

/**
 * QCF V2 (Quranic Madani Mushaf) per-page font loader.
 *
 * Each Mushaf page (1..604) has its own page-specific font hosted by Quran Foundation:
 *   https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p{page}.woff2
 *
 * The font-family registered for each loaded page is `p{page}-v2`.
 *
 * Fonts are cached in a module-level Set so that navigating between pages
 * never re-downloads or re-registers the same page font.
 */

const CDN_BASE = 'https://verses.quran.foundation';
export const QCF_FALLBACK_FONT_FAMILY = 'UthmanicHafs';

const loadedFonts = new Set<number>();
const inFlight = new Map<number, Promise<void>>();

export function getQcfFontFamily(pageNumber: number): string {
  return `p${pageNumber}-v2`;
}

async function loadOne(pageNumber: number): Promise<void> {
  if (loadedFonts.has(pageNumber)) return;
  const existing = inFlight.get(pageNumber);
  if (existing) return existing;

  const family = getQcfFontFamily(pageNumber);
  const url = `${CDN_BASE}/fonts/quran/hafs/v2/woff2/p${pageNumber}.woff2`;

  const promise = (async () => {
    try {
      const face = new FontFace(family, `url(${url}) format('woff2')`, {
        display: 'swap',
      });
      await face.load();
      // @ts-ignore — document.fonts.add accepts FontFace
      document.fonts.add(face);
      loadedFonts.add(pageNumber);
    } catch (err) {
      // Keep silent in production; consumers fall back to UthmanicHafs.
      console.warn(`[QCF] Failed to load font for page ${pageNumber}:`, err);
    } finally {
      inFlight.delete(pageNumber);
    }
  })();

  inFlight.set(pageNumber, promise);
  return promise;
}

/**
 * React hook: ensures all given Mushaf page fonts are loaded.
 * Pass a list of unique page numbers (e.g. derived from the words you're rendering).
 *
 * Returns a Set of page numbers whose fonts are currently registered + ready.
 */
export function useQcfFontLoader(pageNumbers: number[]) {
  const [ready, setReady] = useState<Set<number>>(() => {
    const s = new Set<number>();
    for (const p of pageNumbers) if (loadedFonts.has(p)) s.add(p);
    return s;
  });

  // Stable key for the input list
  const key = pageNumbers
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
    .join(',');

  useEffect(() => {
    let cancelled = false;
    const unique = Array.from(new Set(pageNumbers.filter((n) => Number.isFinite(n))));

    // Seed with anything already cached
    setReady((prev) => {
      const next = new Set(prev);
      for (const p of unique) if (loadedFonts.has(p)) next.add(p);
      return next;
    });

    // Load missing ones
    Promise.all(
      unique.map(async (page) => {
        if (loadedFonts.has(page)) return page;
        await loadOne(page);
        return page;
      }),
    ).then((pages) => {
      if (cancelled) return;
      setReady((prev) => {
        const next = new Set(prev);
        for (const p of pages) if (loadedFonts.has(p)) next.add(p);
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return ready;
}

/** Eagerly load a single page font (e.g. preload next page). */
export function preloadQcfPageFont(pageNumber: number) {
  return loadOne(pageNumber);
}

export function isQcfFontLoaded(pageNumber: number) {
  return loadedFonts.has(pageNumber);
}
