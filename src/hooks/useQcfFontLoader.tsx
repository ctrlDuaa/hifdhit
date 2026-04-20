import { useEffect, useState } from 'react';

/**
 * Loads QCF V2 page-specific glyph fonts on demand.
 * Each Mushaf page has its own font: p{n}-v2 served from verses.quran.foundation.
 * Loaded fonts are registered with document.fonts and cached in-memory so they
 * are never re-fetched in the same session.
 */

export interface QcfWordLike {
  page_number?: number;
  char_type_name?: string;
}

// Module-level caches survive component remounts within a session.
const loadedPages = new Set<number>();
const inFlight = new Map<number, Promise<boolean>>();
const failedPages = new Set<number>();

const FONT_BASE = 'https://verses.quran.foundation/fonts/quran/hafs/v2/woff2';
const FALLBACK_FONT_URL =
  'https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2';

let fallbackInjected = false;

function ensureFallbackFont() {
  if (fallbackInjected || typeof document === 'undefined') return;
  fallbackInjected = true;
  const styleId = 'qcf-uthmanic-hafs-fallback';
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @font-face {
      font-family: 'UthmanicHafs';
      src: url('${FALLBACK_FONT_URL}') format('woff2');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
  `;
  document.head.appendChild(style);
}

async function loadPageFont(pageNumber: number): Promise<boolean> {
  if (loadedPages.has(pageNumber)) return true;
  if (failedPages.has(pageNumber)) return false;
  if (inFlight.has(pageNumber)) return inFlight.get(pageNumber)!;

  const family = `p${pageNumber}-v2`;
  const url = `${FONT_BASE}/p${pageNumber}.woff2`;

  const promise = (async () => {
    try {
      const font = new FontFace(family, `url(${url}) format('woff2')`, {
        display: 'swap',
      } as FontFaceDescriptors);
      await font.load();
      document.fonts.add(font);
      loadedPages.add(pageNumber);
      return true;
    } catch (err) {
      console.warn(`[QCF] Failed to load font for page ${pageNumber}:`, err);
      failedPages.add(pageNumber);
      return false;
    } finally {
      inFlight.delete(pageNumber);
    }
  })();

  inFlight.set(pageNumber, promise);
  return promise;
}

/**
 * Fire-and-forget prefetch for a QCF V2 page font. Safe to call repeatedly —
 * deduplicates against in-flight, loaded, and failed caches. Use to warm
 * adjacent Mushaf pages so navigation feels instant.
 */
export function prefetchQcfPageFont(pageNumber: number): void {
  if (
    typeof document === 'undefined' ||
    !pageNumber ||
    pageNumber < 1 ||
    loadedPages.has(pageNumber) ||
    failedPages.has(pageNumber) ||
    inFlight.has(pageNumber)
  ) {
    return;
  }
  ensureFallbackFont();
  void loadPageFont(pageNumber);
}

export function useQcfFontLoader(words: QcfWordLike[] | undefined | null) {
  const [loadedSet, setLoadedSet] = useState<Set<number>>(() => new Set(loadedPages));

  useEffect(() => {
    ensureFallbackFont();
    if (!words || words.length === 0) return;

    const pages = new Set<number>();
    for (const w of words) {
      if (w?.char_type_name === 'end') continue; // end markers use fallback font
      if (typeof w?.page_number === 'number') pages.add(w.page_number);
    }

    let cancelled = false;
    (async () => {
      await Promise.all(
        Array.from(pages).map(async (p) => {
          const ok = await loadPageFont(p);
          if (!cancelled && ok) {
            setLoadedSet((prev) => {
              if (prev.has(p)) return prev;
              const next = new Set(prev);
              next.add(p);
              return next;
            });
          }
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [words]);

  return {
    loadedPages: loadedSet,
    isPageLoaded: (n: number) => loadedSet.has(n),
  };
}
