/**
 * Mistake-Aware Review Scheduling Engine
 * 
 * Deterministic, explainable scheduling that uses both
 * word-level mistakes and session-end ratings.
 */

// ── Types ────────────────────────────────────────────────────

export type MistakeType = 'incorrect' | 'missed' | 'tajweed' | 'forgot';
export type SessionRating = 'perfect' | 'good' | 'shaky' | 'weak';
export type MasteryStatus = 'new' | 'learning' | 'improving' | 'stable' | 'strong';
export type PriorityLevel = 'urgent' | 'high' | 'normal' | 'low';

export interface WordMistake {
  ayahNumber: number;
  wordIndex: number;
  wordText: string;
  mistakeType: MistakeType;
}

export interface SessionResult {
  rating: SessionRating;
  mistakes: WordMistake[];
  totalWordsInBlock: number;
}

export interface BlockState {
  strengthScore: number;
  easeFactor: number;
  intervalDays: number;
  currentStreak: number;
  totalReviews: number;
  successfulReviews: number;
  perfectReviews: number;
  totalMistakes: number;
  recentMistakes7d: number;
  repeatedProblemWordsCount: number;
  needsFocusReview: boolean;
  masteryStatus: MasteryStatus;
  priorityLevel: PriorityLevel;
  overdueCount: number;
  lastSessionRating: SessionRating | null;
  recentRatings: SessionRating[];
}

export interface SchedulingResult {
  newState: BlockState;
  nextReviewAt: Date;
  blockMistakeScore: number;
  normalizedMistakeScore: number;
  enteredFocusReview: boolean;
  overridesApplied: string[];
  mistakeCountsByType: Record<MistakeType, number>;
}

// ── Constants ────────────────────────────────────────────────

const MISTAKE_WEIGHTS: Record<MistakeType, number> = {
  tajweed: 1,
  incorrect: 2,
  missed: 3,
  forgot: 4,
};

const RATING_CONFIG: Record<SessionRating, {
  multiplier: number;
  strengthBonus: number;
  streakChange: 'increment' | 'reset';
  easeChange: number;
}> = {
  perfect:  { multiplier: 1.35, strengthBonus: 12,  streakChange: 'increment', easeChange: 0.08 },
  good:     { multiplier: 1.0,  strengthBonus: 5,   streakChange: 'increment', easeChange: 0.03 },
  shaky:    { multiplier: 0.55, strengthBonus: -8,   streakChange: 'reset',     easeChange: -0.10 },
  weak:     { multiplier: 0.25, strengthBonus: -18,  streakChange: 'reset',     easeChange: -0.20 },
};

const MASTERY_THRESHOLDS: { min: number; max: number; status: MasteryStatus }[] = [
  { min: 90, max: 100, status: 'strong' },
  { min: 75, max: 89,  status: 'stable' },
  { min: 60, max: 74,  status: 'improving' },
  { min: 45, max: 59,  status: 'learning' },
  { min: 0,  max: 44,  status: 'new' },
];

// ── Helpers ──────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function countMistakesByType(mistakes: WordMistake[]): Record<MistakeType, number> {
  const counts: Record<MistakeType, number> = { incorrect: 0, missed: 0, tajweed: 0, forgot: 0 };
  for (const m of mistakes) counts[m.mistakeType]++;
  return counts;
}

// ── Core Algorithm ───────────────────────────────────────────

/**
 * Calculate weighted mistake score with recurring penalty.
 */
export function calculateMistakeScore(
  mistakes: WordMistake[],
  recentWordMistakes7d: Map<string, number> = new Map(),
  recentWordMistakes14d: Map<string, number> = new Map(),
): number {
  let score = 0;
  for (const m of mistakes) {
    let weight = MISTAKE_WEIGHTS[m.mistakeType];
    const key = `${m.ayahNumber}:${m.wordIndex}`;
    const recent7 = recentWordMistakes7d.get(key) || 0;
    const recent14 = recentWordMistakes14d.get(key) || 0;

    if (recent14 >= 4) {
      weight += 2;
    } else if (recent7 >= 2) {
      weight += 1;
    }
    score += weight;
  }
  return score;
}

