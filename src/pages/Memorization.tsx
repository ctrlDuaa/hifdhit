import { useNavigate, useLocation } from 'react-router-dom';
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
import { MemorizationSessionState } from '@/types/memorization';
import { createDefaultBlockState } from '@/lib/reviewScheduler';

const Memorization = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Read continue state from navigation
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
    getConfidenceSummary,
    getWeakPassages,
  } = useMemorizationSession();

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

  if (!state) {
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
          onExit={() => { endSession(); }}
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
