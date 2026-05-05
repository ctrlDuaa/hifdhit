/**
 * Review analytics — generates natural-language insights from block review history.
 */

import { supabase } from '@/integrations/supabase/runtimeClient';
import { MistakeType, getMistakeTypeLabel, MasteryStatus } from '@/lib/reviewScheduler';

export interface BlockInsight {
  icon: 'warning' | 'improving' | 'info' | 'celebrate';
  text: string;
}

interface ReviewRow {
  session_rating: string;
  block_mistake_score: number;
  mistake_count_incorrect: number;
  mistake_count_missed: number;
  mistake_count_tajweed: number;
  mistake_count_forgot: number;
  created_at: string;
  strength_before: number;
  strength_after: number;
}

interface WordStatRow {
  ayah_number: number;
  word_index: number;
  word_text: string;
  total_incorrect_count: number;
  total_missed_count: number;
  total_tajweed_count: number;
  total_forgot_count: number;
  recent_mistake_count_7d: number;
}

/**
 * Generate insights for a specific block based on its review and word-mistake history.
 */
export async function generateBlockInsights(
  blockId: string,
  currentMastery: string,
  currentStrength: number,
  needsFocusReview: boolean,
): Promise<BlockInsight[]> {
  const insights: BlockInsight[] = [];

  // Fetch last 10 reviews
  const { data: reviews } = await supabase
    .from('block_reviews')
    .select('session_rating, block_mistake_score, mistake_count_incorrect, mistake_count_missed, mistake_count_tajweed, mistake_count_forgot, created_at, strength_before, strength_after')
    .eq('block_id', blockId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch word stats with recent issues
  const { data: wordStats } = await supabase
    .from('block_word_stats')
    .select('ayah_number, word_index, word_text, total_incorrect_count, total_missed_count, total_tajweed_count, total_forgot_count, recent_mistake_count_7d')
    .eq('block_id', blockId)
    .order('recent_mistake_count_7d', { ascending: false });

  if (!reviews || reviews.length === 0) {
    insights.push({ icon: 'info', text: 'No review history yet. Complete a review to start tracking your progress.' });
    return insights;
  }

  const rs = reviews as ReviewRow[];
  const ws = (wordStats || []) as WordStatRow[];

  // ── Forgot pattern ──
  const totalForgot = rs.reduce((s, r) => s + r.mistake_count_forgot, 0);
  const recentForgot = rs.slice(0, 3).reduce((s, r) => s + r.mistake_count_forgot, 0);
  if (recentForgot >= 3) {
    insights.push({ icon: 'warning', text: 'You frequently struggle with "forgot" mistakes in this block. Consider breaking it into smaller chunks for focused repetition.' });
  } else if (totalForgot >= 5 && recentForgot === 0) {
    insights.push({ icon: 'improving', text: 'You used to have frequent "forgot" errors here, but your recent sessions show improvement.' });
  }

  // ── Tajweed trend ──
  const totalTajweed = rs.reduce((s, r) => s + r.mistake_count_tajweed, 0);
  const recentTajweed = rs.slice(0, 3).reduce((s, r) => s + r.mistake_count_tajweed, 0);
  const olderTajweed = rs.slice(3).reduce((s, r) => s + r.mistake_count_tajweed, 0);
  if (totalTajweed >= 3 && recentTajweed < olderTajweed) {
    insights.push({ icon: 'improving', text: 'Your tajweed errors are decreasing — keep it up!' });
  } else if (recentTajweed >= 4) {
    insights.push({ icon: 'warning', text: 'Multiple tajweed mistakes in recent sessions. Consider reviewing the tajweed rules for this passage.' });
  }

  // ── Recurring problem words ──
  const problemWords = ws.filter(w => w.recent_mistake_count_7d >= 2);
  if (problemWords.length >= 3) {
    const wordTexts = problemWords.slice(0, 3).map(w => `"${w.word_text}"`).join(', ');
    insights.push({ icon: 'warning', text: `These ${problemWords.length} words caused repeated mistakes this week: ${wordTexts}. Focus on memorizing them individually.` });
  } else if (problemWords.length > 0) {
    const w = problemWords[0];
    insights.push({ icon: 'info', text: `The word "${w.word_text}" (Ayah ${w.ayah_number}) has been marked ${w.recent_mistake_count_7d} times this week.` });
  }

  // ── Strength trend ──
  if (rs.length >= 3) {
    const strengthChanges = rs.slice(0, 3).map(r => r.strength_after - r.strength_before);
    const avgChange = strengthChanges.reduce((s, c) => s + c, 0) / strengthChanges.length;
    if (avgChange > 5) {
      insights.push({ icon: 'celebrate', text: 'Your strength score is trending upward. This block is becoming more stable.' });
    } else if (avgChange < -5) {
      insights.push({ icon: 'warning', text: 'Strength has been declining. This block may need more frequent review.' });
    }
  }

  // ── Stability insight ──
  if (currentMastery === 'stable' || currentMastery === 'strong') {
    const lastClean = rs.find(r => r.block_mistake_score === 0);
    if (lastClean) {
      insights.push({ icon: 'celebrate', text: 'This block is stable now and can be reviewed less often. Great work!' });
    }
  }

  // ── Rating consistency ──
  const recentRatings = rs.slice(0, 5).map(r => r.session_rating);
  const weakCount = recentRatings.filter(r => r === 'weak').length;
  const perfectCount = recentRatings.filter(r => r === 'perfect').length;
  if (weakCount >= 2) {
    insights.push({ icon: 'warning', text: `${weakCount} of your last ${recentRatings.length} sessions were rated "Weak". This block needs consistent daily review.` });
  } else if (perfectCount >= 3) {
    insights.push({ icon: 'celebrate', text: `${perfectCount} "Perfect" ratings recently! Your memorization of this block is solid.` });
  }

  // ── Dominant mistake type ──
  const totalByType = {
    incorrect: rs.reduce((s, r) => s + r.mistake_count_incorrect, 0),
    missed: rs.reduce((s, r) => s + r.mistake_count_missed, 0),
    tajweed: rs.reduce((s, r) => s + r.mistake_count_tajweed, 0),
    forgot: rs.reduce((s, r) => s + r.mistake_count_forgot, 0),
  };
  const dominant = Object.entries(totalByType).sort((a, b) => b[1] - a[1])[0];
  if (dominant[1] >= 5 && insights.length < 4) {
    const total = Object.values(totalByType).reduce((s, v) => s + v, 0);
    const pct = Math.round((dominant[1] / total) * 100);
    if (pct >= 40) {
      insights.push({
        icon: 'info',
        text: `${pct}% of your mistakes in this block are "${getMistakeTypeLabel(dominant[0] as MistakeType)}" errors.`,
      });
    }
  }

  // ── Focus review context ──
  if (needsFocusReview && insights.length < 5) {
    insights.push({ icon: 'warning', text: 'This block is in Focus Review mode. Complete a clean session (no forgot/missed mistakes, rated Good or Perfect) to exit.' });
  }

  // Limit to 5 insights max
  return insights.slice(0, 5);
}

/**
 * Generate a quick single-line insight for a block card (no DB call — uses passed data).
 */
export function getQuickInsight(block: {
  total_reviews: number;
  strength_score: number;
  mastery_status: string;
  needs_focus_review: boolean;
  repeated_problem_words_count: number;
  last_session_rating: string | null;
  current_streak: number;
}): string | null {
  if (block.needs_focus_review) return 'Needs focused repetition';
  if (block.repeated_problem_words_count >= 3) return `${block.repeated_problem_words_count} recurring problem words`;
  if (block.current_streak >= 5) return `${block.current_streak}-session streak!`;
  if (block.mastery_status === 'strong') return 'Mastered — review less often';
  if (block.last_session_rating === 'weak') return 'Last session was weak';
  if (block.total_reviews === 0) return 'Not yet reviewed';
  return null;
}
