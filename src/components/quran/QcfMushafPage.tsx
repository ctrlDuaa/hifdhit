import React, { useEffect, useMemo, useState } from 'react';
import { quranApi } from '@/services/quranApi';
import { QcfWord, type QcfWordData } from './QcfWord';
import {
  useQcfFontLoader,
  preloadQcfPageFont,
  isQcfFontLoaded,
} from '@/hooks/useQcfFontLoader';

/** A single QCF V2 word enriched with its surah/ayah for mistake mapping. */
export interface QcfRenderWord extends QcfWordData {
  surah: number;
  ayah: number;
  /** 1-based word position within the ayah (matches QF API `position`). */
  word_position: number;
  /** Mushaf line number (1..15 typically) for grouping. */
  line_number: number;
}

export interface QcfLine {
  line_number: number;
  words: QcfRenderWord[];
}

export interface QcfPageData {
  page_number: number;
  lines: QcfLine[];
}

/**
 * Cache QCF V2 page payloads in memory across navigation.
 */
const pageDataCache = new Map<number, QcfPageData>();

async function fetchQcfPage(pageNumber: number): Promise<QcfPageData> {
  const cached = pageDataCache.get(pageNumber);
  if (cached) return cached;

  const res = await quranApi.getQcfPage(pageNumber);
  const verses: any[] = (res as any)?.verses ?? [];

  // Flatten to words, preserving API order, then group by line_number.
  const lineMap = new Map<number, QcfRenderWord[]>();
  for (const verse of verses) {
    const verseKey: string = verse.verse_key ?? '';
    const [surahStr, ayahStr] = verseKey.split(':');
    const surah = parseInt(surahStr, 10);
    const ayah = parseInt(ayahStr, 10);

    for (const w of verse.words ?? []) {
      const line = Number(w.line_number) || 0;
      const word: QcfRenderWord = {
        code_v2: w.code_v2,
        text_qpc_hafs: w.text_qpc_hafs,
        page_number: Number(w.page_number) || pageNumber,
        line_number: line,
        char_type_name: w.char_type_name,
        surah,
        ayah,
        word_position: Number(w.position) || 0,
      };
      const arr = lineMap.get(line) ?? [];
      arr.push(word);
      lineMap.set(line, arr);
    }
  }

  const lines: QcfLine[] = Array.from(lineMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([line_number, words]) => ({ line_number, words }));

  const data: QcfPageData = { page_number: pageNumber, lines };
  pageDataCache.set(pageNumber, data);
  return data;
}

export interface QcfWordHighlight {
  /** background color (any CSS color string) */
  background: string;
  /** optional border color */
  border?: string;
  /** tooltip / aria title */
  title?: string;
  /** force darker text for highlight contrast */
  darkText?: boolean;
}

interface QcfMushafPageProps {
  pageNumber: number;
  /**
   * Map keyed by `${surah}-${ayah}-${wordPosition}` returning a highlight
   * descriptor (e.g. for marked mistakes). Pass `undefined` for none.
   */
  highlights?: Map<string, QcfWordHighlight>;
  /** Called when the page data + font are both ready. */
  onReady?: (data: QcfPageData) => void;
  /** Optional outer className for the page wrapper. */
  className?: string;
  /** Font size in rem for QCF glyphs. Default 1.75. */
  fontSizeRem?: number;
}

/**
 * Renders one Mushaf page in QCF V2 glyph style.
 *  - fetches `verses/by_page/{n}` (proxied via edge fn) with QCF V2 word fields
 *  - groups words by `line_number`
 *  - loads `p{n}-v2` font lazily, with UthmanicHafs as immediate fallback
 *  - end-of-ayah markers always use UthmanicHafs
 */
export const QcfMushafPage: React.FC<QcfMushafPageProps> = ({
  pageNumber,
  highlights,
  onReady,
  className,
  fontSizeRem = 1.75,
}) => {
  const [data, setData] = useState<QcfPageData | null>(
    () => pageDataCache.get(pageNumber) ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  // Fetch page data
  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchQcfPage(pageNumber)
      .then((d) => {
        if (cancelled) return;
        setData(d);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[QcfMushafPage] fetch failed:', e);
        setError(e?.message ?? 'Failed to load page');
      });
    return () => {
      cancelled = true;
    };
  }, [pageNumber]);

  // Determine the unique page numbers needed for this page's words
  // (almost always just [pageNumber], but spillover is possible at boundaries).
  const requiredPages = useMemo(() => {
    if (!data) return [pageNumber];
    const set = new Set<number>([pageNumber]);
    for (const line of data.lines) {
      for (const w of line.words) {
        if (w.char_type_name !== 'end' && w.page_number) set.add(w.page_number);
      }
    }
    return Array.from(set);
  }, [data, pageNumber]);

  const readyFonts = useQcfFontLoader(requiredPages);

  // Preload the next page's font in the background for smoother navigation.
  useEffect(() => {
    if (pageNumber < 604) preloadQcfPageFont(pageNumber + 1);
    if (pageNumber > 1) preloadQcfPageFont(pageNumber - 1);
  }, [pageNumber]);

  // Notify when ready
  useEffect(() => {
    if (data && readyFonts.has(pageNumber)) onReady?.(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, readyFonts.has(pageNumber)]);

  if (error) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        Couldn’t load Mushaf page {pageNumber}.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-3 py-4" aria-busy>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-7 w-full bg-muted/40 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`qcf-mushaf-page ${className ?? ''}`}
      style={{ fontSize: `${fontSizeRem}rem` }}
    >
      {data.lines.map((line) => (
        <div
          key={`qcf-line-${pageNumber}-${line.line_number}`}
          className="qcf-mushaf-line"
        >
          {line.words.map((w, idx) => {
            const fontReady = isQcfFontLoaded(w.page_number) || readyFonts.has(w.page_number);
            const key = `${w.surah}-${w.ayah}-${w.word_position}`;
            const hl = highlights?.get(key);
            return (
              <QcfWord
                key={`qcf-w-${pageNumber}-${line.line_number}-${idx}`}
                word={w}
                isFontLoaded={fontReady}
                title={hl?.title}
                className="relative inline-block"
                style={
                  hl
                    ? {
                        backgroundColor: hl.background,
                        borderRadius: 4,
                        padding: '0 2px',
                        boxShadow: hl.border ? `inset 0 0 0 2px ${hl.border}` : undefined,
                      }
                    : undefined
                }
                innerClassName={hl?.darkText ? 'text-black' : undefined}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default QcfMushafPage;
