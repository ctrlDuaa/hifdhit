import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Tag, CircleDot, Circle, FileText } from 'lucide-react';
import { useSupabaseMushaf, SupabasePage, SupabaseWord } from '@/hooks/useSupabaseMushaf';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useQcfFontLoader, prefetchQcfPageFont } from '@/hooks/useQcfFontLoader';
import { quranApi } from '@/services/quranApi';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
type MistakeCategory = 'tajweed' | 'missed' | 'harakah' | 'incorrect';
interface MistakeData {
  category: MistakeCategory;
  date: string;
  mistakeId?: string;
  sessionId?: string;
}
interface SessionMushafViewerProps {
  sessionId: string;
  initialPage: number;
  userRole: 'reciter' | 'checker';
  reciterId: string;
  onPageChange?: (page: number, surah: number, ayah: number) => void;
}
export const SessionMushafViewer = ({
  sessionId,
  initialPage,
  userRole,
  reciterId,
  onPageChange
}: SessionMushafViewerProps) => {
  const {
    loadPage,
    getPageCount,
    checkPageExists,
    preloadAdjacentPages,
    loading,
    error
  } = useSupabaseMushaf();
  const {
    toast
  } = useToast();
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageData, setPageData] = useState<SupabasePage | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [highlightedWords, setHighlightedWords] = useState<Map<string, MistakeData>>(new Map());
  const [pastMistakes, setPastMistakes] = useState<Map<string, MistakeData>>(new Map());
  const [selectedWord, setSelectedWord] = useState<SupabaseWord | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [noteDrawerOpen, setNoteDrawerOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState('');

  const isMobile = useIsMobile();

  // ── QCF V2 (Quran Foundation glyph rendering) ──
  const [qcfWords, setQcfWords] = useState<any[]>([]);

  useEffect(() => {
    if (!currentPage) return;
    let cancelled = false;
    setQcfWords([]);
    (async () => {
      try {
        const responseJson = await quranApi.getPageQcf(currentPage);
        const verses: any[] = Array.isArray(responseJson?.verses) ? responseJson.verses : [];
        const words: any[] = Array.isArray(responseJson?.words_flattened)
          ? responseJson.words_flattened
          : verses.flatMap((v: any) => v?.words ?? []);
        if (cancelled) return;
        setQcfWords(words);
      } catch {
        if (!cancelled) setQcfWords([]);
      }
    })();
    if (currentPage > 1) quranApi.prefetchPageQcf(currentPage - 1);
    if (currentPage < 604) quranApi.prefetchPageQcf(currentPage + 1);
    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  const { loadedPages: qcfLoadedPages } = useQcfFontLoader(qcfWords);

  // Group QCF words by line for lockstep rendering
  const qcfLineMap = useMemo(() => {
    const m = new Map<number, any[]>();
    for (const w of qcfWords) {
      const ln = w.line_number ?? 0;
      if (!m.has(ln)) m.set(ln, []);
      m.get(ln)!.push(w);
    }
    return m;
  }, [qcfWords]);

  // Prefetch QCF fonts for adjacent pages
  useEffect(() => {
    if (!currentPage) return;
    const candidates = [currentPage - 1, currentPage + 1].filter(
      (p) => p >= 1 && (totalPages === 0 || p <= totalPages)
    );
    const w = window as any;
    const handle = w.requestIdleCallback
      ? w.requestIdleCallback(() => candidates.forEach(prefetchQcfPageFont), { timeout: 1500 })
      : window.setTimeout(() => candidates.forEach(prefetchQcfPageFont), 300);
    return () => {
      if (w.cancelIdleCallback && w.requestIdleCallback) w.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [currentPage, totalPages]);
  
  // Sync internal currentPage with external initialPage prop changes
  useEffect(() => {
    console.log('🔄 initialPage prop changed:', initialPage, '-> updating internal currentPage');
    setCurrentPage(initialPage);
  }, [initialPage]);
  
  // Initialize page count
  useEffect(() => {
    const initializePageCount = async () => {
      const count = await getPageCount();
      setTotalPages(count);
    };
    initializePageCount();
  }, []);
  
  // Load page data when currentPage changes
  useEffect(() => {
    console.log('📖 currentPage changed to:', currentPage, '-> loading page data');
    loadPageData(currentPage);
  }, [currentPage]);

  // Load existing mistakes for this session and past mistakes.
  // Capture reciterId locally so a fast role-flip can't be overwritten by a
  // stale response that started before the new reciterId arrived.
  useEffect(() => {
    if (!sessionId || !pageData || !reciterId) return;

    const activeReciterId = reciterId;
    const activePage = pageData.page_number;
    let cancelled = false;

    console.log('🔁 Reloading mistakes for reciterId:', activeReciterId, 'page:', activePage);

    // Clear stale marks immediately so the previous reciter's highlights
    // never visually persist while the new fetch is in flight.
    setHighlightedWords(new Map());
    setPastMistakes(new Map());

    (async () => {
      try {
        const [sessionRes, pastRes] = await Promise.all([
          supabase
            .from('mistakes')
            .select('*')
            .eq('session_id', sessionId)
            .eq('reciter_id', activeReciterId)
            .eq('page_number', activePage),
          supabase
            .from('mistakes')
            .select('*')
            .eq('reciter_id', activeReciterId)
            .eq('page_number', activePage)
            .neq('session_id', sessionId),
        ]);

        if (cancelled) return;

        const toMap = (rows: any[] | null | undefined) => {
          const m = new Map<string, MistakeData>();
          rows?.forEach((mistake) => {
            const wordKey = `${mistake.surah_number}-${mistake.ayah_number}-${mistake.word_index}`;
            m.set(wordKey, {
              category: (mistake.mistake_category as MistakeCategory) || 'tajweed',
              date: mistake.created_at ? format(new Date(mistake.created_at), 'MMM dd, yyyy') : '',
              mistakeId: mistake.id,
              sessionId: mistake.session_id,
            });
          });
          return m;
        };

        setHighlightedWords(toMap(sessionRes.data));
        setPastMistakes(toMap(pastRes.data));
      } catch (err) {
        if (!cancelled) console.error('Error loading mistakes for reciter:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, pageData?.page_number, reciterId]);


  // Unified real-time subscription for all mistakes (current and past sessions)
  useEffect(() => {
    if (!sessionId || !pageData || !reciterId) return;
    
    console.log('📡 Setting up unified subscription for reciter:', reciterId, 'page:', pageData.page_number, 'role:', userRole);
    
    const channel = supabase
      .channel(`all-mistakes-${reciterId}-${pageData.page_number}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mistakes',
        filter: `reciter_id=eq.${reciterId}`
      }, payload => {
        console.log('🔴 Real-time INSERT received (role:', userRole, '):', payload);
        const mistake = payload.new;
        
        // Only process if it's for the current page
        if (mistake.page_number !== pageData.page_number) {
          console.log('⏭️ Skipping INSERT - different page:', mistake.page_number, 'vs', pageData.page_number);
          return;
        }
        
        const wordKey = `${mistake.surah_number}-${mistake.ayah_number}-${mistake.word_index}`;
        const mistakeData: MistakeData = {
          category: mistake.mistake_category || 'tajweed',
          date: format(new Date(mistake.created_at), 'MMM dd, yyyy'),
          mistakeId: mistake.id,
          sessionId: mistake.session_id
        };
        
        console.log('✅ Processing INSERT for word:', wordKey, 'session:', mistake.session_id);
        
        // Route to correct state based on session
        if (mistake.session_id === sessionId) {
          setHighlightedWords(prev => {
            const updated = new Map(prev);
            updated.set(wordKey, mistakeData);
            console.log('📝 Updated highlightedWords, size:', updated.size);
            return updated;
          });
        } else {
          setPastMistakes(prev => {
            const updated = new Map(prev);
            updated.set(wordKey, mistakeData);
            console.log('📝 Updated pastMistakes, size:', updated.size);
            return updated;
          });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'mistakes',
        filter: `reciter_id=eq.${reciterId}`
      }, payload => {
        console.log('🟡 Real-time UPDATE (role:', userRole, '):', payload);
        const mistake = payload.new;
        
        // Only process if it's for the current page
        if (mistake.page_number !== pageData.page_number) {
          console.log('⏭️ Skipping UPDATE - different page');
          return;
        }
        
        const wordKey = `${mistake.surah_number}-${mistake.ayah_number}-${mistake.word_index}`;
        const mistakeData: MistakeData = {
          category: mistake.mistake_category || 'tajweed',
          date: format(new Date(mistake.created_at), 'MMM dd, yyyy'),
          mistakeId: mistake.id,
          sessionId: mistake.session_id
        };
        
        // Route to correct state based on session
        if (mistake.session_id === sessionId) {
          setHighlightedWords(prev => {
            const updated = new Map(prev);
            updated.set(wordKey, mistakeData);
            return updated;
          });
        } else {
          setPastMistakes(prev => {
            const updated = new Map(prev);
            updated.set(wordKey, mistakeData);
            return updated;
          });
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'mistakes',
        filter: `reciter_id=eq.${reciterId}`
      }, payload => {
        console.log('🔵 Real-time DELETE (role:', userRole, '):', payload);
        
        const mistakeId = payload.old?.id;
        
        if (!mistakeId) {
          console.error('❌ DELETE: No mistake ID found in payload');
          return;
        }
        
        console.log('🗑️ Deleting mistake with ID:', mistakeId);
        
        // Search in highlightedWords (current session)
        let foundInHighlighted = false;
        setHighlightedWords(prev => { 
          const updated = new Map(prev);
          for (const [key, value] of prev.entries()) {
            if (value.mistakeId === mistakeId) {
              updated.delete(key);
              foundInHighlighted = true;
              console.log('🗑️ Deleted from highlightedWords, key:', key, 'new size:', updated.size);
              break;
            }
          }
          return updated;
        });
        
        // If not found in current session, search in pastMistakes
        if (!foundInHighlighted) {
          setPastMistakes(prev => { 
            const updated = new Map(prev);
            for (const [key, value] of prev.entries()) {
              if (value.mistakeId === mistakeId) {
                updated.delete(key);
                console.log('🗑️ Deleted from pastMistakes, key:', key, 'new size:', updated.size);
                break;
              }
            }
            return updated;
          });
        }
      })
      .subscribe((status, err) => {
        if (err) {
          console.error('❌ Subscription error:', userRole, err);
        } else {
          console.log('📡 Subscription status:', userRole, status);
        }
      });
    
    return () => {
      console.log('🔌 Cleaning up subscription for role:', userRole);
      supabase.removeChannel(channel);
    };
  }, [sessionId, pageData?.page_number, reciterId, userRole]);
  
  // Handle click outside to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setPopoverOpen(false);
      }
    };
    
    if (popoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popoverOpen]);
  const loadSessionMistakes = async () => {
    if (!pageData || !reciterId) return;
    try {
      console.log('Loading current session mistakes for reciterId:', reciterId, 'sessionId:', sessionId, 'page:', pageData.page_number);
      
      // Load mistakes for the CURRENT RECITER in this session only
      const {
        data,
        error
      } = await supabase.from('mistakes').select('*').eq('session_id', sessionId).eq('reciter_id', reciterId).eq('page_number', pageData.page_number);
      
      if (error) throw error;
      console.log('✅ Current session mistakes loaded:', data?.length || 0, 'mistakes', data);
      
      const mistakes = new Map<string, MistakeData>();
      data?.forEach(mistake => {
        const wordKey = `${mistake.surah_number}-${mistake.ayah_number}-${mistake.word_index}`;
        mistakes.set(wordKey, {
          category: mistake.mistake_category as MistakeCategory || 'tajweed',
          date: mistake.created_at ? format(new Date(mistake.created_at), 'MMM dd, yyyy') : '',
          mistakeId: mistake.id,
          sessionId: mistake.session_id
        });
        console.log('  → Current mistake word:', wordKey, 'category:', mistake.mistake_category);
      });
      console.log('✅ Setting highlightedWords with', mistakes.size, 'mistakes');
      setHighlightedWords(mistakes);
    } catch (err) {
      console.error('Error loading mistakes:', err);
    }
  };
  const loadPastMistakes = async () => {
    if (!pageData || !reciterId) return;
    try {
      console.log('Loading past mistakes for reciterId:', reciterId, 'page:', pageData.page_number);

      // Load all mistakes for this reciter on this page from OTHER sessions
      const {
        data,
        error
      } = await supabase.from('mistakes').select('*').eq('reciter_id', reciterId).eq('page_number', pageData.page_number).neq('session_id', sessionId);
      if (error) throw error;
      console.log('✅ Past mistakes loaded:', data?.length || 0, 'mistakes', data);
      const mistakes = new Map<string, MistakeData>();
      data?.forEach(mistake => {
        const wordKey = `${mistake.surah_number}-${mistake.ayah_number}-${mistake.word_index}`;
        mistakes.set(wordKey, {
          category: mistake.mistake_category as MistakeCategory || 'tajweed',
          date: mistake.created_at ? format(new Date(mistake.created_at), 'MMM dd, yyyy') : '',
          mistakeId: mistake.id,
          sessionId: mistake.session_id
        });
        console.log('  → Past mistake word:', wordKey, 'category:', mistake.mistake_category);
      });
      console.log('✅ Setting pastMistakes with', mistakes.size, 'mistakes');
      setPastMistakes(mistakes);
    } catch (err) {
      console.error('Error loading past mistakes:', err);
    }
  };
  const loadPageData = async (page: number) => {
    console.log('📄 Loading page data for page:', page);
    const exists = await checkPageExists(page);
    if (!exists && totalPages > 0) {
      console.error('❌ Page does not exist:', page);
      setPageData(null);
      return;
    }
    const data = await loadPage(page);
    console.log('✅ Page data loaded:', data?.page_number);
    setPageData(data);

    // Notify parent of page change
    if (data && onPageChange) {
      const firstLine = data.lines.find(l => l.line_type === 'ayah');
      if (firstLine?.words?.[0]) {
        onPageChange(page, firstLine.words[0].surah, firstLine.words[0].ayah);
      }
    }

    // Preload adjacent pages in background
    if (totalPages > 0 && preloadAdjacentPages) {
      preloadAdjacentPages(page, totalPages);
    }
  };
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };
  const handleWordClick = (word: SupabaseWord, event: React.MouseEvent<HTMLSpanElement>) => {
    // Only checker can mark mistakes
    if (userRole !== 'checker') {
      toast({
        title: "Not Allowed",
        description: "Only the checker can mark mistakes",
        variant: "destructive"
      });
      return;
    }
    
    // Get the position of the clicked word
    const rect = event.currentTarget.getBoundingClientRect();
    setPopoverPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    
    setSelectedWord(word);
    setPopoverOpen(true);
  };
  const handleCategorySelect = async (category: MistakeCategory) => {
    if (!selectedWord) return;
    const wordKey = `${selectedWord.surah}-${selectedWord.ayah}-${selectedWord.word}`;
    const currentMistake = highlightedWords.get(wordKey);
    const pastMistake = pastMistakes.get(wordKey);
    const existingMistake = currentMistake || pastMistake;
    
    try {
      if (existingMistake?.mistakeId) {
        // Update existing mistake by ID
        console.log('Updating existing mistake category:', existingMistake.mistakeId);
        
        // Optimistic update - keep original sessionId for edited mistakes
        const mistakeData: MistakeData = {
          category,
          date: existingMistake.date,
          mistakeId: existingMistake.mistakeId,
          sessionId: existingMistake.sessionId // Keep original session
        };
        
        // Update in the appropriate map
        if (pastMistake) {
          setPastMistakes(prev => {
            const newMap = new Map(prev);
            newMap.set(wordKey, mistakeData);
            return newMap;
          });
        } else {
          setHighlightedWords(prev => {
            const newMap = new Map(prev);
            newMap.set(wordKey, mistakeData);
            return newMap;
          });
        }
        
        const { error } = await supabase
          .from('mistakes')
          .update({ mistake_category: category })
          .eq('id', existingMistake.mistakeId);
        
        if (error) throw error;
        
        console.log('Mistake category updated successfully');
        
        toast({
          title: "Category Updated",
          description: "Mistake category changed successfully"
        });
      } else {
        // Add new mistake with category - get the inserted record back
        console.log('Inserting new mistake');
        
        const { data, error } = await supabase
          .from('mistakes')
          .insert({
            session_id: sessionId,
            reciter_id: reciterId,
            surah_number: selectedWord.surah,
            ayah_number: selectedWord.ayah,
            word_index: selectedWord.word,
            page_number: currentPage,
            mistake_category: category
          })
          .select()
          .single();
        
        if (error) throw error;
        
        console.log('Mistake inserted with ID:', data.id);
        
        // Update local state with the new mistake including its ID
        const mistakeData: MistakeData = {
          category,
          date: format(new Date(), 'MMM dd, yyyy'),
          mistakeId: data.id,
          sessionId: data.session_id
        };
        
        setHighlightedWords(prev => {
          const newMap = new Map(prev);
          newMap.set(wordKey, mistakeData);
          return newMap;
        });
        
        toast({
          title: "Mistake Marked",
          description: "Word marked as mistake"
        });
      }
    } catch (err: any) {
      console.error('Error marking mistake:', err);
      // Revert optimistic update on error
      if (currentMistake) {
        setHighlightedWords(prev => {
          const newMap = new Map(prev);
          if (!existingMistake) {
            newMap.delete(wordKey);
          } else {
            newMap.set(wordKey, currentMistake);
          }
          return newMap;
        });
      } else if (pastMistake) {
        setPastMistakes(prev => {
          const newMap = new Map(prev);
          newMap.set(wordKey, pastMistake);
          return newMap;
        });
      } else {
        setHighlightedWords(prev => {
          const newMap = new Map(prev);
          newMap.delete(wordKey);
          return newMap;
        });
      }
      toast({
        title: "Error",
        description: err.message || "Failed to mark mistake. Please try again.",
        variant: "destructive"
      });
    }
    setPopoverOpen(false);
    setSelectedWord(null);
  };

  const handleOpenNoteDrawer = async () => {
    setPopoverOpen(false);
    
    if (!selectedWord) return;
    
    const wordKey = `${selectedWord.surah}-${selectedWord.ayah}-${selectedWord.word}`;
    const currentMistake = highlightedWords.get(wordKey);
    const pastMistake = pastMistakes.get(wordKey);
    const existingMistake = currentMistake || pastMistake;
    
    // Load existing note if there is one
    if (existingMistake?.mistakeId) {
      try {
        const { data, error } = await supabase
          .from('mistakes')
          .select('note')
          .eq('id', existingMistake.mistakeId)
          .single();
        
        if (error) throw error;
        
        if (data?.note) {
          setCurrentNote(data.note);
        } else {
          setCurrentNote('');
        }
      } catch (err) {
        console.error('Error loading note:', err);
        setCurrentNote('');
      }
    } else {
      setCurrentNote('');
    }
    
    setNoteDrawerOpen(true);
  };

  const handleSaveNote = async () => {
    if (!selectedWord) return;
    
    const wordKey = `${selectedWord.surah}-${selectedWord.ayah}-${selectedWord.word}`;
    const currentMistake = highlightedWords.get(wordKey);
    const pastMistake = pastMistakes.get(wordKey);
    const existingMistake = currentMistake || pastMistake;
    
    if (!existingMistake?.mistakeId) {
      toast({
        title: "Error",
        description: "Cannot add note to a word that hasn't been marked as a mistake",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('mistakes')
        .update({ note: currentNote })
        .eq('id', existingMistake.mistakeId);
      
      if (error) throw error;
      
      toast({
        title: "Note Saved",
        description: "Mistake note saved successfully"
      });
      
      setNoteDrawerOpen(false);
      setCurrentNote('');
      setSelectedWord(null);
    } catch (err: any) {
      console.error('Error saving note:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to save note. Please try again.",
        variant: "destructive"
      });
    }
  };
  const handleRemoveMistake = async () => {
    if (!selectedWord) return;
    const wordKey = `${selectedWord.surah}-${selectedWord.ayah}-${selectedWord.word}`;
    
    const currentMistake = highlightedWords.get(wordKey);
    const pastMistake = pastMistakes.get(wordKey);
    const existingMistake = currentMistake || pastMistake;
    
    if (!existingMistake?.mistakeId) {
      toast({
        title: "Error",
        description: "Cannot remove a word that hasn't been marked as a mistake",
        variant: "destructive"
      });
      return;
    }
    
    // Optimistic update for immediate feedback
    if (currentMistake) {
      setHighlightedWords(prev => {
        const newMap = new Map(prev);
        newMap.delete(wordKey);
        return newMap;
      });
    } else if (pastMistake) {
      setPastMistakes(prev => {
        const newMap = new Map(prev);
        newMap.delete(wordKey);
        return newMap;
      });
    }
    
    try {
      const {
        error
      } = await supabase.from('mistakes').delete().eq('id', existingMistake.mistakeId);
      if (error) throw error;

      // Also remove any mirrored row in `block_review_mistakes` for the same
      // word so the Quran Overview badge count drops accordingly.
      const { error: brmError } = await supabase
        .from('block_review_mistakes')
        .delete()
        .eq('user_id', reciterId)
        .eq('surah_id', selectedWord.surah)
        .eq('ayah_number', selectedWord.ayah)
        .eq('word_index', selectedWord.word);
      if (brmError) console.error('Error removing mirrored block_review_mistakes:', brmError);

      console.log('Mistake deleted');

      toast({
        title: "Mistake Removed",
        description: "Word unmarked successfully"
      });
    } catch (err: any) {
      console.error('Error removing mistake:', err);
      // Revert optimistic update on error
      if (currentMistake) {
        setHighlightedWords(prev => {
          const newMap = new Map(prev);
          newMap.set(wordKey, currentMistake);
          return newMap;
        });
      } else if (pastMistake) {
        setPastMistakes(prev => {
          const newMap = new Map(prev);
          newMap.set(wordKey, pastMistake);
          return newMap;
        });
      }
      toast({
        title: "Error",
        description: err.message || "Failed to remove mistake. Please try again.",
        variant: "destructive"
      });
    }
    setPopoverOpen(false);
    setSelectedWord(null);
  };
  const getCategoryColor = (category: MistakeCategory) => {
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
        return 'hsl(var(--mistake) / 0.3)';
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
        return 'hsl(var(--mistake))';
    }
  };
  const getSurahName = (surahNumber: number): string => {
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
    return surahNames[surahNumber] || `سورة ${surahNumber}`;
  };
  if (loading) {
    return <div className="space-y-4">
        <div className="flex items-center justify-center gap-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="space-y-3">
          {Array.from({
          length: 15
        }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      </div>;
  }
  if (!pageData) {
    return <div className="space-y-4">
        <div className="flex items-center justify-center gap-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          Loading page {currentPage}…
        </div>
        <div className="space-y-3">
          {Array.from({ length: 15 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      </div>;
  }
  return <div className="space-y-4">
      {/* Navigation Header */}
      <div className="flex justify-between items-center gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={goToPreviousPage} disabled={currentPage <= 1} className="flex-none h-6 px-1 text-[10px]">
          <ChevronUp className="w-2 h-2 mr-0.5" />
          {isMobile ? 'Previous' : 'Previous Page'}
        </Button>
        
        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 whitespace-nowrap">
          {isMobile ? currentPage : `Page ${currentPage}`}
        </Badge>
        
        <Button variant="outline" size="sm" onClick={goToNextPage} disabled={currentPage >= totalPages} className="flex-none h-6 px-1 text-[10px]">
          {isMobile ? 'Next' : 'Next Page'}
          <ChevronDown className="w-2 h-2 ml-0.5" />
        </Button>
      </div>

      {/* Mushaf Page Content */}
      <Card className="bg-card border-border">
        
        <CardContent className={isMobile ? 'px-3 py-4' : 'p-8'}>
          <div className="space-y-2 text-center">
            {pageData.lines.map(line => <div key={`${pageData.page_number}-${line.line_number}`}>
                {line.line_type === 'surah_name' && <div className="my-8 flex flex-col items-center gap-4">
                        <div className="w-full max-w-3xl mx-auto">
                          <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                      <div className="flex items-center justify-center gap-2 -mt-3">
                        <div className="w-2 h-2 rotate-45 bg-primary/40" />
                        <div className="w-3 h-3 rotate-45 bg-primary/60" />
                        <div className="w-2 h-2 rotate-45 bg-primary/40" />
                      </div>
                    </div>
                    <div className="text-center text-2xl md:text-3xl lg:text-4xl text-primary font-bold py-2" style={{
                fontFamily: 'DigitalKhattV2'
              }}>
                      {line.surah_number && getSurahName(line.surah_number)}
                    </div>
                  </div>}
                
                {line.line_type === 'basmallah' && <div className="text-center text-xl md:text-2xl lg:text-3xl text-muted-foreground py-2" style={{
              fontFamily: 'DigitalKhattV2'
            }}>
                    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                  </div>}
                
                 {line.line_type === 'ayah' && (() => {
              const qcfLineWords = qcfLineMap.get(line.line_number) ?? [];
              if (qcfLineWords.length === 0) return null;
              const localLineWords: SupabaseWord[] = line.words ?? [];
              let localIdx = 0;

              return (
                <div
                  className={`${isMobile ? 'text-lg' : 'text-xl md:text-2xl lg:text-3xl'} leading-tight w-full mx-auto`}
                  style={{
                    lineHeight: '1.6',
                    textAlign: 'center',
                    direction: 'rtl',
                    wordSpacing: '-0.02em',
                    maxWidth: isMobile ? '100%' : '36rem',
                  }}
                >
                  {qcfLineWords.map((qWord: any, qIndex: number) => {
                    const isEnd = qWord.char_type_name === 'end';
                    const localWord = !isEnd ? localLineWords[localIdx] : undefined;
                    if (!isEnd) localIdx += 1;

                    const wordKey = localWord
                      ? `${localWord.surah}-${localWord.ayah}-${localWord.word}`
                      : null;
                    const currentMistake = wordKey ? highlightedWords.get(wordKey) : undefined;
                    const pastMistake = wordKey ? pastMistakes.get(wordKey) : undefined;
                    const hasMistake = !!currentMistake || !!pastMistake;
                    const mistakeCategory = currentMistake?.category || pastMistake?.category;

                    const getTooltip = () => {
                      if (currentMistake) {
                        const dateStr = currentMistake.date ? ` (${currentMistake.date})` : '';
                        return userRole === 'checker'
                          ? `Current session mistake${dateStr} - Click to change or remove`
                          : `Mistake marked in this session${dateStr}`;
                      }
                      if (pastMistake) {
                        const dateStr = pastMistake.date ? ` (${pastMistake.date})` : '';
                        return userRole === 'checker'
                          ? `Mistake from previous session${dateStr} - Click to edit or remove`
                          : `Mistake from previous session${dateStr}`;
                      }
                      return userRole === 'checker' && !isEnd ? 'Click to mark as mistake' : '';
                    };

                    const pageNum = typeof qWord.page_number === 'number' ? qWord.page_number : currentPage;
                    const fontReady = qcfLoadedPages.has(pageNum);
                    const useGlyph = !isEnd && fontReady && !!qWord.code_v2;
                    const family = useGlyph
                      ? `'p${pageNum}-v2'`
                      : isEnd
                        ? "'UthmanicHafs', serif"
                        : "'UthmanicHafs', serif";

                    const clickable = !isEnd && !!localWord;

                    return (
                      <span
                        key={`${currentPage}-${line.line_number}-${qIndex}`}
                        onClick={
                          clickable
                            ? (e) => handleWordClick(localWord!, e)
                            : undefined
                        }
                        className={`relative inline-block ${
                          clickable && userRole === 'checker' ? 'cursor-pointer hover:opacity-70' : ''
                        } transition-opacity`}
                        style={{ margin: '0 0.5px' }}
                        title={getTooltip()}
                      >
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
                              border: 'none',
                            }}
                          />
                        )}
                        {useGlyph ? (
                          <span
                            className={`relative ${hasMistake ? 'dark:text-black' : ''}`}
                            style={{ zIndex: 1, fontFamily: family }}
                            dangerouslySetInnerHTML={{ __html: qWord.code_v2 }}
                          />
                        ) : (
                          <span
                            className={`relative ${hasMistake ? 'dark:text-black' : ''}`}
                            style={{ zIndex: 1, fontFamily: family }}
                          >
                            {qWord.text_qpc_hafs ?? localWord?.text ?? ''}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              );
            })()}
              </div>)}
          </div>
        </CardContent>
      </Card>

      {/* Bottom Navigation */}
      <div className="flex justify-between items-center gap-2 mt-4">
        <Button variant="outline" size="sm" onClick={goToPreviousPage} disabled={currentPage <= 1} className="flex-none h-6 px-1 text-[10px]">
          <ChevronUp className="w-2 h-2 mr-0.5" />
          {isMobile ? 'Previous' : 'Previous Page'}
        </Button>
        
        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 whitespace-nowrap">
          {isMobile ? currentPage : `Page ${currentPage}`}
        </Badge>
        
        <Button variant="outline" size="sm" onClick={goToNextPage} disabled={currentPage >= totalPages} className="flex-none h-6 px-1 text-[10px]">
          {isMobile ? 'Next' : 'Next Page'}
          <ChevronDown className="w-2 h-2 ml-0.5" />
        </Button>
      </div>

      {/* Category Selection Popover */}
      {popoverOpen && popoverPosition && (
        isMobile ? (
          // Mobile: fixed bottom sheet-style popover
          <div 
            ref={popoverRef}
            className="fixed bottom-0 left-0 right-0 z-50 p-2 bg-background border-t shadow-lg safe-bottom"
          >
            <div className="flex flex-wrap justify-center gap-1.5">
              <Button variant="ghost" size="sm" className="px-2.5 py-1.5 text-xs h-8" onClick={() => handleCategorySelect('incorrect')}>
                Incorrect
              </Button>
              <Button variant="ghost" size="sm" className="px-2.5 py-1.5 text-xs h-8" onClick={() => handleCategorySelect('missed')}>
                Missed
              </Button>
              <Button variant="ghost" size="sm" className="px-2.5 py-1.5 text-xs h-8" onClick={() => handleCategorySelect('tajweed')}>
                Tajweed
              </Button>
              <Button variant="ghost" size="sm" className="px-2.5 py-1.5 text-xs h-8" onClick={() => handleCategorySelect('harakah')}>
                Harakah
              </Button>
              {selectedWord && (highlightedWords.has(`${selectedWord.surah}-${selectedWord.ayah}-${selectedWord.word}`) || pastMistakes.has(`${selectedWord.surah}-${selectedWord.ayah}-${selectedWord.word}`)) && (
                <>
                  <Button variant="ghost" size="sm" className="px-2.5 py-1.5 text-xs h-8" onClick={handleOpenNoteDrawer}>
                    <FileText className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="px-2.5 py-1.5 text-xs h-8 text-destructive hover:text-destructive" onClick={handleRemoveMistake}>
                    Remove
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          // Desktop: floating popover near word
          <div 
            ref={popoverRef}
            className="fixed z-50"
            style={{
              left: `${popoverPosition.x}px`,
              top: `${popoverPosition.y - 60}px`,
              transform: 'translateX(-50%)'
            }}
          >
            <Card className="p-2 shadow-lg border">
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="px-3 py-2" onClick={() => handleCategorySelect('incorrect')} title="Incorrect word">
                  Incorrect
                </Button>
                <Button variant="ghost" size="sm" className="px-3 py-2" onClick={() => handleCategorySelect('missed')} title="Missed word">
                  Missed
                </Button>
                <Button variant="ghost" size="sm" className="px-3 py-2" onClick={() => handleCategorySelect('tajweed')} title="Tajweed mistake">
                  Tajweed
                </Button>
                <Button variant="ghost" size="sm" className="px-3 py-2" onClick={() => handleCategorySelect('harakah')} title="Harakah mistake">
                  Harakah
                </Button>
                {selectedWord && (highlightedWords.has(`${selectedWord.surah}-${selectedWord.ayah}-${selectedWord.word}`) || pastMistakes.has(`${selectedWord.surah}-${selectedWord.ayah}-${selectedWord.word}`)) && (
                  <>
                    <Button variant="ghost" size="sm" className="px-3 py-2" onClick={handleOpenNoteDrawer} title="Add note">
                      <FileText className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="px-3 py-2 text-destructive hover:text-destructive" onClick={handleRemoveMistake} title="Remove mistake">
                      Remove
                    </Button>
                  </>
                )}
              </div>
            </Card>
          </div>
        )
      )}

      {/* Note Drawer/Sheet */}
      {isMobile ? (
        <Sheet open={noteDrawerOpen} onOpenChange={setNoteDrawerOpen}>
          <SheetContent side="bottom" className="h-[400px]">
            <SheetHeader>
              <SheetTitle>Add Note</SheetTitle>
            </SheetHeader>
            <div className="py-4">
              <Label htmlFor="mistake-note" className="mb-2">Note</Label>
              <Textarea
                id="mistake-note"
                placeholder="Type your note here..."
                value={currentNote}
                onChange={(e) => setCurrentNote(e.target.value)}
                className="min-h-[200px]"
              />
            </div>
            <SheetFooter>
              <SheetClose asChild>
                <Button variant="outline">Cancel</Button>
              </SheetClose>
              <Button onClick={handleSaveNote}>Save</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Drawer open={noteDrawerOpen} onOpenChange={setNoteDrawerOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Add Note</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 py-4">
              <Label htmlFor="mistake-note-desktop" className="mb-2">Note</Label>
              <Textarea
                id="mistake-note-desktop"
                placeholder="Type your note here..."
                value={currentNote}
                onChange={(e) => setCurrentNote(e.target.value)}
                className="min-h-[200px]"
              />
            </div>
            <DrawerFooter>
              <Button onClick={handleSaveNote}>Save</Button>
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}
    </div>;
};