import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { useSupabaseMushaf, SupabasePage, SupabaseWord } from '@/hooks/useSupabaseMushaf';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

import { useQcfFontLoader, prefetchQcfPageFont } from '@/hooks/useQcfFontLoader';
import { QcfWord } from '@/components/quran/QcfVerseText';
import { quranApi } from '@/services/quranApi';
import { AppHeader } from '@/components/AppHeader';
import { format } from 'date-fns';


type MistakeCategory = 'tajweed' | 'missed' | 'harakah' | 'incorrect';

interface MistakeData {
  category: MistakeCategory;
  date: string;
  mistakeId?: string;
  note?: string;
}

const MushafViewer = () => {
  const { pageNumber } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loadPage, getPageCount, checkPageExists, preloadAdjacentPages, loading, error } = useSupabaseMushaf();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageData, setPageData] = useState<SupabasePage | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [highlightedWords, setHighlightedWords] = useState<Map<number, MistakeData>>(new Map());
  


  // ── QCF V2 (Quran Foundation glyph rendering) ──
  const [qcfWords, setQcfWords] = useState<QcfWord[] | null>(null);
  const [qcfError, setQcfError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setQcfWords(null);
    setQcfError(null);
    (async () => {
      try {
        const data = await quranApi.getPageQcf(currentPage);
        const verses = data?.verses ?? [];
        const words: QcfWord[] = [];
        for (const v of verses) {
          const [surahStr, ayahStr] = String(v.verse_key ?? '').split(':');
          const surah = Number(surahStr);
          const ayah = Number(ayahStr);
          for (const w of v.words ?? []) {
            words.push({
              id: w.id,
              code_v2: w.code_v2,
              text_qpc_hafs: w.text_qpc_hafs,
              page_number: w.page_number,
              line_number: w.line_number,
              char_type_name: w.char_type_name,
              position: w.position,
              surah,
              ayah,
            });
          }
        }
        if (!cancelled) setQcfWords(words);
      } catch (e: any) {
        if (!cancelled) setQcfError(e?.message || 'QCF fetch failed');
      }
    })();
    // Prefetch QCF data for adjacent pages
    if (currentPage > 1) quranApi.prefetchPageQcf(currentPage - 1);
    if (currentPage < 604) quranApi.prefetchPageQcf(currentPage + 1);
    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  const { loadedPages: qcfLoadedPages } = useQcfFontLoader(qcfWords ?? []);

  // Reload mistakes after QCF words become available — the page-vs-no-page
  // partition uses the canonical word.id set from the QCF response.
  useEffect(() => {
    if (!user || !qcfWords || qcfWords.length === 0) return;
    loadMistakesForPage(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentPage, qcfWords]);

  // Prefetch QCF fonts for adjacent pages (background, idle) so navigation feels instant
  useEffect(() => {
    if (!currentPage) return;
    const candidates = [currentPage - 1, currentPage + 1].filter(
      (p) => p >= 1 && (totalPages === 0 || p <= totalPages)
    );
    const run = () => candidates.forEach(prefetchQcfPageFont);
    const w = window as any;
    const handle = w.requestIdleCallback
      ? w.requestIdleCallback(run, { timeout: 1500 })
      : window.setTimeout(run, 300);
    return () => {
      if (w.cancelIdleCallback && w.requestIdleCallback) w.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [currentPage, totalPages]);

  // Group QCF words by line_number for line-based rendering
  const qcfLineMap = useMemo(() => {
    const m = new Map<number, QcfWord[]>();
    if (!qcfWords) return m;
    for (const w of qcfWords) {
      const ln = w.line_number ?? 0;
      if (!m.has(ln)) m.set(ln, []);
      m.get(ln)!.push(w);
    }
    return m;
  }, [qcfWords]);

  useEffect(() => {
    const initializePage = async () => {
      const pageNum = pageNumber ? parseInt(pageNumber) : 1;
      setCurrentPage(pageNum);
      
      // Get total page count
      const count = await getPageCount();
      setTotalPages(count);
      
      // Load the requested page
      await loadPageData(pageNum);
    };

    initializePage();
  }, [pageNumber]);

  const loadPageData = async (page: number) => {
    const exists = await checkPageExists(page);
    if (!exists && totalPages > 0) {
      setPageData(null);
      return;
    }

      const data = await loadPage(page);
      setPageData(data);
    
    // Load mistakes for this page
    if (user && data) {
        await loadMistakesForPage(page, data);
    }

    // Preload adjacent pages in background
    if (totalPages > 0 && preloadAdjacentPages) {
      preloadAdjacentPages(page, totalPages);
    }
  };

  // Real-time + safety re-sync for canonical mistake updates.
  useEffect(() => {
    if (!user || !currentPage) return;

    console.log('📡 Setting up real-time mistake subscriptions for page:', currentPage);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = (reason: string) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('🛰️ MushafViewer mistake refresh:', reason);
        loadMistakesForPage(currentPage);
      }, 150);
    };

    const mistakesChannel = supabase
      .channel(`mistakes-page-${currentPage}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mistakes',
      }, (payload) => {
        scheduleRefresh(`realtime:${payload.eventType}`);
      })
      .subscribe();

    const safetyInterval = setInterval(() => {
      scheduleRefresh('safety-resync');
    }, 15000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(safetyInterval);
      supabase.removeChannel(mistakesChannel);
    };
  }, [user?.id, currentPage]);

  const loadMistakesForPage = async (page: number, _pageOverride?: SupabasePage | null) => {
    if (!user) return;

    try {
      // Fetch all mistakes on this page (and surah-scoped legacy ones), then
      // key strictly by Quran.com `word_id` — no positional fallback.
      const { data: pageMistakes, error: pageError } = await supabase
        .from('mistakes')
        .select('*')
        .eq('reciter_id', user.id)
        .not('word_id', 'is', null)
        .eq('page_number', page);

      if (pageError) throw pageError;

      // Also include surah-scoped legacy mistakes (no page_number set) whose
      // word_id matches the QCF words on this page.
      const pageWordIds = new Set<number>();
      (qcfWords ?? []).forEach((w) => {
        if (typeof w.id === 'number') pageWordIds.add(w.id);
      });

      let extra: any[] = [];
      if (pageWordIds.size > 0) {
        const { data: noPageMistakes } = await supabase
          .from('mistakes')
          .select('*')
          .eq('reciter_id', user.id)
          .not('word_id', 'is', null)
          .is('page_number', null)
          .in('word_id', [...pageWordIds]);
        extra = noPageMistakes ?? [];
      }

      const mistakes = new Map<number, MistakeData>();
      [...(pageMistakes ?? []), ...extra].forEach(mistake => {
        if (typeof mistake.word_id !== 'number') return;
        if (mistakes.has(mistake.word_id)) return;
        mistakes.set(mistake.word_id, {
          category: (mistake.mistake_category as MistakeCategory) || 'tajweed',
          date: mistake.created_at ? format(new Date(mistake.created_at), 'MMM dd, yyyy') : '',
          mistakeId: mistake.id,
          note: mistake.note || undefined,
        });
      });

      setHighlightedWords(mistakes);
    } catch (err) {
      console.error('Error loading mistakes:', err);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      navigate(`/mushaf/${nextPage}`);
      loadPageData(nextPage);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);
      navigate(`/mushaf/${prevPage}`);
      loadPageData(prevPage);
    }
  };

  const getCategoryColor = (category: MistakeCategory) => {
    switch (category) {
      case 'tajweed':
        return '#D3E7EE';
      case 'missed':
        return '#FFE0B2';
      case 'harakah':
        return '#E1BEE7';
      case 'incorrect':
        return '#FFCDD2';
      default:
        return '#FFCDD2';
    }
  };

  const getSurahName = (surahNumber: number): string => {
    const surahNames: { [key: number]: string } = {
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
      111: 'المسد', 112: 'الإخلاص', 113: 'الفلق', 114: 'الناس'
    };
    return surahNames[surahNumber] || `سورة ${surahNumber}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 15 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !pageData) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard', { state: { refreshStats: true } })}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          <Alert variant="destructive">
            <AlertDescription>
              {error || `Page ${currentPage} not found. Please import the required Mushaf data first.`}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      {/* Navigation Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/dashboard', { state: { refreshStats: true } })}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousPage}
              disabled={currentPage <= 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            
            <span className="text-sm font-medium">
              صفحة {currentPage} من {totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={currentPage >= totalPages}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mushaf Page Content */}
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-card border-border">
            <CardContent className="p-8">
              <div className="space-y-6" dir="rtl">
                {pageData.lines.map((line) => (
                  <div key={`${pageData.page_number}-${line.line_number}`}>
                    {line.line_type === 'surah_name' && (
                      <div className="my-8 flex flex-col items-center gap-4">
                        <div className="w-full max-w-3xl mx-auto">
                          <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                          <div className="flex items-center justify-center gap-2 -mt-3">
                            <div className="w-2 h-2 rotate-45 bg-primary/40" />
                            <div className="w-3 h-3 rotate-45 bg-primary/60" />
                            <div className="w-2 h-2 rotate-45 bg-primary/40" />
                          </div>
                        </div>
                    <div 
                      className="text-center text-2xl md:text-3xl lg:text-4xl text-primary font-bold py-2"
                      style={{ fontFamily: 'DigitalKhattV2' }}
                    >
                      {line.surah_number && getSurahName(line.surah_number)}
                    </div>
                      </div>
                    )}
                    
                    {line.line_type === 'basmallah' && (
                      <div 
                        className="text-center text-xl md:text-2xl lg:text-3xl text-muted-foreground py-2"
                        style={{ fontFamily: 'DigitalKhattV2' }}
                      >
                        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                      </div>
                    )}
                    
                {line.line_type === 'ayah' && (() => {
                  const qcfLineWords = qcfWords && !qcfError ? qcfLineMap.get(line.line_number) : null;
                  if (!qcfLineWords || qcfLineWords.length === 0) return null;

                  const localLineWords: SupabaseWord[] = line.words ?? [];
                  let localIdx = 0;

                  return (
                    <div
                      className="w-full max-w-3xl mx-auto text-xl md:text-2xl lg:text-3xl leading-tight"
                      style={{
                        lineHeight: '2',
                        textAlign: 'center',
                        direction: 'rtl',
                        wordSpacing: '0.05em',
                      }}
                    >
                      {qcfLineWords.map((word, wordIndex) => {
                        const isEnd = word.char_type_name === 'end';
                        if (!isEnd) localIdx += 1;

                        // Highlight strictly by canonical Quran.com word.id.
                        const wordId = typeof word.id === 'number' ? word.id : null;
                        const mistakeData = !isEnd && wordId != null ? highlightedWords.get(wordId) : undefined;
                        const hasMistake = !!mistakeData;
                        const pageNum = typeof word.page_number === 'number' ? word.page_number : currentPage;
                        const fontReady = qcfLoadedPages.has(pageNum);
                        const useGlyph = !isEnd && fontReady && !!word.code_v2;
                        const family = useGlyph ? `'p${pageNum}-v2'` : "'UthmanicHafs', serif";

                        return (
                          <span
                            key={wordId != null ? `w-${wordId}` : `end-${currentPage}-${line.line_number}-${wordIndex}`}
                            className="relative inline-block transition-opacity"
                            style={{ margin: '0 0.5px' }}
                            title={hasMistake ? `${mistakeData.category} - ${mistakeData.date}` : ''}
                          >
                            {hasMistake && (
                              <span
                                className="absolute rounded-sm pointer-events-none"
                                style={{
                                  backgroundColor: getCategoryColor(mistakeData.category),
                                  top: '1px',
                                  left: '-2px',
                                  right: '-2px',
                                  bottom: '1px',
                                  zIndex: 0,
                                  border: 'none',
                                }}
                              />
                            )}
                            {useGlyph ? (
                              <span
                                className={`relative ${hasMistake ? 'dark:text-black' : ''}`}
                                style={{ zIndex: 1, fontFamily: family }}
                                dangerouslySetInnerHTML={{ __html: word.code_v2! }}
                              />
                            ) : (
                              <span
                                className={`relative ${hasMistake ? 'dark:text-black' : ''}`}
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
                })()}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2">
        <div className="flex items-center gap-2 bg-background/95 backdrop-blur border rounded-lg p-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousPage}
            disabled={currentPage <= 1}
          >
            <ChevronRight className="w-4 h-4" />
            السابق
          </Button>
          
          <div className="px-4 py-2 text-sm bg-muted rounded">
            {currentPage} / {totalPages}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={currentPage >= totalPages}
          >
            التالي
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MushafViewer;