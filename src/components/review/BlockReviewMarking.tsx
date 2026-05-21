/**
 * Word-level mistake marking during block review.
 * Mushaf-like layout: RTL, tight spacing, blurred words with hover reveal,
 * verse numbers from API, single card with dividers, memorization-style mistake popup.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose,
} from '@/components/ui/sheet';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from '@/components/ui/drawer';
import { QuranVerse } from '@/services/quranApi';
import { MistakeType, getMistakeTypeLabel } from '@/lib/reviewScheduler';
import { X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { MushafReviewPage } from './MushafReviewPage';
import { RecitationRecorder } from '@/components/memorization/RecitationRecorder';

interface Props {
  verses: QuranVerse[];
  getMistakeForWord: (ayahNumber: number, wordIndex: number) => MistakeType | null;
  getNoteForWord?: (ayahNumber: number, wordIndex: number) => string;
  onToggleMistake: (ayahNumber: number, wordIndex: number, wordText: string, type: MistakeType) => void;
  onRemoveMistake: (ayahNumber: number, wordIndex: number) => void;
  onSaveNote?: (ayahNumber: number, wordIndex: number, note: string) => void;
  onFinishMarking: () => void;
  surahName: string;
  surahId: number;
  startAyah: number;
  endAyah: number;
}

type MistakeCategory = MistakeType;

const MISTAKE_CATEGORIES: { type: MistakeCategory; label: string; color: string; border: string }[] = [
  { type: 'incorrect', label: 'Incorrect', color: 'hsl(var(--mistake-incorrect))', border: 'hsl(var(--mistake-incorrect-border))' },
  { type: 'missed',    label: 'Missed',    color: 'hsl(var(--mistake-missed))',    border: 'hsl(var(--mistake-missed-border))' },
  { type: 'tajweed',   label: 'Tajweed',   color: 'hsl(var(--mistake-tajweed))',   border: 'hsl(var(--mistake-tajweed-border))' },
  { type: 'forgot',    label: 'Harakah',   color: 'hsl(var(--mistake-harakah))',   border: 'hsl(var(--mistake-harakah-border))' },
];

function getCategoryColor(type: MistakeCategory): string {
  return MISTAKE_CATEGORIES.find(c => c.type === type)?.color || 'hsl(var(--mistake-incorrect))';
}

export const BlockReviewMarking = ({
  verses,
  getMistakeForWord,
  onToggleMistake,
  onRemoveMistake,
  onFinishMarking,
  surahName,
  surahId,
  startAyah,
  endAyah,
}: Props) => {
  const isMobile = useIsMobile();
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Selected word state (for mistake popup)
  const [selectedWord, setSelectedWord] = useState<{
    ayahNumber: number;
    wordIndex: number;
    wordText: string;
  } | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);

  // Note drawer
  const [noteDrawerOpen, setNoteDrawerOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState('');

  // Close popover on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setPopoverOpen(false);
      }
    };
    if (popoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, [popoverOpen]);

  const handleWordClick = (ayahNumber: number, wordIndex: number, wordText: string, event: React.MouseEvent) => {
    // Always open the popup — tapping a marked word reveals the mistake options
    // (including a Remove button) instead of auto-clearing it.
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setPopoverPosition({ x: rect.left + rect.width / 2, y: rect.top });
    setSelectedWord({ ayahNumber, wordIndex, wordText });
    setPopoverOpen(true);
  };

  const handleSelectCategory = (type: MistakeCategory) => {
    if (!selectedWord) return;
    onToggleMistake(selectedWord.ayahNumber, selectedWord.wordIndex, selectedWord.wordText, type);
    setPopoverOpen(false);
    setSelectedWord(null);
  };

  const handleRemove = () => {
    if (!selectedWord) return;
    onRemoveMistake(selectedWord.ayahNumber, selectedWord.wordIndex);
    setPopoverOpen(false);
    setSelectedWord(null);
  };

  const totalMistakes = verses.reduce((sum, v) => {
    const words = v.words?.filter(w => w.char_type_name !== 'end') || [];
    return sum + words.filter((_, i) => getMistakeForWord(v.verse_number, i) !== null).length;
  }, 0);

  // Note content (placeholder — notes not stored in block review mistakes currently)
  // Defined as inline JSX (not a nested component) so the Textarea isn't remounted on every keystroke.
  const noteContent = (
    <div className="space-y-3">
      <p className="text-center text-xl font-arabic" dir="rtl">{selectedWord?.wordText}</p>
      <Textarea
        value={currentNote}
        onChange={e => setCurrentNote(e.target.value)}
        placeholder="Add a note about this mistake..."
        className="min-h-[80px]"
      />
    </div>
  );

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
          {MISTAKE_CATEGORIES.map(mt => (
            <div key={mt.type} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: mt.color }} />
              <span className="text-muted-foreground">{mt.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Self-check audio recorder — record your own recitation and play back. Not saved. */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <RecitationRecorder
          resetKey={`review-${surahId}-${startAyah}-${endAyah}`}
          variant="card"
        />
      </div>

      {/* Full Mushaf page with QCF rendering — review range is blurred until tapped */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <MushafReviewPage
              surahId={surahId}
              startAyah={startAyah}
              endAyah={endAyah}
              getMistakeForWord={getMistakeForWord}
              onWordClick={(ayah, idx, text, e) => handleWordClick(ayah, idx, text, e)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Mistake popup — positioned near the word (matches memorization style) */}
      {popoverOpen && selectedWord && popoverPosition && (
        <div
          ref={popoverRef}
          className="fixed z-50 bg-card border border-border rounded-xl shadow-lg p-3 w-48"
          style={{
            left: `${Math.min(popoverPosition.x - 96, window.innerWidth - 200)}px`,
            top: `${popoverPosition.y - 10}px`,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="grid grid-cols-2 gap-1.5">
            {MISTAKE_CATEGORIES.map(cat => {
              const isActive = getMistakeForWord(selectedWord.ayahNumber, selectedWord.wordIndex) === cat.type;
              return (
                <button
                  key={cat.type}
                  onClick={() => handleSelectCategory(cat.type)}
                  className={`px-2 py-2 rounded-md text-xs font-medium transition-all border
                    ${isActive ? 'border-foreground/50 ring-1 ring-foreground/20' : 'border-transparent hover:border-muted-foreground/30'}`}
                  style={{ backgroundColor: cat.color, opacity: isActive ? 1 : 0.6, color: '#000' }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
          {/* Note + Delete row */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
            <button
              onClick={() => { setNoteDrawerOpen(true); setPopoverOpen(false); }}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Add note
            </button>
            {getMistakeForWord(selectedWord.ayahNumber, selectedWord.wordIndex) && (
              <button
                onClick={handleRemove}
                className="text-[11px] text-destructive hover:text-destructive/80"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      {/* Note drawer/sheet */}
      {isMobile ? (
        <Drawer open={noteDrawerOpen} onOpenChange={setNoteDrawerOpen}>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>Mistake Note</DrawerTitle></DrawerHeader>
            <div className="px-4 pb-2">{noteContent}</div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline" onClick={() => setNoteDrawerOpen(false)}>Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={noteDrawerOpen} onOpenChange={setNoteDrawerOpen}>
          <SheetContent>
            <SheetHeader><SheetTitle>Mistake Note</SheetTitle></SheetHeader>
            <div className="py-4">{noteContent}</div>
            <SheetFooter>
              <SheetClose asChild>
                <Button variant="outline">Close</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};
