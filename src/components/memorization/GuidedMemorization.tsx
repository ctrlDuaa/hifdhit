import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Play, Pause, RotateCcw, ChevronRight, ChevronLeft, LogOut, FileText,
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose,
} from '@/components/ui/sheet';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from '@/components/ui/drawer';
import { MemorizationSessionState, MemorizationStage, ConfidenceRating } from '@/types/memorization';
import { MemorizationAyah } from '@/hooks/useMemorizationSession';
import { cn } from '@/lib/utils';
import { MushafContextLines } from '@/components/memorization/MushafContextLines';

import { SaveToCollectionDialog } from '@/components/memorization/SaveToCollectionDialog';
import { BookmarkPlus } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ── Mistake types ────────────────────────────────────────────
type MistakeCategory = 'tajweed' | 'missed' | 'harakah' | 'incorrect';

interface MistakeData {
  category: MistakeCategory;
  note: string;
  mistakeId?: string; // DB id for existing records
}

// ── Stage config ─────────────────────────────────────────────
interface Props {
  state: MemorizationSessionState;
  currentAyah: MemorizationAyah | null;
  onAdvanceStage: () => void;
  onRateAyah: (rating: ConfidenceRating) => void;
  onToggleWeak: (ayahNum: number) => void;
  onExit: () => void;
  onGoBack?: () => void;
}

const STAGE_LABELS: Record<MemorizationStage, string> = {
  'listen': 'Listen & Follow',
  'hide-third': 'Partial Hide — Every 3rd Word',
  'hide-half': 'Partial Hide — Every Other Word',
  'first-letters': 'First Letters Only',
  'full-hide': 'Full Recall',
  'self-assess': 'Self-Assessment',
};

const STAGE_PROMPTS: Record<MemorizationStage, string> = {
  'listen': 'Listen carefully and follow along with the text. Tap any word to mark a mistake.',
  'hide-third': 'Some words are hidden — try to recall them',
  'hide-half': 'Half the words are hidden — keep going!',
  'first-letters': 'Only first letters shown — recall the full words',
  'full-hide': 'Recite the entire ayah from memory',
  'self-assess': 'How did that feel?',
};

const ACTIVE_STAGES = ['listen', 'hide-third', 'hide-half', 'first-letters', 'self-assess'];

// ── Category colors (match SessionMushafViewer) ──────────────
function getCategoryColor(category: MistakeCategory): string {
  switch (category) {
    case 'tajweed':   return '#D3e7ee';
    case 'missed':    return '#FFE0B2';
    case 'harakah':   return '#bec4ed';
    case 'incorrect': return '#f28a8a';
    default:          return 'hsl(var(--mistake) / 0.3)';
  }
}

