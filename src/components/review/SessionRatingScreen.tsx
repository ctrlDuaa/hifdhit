/**
 * End-of-session rating screen.
 * Shows mistake summary + rating buttons.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QuranVerse } from '@/services/quranApi';
import { SessionRating, MistakeType, WordMistake } from '@/lib/reviewScheduler';

interface Props {
  surahName: string;
  mistakes: Map<string, WordMistake>;
  verses: QuranVerse[];
  onRate: (rating: SessionRating) => void;
  onBack: () => void;
  submitting: boolean;
}

const RATINGS: { rating: SessionRating; label: string; desc: string; colorClass: string }[] = [
  { rating: 'perfect', label: 'Perfect', desc: 'Smooth, no meaningful struggle', colorClass: 'border-surah-completed bg-surah-completed/10 hover:bg-surah-completed/20' },
  { rating: 'good', label: 'Good', desc: 'Mostly correct, minor hesitation', colorClass: 'border-surah-progress bg-surah-progress/10 hover:bg-surah-progress/20' },
  { rating: 'shaky', label: 'Shaky', desc: 'Several mistakes, weak confidence', colorClass: 'border-accent bg-accent/10 hover:bg-accent/20' },
  { rating: 'weak', label: 'Weak', desc: 'Significant struggle, major forgetting', colorClass: 'border-destructive bg-destructive/10 hover:bg-destructive/20' },
];

export const SessionRatingScreen = ({ surahName, mistakes, verses, onRate, onBack, submitting }: Props) => {
  const mistakeList = Array.from(mistakes.values());
  const countByType = (type: MistakeType) => mistakeList.filter(m => m.mistakeType === type).length;

  // Find hardest ayah
  const ayahMistakeCounts = new Map<number, number>();
  for (const m of mistakeList) {
    ayahMistakeCounts.set(m.ayahNumber, (ayahMistakeCounts.get(m.ayahNumber) || 0) + 1);
  }
  let hardestAyah: number | null = null;
  let maxMistakes = 0;
  for (const [ayah, count] of ayahMistakeCounts) {
    if (count > maxMistakes) { hardestAyah = ayah; maxMistakes = count; }
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">Rate Your Session</h1>
          <p className="text-sm text-muted-foreground mt-1">{surahName}</p>
        </div>

        {/* Mistake summary */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-foreground mb-3">Session Summary</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { type: 'incorrect' as MistakeType, label: 'Incorrect', color: 'bg-mistake-incorrect/20' },
                { type: 'missed' as MistakeType, label: 'Missed', color: 'bg-mistake-missed/20' },
                { type: 'tajweed' as MistakeType, label: 'Tajweed', color: 'bg-mistake-tajweed/20' },
                { type: 'forgot' as MistakeType, label: 'Forgot', color: 'bg-destructive/20' },
              ].map(item => (
                <div key={item.type} className={`rounded-lg p-2 ${item.color}`}>
                  <p className="text-lg font-bold text-foreground">{countByType(item.type)}</p>
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
            {hardestAyah && (
              <p className="text-xs text-muted-foreground mt-3">
                Hardest ayah: <span className="font-medium text-foreground">Ayah {hardestAyah}</span> ({maxMistakes} mistakes)
              </p>
            )}
            {mistakeList.length === 0 && (
              <p className="text-xs text-surah-completed mt-2 text-center">No mistakes marked</p>
            )}
          </CardContent>
        </Card>

        {/* Rating buttons */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground text-center">How did the overall session feel?</p>
          {RATINGS.map(r => (
            <button
              key={r.rating}
              onClick={() => onRate(r.rating)}
              disabled={submitting}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${r.colorClass} disabled:opacity-50`}
            >
              <p className="font-semibold text-foreground">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </button>
          ))}
        </div>

        <Button variant="ghost" onClick={onBack} className="w-full text-muted-foreground" disabled={submitting}>
          Go back to marking
        </Button>
      </div>
    </div>
  );
};
