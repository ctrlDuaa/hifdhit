import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { quranApi } from '@/services/quranApi';
import { useQcfFontLoader } from '@/hooks/useQcfFontLoader';
import { cn } from '@/lib/utils';

/**
 * Renders the Mushaf line(s) of a given ayah using the QCF V2 glyph fonts —
 * same pipeline as SurahViewer / Quran Overview.
 *
 * Default: shows the line above + ayah lines + the line below ("context window").
 * `showFullPage`: renders every line on the page.
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
  position?: number;
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

  // Resolve the page that contains this verse, then load its QCF data.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPageWords([]);
    setPageNumber(null);

    (async () => {
      try {
        // 1) Find the page number for this verse via the public API.
        const res = await fetch(
          `https://api.quran.com/api/v4/verses/by_key/${verseKey}?fields=page_number`,
          { headers: { Accept: 'application/json' } },
        );
        let page: number | null = null;
        if (res.ok) {
          const json = await res.json();
          if (typeof json?.verse?.page_number === 'number') page = json.verse.page_number;
        }
        if (!page || cancelled) {
          if (!cancelled) setLoading(false);
          return;
        }
        setPageNumber(page);

        // 2) Fetch QCF data for the page (verses + words).
        const data = await quranApi.getPageQcf(page);
        const verses: any[] = Array.isArray(data?.verses) ? data.verses : [];

        // Flatten words AND attach verse_key from the parent verse — the API's
        // word objects don't carry verse_key by default.
        const words: QcfWord[] = verses.flatMap((v: any) =>
          (v?.words ?? []).map((w: any) => ({ ...w, verse_key: w.verse_key ?? v.verse_key })),
        );

        if (!cancelled) setPageWords(words);
      } catch {
        if (!cancelled) setPageWords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [verseKey]);

  // Prefetch font glyphs.
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

  // Lines that contain the target ayah.
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

  // Lines to actually render: just above + ayah + below, or whole page.
  const linesToRender = useMemo(() => {
    if (showFullPage) return allLines;
    if (ayahLines.length === 0) return [];
    const min = ayahLines[0];
    const max = ayahLines[ayahLines.length - 1];
    return allLines.filter((ln) => ln >= min - 1 && ln <= max + 1);
  }, [showFullPage, allLines, ayahLines]);

  if (loading || pageWords.length === 0 || ayahLines.length === 0) {
    return (
      <div className={cn('space-y-2', className)}>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  // 0-based word index within the *target* ayah, counted GLOBALLY across all
  // rendered lines so an ayah that wraps onto multiple lines doesn't restart
  // numbering (which previously caused two words to share the same mistake key).
  let targetAyahWordIdx = -1;

  return (
    <div className={cn('space-y-1.5', className)}>
      {linesToRender.map((ln) => {
        const words = lineMap.get(ln) ?? [];
        const isAyahLine = ayahLines.includes(ln);

        return (
          <div
            key={`ctx-line-${ln}`}
            className={cn(
              'text-xl md:text-2xl lg:text-3xl leading-tight w-full mx-auto px-2',
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

              // Hide-mode logic — only target-ayah, non-end words.
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
                    !isTargetAyah && 'opacity-40',
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
                  {useGlyph ? (
                    <span
                      className={cn('relative', hasMistake && 'dark:text-black')}
                      style={{
                        zIndex: 1,
                        fontFamily: family,
                        color: hidden ? 'transparent' : undefined,
                        textShadow: hidden ? 'none' : undefined,
                      }}
                      dangerouslySetInnerHTML={{ __html: word.code_v2! }}
                    />
                  ) : (
                    <span
                      className={cn('relative', hasMistake && 'dark:text-black')}
                      style={{
                        zIndex: 1,
                        fontFamily: family,
                        color: hidden ? 'transparent' : undefined,
                        textShadow: hidden ? 'none' : undefined,
                      }}
                    >
                      {word.text_qpc_hafs ?? ''}
                    </span>
                  )}
                  {hidden && (
                    <span
                      className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground/70"
                      style={{
                        zIndex: 2,
                        fontFamily: "'UthmanicHafs', serif",
                        fontSize: '0.7em',
                        lineHeight: 1,
                      }}
                      aria-hidden="true"
                    >
                      {firstLetterOnly
                        ? ((word.text_qpc_hafs ?? '').trim().charAt(0) || '•') + '…'
                        : '•••'}
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
