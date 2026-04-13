import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, ChevronUp, ChevronDown, Navigation, Tag, Menu, FileText } from 'lucide-react';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useSupabaseMushaf } from '@/hooks/useSupabaseMushaf';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { usePageFont } from '@/hooks/usePageFont';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AppHeader } from '@/components/AppHeader';

interface MistakeNote {
  id: string;
  ayah_number: number;
  note: string;
  mistake_category: string;
}
const SurahViewer = () => {
  const {
    surahNumber
  } = useParams<{
    surahNumber: string;
  }>();
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const {
    loadPage,
    getSurahStartPage,
    loading,
    error
  } = useSupabaseMushaf();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageData, setPageData] = useState<any>(null);
  const [highlightedWords, setHighlightedWords] = useState<Map<string, {
    category: string;
    date?: string;
  }>>(new Map());
  const [jumpToPage, setJumpToPage] = useState('');
  const [jumpToAyah, setJumpToAyah] = useState('');
  const [surahPageRange, setSurahPageRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [surahAyahCount, setSurahAyahCount] = useState<number | null>(null);
  const [currentSurahNumber, setCurrentSurahNumber] = useState<number | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [mistakeNotes, setMistakeNotes] = useState<MistakeNote[]>([]);
  const [editingNote, setEditingNote] = useState<MistakeNote | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);

  // Load page-specific font
  const { fontFamily: pageFontFamily, fontLoaded } = usePageFont(currentPage);
  const isMobile = useIsMobile();

  // Helper functions for mistake categories
  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'tajweed':
        return '#D3e7ee';
      case 'missed':
        return '#FFE0B2';
      case 'harakah':
        return '#bec4ed';
      case 'incorrect':
        return '#f28a8a';
      default:
        return '#D3e7ee';
    }
  };
  const getCategoryBorderColor = (category: string): string => {
    switch (category) {
      case 'tajweed':
        return 'hsl(var(--mistake-tajweed-border))';
      case 'missed':
        return 'hsl(var(--mistake-missed-border))';
      case 'harakah':
        return 'hsl(var(--mistake-harakah-border))';
      case 'incorrect':
        return 'hsl(var(--mistake-incorrect-border))';
      default:
        return 'hsl(var(--mistake-tajweed-border))';
    }
  };
  const getSurahName = (surahNum: number): string => {
    const surahNames: {
      [key: number]: string;
    } = {
      1: 'الفاتحة',
      2: 'البقرة',
      3: 'آل عمران',
      4: 'النساء',
      5: 'المائدة',
      6: 'الأنعام',
      7: 'الأعراف',
      8: 'الأنفال',
      9: 'التوبة',
      10: 'يونس',
      11: 'هود',
      12: 'يوسف',
      13: 'الرعد',
      14: 'إبراهيم',
      15: 'الحجر',
      16: 'النحل',
      17: 'الإسراء',
      18: 'الكهف',
      19: 'مريم',
      20: 'طه',
      21: 'الأنبياء',
      22: 'الحج',
      23: 'المؤمنون',
      24: 'النور',
      25: 'الفرقان',
      26: 'الشعراء',
      27: 'النمل',
      28: 'القصص',
      29: 'العنكبوت',
      30: 'الروم',
      31: 'لقمان',
      32: 'السجدة',
      33: 'الأحزاب',
      34: 'سبأ',
      35: 'فاطر',
      36: 'يس',
      37: 'الصافات',
      38: 'ص',
      39: 'الزمر',
      40: 'غافر',
      41: 'فصلت',
      42: 'الشورى',
      43: 'الزخرف',
      44: 'الدخان',
      45: 'الجاثية',
      46: 'الأحقاف',
      47: 'محمد',
      48: 'الفتح',
      49: 'الحجرات',
      50: 'ق',
      51: 'الذاريات',
      52: 'الطور',
      53: 'النجم',
      54: 'القمر',
      55: 'الرحمن',
      56: 'الواقعة',
      57: 'الحديد',
      58: 'المجادلة',
      59: 'الحشر',
      60: 'الممتحنة',
      61: 'الصف',
      62: 'الجمعة',
      63: 'المنافقون',
      64: 'التغابن',
      65: 'الطلاق',
      66: 'التحريم',
      67: 'الملك',
      68: 'القلم',
      69: 'الحاقة',
      70: 'المعارج',
      71: 'نوح',
      72: 'الجن',
      73: 'المزمل',
      74: 'المدثر',
      75: 'القيامة',
      76: 'الإنسان',
      77: 'المرسلات',
      78: 'النبأ',
      79: 'النازعات',
      80: 'عبس',
      81: 'التكوير',
      82: 'الانفطار',
      83: 'المطففين',
      84: 'الانشقاق',
      85: 'البروج',
      86: 'الطارق',
      87: 'الأعلى',
      88: 'الغاشية',
      89: 'الفجر',
      90: 'البلد',
      91: 'الشمس',
      92: 'الليل',
      93: 'الضحى',
      94: 'الشرح',
      95: 'التين',
      96: 'العلق',
      97: 'القدر',
      98: 'البينة',
      99: 'الزلزلة',
      100: 'العاديات',
      101: 'القارعة',
      102: 'التكاثر',
      103: 'العصر',
      104: 'الهمزة',
      105: 'الفيل',
      106: 'قريش',
      107: 'الماعون',
      108: 'الكوثر',
      109: 'الكافرون',
      110: 'النصر',
      111: 'المسد',
      112: 'الإخلاص',
      113: 'الفلق',
      114: 'الناس'
    };
    return surahNames[surahNum] || `سورة ${surahNum}`;
  };
  const getSurahAyahCount = (surahNum: number): number => {
    const ayahCounts: {
      [key: number]: number;
    } = {
      1: 7,
      2: 286,
      3: 200,
      4: 176,
      5: 120,
      6: 165,
      7: 206,
      8: 75,
      9: 129,
      10: 109,
      11: 123,
      12: 111,
      13: 43,
      14: 52,
      15: 99,
      16: 128,
      17: 111,
      18: 110,
      19: 98,
      20: 135,
      21: 112,
      22: 78,
      23: 118,
      24: 64,
      25: 77,
      26: 227,
      27: 93,
      28: 88,
      29: 69,
      30: 60,
      31: 34,
      32: 30,
      33: 73,
      34: 54,
      35: 45,
      36: 83,
      37: 182,
      38: 88,
      39: 75,
      40: 85,
      41: 54,
      42: 53,
      43: 89,
      44: 59,
      45: 37,
      46: 35,
      47: 38,
      48: 29,
      49: 18,
      50: 45,
      51: 60,
      52: 49,
      53: 62,
      54: 55,
      55: 78,
      56: 96,
      57: 29,
      58: 22,
      59: 24,
      60: 13,
      61: 14,
      62: 11,
      63: 11,
      64: 18,
      65: 12,
      66: 12,
      67: 30,
      68: 52,
      69: 52,
      70: 44,
      71: 28,
      72: 28,
      73: 20,
      74: 56,
      75: 40,
      76: 31,
      77: 50,
      78: 40,
      79: 46,
      80: 42,
      81: 29,
      82: 19,
      83: 36,
      84: 25,
      85: 22,
      86: 17,
      87: 19,
      88: 26,
      89: 30,
      90: 20,
      91: 15,
      92: 21,
      93: 11,
      94: 8,
      95: 8,
      96: 19,
      97: 5,
      98: 8,
      99: 8,
      100: 11,
      101: 11,
      102: 8,
      103: 3,
      104: 9,
      105: 5,
      106: 4,
      107: 7,
      108: 3,
      109: 6,
      110: 3,
      111: 5,
      112: 4,
      113: 5,
      114: 6
    };
    return ayahCounts[surahNum] || 0;
  };

  // Load initial page based on surah
  useEffect(() => {
    const loadSurahPage = async () => {
      if (surahNumber) {
        const surahNum = parseInt(surahNumber);
        console.log('📚 Loading surah data for:', surahNum);
        const pageNum = await getSurahStartPage(surahNum);
        console.log('📄 Surah start page:', pageNum);
        if (pageNum) {
          // Update surah metadata first
          await updateSurahMetadata(surahNum);
          // Then load the page
          loadPageData(pageNum);
        } else {
          console.error(`Could not find starting page for Surah ${surahNum}`);
        }
      }
    };
    loadSurahPage();
  }, [surahNumber, getSurahStartPage]);
  const loadPageData = useCallback(async (pageNumber: number) => {
    try {
      const page = await loadPage(pageNumber);
      setPageData(page);
      setCurrentPage(pageNumber);

      // Load mistakes for this page
      if (user && page) {
        await loadMistakesForPage(pageNumber);
      }
    } catch (err) {
      console.error('Failed to load page:', err);
    }
  }, [loadPage, user]);
  const loadMistakesForPage = async (page: number) => {
    if (!user) return;
    try {
      console.log('📋 [SurahViewer] Loading mistakes for user:', user.id, 'page:', page);
      const {
        data,
        error
      } = await supabase.from('mistakes').select('*').eq('reciter_id', user.id).eq('page_number', page);
      if (error) throw error;
      console.log('✅ [SurahViewer] Mistakes loaded:', data?.length || 0, 'mistakes', data);
      const mistakeMap = new Map<string, {
        category: string;
        date?: string;
      }>();
      const notesWithData: MistakeNote[] = [];
      data?.forEach(mistake => {
        const wordKey = `${mistake.surah_number}-${mistake.ayah_number}-${mistake.word_index}`;
        mistakeMap.set(wordKey, {
          category: mistake.mistake_category || 'tajweed',
          date: mistake.created_at ? format(new Date(mistake.created_at), 'MMM dd, yyyy') : undefined
        });
        console.log('  → Mistake word:', wordKey, 'category:', mistake.mistake_category);
        
        // Collect mistakes with notes
        if (mistake.note) {
          notesWithData.push({
            id: mistake.id,
            ayah_number: mistake.ayah_number,
            note: mistake.note,
            mistake_category: mistake.mistake_category || 'tajweed'
          });
        }
      });
      console.log('✅ [SurahViewer] Setting highlightedWords with', mistakeMap.size, 'mistakes');
      setHighlightedWords(mistakeMap);
      setMistakeNotes(notesWithData);
    } catch (err) {
      console.error('Error loading mistakes:', err);
    }
  };
  const updateSurahMetadata = async (surahNum: number) => {
    console.log('🔄 Updating surah metadata for surah:', surahNum);

    // Update ayah count
    const ayahCount = getSurahAyahCount(surahNum);
    setSurahAyahCount(ayahCount);
    setCurrentSurahNumber(surahNum);

    // Get page range for this surah
    try {
      const {
        data: firstWord,
        error: firstError
      } = await supabase.from('words').select('id').eq('surah', surahNum).order('id', {
        ascending: true
      }).limit(1).maybeSingle();
      if (firstError) throw firstError;
      const {
        data: lastWord,
        error: lastError
      } = await supabase.from('words').select('id').eq('surah', surahNum).order('id', {
        ascending: false
      }).limit(1).maybeSingle();
      if (lastError) throw lastError;
      if (firstWord && lastWord) {
        const {
          data: pagesData,
          error: pagesError
        } = await supabase.from('pages').select('page_number').lte('first_word_id', lastWord.id).gte('last_word_id', firstWord.id).order('page_number');
        if (pagesData && pagesData.length > 0 && !pagesError) {
          const uniquePages = [...new Set(pagesData.map(p => p.page_number))];
          const range = {
            start: Math.min(...uniquePages),
            end: Math.max(...uniquePages)
          };
          console.log('✅ Updated page range:', range);
          setSurahPageRange(range);
        }
      }
    } catch (err) {
      console.error('Error updating surah metadata:', err);
    }
  };

  // Detect surah changes when page data changes
  useEffect(() => {
    if (!pageData || !pageData.lines) return;

    // Find the primary surah on this page
    let primarySurah: number | null = null;

    // First, check for surah_name lines (most reliable)
    for (const line of pageData.lines) {
      if (line.line_type === 'surah_name' && line.surah_number) {
        primarySurah = line.surah_number;
        break;
      }
    }

    // If no surah_name found, get surah from first word
    if (!primarySurah) {
      for (const line of pageData.lines) {
        if (line.words && line.words.length > 0) {
          primarySurah = line.words[0].surah;
          break;
        }
      }
    }

    // Update metadata if we found a different surah
    if (primarySurah && primarySurah !== currentSurahNumber) {
      console.log('📚 Surah changed from', currentSurahNumber, 'to', primarySurah);
      updateSurahMetadata(primarySurah);
    }
  }, [pageData, currentSurahNumber]);
  const goToNextPage = useCallback(() => {
    if (currentPage < 604) {
      loadPageData(currentPage + 1);
    }
  }, [currentPage, loadPageData]);
  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      loadPageData(currentPage - 1);
    }
  }, [currentPage, loadPageData]);
  const handleEditNote = (note: MistakeNote) => {
    setEditingNote(note);
    setEditNoteText(note.note);
    setIsEditDrawerOpen(true);
  };

  const handleSaveEditedNote = async () => {
    if (!editingNote || !user) return;

    try {
      const { error } = await supabase
        .from('mistakes')
        .update({ note: editNoteText })
        .eq('id', editingNote.id);

      if (error) throw error;

      // Update local state
      setMistakeNotes(prev => 
        prev.map(n => n.id === editingNote.id ? { ...n, note: editNoteText } : n)
      );
      
      setIsEditDrawerOpen(false);
      setEditingNote(null);
      setEditNoteText('');
    } catch (err) {
      console.error('Error updating note:', err);
    }
  };

  const handleJumpToPage = () => {
    console.log('🔍 handleJumpToPage called', {
      jumpToPage,
      surahPageRange,
      surahNumber
    });
    const pageNum = parseInt(jumpToPage);
    console.log('📄 Parsed page number:', pageNum);
    if (!pageNum || isNaN(pageNum)) {
      console.warn('❌ Invalid page number');
      return;
    }

    // Validate page is within Quran range (1-604)
    if (pageNum < 1 || pageNum > 604) {
      console.warn(`❌ Page ${pageNum} is outside valid range (1-604)`);
      alert(`Please enter a page between 1 and 604.`);
      return;
    }
    console.log('✅ Loading page...');
    loadPageData(pageNum);
    setJumpToPage('');
  };
  const handleJumpToAyah = async () => {
    console.log('🔍 handleJumpToAyah called', {
      jumpToAyah,
      surahNumber,
      surahAyahCount
    });
    const ayahNum = parseInt(jumpToAyah);
    const surahNum = parseInt(surahNumber || '1');
    console.log('📖 Parsed values:', {
      ayahNum,
      surahNum
    });
    if (!ayahNum || isNaN(ayahNum) || !surahNum) {
      console.warn('❌ Invalid ayah or surah number');
      return;
    }
    if (surahAyahCount && (ayahNum < 1 || ayahNum > surahAyahCount)) {
      console.warn(`❌ Ayah ${ayahNum} is outside this surah's range (1-${surahAyahCount})`);
      alert(`Please enter an ayah between 1 and ${surahAyahCount} for this surah.`);
      return;
    }
    try {
      console.log('🔎 Querying database for ayah...');

      // First, find a word from this ayah
      const {
        data: wordData,
        error: wordError
      } = await supabase.from('words').select('id').eq('surah', surahNum).eq('ayah', ayahNum).limit(1).maybeSingle();
      if (wordError) throw wordError;
      if (!wordData) {
        console.warn(`⚠️ Ayah ${ayahNum} not found in surah ${surahNum}`);
        alert(`Ayah ${ayahNum} not found in this surah.`);
        return;
      }
      console.log('📝 Found word ID:', wordData.id);

      // Now find which page contains this word
      const {
        data: pageData,
        error: pageError
      } = await supabase.from('pages').select('page_number').lte('first_word_id', wordData.id).gte('last_word_id', wordData.id).limit(1).maybeSingle();
      console.log('📊 Page response:', {
        data: pageData,
        error: pageError
      });
      if (pageError) {
        console.error('❌ Error finding page:', pageError);
        alert('Error finding ayah. Please try again.');
        return;
      }
      if (pageData && pageData.page_number) {
        console.log('✅ Found ayah on page:', pageData.page_number);
        loadPageData(pageData.page_number);
        setJumpToAyah('');
      } else {
        console.warn(`⚠️ Could not find page for ayah ${ayahNum}`);
        alert(`Could not find page for this ayah.`);
      }
    } catch (err) {
      console.error('❌ Error finding ayah:', err);
      alert('Error finding ayah. Please try again.');
    }
  };
  if ((loading && !pageData) || !fontLoaded) {
    return <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
            </CardContent>
          </Card>
        </div>
      </div>;
  }
  if (error) {
    return <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="flex items-center justify-center h-96">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">Failed to load Mushaf page</p>
                <p className="text-sm text-red-500 mb-4">{error}</p>
                <Button onClick={() => navigate('/dashboard')} variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>;
  }
  const renderAyahMarker = (ayahNumber: number) => <span className="ayah-marker inline-flex items-center justify-center w-6 h-6 mx-1 text-xs bg-primary/10 border border-primary/30 rounded-full text-primary font-semibold" style={{
    fontFamily: 'Inter, sans-serif'
  }}>
      {ayahNumber}
    </span>;
  return <div className="min-h-screen bg-background">
      <AppHeader />
      
      {/* Edit Note Drawer (Desktop) / Sheet (Mobile) */}
      {!isMobile ? (
        <Drawer open={isEditDrawerOpen} onOpenChange={setIsEditDrawerOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Edit Note</DrawerTitle>
              <DrawerDescription>
                Update the note for Ayah {editingNote?.ayah_number}
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <Textarea
                value={editNoteText}
                onChange={(e) => setEditNoteText(e.target.value)}
                placeholder="Type your note here..."
                className="min-h-[120px]"
              />
            </div>
            <DrawerFooter>
              <Button onClick={handleSaveEditedNote}>Save</Button>
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={isEditDrawerOpen} onOpenChange={setIsEditDrawerOpen}>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Edit Note</SheetTitle>
              <SheetDescription>
                Update the note for Ayah {editingNote?.ayah_number}
              </SheetDescription>
            </SheetHeader>
            <div className="py-4">
              <Textarea
                value={editNoteText}
                onChange={(e) => setEditNoteText(e.target.value)}
                placeholder="Type your note here..."
                className="min-h-[120px]"
              />
            </div>
            <SheetFooter>
              <SheetClose asChild>
                <Button variant="outline">Cancel</Button>
              </SheetClose>
              <Button onClick={handleSaveEditedNote}>Save</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}
      <div className="container mx-auto px-4 py-8">
        {/* Navigation Header */}
        <div className="mb-6">
          <Button onClick={() => navigate('/dashboard')} variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <Card>
            
          </Card>
        </div>

        {/* Main Content with Sidebar */}
        <div className="flex gap-4">
          {/* Navigation Sidebar - Left Side (Desktop) or Collapsible (Mobile) */}
          {!isMobile ? <div className="w-44 shrink-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Navigation className="w-4 h-4" />
                    Navigation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="jump-page" className="text-xs">Jump to Page</Label>
                    <div className="flex gap-2">
                      <Input id="jump-page" type="number" min={surahPageRange?.start || 1} max={surahPageRange?.end || 604} placeholder={surahPageRange ? `${surahPageRange.start}-${surahPageRange.end}` : 'Page #'} value={jumpToPage} onChange={e => setJumpToPage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleJumpToPage()} className="h-8 text-sm" />
                      <Button onClick={handleJumpToPage} size="sm" disabled={!jumpToPage} className="h-8 px-3 bg-[#c6a477]">
                        Go
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="jump-ayah" className="text-xs">Jump to Ayah</Label>
                    <div className="flex gap-2">
                      <Input id="jump-ayah" type="number" min="1" max={surahAyahCount || undefined} placeholder={surahAyahCount ? `1-${surahAyahCount}` : 'Ayah #'} value={jumpToAyah} onChange={e => setJumpToAyah(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleJumpToAyah()} className="h-8 text-sm" />
                      <Button onClick={handleJumpToAyah} size="sm" disabled={!jumpToAyah} className="h-8 px-3 bg-[#c6a477]">
                        Go
                      </Button>
                    </div>
                  </div>
                </CardContent>
                
                {/* Mistake Legend */}
                <div className="px-4 pb-4 pt-3 border-t border-border">
                  <div className="text-base font-semibold mb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Mistake Types
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <div style={{
                    backgroundColor: 'hsl(var(--mistake-incorrect))',
                    borderColor: 'hsl(var(--mistake-incorrect))'
                  }} className="w-6 h-4 rounded border-2" />
                      <span className="text-muted-foreground">Incorrect</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div style={{
                    backgroundColor: 'hsl(var(--mistake-missed))',
                    borderColor: 'hsl(var(--mistake-missed))'
                  }} className="w-6 h-4 rounded border-2" />
                      <span className="text-muted-foreground">Missed</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div style={{
                    backgroundColor: 'hsl(var(--mistake-tajweed))',
                    borderColor: 'hsl(var(--mistake-tajweed))'
                  }} className="w-6 h-4 rounded border-2" />
                      <span className="text-muted-foreground">Tajweed</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div style={{
                    backgroundColor: 'hsl(var(--mistake-harakah))',
                    borderColor: 'hsl(var(--mistake-harakah))'
                  }} className="w-6 h-4 rounded border-2" />
                      <span className="text-muted-foreground">Harakah</span>
                    </div>
                  </div>
                </div>
                
                {/* Mistake Notes Section */}
                {mistakeNotes.length > 0 && (
                  <div className="px-4 pb-4 pt-3 border-t border-border">
                    <div className="text-base font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Mistake Notes
                    </div>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-3 pr-4">
                        {mistakeNotes.map((note, idx) => (
                          <div 
                            key={idx} 
                            className="space-y-1 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
                            onClick={() => handleEditNote(note)}
                          >
                            <div className="text-xs font-medium" style={{ 
                              color: note.mistake_category === 'tajweed' 
                                ? 'hsl(var(--mistake-tajweed-border))' 
                                : note.mistake_category === 'missed' 
                                ? 'hsl(var(--mistake-missed-border))' 
                                : note.mistake_category === 'incorrect'
                                ? 'hsl(var(--mistake-incorrect-border))'
                                : 'hsl(var(--mistake-harakah-border))'
                            }}>
                              Ayah {note.ayah_number}
                            </div>
                            <div className="text-xs text-muted-foreground">{note.note}</div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </Card>
            </div> : null}

          {/* Main Content */}
          <div className="flex-1">
            {/* Mobile Navigation and Legend - Above Everything */}
            {isMobile && <div className="flex items-start gap-2 mb-4">
                <Collapsible open={isNavOpen} onOpenChange={setIsNavOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Navigation className="w-4 h-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className={`mt-2 absolute left-4 z-10 ${isMobile ? 'w-72' : 'w-auto'}`}>
                    <Card>
                      <CardContent className="pt-4 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="jump-page-mobile" className="text-xs">Jump to Page</Label>
                          <div className="flex gap-2">
                            <Input id="jump-page-mobile" type="number" min={surahPageRange?.start || 1} max={surahPageRange?.end || 604} placeholder={surahPageRange ? `${surahPageRange.start}-${surahPageRange.end}` : 'Page #'} value={jumpToPage} onChange={e => setJumpToPage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleJumpToPage()} className="h-8 text-sm" />
                            <Button onClick={handleJumpToPage} size="sm" disabled={!jumpToPage} className="h-8 px-3">
                              Go
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="jump-ayah-mobile" className="text-xs">Jump to Ayah</Label>
                          <div className="flex gap-2">
                            <Input id="jump-ayah-mobile" type="number" min="1" max={surahAyahCount || undefined} placeholder={surahAyahCount ? `1-${surahAyahCount}` : 'Ayah #'} value={jumpToAyah} onChange={e => setJumpToAyah(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleJumpToAyah()} className="h-8 text-sm" />
                            <Button onClick={handleJumpToAyah} size="sm" disabled={!jumpToAyah} className="h-8 px-3">
                              Go
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>
                
                {/* Mistake Types Legend - Horizontal (Mobile Only) */}
                <Card className="flex-1">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-around gap-1.5">
                      <div className="flex items-center gap-1 text-[10px]">
                        <div className="w-5 h-3 rounded border-2" style={{
                      backgroundColor: 'hsl(var(--mistake-incorrect))',
                      borderColor: 'hsl(var(--mistake-incorrect))'
                    }} />
                        <span className="text-muted-foreground whitespace-nowrap">Incorrect</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px]">
                        <div className="w-5 h-3 rounded border-2" style={{
                      backgroundColor: 'hsl(var(--mistake-missed))',
                      borderColor: 'hsl(var(--mistake-missed))'
                    }} />
                        <span className="text-muted-foreground whitespace-nowrap">Missed</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px]">
                        <div className="w-5 h-3 rounded border-2" style={{
                      backgroundColor: 'hsl(var(--mistake-tajweed))',
                      borderColor: 'hsl(var(--mistake-tajweed))'
                    }} />
                        <span className="text-muted-foreground whitespace-nowrap">Tajweed</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px]">
                        <div className="w-5 h-3 rounded border-2" style={{
                      backgroundColor: 'hsl(var(--mistake-harakah))',
                      borderColor: 'hsl(var(--mistake-harakah))'
                    }} />
                        <span className="text-muted-foreground whitespace-nowrap">Harakah</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>}

        {/* Page Navigation */}
        <div className="flex justify-between items-center gap-2 mb-4">
          <Button onClick={goToPreviousPage} variant="outline" size="sm" disabled={currentPage === 1} className="flex-none h-6 px-1 text-[10px]">
            <ChevronUp className="w-2 h-2 mr-0.5" />
            {isMobile ? 'Previous' : 'Previous Page'}
          </Button>
          
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 whitespace-nowrap">
            {isMobile ? currentPage : `Page ${currentPage}`}
          </Badge>
          
          <Button onClick={goToNextPage} variant="outline" size="sm" disabled={currentPage === 604} className="flex-none h-6 px-1 text-[10px]">
            {isMobile ? 'Next' : 'Next Page'}
            <ChevronDown className="w-2 h-2 ml-0.5" />
          </Button>
        </div>

        {/* Mushaf Page */}
        <Card className="page-container">
          
          <CardContent className="p-3 md:p-4 lg:p-6 min-h-[600px] px-[12px] py-[40px]" style={isMobile ? {
              maxWidth: '100%'
            } : {}}>
            {loading || !pageData ? <div className="space-y-4">
                {Array.from({
                  length: 15
                }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div> : <div className="arabic-text text-center leading-normal">
                <div className="space-y-2">
                  {pageData.lines?.map((line: any, lineIndex: number) => {
                    const isSurahName = line.line_type === 'surah_name';
                    const isBasmallah = line.line_type === 'basmallah';
                    return <div key={`line-${line.line_number}`}>
                      {isSurahName && line.surah_number && <div className="my-8 flex flex-col items-center gap-4">
                        <div className="w-full max-w-xl mx-auto">
                          <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                              <div className="flex items-center justify-center gap-2 -mt-3">
                                
                                
                                
                              </div>
                            </div>
                            <div className="text-center text-2xl md:text-3xl lg:text-4xl text-primary font-bold py-2" style={{
                          fontFamily: 'DigitalKhattV2'
                        }}>
                              {getSurahName(line.surah_number)}
                            </div>
                          </div>}
                        {isBasmallah && <div className="text-center text-xl md:text-2xl lg:text-3xl text-muted-foreground py-2" style={{
                        fontFamily: 'DigitalKhattV2'
                      }}>
                            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                          </div>}
                       {!isSurahName && !isBasmallah && <div className="text-xl md:text-2xl lg:text-3xl leading-tight w-full mx-auto" style={{
                        fontFamily: pageFontFamily,
                        lineHeight: '1.6',
                        textAlign: 'center',
                        direction: 'rtl',
                        wordSpacing: '-0.02em',
                        maxWidth: isMobile ? '100%' : '36rem'
                      }}>
                          {line.words?.map((word: any, wordIndex: number) => {
                          const wordKey = `${word.surah}-${word.ayah}-${word.word}`;
                          const mistakeData = highlightedWords.get(wordKey);
                          const hasMistake = !!mistakeData;
                          const mistakeCategory = mistakeData?.category;
                          const mistakeDate = mistakeData?.date;
                          
                          const getCategoryLabel = (cat: string) => {
                            switch (cat) {
                              case 'tajweed':
                                return 'Tajweed mistake';
                              case 'missed':
                                return 'Missed word';
                              case 'harakah':
                                return 'Harakah mistake';
                              case 'incorrect':
                                return 'Incorrect word';
                              default:
                                return 'Mistake';
                            }
                          };
                          const tooltip = hasMistake && mistakeCategory ? `${getCategoryLabel(mistakeCategory)}${mistakeDate ? ` - ${mistakeDate}` : ''}` : '';
                          
                          return <span 
                            key={`${currentPage}-${line.line_number}-${wordIndex}`} 
                            className="quran-word relative inline-block" 
                            data-word-id={word.id} 
                            data-ayah={word.ayah} 
                            data-surah={word.surah} 
                            title={tooltip} 
                            style={{
                              margin: '0 0.5px'
                            }}>
                            {hasMistake && mistakeCategory && (
                              <span 
                                className="absolute rounded-sm pointer-events-none"
                                style={{
                                  backgroundColor: getCategoryColor(mistakeCategory),
                                  top: '1px',
                                  left: '-2px',
                                  right: '-2px',
                                  bottom: '1px',
                                  zIndex: 0,
                                  border: 'none'
                                }}
                              />
                            )}
                            <span className={`relative ${hasMistake ? 'dark:text-black' : ''}`} style={{ zIndex: 1 }}>{word.text}</span>
                          </span>;
                        })}
                        </div>}
                      </div>;
                  })}
                </div>
              </div>}
          </CardContent>
          
          
        </Card>

        {/* Bottom Navigation */}
        <div className="flex justify-between items-center gap-2 mt-4">
          <Button onClick={goToPreviousPage} variant="outline" size="sm" disabled={currentPage === 1} className="flex-none h-6 px-1 text-[10px]">
            <ChevronUp className="w-2 h-2 mr-0.5" />
            {isMobile ? 'Previous' : 'Previous Page'}
          </Button>
          
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 whitespace-nowrap">
            {isMobile ? currentPage : `Page ${currentPage}`}
          </Badge>
          
          <Button onClick={goToNextPage} variant="outline" size="sm" disabled={currentPage === 604} className="flex-none h-6 px-1 text-[10px]">
            {isMobile ? 'Next' : 'Next Page'}
            <ChevronDown className="w-2 h-2 ml-0.5" />
          </Button>
        </div>
        </div>
        </div>
      </div>
    </div>;
};
export default SurahViewer;