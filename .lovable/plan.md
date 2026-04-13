

## Plan: Unify Arabic Font to DigitalKhattV2

### Problem
The app uses three different font configurations for Quranic text:
1. **Mushaf Viewer / Surah Viewer**: Page-specific glyph fonts (`p1.ttf`, etc.) — correct for layout rendering
2. **Memorization & Consolidation screens**: `font-arabic` class → `DigitalKhatt` (no matching `@font-face`; falls back to `Noto Sans Arabic`)
3. **Block Review Marking**: Inline style with `KFGQPC Uthmanic Script HAFS` (system font, likely not installed)

### Solution
Update the `font-arabic` Tailwind utility and all inline font references to consistently use `DigitalKhattV2`, which already has a working `@font-face` declaration and font file.

### Changes

**1. `tailwind.config.ts`** — Fix the font-arabic family
- Change `'DigitalKhatt'` to `'DigitalKhattV2'` in the `fontFamily.arabic` array

**2. `src/components/review/BlockReviewMarking.tsx`** — Remove custom inline font
- Remove the inline `fontFamily` style (`KFGQPC Uthmanic Script HAFS`) from word buttons
- Add the `font-arabic` class instead so it uses DigitalKhattV2

**3. No changes needed to**:
- `GuidedMemorization.tsx` — already uses `font-arabic` class
- `ConsolidationCheckpoint.tsx` — already uses `font-arabic` class  
- `QuranVerseDisplay.tsx` — already uses `font-arabic` class
- `SurahHeader.tsx` — already uses `font-arabic` class
- Mushaf/Surah viewers — these correctly use page-specific glyph fonts for layout

### Technical Detail
`DigitalKhattV2.otf` is already loaded via `@font-face` in `index.css`. The Tailwind `font-arabic` utility class just needs to reference the correct family name. This single config fix propagates to all components using the class.

