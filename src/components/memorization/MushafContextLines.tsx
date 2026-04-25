import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { quranApi } from '@/services/quranApi';
import { useQcfFontLoader } from '@/hooks/useQcfFontLoader';
import { cn } from '@/lib/utils';

/**
 * Renders the Mushaf line(s) of a given ayah using the QCF V2 glyph fonts —
 * same rendering pipeline as the Quran Overview / SurahViewer.
 *
 * By default shows just the line above and the line below the target ayah's
 * lines (the "context window"). When `showFullPage` is true, renders every
 * line on the page.
 *
 * Words belonging to the target ayah are interactive (clickable) and can
 * display mistake highlights via the optional callbacks/maps.
 */

interface QcfWord {
  verse_key?: string;
  page_number?: number;
  line_number?: number;
  char_type_name?: string;
  code_v2?: string;
  text_qpc_hafs?: string;
}

export type HideMode = 'none' | 'hide-third' | 'hide-half' | 'first-letters' | 'full-hide';

export interface MushafContextLinesProps {
  surahId: number;
  ayahNumber: number;
  showFullPage?: boolean;
  /** Map keyed by `${surahId}-${ayahNumber}-${wordIndexWithinAyah}` (0-based, end markers excluded). */
  mistakes?: Map<string, { category: string }>;
  /** Click handler for words inside the target ayah. wordIndex is 0-based, end markers excluded. */
  onWordClick?: (ayahNumber: number, wordIndex: number, e: React.MouseEvent<HTMLSpanElement>) => void;
  /** Hide pattern applied ONLY to words inside the target ayah. */
  hideMode?: HideMode;
  className?: string;
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'tajweed':   return '#D3e7ee';
    case 'missed':    return '#FFE0B2';
    case 'harakah':   return '#bec4ed';
    case 'incorrect': return '#f28a8a';
    default:          return 'hsl(var(--mistake) / 0.3)';
  }
}

