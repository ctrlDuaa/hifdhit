import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { quranApi } from '@/services/quranApi';
import { useQcfFontLoader } from '@/hooks/useQcfFontLoader';
import { cn } from '@/lib/utils';
import { MistakeType } from '@/lib/reviewScheduler';

/**
 * Renders the FULL Mushaf page(s) covering a range of ayat using the QCF V2
 * glyph fonts (same pipeline as Quran Overview / memorization session).
 *
 * - Words inside the review range are blurred (`blur-sm hover:blur-none`)
 *   and clickable to mark mistakes.
 * - Words outside the review range are dimmed (opacity-40), un-blurred for
 *   surrounding context.
 * - Marked mistakes show a colored highlight and remove the blur.
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

interface Props {
  surahId: number;
  startAyah: number;
  endAyah: number;
  /** Map keyed by `${ayahNumber}:${wordIndexWithinAyah}` (0-based, end markers excluded). */
  getMistakeForWord: (ayahNumber: number, wordIndex: number) => MistakeType | null;
  onWordClick: (ayahNumber: number, wordIndex: number, wordText: string, e: React.MouseEvent<HTMLSpanElement>) => void;
  className?: string;
}

function getCategoryColor(type: MistakeType): string {
  switch (type) {
    case 'tajweed':   return 'hsl(var(--mistake-tajweed))';
    case 'missed':    return 'hsl(var(--mistake-missed))';
    case 'forgot':    return 'hsl(var(--mistake-harakah))';
    case 'incorrect': return 'hsl(var(--mistake-incorrect))';
    default:          return 'hsl(var(--mistake) / 0.3)';
  }
}