/**
 * Count words that have repeated recent mistakes.
 */
export function countRepeatedProblemWords(
  recentWordMistakes7d: Map<string, number>,
): number {
  let count = 0;
  for (const v of recentWordMistakes7d.values()) {
    if (v >= 2) count++;
  }
  return count;
}

/**
 * Main scheduling function — processes a session result and returns updated block state.
 */
export function processSessionResult(
  currentState: BlockState,
  result: SessionResult,
  recentWordMistakes7d: Map<string, number> = new Map(),
  recentWordMistakes14d: Map<string, number> = new Map(),
): SchedulingResult {
  const ratingConfig = RATING_CONFIG[result.rating];
  const mistakeCounts = countMistakesByType(result.mistakes);
  const blockMistakeScore = calculateMistakeScore(result.mistakes, recentWordMistakes7d, recentWordMistakes14d);
  const normalizedMistakeScore = blockMistakeScore / Math.max(1, result.totalWordsInBlock);
  const repeatedProblemWordsCount = countRepeatedProblemWords(recentWordMistakes7d);

  const overridesApplied: string[] = [];

  // ── Determine effective rating (with override B) ──
  let effectiveRating = result.rating;
  if (normalizedMistakeScore > 0.20) {
    if (effectiveRating === 'perfect') { effectiveRating = 'good'; overridesApplied.push('B'); }
    else if (effectiveRating === 'good') { effectiveRating = 'shaky'; overridesApplied.push('B'); }
  }
  const effectiveConfig = RATING_CONFIG[effectiveRating];

  // ── Update streak ──
  let newStreak = currentState.currentStreak;
  if (effectiveConfig.streakChange === 'increment') {
    newStreak++;
  } else {
    newStreak = 0;
  }

  // ── Update strength ──
  let newStrength = currentState.strengthScore
    + ratingConfig.strengthBonus
    - (blockMistakeScore * 2)
    - (repeatedProblemWordsCount * 3)
    + Math.min(currentState.currentStreak, 5);
  newStrength = clamp(newStrength, 0, 100);

  // ── Update ease factor ──
  let newEase = currentState.easeFactor + effectiveConfig.easeChange;
  newEase = clamp(newEase, 0.7, 2.5);

  // ── Calculate interval using block-level schedule ──
  // Base schedule depends on effective rating tier
  const scheduleForRating = (r: SessionRating): number[] => {
    if (r === 'weak') return [1, 2, 3];
    if (r === 'shaky') return [1, 3, 5];
    return [1, 3, 7]; // perfect or good
  };

  const schedule = scheduleForRating(effectiveRating);
  let newInterval: number;

  // For the first 3 reviews, follow the fixed schedule
  if (currentState.totalReviews < 3) {
    newInterval = schedule[currentState.totalReviews] ?? schedule[schedule.length - 1];
  } else {
    // After 3 reviews, grow from the last schedule value using ease factor
    const baseInterval = schedule[schedule.length - 1];
    const growthFactor = Math.max(1, currentState.totalReviews - 2);
    newInterval = Math.round(baseInterval * growthFactor * newEase);
    newInterval = clamp(newInterval, 1, 30);
  }

  // Weak rating always forces same-day or next-day
  if (effectiveRating === 'weak') {
    newInterval = Math.min(newInterval, 1);
  }

  // ── Update counters ──
  const newTotalReviews = currentState.totalReviews + 1;
  const isSuccessful = effectiveRating === 'perfect' || effectiveRating === 'good';
  const newSuccessful = currentState.successfulReviews + (isSuccessful ? 1 : 0);
  const newPerfect = currentState.perfectReviews + (effectiveRating === 'perfect' ? 1 : 0);
  const newTotalMistakes = currentState.totalMistakes + result.mistakes.length;

  // ── Recent ratings (keep last 5) ──
  const recentRatings = [...currentState.recentRatings, result.rating].slice(-5);

  // ── Focus review ──
  let needsFocusReview = currentState.needsFocusReview;
  let enteredFocusReview = false;

  // Override A: 2+ forgot mistakes
  if (mistakeCounts.forgot >= 2) {
    newInterval = Math.min(newInterval, 1);
    needsFocusReview = true;
    enteredFocusReview = true;
    overridesApplied.push('A');
  }

  // Override C: same word 3+ times in 7 days
  for (const [, count] of recentWordMistakes7d) {
    if (count >= 3) {
      needsFocusReview = true;
      enteredFocusReview = true;
      newInterval = Math.min(newInterval, 1);
      if (!overridesApplied.includes('C')) overridesApplied.push('C');
      break;
    }
  }

  // Override D: 2 Weak in last 5 OR 3 Shaky/Weak in last 5
  const weakCount = recentRatings.filter(r => r === 'weak').length;
  const shakyWeakCount = recentRatings.filter(r => r === 'shaky' || r === 'weak').length;
  if (weakCount >= 2 || shakyWeakCount >= 3) {
    newInterval = Math.min(newInterval, 1);
    overridesApplied.push('D');
  }

  // Override E: 3 consecutive Perfect/Good with 0 mistakes
  if (recentRatings.length >= 3) {
    const last3 = recentRatings.slice(-3);
    if (last3.every(r => r === 'perfect' || r === 'good') && blockMistakeScore === 0) {
      if (repeatedProblemWordsCount === 0) {
        needsFocusReview = false;
        overridesApplied.push('E');
      }
    }
  }

  // Focus review triggers
  if (result.rating === 'weak') { needsFocusReview = true; enteredFocusReview = true; }
  if (mistakeCounts.forgot > 0) { needsFocusReview = true; enteredFocusReview = true; }
  if (repeatedProblemWordsCount >= 2) { needsFocusReview = true; enteredFocusReview = true; }

  // Check 2 consecutive shaky
  if (recentRatings.length >= 2) {
    const last2 = recentRatings.slice(-2);
    if (last2.every(r => r === 'shaky')) {
      needsFocusReview = true;
      enteredFocusReview = true;
    }
  }

  // ── Mastery status ──
  let mastery = getMasteryFromStrength(newStrength);

  // Cap mastery if recent performance is poor
  const last3Ratings = recentRatings.slice(-3);
  const poorLast3 = last3Ratings.filter(r => r === 'shaky' || r === 'weak').length;
  if (poorLast3 >= 2) {
    mastery = capMastery(mastery, 'learning');
  }
  if (repeatedProblemWordsCount >= 3) {
    mastery = capMastery(mastery, 'improving');
  }

  // Override D mastery
  if (weakCount >= 2 || shakyWeakCount >= 3) {
    mastery = capMastery(mastery, 'learning');
  }

  // ── Priority level ──
  let priority: PriorityLevel = 'normal';
  if (effectiveRating === 'weak' || newInterval === 0) {
    priority = 'urgent';
  } else if (needsFocusReview || repeatedProblemWordsCount > 0 || (weakCount >= 2 || shakyWeakCount >= 3)) {
    priority = 'high';
  } else if (newStrength >= 90 && newStreak >= 3) {
    priority = 'low';
  }

  // ── Next review date ──
  const now = new Date();
  const nextReviewAt = new Date(now);
  if (newInterval === 0) {
    // Same day — add 4 hours
    nextReviewAt.setHours(nextReviewAt.getHours() + 4);
  } else {
    nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);
    nextReviewAt.setHours(5, 0, 0, 0); // 5 AM next day
  }

  return {
    newState: {
      strengthScore: newStrength,
      easeFactor: Math.round(newEase * 100) / 100,
      intervalDays: newInterval,
      currentStreak: newStreak,
      totalReviews: newTotalReviews,
      successfulReviews: newSuccessful,
      perfectReviews: newPerfect,
      totalMistakes: newTotalMistakes,
      recentMistakes7d: currentState.recentMistakes7d, // updated separately
      repeatedProblemWordsCount,
      needsFocusReview,
      masteryStatus: mastery,
      priorityLevel: priority,
      overdueCount: currentState.overdueCount,
      lastSessionRating: result.rating,
      recentRatings,
    },
    nextReviewAt,
    blockMistakeScore,
    normalizedMistakeScore: Math.round(normalizedMistakeScore * 1000) / 1000,
    enteredFocusReview,
    overridesApplied,
    mistakeCountsByType: mistakeCounts,
  };
}

