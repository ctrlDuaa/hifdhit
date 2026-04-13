/**
 * Hook for conducting a block review session.
 * Manages word-level mistake marking and session submission.
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { quranApi, QuranVerse } from '@/services/quranApi';
import {
  WordMistake,
  SessionRating,
  MistakeType,
  processSessionResult,
  createDefaultBlockState,
  BlockState,
  SchedulingResult,
} from '@/lib/reviewScheduler';

export interface BlockInfo {
  id: string;
  surahId: number;
  surahName: string;
  startAyah: number;
  endAyah: number;
}

export interface ReviewWord {
  ayahNumber: number;
  wordIndex: number;
  text: string;
  mistake: MistakeType | null;
}

export function useBlockReview() {
  const { user } = useAuth();
  const [block, setBlock] = useState<BlockInfo | null>(null);
  const [verses, setVerses] = useState<QuranVerse[]>([]);
  const [mistakes, setMistakes] = useState<Map<string, WordMistake>>(new Map());
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'reviewing' | 'rating' | 'summary'>('idle');
  const [schedulingResult, setSchedulingResult] = useState<SchedulingResult | null>(null);

  const startReview = useCallback(async (blockInfo: BlockInfo) => {
    setLoading(true);
    try {
      const result = await quranApi.getVerseRange(
        blockInfo.surahId,
        blockInfo.startAyah,
        blockInfo.endAyah,
      );
      setVerses(result.verses);
      setBlock(blockInfo);
      setMistakes(new Map());
      setPhase('reviewing');
    } catch (err) {
      console.error('Failed to load verses for review:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleMistake = useCallback((ayahNumber: number, wordIndex: number, wordText: string, type: MistakeType) => {
    setMistakes(prev => {
      const next = new Map(prev);
      const key = `${ayahNumber}:${wordIndex}`;
      const existing = next.get(key);
      if (existing && existing.mistakeType === type) {
        next.delete(key);
      } else {
        next.set(key, { ayahNumber, wordIndex, wordText, mistakeType: type });
      }
      return next;
    });
  }, []);

  const removeMistake = useCallback((ayahNumber: number, wordIndex: number) => {
    setMistakes(prev => {
      const next = new Map(prev);
      next.delete(`${ayahNumber}:${wordIndex}`);
      return next;
    });
  }, []);

  const getMistakeForWord = useCallback((ayahNumber: number, wordIndex: number): MistakeType | null => {
    return mistakes.get(`${ayahNumber}:${wordIndex}`)?.mistakeType || null;
  }, [mistakes]);

  const goToRating = useCallback(() => {
    setPhase('rating');
  }, []);

  const goBackToMarking = useCallback(() => {
    setPhase('reviewing');
  }, []);

  const submitRating = useCallback(async (rating: SessionRating) => {
    if (!block || !user) return;

    const mistakeList = Array.from(mistakes.values());
    const totalWords = verses.reduce((sum, v) => {
      const wordCount = v.words?.filter(w => w.char_type_name !== 'end').length || 0;
      return sum + wordCount;
    }, 0);

    // Fetch current block state from DB
    const { data: blockRow } = await supabase
      .from('memorization_blocks')
      .select('*')
      .eq('id', block.id)
      .single();

    const currentState: BlockState = blockRow ? {
      strengthScore: blockRow.strength_score,
      easeFactor: Number(blockRow.ease_factor),
      intervalDays: blockRow.interval_days,
      currentStreak: blockRow.current_streak,
      totalReviews: blockRow.total_reviews,
      successfulReviews: blockRow.successful_reviews,
      perfectReviews: blockRow.perfect_reviews,
      totalMistakes: blockRow.total_mistakes,
      recentMistakes7d: blockRow.recent_mistakes_7d,
      repeatedProblemWordsCount: blockRow.repeated_problem_words_count,
      needsFocusReview: blockRow.needs_focus_review,
      masteryStatus: blockRow.mastery_status as any,
      priorityLevel: blockRow.priority_level as any,
      overdueCount: blockRow.overdue_count,
      lastSessionRating: blockRow.last_session_rating as any,
      recentRatings: (blockRow.recent_ratings as any) || [],
    } : createDefaultBlockState();

    // Fetch recent word mistakes for recurring penalty
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: recentMistakes } = await supabase
      .from('block_review_mistakes')
      .select('ayah_number, word_index, created_at')
      .eq('block_id', block.id)
      .gte('created_at', fourteenDaysAgo.toISOString());

    const recentWordMistakes7d = new Map<string, number>();
    const recentWordMistakes14d = new Map<string, number>();
    for (const rm of recentMistakes || []) {
      const key = `${rm.ayah_number}:${rm.word_index}`;
      recentWordMistakes14d.set(key, (recentWordMistakes14d.get(key) || 0) + 1);
      if (new Date(rm.created_at) >= sevenDaysAgo) {
        recentWordMistakes7d.set(key, (recentWordMistakes7d.get(key) || 0) + 1);
      }
    }

    // Run scheduling algorithm
    const result = processSessionResult(
      currentState,
      { rating, mistakes: mistakeList, totalWordsInBlock: totalWords },
      recentWordMistakes7d,
      recentWordMistakes14d,
    );

    // Save review to DB
    const { data: review } = await supabase
      .from('block_reviews')
      .insert({
        user_id: user.id,
        block_id: block.id,
        session_rating: rating,
        block_mistake_score: result.blockMistakeScore,
        normalized_mistake_score: result.normalizedMistakeScore,
        total_words_in_block: totalWords,
        mistake_count_incorrect: result.mistakeCountsByType.incorrect,
        mistake_count_missed: result.mistakeCountsByType.missed,
        mistake_count_tajweed: result.mistakeCountsByType.tajweed,
        mistake_count_forgot: result.mistakeCountsByType.forgot,
        repeated_problem_words_count: result.newState.repeatedProblemWordsCount,
        strength_before: currentState.strengthScore,
        strength_after: result.newState.strengthScore,
        interval_before: currentState.intervalDays,
        interval_after: result.newState.intervalDays,
        ease_before: currentState.easeFactor,
        ease_after: result.newState.easeFactor,
        entered_focus_review: result.enteredFocusReview,
        override_applied: result.overridesApplied.join(',') || null,
      })
      .select('id')
      .single();

    // Save individual mistakes
    if (review && mistakeList.length > 0) {
      const mistakeRows = mistakeList.map(m => ({
        user_id: user.id,
        block_id: block.id,
        review_id: review.id,
        surah_id: block.surahId,
        ayah_number: m.ayahNumber,
        word_index: m.wordIndex,
        word_text: m.wordText,
        mistake_type: m.mistakeType,
      }));
      await supabase.from('block_review_mistakes').insert(mistakeRows);
    }

    // Update block state
    const ns = result.newState;
    await supabase
      .from('memorization_blocks')
      .update({
        strength_score: ns.strengthScore,
        ease_factor: ns.easeFactor,
        interval_days: ns.intervalDays,
        current_streak: ns.currentStreak,
        total_reviews: ns.totalReviews,
        successful_reviews: ns.successfulReviews,
        perfect_reviews: ns.perfectReviews,
        total_mistakes: ns.totalMistakes,
        repeated_problem_words_count: ns.repeatedProblemWordsCount,
        needs_focus_review: ns.needsFocusReview,
        mastery_status: ns.masteryStatus,
        priority_level: ns.priorityLevel,
        last_session_rating: ns.lastSessionRating,
        recent_ratings: ns.recentRatings as any,
        last_reviewed_at: new Date().toISOString(),
        next_review_at: result.nextReviewAt.toISOString(),
      })
      .eq('id', block.id);

    // Update word stats
    for (const m of mistakeList) {
      const typeCol = `total_${m.mistakeType}_count` as const;
      
      // Upsert word stats
      const { data: existing } = await supabase
        .from('block_word_stats')
        .select('id, total_incorrect_count, total_missed_count, total_tajweed_count, total_forgot_count, recent_mistake_count_7d')
        .eq('block_id', block.id)
        .eq('ayah_number', m.ayahNumber)
        .eq('word_index', m.wordIndex)
        .maybeSingle();

      if (existing) {
        const updates: any = {
          last_mistake_at: new Date().toISOString(),
          recent_mistake_count_7d: (existing.recent_mistake_count_7d || 0) + 1,
        };
        if (m.mistakeType === 'incorrect') updates.total_incorrect_count = existing.total_incorrect_count + 1;
        if (m.mistakeType === 'missed') updates.total_missed_count = existing.total_missed_count + 1;
        if (m.mistakeType === 'tajweed') updates.total_tajweed_count = existing.total_tajweed_count + 1;
        if (m.mistakeType === 'forgot') updates.total_forgot_count = existing.total_forgot_count + 1;
        await supabase.from('block_word_stats').update(updates).eq('id', existing.id);
      } else {
        await supabase.from('block_word_stats').insert({
          user_id: user.id,
          block_id: block.id,
          ayah_number: m.ayahNumber,
          word_index: m.wordIndex,
          word_text: m.wordText,
          total_incorrect_count: m.mistakeType === 'incorrect' ? 1 : 0,
          total_missed_count: m.mistakeType === 'missed' ? 1 : 0,
          total_tajweed_count: m.mistakeType === 'tajweed' ? 1 : 0,
          total_forgot_count: m.mistakeType === 'forgot' ? 1 : 0,
          last_mistake_at: new Date().toISOString(),
          recent_mistake_count_7d: 1,
        });
      }
    }

    // Update ayah stats
    const ayahNumbers = new Set(mistakeList.map(m => m.ayahNumber));
    for (let a = block.startAyah; a <= block.endAyah; a++) {
      const ayahMistakeCount = mistakeList.filter(m => m.ayahNumber === a).length;
      const { data: existing } = await supabase
        .from('block_ayah_stats')
        .select('id, total_reviews, total_mistakes, strength_score')
        .eq('block_id', block.id)
        .eq('ayah_number', a)
        .maybeSingle();

      if (existing) {
        const newAyahStrength = Math.max(0, Math.min(100,
          existing.strength_score + (ayahMistakeCount === 0 ? 3 : -ayahMistakeCount * 5)
        ));
        await supabase.from('block_ayah_stats').update({
          total_reviews: existing.total_reviews + 1,
          total_mistakes: existing.total_mistakes + ayahMistakeCount,
          last_reviewed_at: new Date().toISOString(),
          strength_score: newAyahStrength,
        }).eq('id', existing.id);
      } else {
        await supabase.from('block_ayah_stats').insert({
          user_id: user.id,
          block_id: block.id,
          ayah_number: a,
          total_reviews: 1,
          total_mistakes: ayahMistakeCount,
          last_reviewed_at: new Date().toISOString(),
          strength_score: ayahMistakeCount === 0 ? 43 : Math.max(0, 40 - ayahMistakeCount * 5),
        });
      }
    }

    // Also record as session_activity for global stats
    await supabase.from('session_activity').insert({
      user_id: user.id,
      session_id: user.id,
      surah_number: block.surahId,
      starting_ayah: block.startAyah,
      ending_ayah: block.endAyah,
      ayat_revised: block.endAyah - block.startAyah + 1,
      mistake_count: mistakeList.length,
      role: 'reciter',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    // Upsert progress
    const progressRows = [];
    for (let a = block.startAyah; a <= block.endAyah; a++) {
      progressRows.push({
        user_id: user.id,
        surah_number: block.surahId,
        ayah_number: a,
        status: 'revised' as const,
      });
    }
    for (let i = 0; i < progressRows.length; i += 50) {
      await supabase.from('progress').upsert(
        progressRows.slice(i, i + 50),
        { onConflict: 'user_id,surah_number,ayah_number' },
      );
    }

    setSchedulingResult(result);
    setPhase('summary');
  }, [block, user, mistakes, verses]);

  const resetReview = useCallback(() => {
    setBlock(null);
    setVerses([]);
    setMistakes(new Map());
    setPhase('idle');
    setSchedulingResult(null);
  }, []);

  return {
    block,
    verses,
    mistakes,
    loading,
    phase,
    schedulingResult,
    startReview,
    toggleMistake,
    removeMistake,
    getMistakeForWord,
    goToRating,
    goBackToMarking,
    submitRating,
    resetReview,
  };
}
