import { useState, useEffect } from 'react';
import { callQfUserApi, isQfSessionValid } from '@/services/qfAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, BookOpen } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface HifdhBookmark {
  id: string;
  key: number; // surah number
  verseNumber: number | null;
  type: string;
}

interface Props {
  onSelectVerses: (verses: { surahId: number; ayah: number }[]) => void;
}

export const HifdhCollectionPicker = ({ onSelectVerses }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<HifdhBookmark[]>([]);
  const [noCollection, setNoCollection] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isConnected = isQfSessionValid();

  if (!isConnected) return null;

  const fetchHifdhCollection = async () => {
    setLoading(true);
    setError(null);
    setNoCollection(false);
    setBookmarks([]);

    try {
      // Step 1: Get all collections
      const collectionsRes = await callQfUserApi('/auth/v1/collections?first=20') as any;
      const collections: { id: string; name: string }[] = collectionsRes?.data || [];

      // Step 2: Find the "Hifdh" collection (case-insensitive)
      const hifdhCollection = collections.find(
        (c) => c.name.toLowerCase() === 'hifdh' || c.name.toLowerCase() === 'hifz'
      );

      if (!hifdhCollection) {
        setNoCollection(true);
        setLoading(false);
        return;
      }

      // Step 3: Get bookmarks in the Hifdh collection
      const itemsRes = await callQfUserApi(
        `/auth/v1/collections/${hifdhCollection.id}?sortBy=verseKey&first=50`
      ) as any;

      const items: HifdhBookmark[] = itemsRes?.data?.bookmarks || [];
      // Filter to ayah-type bookmarks only
      const ayahBookmarks = items.filter((b) => b.type === 'ayah' && b.verseNumber != null);

      if (ayahBookmarks.length === 0) {
        setNoCollection(true);
        setLoading(false);
        return;
      }

      setBookmarks(ayahBookmarks);
    } catch (err) {
      console.error('Failed to fetch Hifdh collection:', err);
      setError(err instanceof Error ? err.message : 'Failed to load collection');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setSelected(new Set());
    fetchHifdhCollection();
  };

  const toggleBookmark = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const verses = bookmarks
      .filter((b) => selected.has(b.id))
      .map((b) => ({ surahId: b.key, ayah: b.verseNumber! }));
    onSelectVerses(verses);
    setOpen(false);
  };

  // Group bookmarks by surah for display
  const groupedBookmarks = bookmarks.reduce<Record<number, HifdhBookmark[]>>((acc, b) => {
    if (!acc[b.key]) acc[b.key] = [];
    acc[b.key].push(b);
    return acc;
  }, {});

  return (
    <>
      <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-2">
        <p className="text-sm text-muted-foreground">Memorize verses that are meaningful to you</p>
        <Button
          variant="outline"
          onClick={handleOpen}
          className="w-full gap-2 border-[#C6A477]/30 text-[#C6A477] hover:bg-[#C6A477]/10 hover:text-[#C6A477]"
        >
          <BookOpen className="w-4 h-4" />
          See Hifdh collection
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Hifdh Collection</DialogTitle>
            <DialogDescription>Select verses to memorize from your Quran.com Hifdh collection</DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#C6A477]" />
            </div>
          )}

          {error && (
            <div className="text-center py-6 space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchHifdhCollection}>
                Try Again
              </Button>
            </div>
          )}

          {noCollection && !loading && !error && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">
                You have no Hifdh collection, start creating one now!
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://quran.com', '_blank')}
              >
                Go to Quran.com
              </Button>
            </div>
          )}

          {!loading && !error && !noCollection && bookmarks.length > 0 && (
            <>
              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-3 pr-3">
                  {Object.entries(groupedBookmarks).map(([surahStr, items]) => {
                    const surahNum = parseInt(surahStr);
                    return (
                      <div key={surahNum}>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">
                          Surah {surahNum}
                        </p>
                        <div className="space-y-1">
                          {items.map((b) => (
                            <label
                              key={b.id}
                              className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                            >
                              <Checkbox
                                checked={selected.has(b.id)}
                                onCheckedChange={() => toggleBookmark(b.id)}
                              />
                              <span className="text-sm">
                                Ayah {b.verseNumber} ({surahNum}:{b.verseNumber})
                              </span>
                            </label>
                          ))}
                        </div>
                        <Separator className="mt-2" />
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <Button
                onClick={handleConfirm}
                disabled={selected.size === 0}
                className="w-full bg-[#C6A477] hover:bg-[#b8956a] text-white"
              >
                Memorize {selected.size} selected {selected.size === 1 ? 'verse' : 'verses'}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
