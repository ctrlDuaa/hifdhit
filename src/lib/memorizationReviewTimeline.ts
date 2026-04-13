export interface ReviewTimelineBlock {
  id: string;
  created_at: string;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  interval_days?: number;
  needs_focus_review?: boolean;
  strength_score?: number;
  total_mistakes?: number;
  total_reviews: number;
  last_session_rating: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function getScheduleDays(block: ReviewTimelineBlock): number[] {
  const rating = block.last_session_rating;
  const isLegacyMemorizationSeed =
    block.total_reviews === 1 &&
    block.strength_score === 50 &&
    (block.total_mistakes ?? 0) === 0;

  if (block.interval_days === 2) return [1, 2, 3];
  if (block.interval_days === 5) return [1, 3, 5];
  if (block.interval_days === 7) return [1, 3, 7];
  if (block.interval_days === 3 && block.total_reviews >= 3) return [1, 2, 3];

  if (isLegacyMemorizationSeed && rating === 'good') return [1, 3, 5];
  if (isLegacyMemorizationSeed && (rating === 'shaky' || block.needs_focus_review)) return [1, 2, 3];

  if (rating === 'weak' || rating === 'hard') return [1, 2, 3];
  if (rating === 'shaky') return [1, 3, 5];
  return [1, 3, 7];
}

function startOfLocalDay(date: Date): number {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized.getTime();
}

function addDays(anchor: Date, days: number): Date {
  return new Date(anchor.getTime() + days * DAY_MS);
}

export function getBlockProjectedReviewDates(block: ReviewTimelineBlock): Date[] {
  const seen = new Set<number>();
  const dates: Date[] = [];

  const pushDate = (value: string | Date | null | undefined) => {
    if (!value) return;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return;
    const key = startOfLocalDay(date);
    if (seen.has(key)) return;
    seen.add(key);
    dates.push(date);
  };

  pushDate(block.next_review_at);

  if (block.total_reviews >= 1 && block.total_reviews <= 3) {
    const anchor = new Date(block.last_reviewed_at || block.created_at);
    if (!Number.isNaN(anchor.getTime())) {
      const scheduleDays = getScheduleDays(block);
      const startIndex = Math.min(Math.max(block.total_reviews - 1, 0), scheduleDays.length - 1);

      for (let i = startIndex; i < scheduleDays.length; i += 1) {
        pushDate(addDays(anchor, scheduleDays[i]));
      }
    }
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

export function getCurrentProjectedReviewDate(block: ReviewTimelineBlock, reference = new Date()): Date | null {
  const projectedDates = getBlockProjectedReviewDates(block);
  if (projectedDates.length === 0) return null;

  const referenceDay = startOfLocalDay(reference);
  return projectedDates.find(date => startOfLocalDay(date) >= referenceDay) ?? projectedDates[0];
}

export function getBlockProjectedDateKeys(block: ReviewTimelineBlock): string[] {
  return getBlockProjectedReviewDates(block).map(date => {
    const local = new Date(date);
    const year = local.getFullYear();
    const month = String(local.getMonth() + 1).padStart(2, '0');
    const day = String(local.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
}

export function isBlockDueOnDate(block: ReviewTimelineBlock, target: Date): boolean {
  const targetKey = startOfLocalDay(target);
  return getBlockProjectedReviewDates(block).some(date => startOfLocalDay(date) === targetKey);
}
