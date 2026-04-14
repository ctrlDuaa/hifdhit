import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Play, Pause, RotateCcw, ChevronRight, ChevronLeft, LogOut,
} from 'lucide-react';
import { MemorizationSessionState, MemorizationStage, ConfidenceRating } from '@/types/memorization';
import { MemorizationAyah } from '@/hooks/useMemorizationSession';
import { cn } from '@/lib/utils';
import { isQfSessionValid } from '@/services/qfAuth';
import { SaveToCollectionDialog } from '@/components/memorization/SaveToCollectionDialog';
import { BookmarkPlus } from 'lucide-react';

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
  'listen': 'Listen carefully and follow along with the text',
  'hide-third': 'Some words are hidden — try to recall them',
  'hide-half': 'Half the words are hidden — keep going!',
  'first-letters': 'Only first letters shown — recall the full words',
  'full-hide': 'Recite the entire ayah from memory',
  'self-assess': 'How did that feel?',
};

const ACTIVE_STAGES = ['listen', 'hide-third', 'hide-half', 'first-letters', 'self-assess'];

function renderArabicText(ayah: MemorizationAyah, stage: MemorizationStage): React.ReactNode {
  const words = ayah.words;

  if (stage === 'listen') {
    return <span>{ayah.text}</span>;
  }
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

        if (hidden) {
          return (
            <span key={i} className="inline-block px-2 py-1 rounded bg-muted/60 text-muted-foreground/40 min-w-[2rem] text-center transition-all">
              {showFirstLetter ? word.charAt(0) + '...' : '•••'}
            </span>
          );
        }
        return <span key={i}>{word}</span>;
      })}
    </span>
  );
}

export const GuidedMemorization = ({ state, currentAyah, onAdvanceStage, onRateAyah, onToggleWeak, onExit, onGoBack }: Props) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranslation, setShowTranslation] = useState(state.config.showTranslation);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const qfConnected = isQfSessionValid();

  const chunk = state.chunks[state.currentChunkIndex];
  const currentAyahNum = chunk ? chunk.ayahStart + state.currentAyahInChunk : 0;

  const totalAyahs = state.config.ayahEnd - state.config.ayahStart + 1;
  const completedAyahs = Object.values(state.ayahPerformance).filter(p => p.confidenceRating !== null).length;
  const currentAyahIndex = state.currentAyahInChunk + 1;
  const progressPercent = totalAyahs > 0 ? (completedAyahs / totalAyahs) * 100 : 0;

  const stageIndex = ACTIVE_STAGES.indexOf(state.currentStage);
  const isSelfAssess = state.currentStage === 'self-assess';

  // Audio management
  useEffect(() => {
    if (currentAyah?.audioUrl) {
      const audio = new Audio(currentAyah.audioUrl);
      audioRef.current = audio;
      audio.addEventListener('ended', () => setIsPlaying(false));
      return () => { audio.pause(); audio.src = ''; };
    }
  }, [currentAyah?.audioUrl]);

  const toggleAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play().catch(() => {}); setIsPlaying(true); }
  }, [isPlaying]);

  const replayAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    setIsPlaying(true);
  }, []);

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
              /* Self-assessment UI — replaces the verse display */
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
                {/* Arabic text */}
                <div className="text-center py-6">
                  <div className="text-3xl md:text-4xl leading-loose font-arabic" dir="rtl" style={{ lineHeight: '2.5' }}>
                    {renderArabicText(currentAyah, state.currentStage)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">﴿{currentAyahNum}﴾</p>
                </div>

                {/* Translation toggle */}
                <div className="flex flex-wrap gap-4 justify-center border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Switch id="translation" checked={showTranslation} onCheckedChange={setShowTranslation} />
                    <Label htmlFor="translation" className="text-xs cursor-pointer">Translation</Label>
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
                  <Button variant="outline" size="icon" onClick={toggleAudio} className="h-12 w-12 rounded-full" disabled={!currentAyah.audioUrl}>
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={replayAudio} disabled={!currentAyah.audioUrl}>
                    <RotateCcw className="w-4 h-4 mr-1" /> Replay
                  </Button>
                </div>

                {/* Continue + Back buttons */}
                <div className="flex justify-center gap-3 pt-4 border-t">
                  {onGoBack && stageIndex > 0 && (
                    <Button onClick={onGoBack} variant="outline" className="border-[#C6A477] text-[#C6A477] hover:bg-[#C6A477]/10">
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

        {/* Save to collection CTA */}
        {qfConnected && (
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
    </div>
  );
};
