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

const SURAH_NAMES_AR: { [key: number]: string } = {
  1: 'الفاتحة', 2: 'البقرة', 3: 'آل عمران', 4: 'النساء', 5: 'المائدة',
  6: 'الأنعام', 7: 'الأعراف', 8: 'الأنفال', 9: 'التوبة', 10: 'يونس',
  11: 'هود', 12: 'يوسف', 13: 'الرعد', 14: 'إبراهيم', 15: 'الحجر',
  16: 'النحل', 17: 'الإسراء', 18: 'الكهف', 19: 'مريم', 20: 'طه',
  21: 'الأنبياء', 22: 'الحج', 23: 'المؤمنون', 24: 'النور', 25: 'الفرقان',
  26: 'الشعراء', 27: 'النمل', 28: 'القصص', 29: 'العنكبوت', 30: 'الروم',
  31: 'لقمان', 32: 'السجدة', 33: 'الأحزاب', 34: 'سبأ', 35: 'فاطر',
  36: 'يس', 37: 'الصافات', 38: 'ص', 39: 'الزمر', 40: 'غافر',
  41: 'فصلت', 42: 'الشورى', 43: 'الزخرف', 44: 'الدخان', 45: 'الجاثية',
  46: 'الأحقاف', 47: 'محمد', 48: 'الفتح', 49: 'الحجرات', 50: 'ق',
  51: 'الذاريات', 52: 'الطور', 53: 'النجم', 54: 'القمر', 55: 'الرحمن',
  56: 'الواقعة', 57: 'الحديد', 58: 'المجادلة', 59: 'الحشر', 60: 'الممتحنة',
  61: 'الصف', 62: 'الجمعة', 63: 'المنافقون', 64: 'التغابن', 65: 'الطلاق',
  66: 'التحريم', 67: 'الملك', 68: 'القلم', 69: 'الحاقة', 70: 'المعارج',
  71: 'نوح', 72: 'الجن', 73: 'المزمل', 74: 'المدثر', 75: 'القيامة',
  76: 'الإنسان', 77: 'المرسلات', 78: 'النبأ', 79: 'النازعات', 80: 'عبس',
  81: 'التكوير', 82: 'الانفطار', 83: 'المطففين', 84: 'الانشقاق', 85: 'البروج',
  86: 'الطارق', 87: 'الأعلى', 88: 'الغاشية', 89: 'الفجر', 90: 'البلد',
  91: 'الشمس', 92: 'الليل', 93: 'الضحى', 94: 'الشرح', 95: 'التين',
  96: 'العلق', 97: 'القدر', 98: 'البينة', 99: 'الزلزلة', 100: 'العاديات',
  101: 'القارعة', 102: 'التكاثر', 103: 'العصر', 104: 'الهمزة', 105: 'الفيل',
  106: 'قريش', 107: 'الماعون', 108: 'الكوثر', 109: 'الكافرون', 110: 'النصر',
  111: 'المسد', 112: 'الإخلاص', 113: 'الفلق', 114: 'الناس',
};

function getSurahNameAr(n: number): string {
  return SURAH_NAMES_AR[n] || `سورة ${n}`;
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
        // 1) Resolve the page that contains this verse via the proxied edge
        //    function (api.quran.com is CORS-blocked from the browser, so a
        //    direct fetch leaves the page in a permanent skeleton state).
        let page: number | null = null;
        try {
          const res: any = await quranApi.getVerse(verseKey);
          const verse = res?.verse ?? res?.data?.verse ?? null;
          if (typeof verse?.page_number === 'number') {
            page = verse.page_number;
          } else if (Array.isArray(verse?.words)) {
            const w = verse.words.find((w: any) => typeof w?.page_number === 'number');
            if (w) page = w.page_number;
          }
        } catch (err) {
          console.warn('MushafContextLines: getVerse failed', err);
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

  // Track surah transitions so we can render the surah-name + bismillah header
  // when a new surah starts on the page (only meaningful in full-page mode).
  let prevSurahOnPage: number | null = null;

  return (
    <div className={cn('space-y-1.5', className)}>
      {linesToRender.map((ln, lnIdx) => {
        const words = lineMap.get(ln) ?? [];
        const isAyahLine = ayahLines.includes(ln);

        // Determine the surah & first-ayah this line belongs to (from first
        // word that has a verse_key). Used for new-surah header detection.
        let lineSurah: number | null = null;
        let lineFirstAyah: number | null = null;
        for (const w of words) {
          if (!w.verse_key) continue;
          const [sStr, aStr] = w.verse_key.split(':');
          const s = Number(sStr);
          const a = Number(aStr);
          if (Number.isFinite(s) && Number.isFinite(a)) {
            lineSurah = s;
            lineFirstAyah = a;
            break;
          }
        }

        // Show a surah-name + bismillah header above this line when the page
        // transitions into a new surah mid-page. Always show on the first line
        // when it starts at ayah 1 of a surah (i.e. a new surah opens the page).
        const isNewSurahStart =
          showFullPage &&
          lineSurah !== null &&
          lineFirstAyah === 1 &&
          (prevSurahOnPage === null ? lnIdx === 0 : lineSurah !== prevSurahOnPage);

        if (lineSurah !== null) prevSurahOnPage = lineSurah;

        const surahHeader = isNewSurahStart && lineSurah !== null ? (
          <div className="my-4 flex flex-col items-center gap-3">
            <div className="w-full max-w-3xl mx-auto">
              <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              <div className="flex items-center justify-center gap-2 -mt-3">
                <div className="w-2 h-2 rotate-45 bg-primary/40" />
                <div className="w-3 h-3 rotate-45 bg-primary/60" />
                <div className="w-2 h-2 rotate-45 bg-primary/40" />
              </div>
            </div>
            <div
              className="text-center text-2xl md:text-3xl text-primary font-bold py-1"
              style={{ fontFamily: 'DigitalKhattV2' }}
            >
              {getSurahNameAr(lineSurah)}
            </div>
            {lineSurah !== 1 && lineSurah !== 9 && (
              <div
                className="text-center text-xl md:text-2xl text-muted-foreground"
                style={{ fontFamily: 'DigitalKhattV2', direction: 'rtl' }}
              >
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </div>
            )}
          </div>
        ) : null;

        return (
          <div key={`ctx-line-wrap-${ln}`}>
            {surahHeader}
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
          </div>
        );
      })}
    </div>
  );
};
