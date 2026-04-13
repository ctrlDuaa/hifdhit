/**
 * Hook for managing memorization blocks — CRUD + queries.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { createDefaultBlockState } from '@/lib/reviewScheduler';
import { getBlockProjectedReviewDates } from '@/lib/memorizationReviewTimeline';

export interface MemorizationBlock {
  id: string;
  user_id: string;
  surah_id: number;
  start_ayah: number;
  end_ayah: number;
  strength_score: number;
  ease_factor: number;
  interval_days: number;
  current_streak: number;
  total_reviews: number;
  successful_reviews: number;
  perfect_reviews: number;
  total_mistakes: number;
  recent_mistakes_7d: number;
  repeated_problem_words_count: number;
  needs_focus_review: boolean;
  mastery_status: string;
  priority_level: string;
  overdue_count: number;
  last_session_rating: string | null;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  recent_ratings: string[];
  created_at: string;
}

export function useMemorizationBlocks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const blocksQuery = useQuery({
    queryKey: ['memorization-blocks', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('memorization_blocks')
        .select('*')
        .eq('user_id', user.id)
        .order('next_review_at', { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data as MemorizationBlock[];
    },
    enabled: !!user,
  });

  const createBlock = useMutation({
    mutationFn: async (params: { surahId: number; startAyah: number; endAyah: number }) => {
      if (!user) throw new Error('Not authenticated');
      const defaults = createDefaultBlockState();
      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + 1);

      const { data, error } = await supabase
        .from('memorization_blocks')
        .insert({
          user_id: user.id,
          surah_id: params.surahId,
          start_ayah: params.startAyah,
          end_ayah: params.endAyah,
          strength_score: defaults.strengthScore,
          ease_factor: defaults.easeFactor,
          interval_days: defaults.intervalDays,
          mastery_status: defaults.masteryStatus,
          priority_level: defaults.priorityLevel,
          next_review_at: nextReview.toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['memorization-blocks'] }),
  });

  const deleteBlock = useMutation({
    mutationFn: async (blockId: string) => {
      const { error } = await supabase
        .from('memorization_blocks')
        .delete()
        .eq('id', blockId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['memorization-blocks'] }),
  });

  const blocks = blocksQuery.data || [];
  const now = new Date();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const dueToday = blocks.filter(block =>
    getBlockProjectedReviewDates(block).some(date => {
      const reviewDay = new Date(date);
      reviewDay.setHours(0, 0, 0, 0);
      return reviewDay.getTime() <= startOfToday.getTime();
    })
  );

  const focusReviewBlocks = blocks.filter(b => b.needs_focus_review);

  const urgentBlocks = blocks.filter(b => b.priority_level === 'urgent' || b.priority_level === 'high');

  const needsAttention = blocks.filter(b =>
    b.needs_focus_review ||
    b.priority_level === 'urgent' ||
    b.priority_level === 'high' ||
    getBlockProjectedReviewDates(b).some(date => date < now)
  );

  return {
    blocks,
    loading: blocksQuery.isLoading,
    dueToday,
    focusReviewBlocks,
    urgentBlocks,
    needsAttention,
    createBlock,
    deleteBlock,
    refetch: blocksQuery.refetch,
  };
}