async function fetchVersePage(verseKey: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.quran.com/api/v4/verses/by_key/${verseKey}?fields=page_number`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const p = json?.verse?.page_number;
    return typeof p === 'number' ? p : null;
  } catch {
    return null;
  }
}

export const MushafContextLines = ({
  surahId,
  ayahNumber,
  showFullPage = false,
  mistakes,
  onWordClick,
  hideMode = 'none',
  className,
}: MushafContextLinesProps) => {
  const verseKey = `${surahId}:${ayahNumber}`;
  const [pageNumber, setPageNumber] = useState<number | null>(null);
  const [pageWords, setPageWords] = useState<QcfWord[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolve page number for this verse, then load QCF data for that page.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPageWords([]);
    setPageNumber(null);

    (async () => {
      const page = await fetchVersePage(verseKey);
      if (cancelled || !page) {
        if (!cancelled) setLoading(false);
        return;
      }
      setPageNumber(page);
      try {
        const data = await quranApi.getPageQcf(page);
        const verses: any[] = Array.isArray(data?.verses) ? data.verses : [];
        const words: QcfWord[] = Array.isArray(data?.words_flattened)
          ? data.words_flattened
          : verses.flatMap((v: any) =>
              (v?.words ?? []).map((w: any) => ({ ...w, verse_key: w.verse_key ?? v.verse_key }))
            );
        if (!cancelled) setPageWords(words);
      } catch {
        if (!cancelled) setPageWords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Prefetch neighbors for snappier nav.
      if (page > 1) quranApi.prefetchPageQcf(page - 1);
      if (page < 604) quranApi.prefetchPageQcf(page + 1);
    })();

    return () => { cancelled = true; };
  }, [verseKey]);

  const { loadedPages: qcfLoadedPages } = useQcfFontLoader(pageWords);

  // Group words by line.
  const lineMap = useMemo(() => {
    const m = new Map<number, QcfWord[]>();
    for (const w of pageWords) {
      const ln = typeof w.line_number === 'number' ? w.line_number : -1;
      if (ln < 0) continue;
      if (!m.has(ln)) m.set(ln, []);
      m.get(ln)!.push(w);
    }
    return m;
  }, [pageWords]);

  // Determine which lines contain the target ayah.
  const { ayahLines, allLines } = useMemo(() => {
    const all = Array.from(lineMap.keys()).sort((a, b) => a - b);
    const hit = new Set<number>();
    for (const w of pageWords) {
      if (w.verse_key === verseKey && typeof w.line_number === 'number') {
        hit.add(w.line_number);
      }
    }
    return { ayahLines: Array.from(hit).sort((a, b) => a - b), allLines: all };
  }, [lineMap, pageWords, verseKey]);

  // Compute which lines to actually render.
  const linesToRender = useMemo(() => {
    if (showFullPage) return allLines;
    if (ayahLines.length === 0) return [];
    const min = ayahLines[0];
    const max = ayahLines[ayahLines.length - 1];
    return allLines.filter((ln) => ln >= min - 1 && ln <= max + 1);
  }, [showFullPage, allLines, ayahLines]);

  if (loading) {
    return (
      <div className={cn('space-y-2', className)}>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (pageWords.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {linesToRender.map((ln) => {
        const words = lineMap.get(ln) ?? [];
        const isAyahLine = ayahLines.includes(ln);

        // Track 0-based word index within the *target* ayah for mistake key alignment.
        let targetAyahWordIdx = -1;

        return (
          <div
            key={`ctx-line-${ln}`}
            className={cn(
              'text-xl md:text-2xl lg:text-3xl leading-tight w-full mx-auto px-2',
              !isAyahLine && 'opacity-40',
            )}
            style={{
              lineHeight: '1.7',
              textAlign: 'center',
              direction: 'rtl',
              wordSpacing: '-0.02em',
            }}
          >
            {words.map((word, wi) => {
              const isEnd = word.char_type_name === 'end';
              const isTargetAyah = word.verse_key === verseKey;
              if (isTargetAyah && !isEnd) targetAyahWordIdx += 1;

              const mistakeKey = isTargetAyah && !isEnd
                ? `${surahId}-${ayahNumber}-${targetAyahWordIdx}`
                : null;
              const mistake = mistakeKey ? mistakes?.get(mistakeKey) : undefined;
              const hasMistake = !!mistake;

              const pageNum = typeof word.page_number === 'number' ? word.page_number : pageNumber ?? 0;
              const fontReady = qcfLoadedPages.has(pageNum);
              const useGlyph = !isEnd && fontReady && !!word.code_v2;
              const family = useGlyph ? `'p${pageNum}-v2'` : "'UthmanicHafs', serif";

              const interactive = isTargetAyah && !isEnd && !!onWordClick;
              const wordIndexForClick = targetAyahWordIdx;

              // Hide-mode logic — only applies to target-ayah, non-end words.
              let hidden = false;
              let firstLetterOnly = false;
              if (isTargetAyah && !isEnd && hideMode !== 'none') {
                if (hideMode === 'full-hide') hidden = true;
                else if (hideMode === 'hide-third') hidden = targetAyahWordIdx % 3 === 2;
                else if (hideMode === 'hide-half') hidden = targetAyahWordIdx % 2 === 1;
                else if (hideMode === 'first-letters') { hidden = true; firstLetterOnly = true; }
              }

              return (
                <span
                  key={`ctx-${ln}-${wi}`}
                  className={cn(
                    'relative inline-block transition-opacity',
                    interactive && 'cursor-pointer hover:opacity-70',
                  )}
                  style={{ margin: '0 0.5px' }}
                  onClick={interactive
                    ? (e) => onWordClick!(ayahNumber, wordIndexForClick, e)
                    : undefined}
                >
                  {hasMistake && mistake && !hidden && (
                    <span
                      className="absolute rounded-sm pointer-events-none"
                      style={{
                        backgroundColor: getCategoryColor(mistake.category),
                        top: '1px',
                        left: '-2px',
                        right: '-2px',
                        bottom: '1px',
                        zIndex: 0,
                      }}
                    />
                  )}
                  {hidden ? (
                    <span
                      className="inline-block px-2 rounded bg-muted/60 text-muted-foreground/60 text-base align-middle"
                      style={{ minWidth: '2.25rem', textAlign: 'center', fontFamily: "'UthmanicHafs', serif" }}
                    >
                      {firstLetterOnly
                        ? ((word.text_qpc_hafs ?? '').trim().charAt(0) || '•') + '…'
                        : '•••'}
                    </span>
                  ) : useGlyph ? (
                    <span
                      className={cn('relative', hasMistake && 'dark:text-black')}
                      style={{ zIndex: 1, fontFamily: family }}
                      dangerouslySetInnerHTML={{ __html: word.code_v2! }}
                    />
                  ) : (
                    <span
                      className={cn('relative', hasMistake && 'dark:text-black')}
                      style={{ zIndex: 1, fontFamily: family }}
                    >
                      {word.text_qpc_hafs ?? ''}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
