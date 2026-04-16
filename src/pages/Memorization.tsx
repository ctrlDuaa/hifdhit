import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useMemorizationSession } from '@/hooks/useMemorizationSession';
import { MemorizationSetup } from '@/components/memorization/MemorizationSetup';
import { GuidedMemorization } from '@/components/memorization/GuidedMemorization';
import { ConsolidationCheckpoint } from '@/components/memorization/ConsolidationCheckpoint';
import { SessionSummary } from '@/components/memorization/SessionSummary';
import { AppHeader } from '@/components/AppHeader';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useCallback } from 'react';
import { MemorizationSessionState, MemorizationSessionConfig } from '@/types/memorization';
import { createDefaultBlockState } from '@/lib/reviewScheduler';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw } from 'lucide-react';

const Memorization = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const continueState = location.state as { surahId?: number; nextAyahStart?: number } | null;

  const {
    state,
    loadingVerses,
    startSession,
    getCurrentAyah,
    getChunkAyahs,
    advanceStage,
    goBackStage,
    rateAyah,
    handleCheckpointResult,
    toggleWeakMark,
    endSession,
    pauseSession,
    resumeSession,
    getSavedSessionInfo,
    getConfidenceSummary,
    getWeakPassages,
  } = useMemorizationSession();

  // Check for a saved incomplete session
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [savedInfo, setSavedInfo] = useState<ReturnType<typeof getSavedSessionInfo>>(null);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    if (!state) {
      const info = getSavedSessionInfo();
      if (info) {
        setSavedInfo(info);
        setShowResumeDialog(true);
        setShowSetup(false);
      } else {
        setShowSetup(true);
      }
    }
  }, [state, getSavedSessionInfo]);

  const handleResume = async () => {
    setShowResumeDialog(false);
    try {
      await resumeSession();
    } catch {
      toast({
        title: 'Failed to resume session',
        description: 'Could not fetch verse data. Please start a new session.',
        variant: 'destructive',
      });
      endSession();
      setShowSetup(true);
    }
  };

  const handleNewSession = () => {
    setShowResumeDialog(false);
    endSession(); // clears saved data
    setShowSetup(true);
  };

  const saveSessionStats = useCallback(async (sessionState: MemorizationSessionState) => {
    if (!user) return;
    const { config, startedAt } = sessionState;
    const completedAt = sessionState.completedAt || new Date().toISOString();
    const ayatRevised = config.ayahEnd - config.ayahStart + 1;

    // Compute block-level review schedule based on worst confidence
    const perfs = Object.values(sessionState.ayahPerformance);
    const hasHard = perfs.some(p => p.confidenceRating === 'hard');
    const hasShaky = perfs.some(p => p.confidenceRating === 'shaky');
    const reviewDays = hasHard ? [1, 2, 3] : hasShaky ? [1, 3, 5] : [1, 3, 7];
    const firstReviewDay = reviewDays[0];

    try {
      const { error: activityError } = await supabase
        .from('session_activity')
        .insert({
          user_id: user.id,
          session_id: user.id,
          surah_number: config.surahId,
          starting_ayah: config.ayahStart,
          ending_ayah: config.ayahEnd,
          ayat_revised: ayatRevised,
          mistake_count: 0,
          role: 'reciter',
          started_at: startedAt,
          completed_at: completedAt,
        });

      if (activityError) {
        console.error('❌ Error recording memorization activity:', activityError);
      }

      const progressRecords = [];
      for (let a = config.ayahStart; a <= config.ayahEnd; a++) {
        progressRecords.push({
          user_id: user.id,
          surah_number: config.surahId,
          ayah_number: a,
          status: 'revised' as const,
        });
      }

      for (let i = 0; i < progressRecords.length; i += 50) {
        const batch = progressRecords.slice(i, i + 50);
        const { error: progressError } = await supabase
          .from('progress')
          .upsert(batch, { onConflict: 'user_id,surah_number,ayah_number' });
        if (progressError) {
          console.error('❌ Error upserting progress:', progressError);
        }
      }

      // Auto-create memorization block with block-level scheduling
      const { data: existingBlock } = await supabase
        .from('memorization_blocks')
        .select('id')
        .eq('user_id', user.id)
        .eq('surah_id', config.surahId)
        .eq('start_ayah', config.ayahStart)
        .eq('end_ayah', config.ayahEnd)
        .maybeSingle();

      if (!existingBlock) {
        const defaults = createDefaultBlockState();
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + firstReviewDay);

        const rating = hasHard ? 'weak' : hasShaky ? 'shaky' : 'perfect';

        const { error: blockError } = await supabase
          .from('memorization_blocks')
          .insert({
            user_id: user.id,
            surah_id: config.surahId,
            start_ayah: config.ayahStart,
            end_ayah: config.ayahEnd,
            strength_score: 50,
            ease_factor: defaults.easeFactor,
            interval_days: firstReviewDay,
            mastery_status: 'learning',
            priority_level: 'high',
            needs_focus_review: hasHard,
            next_review_at: nextReview.toISOString(),
            last_reviewed_at: new Date().toISOString(),
            total_reviews: 1,
            successful_reviews: 1,
            last_session_rating: rating,
            recent_ratings: [rating],
          });

        if (blockError) {
          console.error('❌ Error creating memorization block:', blockError);
        }
      }
    } catch (err) {
      console.error('❌ Failed to save memorization stats:', err);
    }
  }, [user]);

  const handleStart = async (config: any) => {
    try {
      await startSession(config);
    } catch (err) {
      toast({
        title: 'Failed to load verses',
        description: err instanceof Error ? err.message : 'Could not fetch Quran data. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleFinish = async () => {
    if (state) {
      await saveSessionStats(state);
    }
    endSession();
    navigate('/dashboard');
  };

  const handleExit = () => {
    pauseSession(); // keep data in localStorage for resume
    navigate('/dashboard');
  };

  // Resume dialog — shown when no active React state but localStorage has data
  if (!state && showResumeDialog && savedInfo) {
    return (
      <>
        <AppHeader />
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-background">
          <Dialog open onOpenChange={(open) => { if (!open) handleNewSession(); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl">Resume Session?</DialogTitle>
                <DialogDescription className="text-sm">
                  You have an unfinished memorization session.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg bg-muted/50 p-4 space-y-1.5 my-2">
                <p className="font-semibold text-foreground">{savedInfo.config.surahName}</p>
                <p className="text-sm text-muted-foreground">
                  Ayat {savedInfo.config.ayahStart}–{savedInfo.config.ayahEnd}
                </p>
                <p className="text-sm text-muted-foreground">
                  Progress: {savedInfo.completedAyahs}/{savedInfo.totalAyahs} ayat completed · Currently on Ayah {savedInfo.currentAyah}
                </p>
              </div>
              <div className="flex flex-col gap-2 mt-2">
                <Button onClick={handleResume} className="w-full gap-2 bg-[#C6A477] hover:bg-[#b8956a] text-white" disabled={loadingVerses}>
                  {loadingVerses ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Resume Session
                    </>
                  )}
                </Button>
                <Button onClick={handleNewSession} variant="outline" className="w-full gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Start New Session
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </>
    );
  }

  if (!state && showSetup) {
    return (
      <>
        <AppHeader />
        <MemorizationSetup
          onStart={handleStart}
          loading={loadingVerses}
          onBack={() => navigate('/dashboard')}
          initialSurahId={continueState?.surahId}
          initialAyahStart={continueState?.nextAyahStart}
        />
      </>
    );
  }

  if (!state) return null;

  if (state.phase === 'memorizing') {
    return (
      <>
        <AppHeader />
        <GuidedMemorization
          state={state}
          currentAyah={getCurrentAyah()}
          onAdvanceStage={advanceStage}
          onRateAyah={rateAyah}
          onToggleWeak={toggleWeakMark}
          onExit={handleExit}
          onGoBack={goBackStage}
        />
      </>
    );
  }

  if (state.phase === 'checkpoint') {
    return (
      <>
        <AppHeader />
        <ConsolidationCheckpoint
          state={state}
          chunkAyahs={getChunkAyahs()}
          onResult={handleCheckpointResult}
        />
      </>
    );
  }

  if (state.phase === 'summary') {
    return (
      <>
        <AppHeader />
        <SessionSummary
          state={state}
          confidenceSummary={getConfidenceSummary()}
          weakPassages={getWeakPassages()}
          onFinish={handleFinish}
          onStartRevision={async () => {
            if (state) await saveSessionStats(state);
            endSession();
            navigate('/review');
          }}
        />
      </>
    );
  }

  return null;
};

export default Memorization;