// ── Mastery helpers ──────────────────────────────────────────

function getMasteryFromStrength(strength: number): MasteryStatus {
  for (const t of MASTERY_THRESHOLDS) {
    if (strength >= t.min && strength <= t.max) return t.status;
  }
  return 'new';
}

const MASTERY_ORDER: MasteryStatus[] = ['new', 'learning', 'improving', 'stable', 'strong'];

function capMastery(current: MasteryStatus, cap: MasteryStatus): MasteryStatus {
  const currentIdx = MASTERY_ORDER.indexOf(current);
  const capIdx = MASTERY_ORDER.indexOf(cap);
  return currentIdx > capIdx ? cap : current;
}

// ── Default state for new blocks ─────────────────────────────

export function createDefaultBlockState(): BlockState {
  return {
    strengthScore: 40,
    easeFactor: 1.0,
    intervalDays: 1,
    currentStreak: 0,
    totalReviews: 0,
    successfulReviews: 0,
    perfectReviews: 0,
    totalMistakes: 0,
    recentMistakes7d: 0,
    repeatedProblemWordsCount: 0,
    needsFocusReview: false,
    masteryStatus: 'new',
    priorityLevel: 'normal',
    overdueCount: 0,
    lastSessionRating: null,
    recentRatings: [],
  };
}