export const GuidedMemorization = ({ state, currentAyah, onAdvanceStage, onRateAyah, onToggleWeak, onExit, onGoBack }: Props) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranslation, setShowTranslation] = useState(state.config.showTranslation);
  const [showFullPage, setShowFullPage] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { toast } = useToast();

  // ── Mistake state ────────────────────────────────────────
  // Key: "surahNumber-ayahNumber-wordIndex" (matches SessionMushafViewer format)
  const [mistakes, setMistakes] = useState<Map<string, MistakeData>>(new Map());
  const [selectedWordKey, setSelectedWordKey] = useState<string | null>(null);
  const [selectedWordInfo, setSelectedWordInfo] = useState<{ surah: number; ayah: number; wordIndex: number } | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [noteDrawerOpen, setNoteDrawerOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState('');

  const chunk = state.chunks[state.currentChunkIndex];
  const currentAyahNum = chunk ? chunk.ayahStart + state.currentAyahInChunk : 0;
  const surahId = state.config.surahId;

  const totalAyahs = state.config.ayahEnd - state.config.ayahStart + 1;
  const completedAyahs = Object.values(state.ayahPerformance).filter(p => p.confidenceRating !== null).length;
  const currentAyahIndex = state.currentAyahInChunk + 1;
  const progressPercent = totalAyahs > 0 ? (completedAyahs / totalAyahs) * 100 : 0;

  const stageIndex = ACTIVE_STAGES.indexOf(state.currentStage);
  const isSelfAssess = state.currentStage === 'self-assess';

  // ── Load existing mistakes from DB for entire ayah range ──
  useEffect(() => {
    if (!user) return;
    const loadMistakes = async () => {
      try {
        const { data, error } = await supabase
          .from('mistakes')
          .select('*')
          .eq('reciter_id', user.id)
          .eq('surah_number', surahId)
          .gte('ayah_number', state.config.ayahStart)
          .lte('ayah_number', state.config.ayahEnd);

        if (error) throw error;

        const loaded = new Map<string, MistakeData>();
        data?.forEach(m => {
          const storedWordIndex = typeof m.word_index === 'number' ? m.word_index - 1 : m.word_index;
          const key = `${m.surah_number}-${m.ayah_number}-${storedWordIndex}`;
          loaded.set(key, {
            category: (m.mistake_category as MistakeCategory) || 'tajweed',
            note: m.note || '',
            mistakeId: m.id,
          });
        });
        setMistakes(loaded);
      } catch (err) {
        console.error('Failed to load memorization mistakes:', err);
      }
    };
    loadMistakes();
  }, [user, surahId, state.config.ayahStart, state.config.ayahEnd]);

  // ── Audio management ─────────────────────────────────────
  // Reset playing state and tear down any prior Audio when the verse changes.
  useEffect(() => {
    setIsPlaying(false);
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [currentAyah?.audioUrl]);

  /**
   * Create / reuse the Audio element synchronously inside the user gesture so
   * mobile browsers (iOS Safari especially) honor the play() call.
   */
  const ensureAudio = useCallback((): HTMLAudioElement | null => {
    const url = currentAyah?.audioUrl;
    if (!url) return null;
    if (!audioRef.current || audioRef.current.src !== url) {
      const a = new Audio(url);
      a.preload = 'auto';
      a.addEventListener('ended', () => setIsPlaying(false));
      a.addEventListener('pause', () => setIsPlaying(false));
      a.addEventListener('play', () => setIsPlaying(true));
      a.addEventListener('error', () => {
        console.error('[memorization] audio failed to load', url);
        setIsPlaying(false);
        toast({ title: 'Audio unavailable for this verse', variant: 'destructive' });
      });
      audioRef.current = a;
    }
    return audioRef.current;
  }, [currentAyah?.audioUrl, toast]);

  const toggleAudio = useCallback(() => {
    const audio = ensureAudio();
    if (!audio) {
      toast({ title: 'No audio available for this verse' });
      return;
    }
    if (!audio.paused) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.error('[memorization] play() rejected', err);
        setIsPlaying(false);
      });
    }
  }, [ensureAudio, toast]);

  const replayAudio = useCallback(() => {
    const audio = ensureAudio();
    if (!audio) {
      toast({ title: 'No audio available for this verse' });
      return;
    }
    audio.currentTime = 0;
    audio.play().catch((err) => {
      console.error('[memorization] replay play() rejected', err);
      setIsPlaying(false);
    });
  }, [ensureAudio, toast]);

  // ── Close popover on click outside ───────────────────────
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setPopoverOpen(false);
      }
    };
    if (popoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, [popoverOpen]);

  // ── Mistake handlers ─────────────────────────────────────
  const handleWordClick = (ayahNum: number, wordIndex: number, event: React.MouseEvent<HTMLSpanElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPopoverPosition({ x: rect.left + rect.width / 2, y: rect.top });
    const key = `${surahId}-${ayahNum}-${wordIndex}`;
    setSelectedWordKey(key);
    setSelectedWordInfo({ surah: surahId, ayah: ayahNum, wordIndex });
    setPopoverOpen(true);
  };

  const handleCategorySelect = async (category: MistakeCategory) => {
    if (!selectedWordKey || !selectedWordInfo || !user) return;

    const existing = mistakes.get(selectedWordKey);

    // Optimistic update
    setMistakes(prev => {
      const updated = new Map(prev);
      updated.set(selectedWordKey, {
        category,
        note: existing?.note ?? '',
        mistakeId: existing?.mistakeId,
      });
      return updated;
    });
    setPopoverOpen(false);
    setSelectedWordKey(null);

    try {
      if (existing?.mistakeId) {
        // Update existing
        const { error } = await supabase
          .from('mistakes')
          .update({ mistake_category: category })
          .eq('id', existing.mistakeId);
        if (error) throw error;
      } else {
        // Insert new — use upsert to handle the unique constraint
        const { data, error } = await supabase
          .from('mistakes')
          .upsert({
            reciter_id: user.id,
            surah_number: selectedWordInfo.surah,
            ayah_number: selectedWordInfo.ayah,
            word_index: selectedWordInfo.wordIndex + 1,
            mistake_category: category,
          }, { onConflict: 'reciter_id,surah_number,ayah_number,word_index' })
          .select()
          .single();

        if (error) throw error;

        // Update local state with the DB id
        setMistakes(prev => {
          const updated = new Map(prev);
          const current = updated.get(`${selectedWordInfo.surah}-${selectedWordInfo.ayah}-${selectedWordInfo.wordIndex}`);
          if (current) {
            updated.set(`${selectedWordInfo.surah}-${selectedWordInfo.ayah}-${selectedWordInfo.wordIndex}`, {
              ...current,
              mistakeId: data.id,
            });
          }
          return updated;
        });
      }
    } catch (err) {
      console.error('Failed to save mistake:', err);
      // Revert optimistic update
      if (existing) {
        setMistakes(prev => {
          const updated = new Map(prev);
          updated.set(selectedWordKey, existing);
          return updated;
        });
      } else {
        setMistakes(prev => {
          const updated = new Map(prev);
          updated.delete(selectedWordKey);
          return updated;
        });
      }
      toast({ title: 'Failed to save mistake', variant: 'destructive' });
    }
  };

  const handleRemoveMistake = async () => {
    if (!selectedWordKey) return;
    const existing = mistakes.get(selectedWordKey);
    if (!existing?.mistakeId) return;

    // Optimistic delete
    setMistakes(prev => {
      const updated = new Map(prev);
      updated.delete(selectedWordKey);
      return updated;
    });
    setPopoverOpen(false);
    setSelectedWordKey(null);

    try {
      const { error } = await supabase
        .from('mistakes')
        .delete()
        .eq('id', existing.mistakeId);
      if (error) throw error;

      toast({ title: 'Mistake removed' });
    } catch (err) {
      console.error('Failed to delete mistake:', err);
      // Revert
      setMistakes(prev => {
        const updated = new Map(prev);
        updated.set(selectedWordKey, existing);
        return updated;
      });
      toast({ title: 'Failed to remove mistake', variant: 'destructive' });
    }
  };

  const handleOpenNoteDrawer = async () => {
    setPopoverOpen(false);
    if (!selectedWordKey) return;
    const existing = mistakes.get(selectedWordKey);

    // Load note from DB if we have a mistakeId
    if (existing?.mistakeId) {
      try {
        const { data } = await supabase
          .from('mistakes')
          .select('note')
          .eq('id', existing.mistakeId)
          .single();
        setCurrentNote(data?.note || '');
      } catch {
        setCurrentNote(existing?.note ?? '');
      }
    } else {
      setCurrentNote(existing?.note ?? '');
    }
    setNoteDrawerOpen(true);
  };

  const handleSaveNote = async () => {
    if (!selectedWordKey) return;
    const existing = mistakes.get(selectedWordKey);

    if (existing?.mistakeId) {
      try {
        const { error } = await supabase
          .from('mistakes')
          .update({ note: currentNote })
          .eq('id', existing.mistakeId);
        if (error) throw error;

        // Update local state
        setMistakes(prev => {
          const updated = new Map(prev);
          updated.set(selectedWordKey, { ...existing, note: currentNote });
          return updated;
        });
        toast({ title: 'Note saved' });
      } catch (err) {
        console.error('Failed to save note:', err);
        toast({ title: 'Failed to save note', variant: 'destructive' });
      }
    }

    setNoteDrawerOpen(false);
    setCurrentNote('');
    setSelectedWordKey(null);
  };

  // ── Render Arabic text with mistake highlighting ─────────
  function renderArabicText(ayah: MemorizationAyah, stage: MemorizationStage): React.ReactNode {
    const words = ayah.words;
    const ayahNum = ayah.number;

    if (stage === 'full-hide') {
      return <span className="text-muted-foreground/30 select-none blur-md">{ayah.text}</span>;
    }

    return (
      <span className="flex flex-wrap justify-center gap-x-3 gap-y-1" dir="rtl">
        {words.map((word, i) => {
          let hidden = false;
          let showFirstLetter = false;

          if (stage === 'hide-third') hidden = i % 3 === 2;
          if (stage === 'hide-half') hidden = i % 2 === 1;
          if (stage === 'first-letters') { hidden = true; showFirstLetter = true; }

          const wordKey = `${surahId}-${ayahNum}-${i}`;
          const mistake = mistakes.get(wordKey);
          const hasMistake = !!mistake;

          return (
            <span
              key={i}
              className={cn(
                'relative inline-block cursor-pointer transition-opacity hover:opacity-70',
              )}
              onClick={(e) => handleWordClick(ayahNum, i, e)}
            >
              {hasMistake && mistake && (
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
              <span className={cn('relative', hasMistake && 'dark:text-black')} style={{ zIndex: 1 }}>
                {hidden
                  ? (
                    <span className="inline-block px-2 py-1 rounded bg-muted/60 text-muted-foreground/40 min-w-[2rem] text-center transition-all">
                      {showFirstLetter ? word.charAt(0) + '...' : '•••'}
                    </span>
                  )
                  : word
                }
              </span>
            </span>
          );
        })}
      </span>
    );
  }

  if (!currentAyah) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground p-4 text-center">
        <div>
          <p className="text-lg font-medium">Loading verse data...</p>
          <p className="text-sm mt-1">If this persists, the verse data may not be available. Try restarting the session.</p>
        </div>
      </div>
    );
  }

  const hasMistakeOnSelected = selectedWordKey ? mistakes.has(selectedWordKey) : false;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background">
      {/* Header */}
      <div className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-foreground">{state.config.surahName}</h1>
            <Badge variant="secondary" className="text-xs">
              Ayah {currentAyahIndex}/{totalAyahs}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onExit}>
            <LogOut className="w-4 h-4 mr-1" /> Exit
          </Button>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-2">
          <Progress value={progressPercent} className="h-1.5" />
          <p className="text-xs text-muted-foreground mt-1">{completedAyahs}/{totalAyahs} ayat completed</p>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Stage indicator */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-primary">{STAGE_LABELS[state.currentStage]}</p>
            <p className="text-xs text-muted-foreground">{STAGE_PROMPTS[state.currentStage]}</p>
          </div>
          <Badge variant="outline" className="text-xs">
            Ayah {currentAyahNum}
          </Badge>
        </div>

        {/* Stage progress mini bar */}
        <div className="flex gap-1">
          {ACTIVE_STAGES.map((s, i) => (
            <div key={s} className={cn("h-1 flex-1 rounded-full transition-colors", i <= stageIndex ? 'bg-[#C6A477]' : 'bg-muted')} />
          ))}
        </div>

        {/* Main memorization card */}
        <Card className="shadow-lg border-border/50">
          <CardContent className="p-8 space-y-6">
            {isSelfAssess ? (
              /* Self-assessment UI */
              <div className="space-y-6 py-8">
                <p className="text-center text-xl font-medium text-foreground">How did that feel?</p>
                <div className="grid grid-cols-3 gap-3">
                  <Button onClick={() => onRateAyah('easy')} variant="outline" className="flex-col h-auto py-6 hover:bg-surah-completed/20 hover:border-surah-completed hover:text-foreground">
                    <span className="text-3xl mb-2">😊</span>
                    <span className="text-sm font-medium">Easy</span>
                    <span className="text-xs text-muted-foreground">Got it!</span>
                  </Button>
                  <Button onClick={() => onRateAyah('shaky')} variant="outline" className="flex-col h-auto py-6 hover:bg-accent/20 hover:border-accent hover:text-foreground">
                    <span className="text-3xl mb-2">🤔</span>
                    <span className="text-sm font-medium">Shaky</span>
                    <span className="text-xs text-muted-foreground">Almost</span>
                  </Button>
                  <Button onClick={() => onRateAyah('hard')} variant="outline" className="flex-col h-auto py-6 hover:bg-mistake/20 hover:border-mistake hover:text-foreground">
                    <span className="text-3xl mb-2">😓</span>
                    <span className="text-sm font-medium">Hard</span>
                    <span className="text-xs text-muted-foreground">Need more</span>
                  </Button>
                </div>
              </div>
            ) : (
              /* Normal memorization stages */
              <>
                {/* Arabic text — Mushaf-style across all stages, with per-stage hide pattern */}
                <div className="text-center py-4">
                  <MushafContextLines
                    surahId={surahId}
                    ayahNumber={currentAyahNum}
                    showFullPage={showFullPage}
                    mistakes={mistakes}
                    onWordClick={(ayah, wordIndex, e) => handleWordClick(ayah, wordIndex, e)}
                    hideMode={
                      state.currentStage === 'hide-third' ? 'hide-third'
                      : state.currentStage === 'hide-half' ? 'hide-half'
                      : state.currentStage === 'first-letters' ? 'first-letters'
                      : state.currentStage === 'full-hide' ? 'full-hide'
                      : 'none'
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-4">﴿{currentAyahNum}﴾</p>
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-4 justify-center border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Switch id="translation" checked={showTranslation} onCheckedChange={setShowTranslation} />
                    <Label htmlFor="translation" className="text-xs cursor-pointer">Translation</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="full-page" checked={showFullPage} onCheckedChange={setShowFullPage} />
                    <Label htmlFor="full-page" className="text-xs cursor-pointer">Show full page</Label>
                  </div>
                </div>

                {/* Translation display */}
                {showTranslation && currentAyah.translation && (
                  <div className="text-center text-sm text-muted-foreground italic bg-muted/30 rounded-lg p-4 transition-all">
                    {currentAyah.translation}
                  </div>
                )}

                {/* Audio controls */}
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" size="icon" onClick={toggleAudio} className="h-12 w-12 rounded-full">
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={replayAudio}>
                    <RotateCcw className="w-4 h-4 mr-1" /> Replay
                  </Button>
                </div>

                {/* Continue + Back buttons */}
                <div className="flex justify-center gap-3 pt-4 border-t">
                  {onGoBack && stageIndex > 0 && (
                    <Button onClick={onGoBack} size="lg" variant="outline" className="border-[#C6A477] text-[#C6A477] hover:bg-[#C6A477]/10">
                      <ChevronLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                  )}
                  <Button onClick={onAdvanceStage} size="lg" className="bg-[#C6A477] hover:bg-[#b8956a] text-white">
                    Continue <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Mistake legend — only show if there are mistakes */}
        {mistakes.size > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f28a8a' }} /> Incorrect</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#FFE0B2' }} /> Missed</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#D3e7ee' }} /> Tajweed</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#bec4ed' }} /> Harakah</span>
          </div>
        )}

        {/* Save to collection CTA */}
        {user && (
          <>
            <button
              onClick={() => setSaveDialogOpen(true)}
              className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors py-2 flex items-center justify-center gap-1.5"
            >
              <BookmarkPlus className="w-4 h-4" />
              Like the verse? Save it to your collection now
            </button>
            <SaveToCollectionDialog
              open={saveDialogOpen}
              onOpenChange={setSaveDialogOpen}
              verses={[{ surahId: state.config.surahId, ayah: currentAyahNum }]}
              ctaText="Save the current verse to one of your Quran.com collections."
            />
          </>
        )}
      </div>

      {/* ── Mistake category popover (same layout as SessionMushafViewer) ── */}
      {popoverOpen && popoverPosition && (
        isMobile ? (
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
              {hasMistakeOnSelected && (
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
          <div
            ref={popoverRef}
            className="fixed z-50"
            style={{
              left: `${popoverPosition.x}px`,
              top: `${popoverPosition.y - 60}px`,
              transform: 'translateX(-50%)',
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
                {hasMistakeOnSelected && (
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

      {/* ── Note Drawer/Sheet (same as SessionMushafViewer) ── */}
      {isMobile ? (
        <Sheet open={noteDrawerOpen} onOpenChange={setNoteDrawerOpen}>
          <SheetContent side="bottom" className="h-[400px]">
            <SheetHeader>
              <SheetTitle>Add Note</SheetTitle>
            </SheetHeader>
            <div className="py-4">
              <Label htmlFor="mem-mistake-note" className="mb-2">Note</Label>
              <Textarea
                id="mem-mistake-note"
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
              <Label htmlFor="mem-mistake-note-desktop" className="mb-2">Note</Label>
              <Textarea
                id="mem-mistake-note-desktop"
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
    </div>
  );
};
