import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { useSupabaseMushaf, SupabasePage, SupabaseWord } from '@/hooks/useSupabaseMushaf';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePageFont } from '@/hooks/usePageFont';
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
  const [highlightedWords, setHighlightedWords] = useState<Map<string, MistakeData>>(new Map());
  
  // Load page-specific font
  const { fontFamily: pageFontFamily, fontLoaded } = usePageFont(currentPage);

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
      await loadMistakesForPage(page);
    }

    // Preload adjacent pages in background
    if (totalPages > 0 && preloadAdjacentPages) {
      preloadAdjacentPages(page, totalPages);
    }
  };

  // Add real-time subscription for mistake updates
  useEffect(() => {
    if (!user || !currentPage) return;

    console.log('📡 Setting up real-time mistake subscription for page:', currentPage);

    const channel = supabase
      .channel(`mistakes-page-${currentPage}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mistakes',
        filter: `reciter_id=eq.${user.id}`
      }, (payload) => {
        console.log('📡 Mistake change detected:', payload);
        // Check if this mistake is on the current page
        const mistakePageNumber = (payload.new as any)?.page_number || (payload.old as any)?.page_number;
        if (mistakePageNumber === currentPage) {
          loadMistakesForPage(currentPage);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, currentPage]);

  const loadMistakesForPage = async (page: number) => {
    if (!user) return;

    try {
      // 1. Mistakes with page_number set (session mistakes)
      const { data: pageMistakes, error: err1 } = await supabase
        .from('mistakes')
        .select('*')
        .eq('reciter_id', user.id)
        .eq('page_number', page);

      if (err1) throw err1;

      // 2. Find which surahs are on this page to also load memorization mistakes (no page_number)
      const surahsOnPage = new Set<number>();
      if (pageData?.lines) {
        for (const line of pageData.lines) {
          if (line.words) {
            for (const w of line.words) {
              if (w.surah) surahsOnPage.add(w.surah);
            }
          }
        }
      }

      let noPageMistakes: any[] = [];
      let blockMistakes: any[] = [];

      for (const surahId of surahsOnPage) {
        const { data: d1 } = await supabase
          .from('mistakes')
          .select('*')
          .eq('reciter_id', user.id)
          .is('page_number', null)
          .eq('surah_number', surahId);
        if (d1) noPageMistakes.push(...d1);

        const { data: d2 } = await supabase
          .from('block_review_mistakes')
          .select('*')
          .eq('user_id', user.id)
          .eq('surah_id', surahId);
        if (d2) blockMistakes.push(...d2);
      }

      const mistakes = new Map<string, MistakeData>();
      const seenKeys = new Set<string>();

      // Merge all sources
      [...(pageMistakes || []), ...noPageMistakes].forEach(mistake => {
        const wordKey = `${mistake.surah_number}-${mistake.ayah_number}-${mistake.word_index}`;
        if (!seenKeys.has(wordKey)) {
          seenKeys.add(wordKey);
          mistakes.set(wordKey, {
            category: (mistake.mistake_category as MistakeCategory) || 'tajweed',
            date: mistake.created_at ? format(new Date(mistake.created_at), 'MMM dd, yyyy') : '',
            mistakeId: mistake.id,
            note: mistake.note || undefined
          });
        }
      });

      blockMistakes.forEach(bm => {
        const wordKey = `${bm.surah_id}-${bm.ayah_number}-${bm.word_index}`;
        if (!seenKeys.has(wordKey)) {
          seenKeys.add(wordKey);
          mistakes.set(wordKey, {
            category: (bm.mistake_type as MistakeCategory) || 'incorrect',
            date: bm.created_at ? format(new Date(bm.created_at), 'MMM dd, yyyy') : '',
          });
        }
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

  const getCategoryBorderColor = (category: MistakeCategory) => {
    switch (category) {
      case 'tajweed':
        return 'hsl(var(--mistake-tajweed))';
      case 'missed':
        return 'hsl(var(--mistake-missed))';
      case 'harakah':
        return 'hsl(var(--mistake-harakah))';
      case 'incorrect':
        return 'hsl(var(--mistake-incorrect))';
      default:
        return 'hsl(var(--mistake-incorrect))';
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

  if (loading || !fontLoaded) {
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
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
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
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
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
                    
                {line.line_type === 'ayah' && (
                  <div 
                    className="w-full max-w-3xl mx-auto text-xl md:text-2xl lg:text-3xl leading-tight"
                    style={{ 
                      fontFamily: pageFontFamily,
                      lineHeight: '2',
                      textAlign: 'center',
                      direction: 'rtl',
                      wordSpacing: '0.05em'
                    }}
                  >
                    {line.words.map((word) => {
                      const wordKey = `${word.surah}-${word.ayah}-${word.word}`;
                      const mistakeData = highlightedWords.get(wordKey);
                      const hasMistake = mistakeData !== undefined;
                      
                      return (
                        <span
                          key={word.id}
                          className="transition-colors duration-200 rounded-sm"
                          style={
                            hasMistake
                              ? {
                                  backgroundColor: getCategoryColor(mistakeData.category),
                                  border: `2px solid ${getCategoryBorderColor(mistakeData.category)}`,
                                  padding: '2px 4px',
                                  color: 'black'
                                }
                              : undefined
                          }
                          title={hasMistake ? `${mistakeData.category} - ${mistakeData.date}` : ''}
                        >
                          {word.text}
                        </span>
                      );
                    })}
                  </div>
                )}
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