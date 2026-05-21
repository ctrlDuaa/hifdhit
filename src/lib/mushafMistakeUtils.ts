import { supabase } from '@/integrations/supabase/client';

/**
 * ID-BASED MISTAKE TRACKING
 * ─────────────────────────
 * The single source of truth for which word a mistake is attached to is the
 * Quran.com global `word.id` (a stable integer, 1..77439). It is identical in
 * the QF API responses and in our local `words` table (`words.id`).
 *
 * - Writes: always set `word_id: word.id` on the `mistakes` row. The legacy
 *   `word_index` column is still written for backward compatibility but is
 *   never used for lookup.
 * - Reads: fetch mistakes for the current page by `word_id IN (...)` and key
 *   the resulting map by `word_id`. UI lookups are `mistakeMap.get(word.id)` —
 *   strict O(1), no fallback / candidate / +1 / -1 math anywhere.
 *
 * Legacy mistake rows (pre-migration) that do not have a `word_id` will NOT
 * render. That is intentional — old rows were created with off-by-one bugs
 * and cannot be reliably reconstructed.
 */

export interface MistakeRow {
  id: string;
  word_id: number | null;
  surah_number: number;
  ayah_number: number;
  word_index: number;
  page_number: number | null;
  mistake_category: string | null;
  note: string | null;
  session_id: string | null;
  reciter_id: string;
  created_at: string;
}

/**
 * Fetch every mistake for a reciter that belongs to one of the given word IDs.
 * Returns a Map keyed by `word_id`.
 */
export const fetchMistakesByWordIds = async (
  reciterId: string,
  wordIds: number[]
): Promise<Map<number, MistakeRow>> => {
  const map = new Map<number, MistakeRow>();
  if (!reciterId || wordIds.length === 0) return map;

  // Chunk in case the page has many words (max URL length on `.in()`)
  const chunkSize = 500;
  for (let i = 0; i < wordIds.length; i += chunkSize) {
    const chunk = wordIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('mistakes')
      .select('*')
      .eq('reciter_id', reciterId)
      .in('word_id', chunk);

    if (error) throw error;
    (data ?? []).forEach((row: any) => {
      if (typeof row.word_id === 'number') {
        map.set(row.word_id, row as MistakeRow);
      }
    });
  }

  return map;
};

/**
 * Fetch the single mistake row for `(reciterId, wordId)` if it exists.
 */
export const fetchMistakeByWordId = async (
  reciterId: string,
  wordId: number
): Promise<MistakeRow | null> => {
  const { data, error } = await supabase
    .from('mistakes')
    .select('*')
    .eq('reciter_id', reciterId)
    .eq('word_id', wordId)
    .maybeSingle();
  if (error) throw error;
  return (data as MistakeRow | null) ?? null;
};

// ---------------------------------------------------------------------------
// Realtime helpers (kept ID-keyed)
// ---------------------------------------------------------------------------

type MistakeMapValueLike = {
  category?: string;
  mistakeId?: string;
  note?: string;
  sessionId?: string;
};

export const computeMistakeMapSignature = (
  map: Map<number, MistakeMapValueLike> | null | undefined
): string => {
  if (!map || map.size === 0) return '';
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(
      ([k, v]) =>
        `${k}:${v.category ?? ''}:${v.mistakeId ?? ''}:${v.note ?? ''}:${v.sessionId ?? ''}`
    )
    .join('|');
};

export type MistakeMapDiff = {
  added: number[];
  removed: number[];
  changed: number[];
};

export const diffMistakeMaps = (
  prev: Map<number, MistakeMapValueLike> | null | undefined,
  next: Map<number, MistakeMapValueLike> | null | undefined
): MistakeMapDiff => {
  const added: number[] = [];
  const removed: number[] = [];
  const changed: number[] = [];
  const prevMap = prev ?? new Map();
  const nextMap = next ?? new Map();

  nextMap.forEach((value, key) => {
    const prior = prevMap.get(key);
    if (!prior) added.push(key);
    else if (
      prior.category !== value.category ||
      prior.mistakeId !== value.mistakeId ||
      (prior.note ?? '') !== (value.note ?? '') ||
      (prior.sessionId ?? '') !== (value.sessionId ?? '')
    ) {
      changed.push(key);
    }
  });
  prevMap.forEach((_v, key) => {
    if (!nextMap.has(key)) removed.push(key);
  });
  return { added, removed, changed };
};

export const mistakeDiffHasChanges = (diff: MistakeMapDiff): boolean =>
  diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;