export const MushafReviewPage = ({
  surahId,
  startAyah,
  endAyah,
  getMistakeForWord,
  onWordClick,
  className,
}: Props) => {
  const firstKey = `${surahId}:${startAyah}`;
  const lastKey = `${surahId}:${endAyah}`;

  const [pages, setPages] = useState<number[]>([]);
  const [pageWords, setPageWords] = useState<QcfWord[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolve the page range covering the ayat, then load each page.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPageWords([]);
    setPages([]);

    (async () => {
      try {
        const [firstRes, lastRes] = await Promise.all([
          fetch(`https://api.quran.com/api/v4/verses/by_key/${firstKey}?fields=page_number`, { headers: { Accept: 'application/json' } }),
          fetch(`https://api.quran.com/api/v4/verses/by_key/${lastKey}?fields=page_number`, { headers: { Accept: 'application/json' } }),
        ]);

        let firstPage: number | null = null;
        let lastPage: number | null = null;
        if (firstRes.ok) {
          const j = await firstRes.json();
          if (typeof j?.verse?.page_number === 'number') firstPage = j.verse.page_number;
        }
        if (lastRes.ok) {
          const j = await lastRes.json();
          if (typeof j?.verse?.page_number === 'number') lastPage = j.verse.page_number;
        }
        if (!firstPage || !lastPage || cancelled) {
          if (!cancelled) setLoading(false);
          return;
        }

        const lo = Math.min(firstPage, lastPage);
        const hi = Math.max(firstPage, lastPage);
        const pageList: number[] = [];
        for (let p = lo; p <= hi; p++) pageList.push(p);
        setPages(pageList);

        const allWords: QcfWord[] = [];
        for (const p of pageList) {
          const data = await quranApi.getPageQcf(p);
          const verses: any[] = Array.isArray(data?.verses) ? data.verses : [];
          for (const v of verses) {
            for (const w of (v?.words ?? [])) {
              allWords.push({ ...w, verse_key: w.verse_key ?? v.verse_key });
            }
          }
        }

        if (!cancelled) setPageWords(allWords);
      } catch {
        if (!cancelled) setPageWords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [firstKey, lastKey]);

  const { loadedPages: qcfLoadedPages } = useQcfFontLoader(pageWords);

  // Group words: pageNumber -> lineNumber -> words[]
  const pageLineMap = useMemo(() => {
    const m = new Map<number, Map<number, QcfWord[]>>();
    for (const w of pageWords) {
      const pn = typeof w.page_number === 'number' ? w.page_number : -1;
      const ln = typeof w.line_number === 'number' ? w.line_number : -1;
      if (pn < 0 || ln < 0) continue;
      if (!m.has(pn)) m.set(pn, new Map());
      const lm = m.get(pn)!;
      if (!lm.has(ln)) lm.set(ln, []);
      lm.get(ln)!.push(w);
    }
    return m;
  }, [pageWords]);

  // Helper: is this verse_key within the review range?
  const isInRange = (verseKey: string | undefined): { inRange: boolean; ayah: number | null } => {
    if (!verseKey) return { inRange: false, ayah: null };
    const [s, a] = verseKey.split(':').map(Number);
    if (s !== surahId) return { inRange: false, ayah: a ?? null };
    if (typeof a !== 'number') return { inRange: false, ayah: null };
    return { inRange: a >= startAyah && a <= endAyah, ayah: a };
  };

  if (loading || pageWords.length === 0) {
    return (
      <div className={cn('space-y-2', className)}>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {pages.map((pageNum) => {
        const lineMap = pageLineMap.get(pageNum);
        if (!lineMap) return null;
        const lines = Array.from(lineMap.keys()).sort((a, b) => a - b);

        // Track per-ayah word index across the whole page (resets per ayah).
        const ayahWordCounters = new Map<number, number>();

        // Detect surah boundaries on this page: any line whose first non-end
        // word is the start (ayah 1) of a surah different from the previous
        // line's surah marks a new-surah header.
        const lineSurahStart = new Map<number, number>();
        let prevSurah: number | null = null;
        for (const ln of lines) {
          const ws = lineMap.get(ln) ?? [];
          const firstWord = ws.find(w => w.char_type_name !== 'end' && !!w.verse_key);
          if (!firstWord?.verse_key) continue;
          const [sStr, aStr] = firstWord.verse_key.split(':');
          const s = Number(sStr);
          const a = Number(aStr);
          if (!Number.isFinite(s)) continue;
          if (a === 1 && s !== prevSurah) lineSurahStart.set(ln, s);
          prevSurah = s;
        }

        return (
          <div key={`page-${pageNum}`} className="space-y-1.5">
            {lines.map((ln) => {
              const words = lineMap.get(ln) ?? [];
              const newSurah = lineSurahStart.get(ln);
              return (
                <div key={`p${pageNum}-line-${ln}-wrap`}>
                  {newSurah && (
                    <div className="my-6 flex flex-col items-center gap-3">
                      <div className="w-full max-w-3xl mx-auto">
                        <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                        <div className="flex items-center justify-center gap-2 -mt-3">
                          <div className="w-2 h-2 rotate-45 bg-primary/40" />
                          <div className="w-3 h-3 rotate-45 bg-primary/60" />
                          <div className="w-2 h-2 rotate-45 bg-primary/40" />
                        </div>
                      </div>
                      <div
                        className="text-center text-2xl md:text-3xl text-primary font-bold"
                        style={{ fontFamily: 'DigitalKhattV2' }}
                        dir="rtl"
                      >
                        {getSurahArabicName(newSurah)}
                      </div>
                      {newSurah !== 1 && newSurah !== 9 && (
                        <div
                          className="text-center text-xl md:text-2xl text-muted-foreground"
                          style={{ fontFamily: 'DigitalKhattV2' }}
                          dir="rtl"
                        >
                          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    className="text-xl md:text-2xl lg:text-3xl leading-tight w-full mx-auto px-2"
                    style={{
                      lineHeight: '1.7',
                      textAlign: 'center',
                      direction: 'rtl',
                      wordSpacing: '-0.02em',
                    }}
                  >
                    {words.map((word, wi) => {
                      const isEnd = word.char_type_name === 'end';
                      const { inRange, ayah } = isInRange(word.verse_key);

                      let wordIdxInAyah = -1;
                      if (ayah != null && !isEnd) {
                        if (typeof word.position === 'number' && word.position > 0) {
                          wordIdxInAyah = word.position - 1;
                          ayahWordCounters.set(ayah, Math.max(ayahWordCounters.get(ayah) ?? 0, word.position));
                        } else {
                          const cur = ayahWordCounters.get(ayah) ?? 0;
                          wordIdxInAyah = cur;
                          ayahWordCounters.set(ayah, cur + 1);
                        }
                      }

                      const mistake = inRange && !isEnd && ayah != null
                        ? getMistakeForWord(ayah, wordIdxInAyah)
                        : null;
                      const hasMistake = !!mistake;

                      const fontReady = qcfLoadedPages.has(pageNum);
                      const useGlyph = !isEnd && fontReady && !!word.code_v2;
                      const family = useGlyph ? `'p${pageNum}-v2'` : "'UthmanicHafs', serif";

                      const interactive = inRange && !isEnd && ayah != null;
                      const blurred = interactive && !hasMistake;

                      return (
                        <span
                          key={`p${pageNum}-${ln}-${wi}`}
                          className={cn(
                            'relative inline-block transition-all',
                            interactive && 'cursor-pointer',
                            !inRange && 'opacity-40',
                            blurred && 'blur-sm hover:blur-none',
                          )}
                          style={{ margin: '0 0.5px' }}
                          onClick={interactive
                            ? (e) => onWordClick(ayah!, wordIdxInAyah, word.text_qpc_hafs ?? '', e)
                            : undefined}
                        >
                          {hasMistake && mistake && (
                            <span
                              className="absolute rounded-sm pointer-events-none"
                              style={{
                                backgroundColor: getCategoryColor(mistake),
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
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

const SURAH_ARABIC_NAMES: Record<number, string> = {
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

function getSurahArabicName(n: number): string {
  return SURAH_ARABIC_NAMES[n] ?? `سورة ${n}`;
}