// ── UI helpers ───────────────────────────────────────────────

export function getMasteryLabel(status: MasteryStatus): string {
  const labels: Record<MasteryStatus, string> = {
    new: 'New',
    learning: 'Learning',
    improving: 'Improving',
    stable: 'Stable',
    strong: 'Strong',
  };
  return labels[status];
}

export function getMasteryColor(status: MasteryStatus): string {
  const colors: Record<MasteryStatus, string> = {
    new: 'bg-muted text-muted-foreground',
    learning: 'bg-accent/20 text-accent-foreground',
    improving: 'bg-surah-progress text-foreground',
    stable: 'bg-surah-completed/30 text-foreground',
    strong: 'bg-surah-completed text-foreground',
  };
  return colors[status];
}

export function getPriorityLabel(priority: PriorityLevel): string {
  const labels: Record<PriorityLevel, string> = {
    urgent: 'Urgent',
    high: 'High Priority',
    normal: 'Normal',
    low: 'Low Priority',
  };
  return labels[priority];
}

export function getMistakeTypeLabel(type: MistakeType): string {
  const labels: Record<MistakeType, string> = {
    incorrect: 'Incorrect',
    missed: 'Missed',
    tajweed: 'Tajweed',
    forgot: 'Harakah',
  };
  return labels[type];
}

export function getRatingLabel(rating: SessionRating): string {
  const labels: Record<SessionRating, string> = {
    perfect: 'Perfect',
    good: 'Good',
    shaky: 'Shaky',
    weak: 'Weak',
  };
  return labels[rating];
}

export function formatNextReview(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / 3600000);
  if (diffHours < 1) return 'Now';
  if (diffHours < 24) return `In ${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return 'Tomorrow';
  return `In ${diffDays} days`;
}
