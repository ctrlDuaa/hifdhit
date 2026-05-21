
# Plan: ID-based Mistake Tracking Refactor

## Goal
Replace all index/position-based mistake mapping with Quran.com `word.id` (a stable global integer, e.g. `1`–`77439`). This eliminates the off-by-one errors that keep recurring in memorization sessions and on the Mushaf overview.

## 1. Database (Supabase migration)
Add a new canonical column to `mistakes`:
- `word_id BIGINT` — Quran.com global word ID (nullable for backfill safety)
- Index on `(reciter_id, word_id)` for O(1) lookup
- Keep existing `surah_number`, `ayah_number`, `word_index`, `page_number` columns as legacy/redundant fields (still written for now to avoid breaking older clients, but no read path will rely on them)

No data backfill is attempted for old rows — we cannot reliably reconstruct `word_id` from the existing `word_index` given the bugs that motivated this refactor. Legacy mistakes without `word_id` will simply not render on the Mushaf after this change. (If preserving them matters, say so and I'll add a best-effort backfill.)

## 2. API layer
`src/services/quranApi.ts` already requests `word_fields=position`. Extend `word_fields` to include `id` (Quran.com calls this the global word id). Verify the QCF page endpoint also returns `id` per word (it does in the v4 API).

## 3. Write path (marking a mistake)
Components that create mistakes:
- `src/components/memorization/GuidedMemorization.tsx`
- `src/components/memorization/MushafContextLines.tsx` (click handler)
- `src/components/review/BlockReviewMarking.tsx` and `MushafReviewPage.tsx`
- `src/components/SessionMushafViewer.tsx`
- `src/hooks/useSessionSystem.tsx`

All click handlers will be updated to receive and pass through `word.id` (number) instead of (or in addition to) `wordIndex` / `position`. The Supabase insert always sets `word_id: word.id`. No `+1` / `-1` math anywhere.

## 4. Read path (rendering highlights)
- Fetch mistakes for the current scope (page / session / block) and build `const mistakeMap = new Map<number, MistakeRow>()` keyed by `word_id`.
- During render, every word span checks `mistakeMap.get(word.id)`. No more `${surah}-${ayah}-${index}` composite keys.
- React `key={word.id}` on every word span (replacing array index keys).
- Delete the entire fallback/candidate logic in `src/lib/mushafMistakeUtils.ts` (`getNormalizedMistakeWordKey`, `getPageWordIndexCandidates`, `buildPageWordKeySet`) and replace with a tiny ID-keyed helper.

## 5. Files touched
- `src/services/quranApi.ts` — add `id` to word_fields
- `src/lib/mushafMistakeUtils.ts` — rewrite around `word_id`
- `src/components/memorization/GuidedMemorization.tsx`
- `src/components/memorization/MushafContextLines.tsx`
- `src/components/memorization/CheckpointMushafView.tsx`
- `src/components/review/BlockReviewMarking.tsx`
- `src/components/review/MushafReviewPage.tsx`
- `src/components/SessionMushafViewer.tsx`
- `src/hooks/useSessionSystem.tsx`
- `src/hooks/useBlockReview.ts`
- `src/pages/MushafViewer.tsx`
- `src/pages/SurahViewer.tsx`
- `src/pages/BlockReview.tsx`
- Analytics-only readers (`WeeklyMistakesCard`, `Dashboard`, `Stats`, `reviewInsights`) keep using counts/categories — no change needed beyond making sure they don't break on the new column.

## 6. Migration SQL
```sql
ALTER TABLE public.mistakes ADD COLUMN word_id BIGINT;
CREATE INDEX IF NOT EXISTS mistakes_reciter_word_id_idx
  ON public.mistakes (reciter_id, word_id);
```

## 7. Out of scope
- Backfilling existing mistake rows
- Changing the `block_review_mistakes` / `block_word_stats` tables (those use a different per-block `word_index` that is internally consistent within the review flow and is not rendered on the Mushaf)

## Confirmation needed
1. OK to drop visibility of pre-existing mistake rows (those without `word_id`) on the Mushaf? Or do you want a best-effort backfill?
2. OK to keep the legacy `word_index` column written but unused (safer), vs. dropping it entirely?
