/**
 * Word-level mistake marking during block review.
 * Users tap words to mark mistakes; highlighted words show mistake type.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QuranVerse } from '@/services/quranApi';
import { MistakeType, getMistakeTypeLabel } from '@/lib/reviewScheduler';
import { X } from 'lucide-react';

interface Props {
  verses: QuranVerse[];
  getMistakeForWord: (ayahNumber: number, wordIndex: number) => MistakeType | null;
  onToggleMistake: (ayahNumber: number, wordIndex: number, wordText: string, type: MistakeType) => void;
  onRemoveMistake: (ayahNumber: number, wordIndex: number) => void;
  onFinishMarking: () => void;
  surahName: string;
}

const MISTAKE_TYPES: { type: MistakeType; label: string; colorClass: string; borderClass: string }[] = [
  { type: 'incorrect', label: 'Incorrect', colorClass: 'bg-mistake-incorrect/30', borderClass: 'border-mistake-incorrect-border' },
  { type: 'missed', label: 'Missed', colorClass: 'bg-mistake-missed/30', borderClass: 'border-mistake-missed-border' },
  { type: 'tajweed', label: 'Tajweed', colorClass: 'bg-mistake-tajweed/30', borderClass: 'border-mistake-tajweed-border' },
  { type: 'forgot', label: 'Forgot', colorClass: 'bg-destructive/20', borderClass: 'border-destructive' },
];

function getMistakeStyle(type: MistakeType): string {
  switch (type) {
    case 'incorrect': return 'bg-mistake-incorrect/30 border-2 border-mistake-incorrect-border';
    case 'missed': return 'bg-mistake-missed/30 border-2 border-mistake-missed-border';
    case 'tajweed': return 'bg-mistake-tajweed/30 border-2 border-mistake-tajweed-border';
    case 'forgot': return 'bg-destructive/20 border-2 border-destructive';
  }
}

export const BlockReviewMarking = ({
  verses,
  getMistakeForWord,
  onToggleMistake,
  onRemoveMistake,
  onFinishMarking,
  surahName,
}: Props) => {
  const [selectedWord, setSelectedWord] = useState<{
    ayahNumber: number;
    wordIndex: number;
    wordText: string;
  } | null>(null);

  const handleWordTap = (ayahNumber: number, wordIndex: number, wordText: string) => {
    const existing = getMistakeForWord(ayahNumber, wordIndex);
    if (existing) {
      // Show menu to change or remove
      setSelectedWord({ ayahNumber, wordIndex, wordText });
    } else {
      setSelectedWord({ ayahNumber, wordIndex, wordText });
    }
  };

  const handleSelectMistakeType = (type: MistakeType) => {
    if (!selectedWord) return;
    onToggleMistake(selectedWord.ayahNumber, selectedWord.wordIndex, selectedWord.wordText, type);
    setSelectedWord(null);
  };

  const handleRemove = () => {
    if (!selectedWord) return;
    onRemoveMistake(selectedWord.ayahNumber, selectedWord.wordIndex);
    setSelectedWord(null);
  };

  const totalMistakes = verses.reduce((sum, v) => {
    const words = v.words?.filter(w => w.char_type_name !== 'end') || [];
    return sum + words.filter((_, i) => getMistakeForWord(v.verse_number, i) !== null).length;
  }, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">{surahName}</h1>
            <p className="text-xs text-muted-foreground">Tap any word to mark a mistake</p>
          </div>
          <div className="flex items-center gap-3">
            {totalMistakes > 0 && (
              <Badge variant="destructive" className="text-xs">
                {totalMistakes} marked
              </Badge>
            )}
            <Button onClick={onFinishMarking} size="sm">
              Done
            </Button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="max-w-2xl mx-auto px-4 py-2">
        <div className="flex gap-3 text-xs flex-wrap">
          {MISTAKE_TYPES.map(mt => (
            <div key={mt.type} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${mt.colorClass} border ${mt.borderClass}`} />
              <span className="text-muted-foreground">{mt.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Verses */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {verses.map(verse => {
          const words = verse.words?.filter(w => w.char_type_name !== 'end') || [];
          const verseNum = verse.verse_number;

          return (
            <Card key={verse.verse_key} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="text-xs">{verse.verse_key}</Badge>
                </div>
                <div className="flex flex-wrap gap-2 justify-end" dir="rtl">
                  {words.map((word, idx) => {
                    const mistake = getMistakeForWord(verseNum, idx);
                    return (
                      <button
                        key={idx}
                        onClick={() => handleWordTap(verseNum, idx, word.text_uthmani)}
                        className={`px-2 py-1 rounded-md text-xl leading-loose transition-all cursor-pointer font-arabic
                          ${mistake
                            ? getMistakeStyle(mistake)
                            : 'hover:bg-muted/50'
                          }`}
                      >
                        {word.text_uthmani}
                      </button>
                    );
                  })}
                </div>
                {verse.translations?.[0]?.text && (
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: verse.translations[0].text }}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Mistake type selector popup */}
      {selectedWord && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setSelectedWord(null)} />
          <div className="relative bg-card border border-border rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-sm shadow-lg mx-4 mb-0 sm:mb-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground text-sm">Mark Mistake</h3>
              <button onClick={() => setSelectedWord(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xl text-center mb-4 text-foreground font-arabic" dir="rtl">
              {selectedWord.wordText}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {MISTAKE_TYPES.map(mt => {
                const isActive = getMistakeForWord(selectedWord.ayahNumber, selectedWord.wordIndex) === mt.type;
                return (
                  <button
                    key={mt.type}
                    onClick={() => handleSelectMistakeType(mt.type)}
                    className={`px-3 py-3 rounded-lg border-2 text-sm font-medium transition-all
                      ${isActive
                        ? `${mt.colorClass} ${mt.borderClass}`
                        : 'border-border hover:border-muted-foreground/30'
                      }`}
                  >
                    {mt.label}
                  </button>
                );
              })}
            </div>
            {getMistakeForWord(selectedWord.ayahNumber, selectedWord.wordIndex) && (
              <Button variant="ghost" size="sm" className="w-full mt-3 text-muted-foreground" onClick={handleRemove}>
                Remove Mistake
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
