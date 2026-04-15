import { useState, useEffect, useMemo } from 'react';
import { callQfUserApi, isQfSessionValid } from '@/services/qfAuth';
import { useSurahList } from '@/hooks/useQuranData';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, BookOpen } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface Collection {
  id: string;
  name: string;
}

interface CollectionBookmark {
  id: string;
  key: number;
  verseNumber: number | null;
  type: string;
}

interface Props {
  onSelectVerses: (verses: { surahId: number; ayah: number }[]) => void;
}

export const HifdhCollectionPicker = ({ onSelectVerses }: Props) => {
  const [open, setOpen] = useState(false);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [bookmarksError, setBookmarksError] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<CollectionBookmark[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const isConnected = isQfSessionValid();
  const { data: chapters } = useSurahList();

  const surahNameMap = useMemo(() => {
    const map: Record<number, { arabic: string; simple: string }> = {};
    chapters?.forEach((s) => { map[s.id] = { arabic: s.name_arabic, simple: s.name_simple }; });
    return map;
  }, [chapters]);

  const fetchCollections = async () => {
    setLoadingCollections(true);
    setCollectionsError(null);
    setCollections([]);
    setSelectedCollectionId(null);
    setBookmarks([]);
    setSelected(new Set());

    try {
      const collectionsRes = await callQfUserApi('/auth/v1/collections?first=1&type=ayah') as any;

      const upstreamStatus = collectionsRes?.upstreamStatus;
      if (upstreamStatus && upstreamStatus >= 400) {
        throw new Error(`HTTP ${upstreamStatus}`);
      }

      const innerData = collectionsRes?.data;
      const pageItems: Collection[] = Array.isArray(innerData?.data)
        ? innerData.data
        : Array.isArray(innerData)
          ? innerData
          : [];

      const filtered = pageItems.filter((c) => !!c?.id);
      setCollections(filtered);
      if (filtered.length > 0) {
        setSelectedCollectionId(filtered[0].id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load collections';
      setCollectionsError(msg);
    } finally {
      setLoadingCollections(false);
    }
  };

  const fetchCollectionBookmarks = async (collectionId: string) => {
    setLoadingBookmarks(true);
    setBookmarksError(null);
    setBookmarks([]);
    setSelected(new Set());

    try {
      const itemsRes = await callQfUserApi(`/auth/v1/collections/${collectionId}?first=10`) as any;

      if (itemsRes?.success === false || itemsRes?.type === 'not_found') {
        setBookmarksError('Collection not found');
        return;
      }

      const resData = itemsRes?.data?.data ?? itemsRes?.data;
      const rawItems: any[] = Array.isArray(resData?.items)
        ? resData.items
        : Array.isArray(resData?.bookmarks)
          ? resData.bookmarks
          : Array.isArray(resData)
            ? resData
            : [];

      const normalized: CollectionBookmark[] = [];
      for (const raw of rawItems) {
        const id = raw.id ?? raw.verseKey ?? `${raw.key ?? raw.chapterId ?? raw.surahId}:${raw.verseNumber ?? raw.ayah ?? raw.verse_number}`;
        const key = raw.key ?? raw.chapterId ?? raw.chapter_id ?? raw.surahId ?? (typeof raw.verseKey === 'string' ? parseInt(raw.verseKey.split(':')[0]) : null);
        const verseNumber = raw.verseNumber ?? raw.verse_number ?? raw.ayah ?? (typeof raw.verseKey === 'string' ? parseInt(raw.verseKey.split(':')[1]) : null);

        if (key != null && verseNumber != null && !isNaN(Number(key)) && !isNaN(Number(verseNumber))) {
          normalized.push({ id: String(id), key: Number(key), verseNumber: Number(verseNumber), type: raw.type ?? 'ayah' });
        }
      }

      setBookmarks(normalized);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load collection verses';
      setBookmarksError(msg);
    } finally {
      setLoadingBookmarks(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCollections();
    }
  }, [open]);

  useEffect(() => {
    if (open && selectedCollectionId) {
      fetchCollectionBookmarks(selectedCollectionId);
    }
  }, [open, selectedCollectionId]);

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
      .filter((bookmark) => selected.has(bookmark.id))
      .map((bookmark) => ({ surahId: bookmark.key, ayah: bookmark.verseNumber! }));
    onSelectVerses(verses);
    setOpen(false);
  };

  const groupedBookmarks = bookmarks.reduce<Record<number, CollectionBookmark[]>>((acc, bookmark) => {
    if (!acc[bookmark.key]) acc[bookmark.key] = [];
    acc[bookmark.key].push(bookmark);
    return acc;
  }, {});

  if (!isConnected) return null;

  return (
    <>
      <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-2">
        <p className="text-sm text-muted-foreground">Memorize verses that are meaningful to you</p>
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
        >
          <BookOpen className="w-4 h-4" />
          See collections
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Your Collections</DialogTitle>
            <DialogDescription>Select verses to memorize from any Quran.com collection</DialogDescription>
          </DialogHeader>

          {loadingCollections && collections.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {collectionsError && (
            <div className="py-4 space-y-2">
              <p className="text-sm font-medium text-destructive">Error loading collections</p>
              <p className="text-xs text-muted-foreground">{collectionsError}</p>
              <Button variant="outline" size="sm" onClick={fetchCollections}>
                Try Again
              </Button>
            </div>
          )}

          {!loadingCollections && !collectionsError && collections.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">
                No collections found on your Quran.com account yet.
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

          {!collectionsError && collections.length > 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Choose a collection</p>
                <ScrollArea className="max-h-40 rounded-md border border-border/50">
                  <div className="p-2 space-y-1">
                    {collections.map((collection) => {
                      const isActive = selectedCollectionId === collection.id;
                      return (
                        <button
                          key={collection.id}
                          type="button"
                          onClick={() => setSelectedCollectionId(collection.id)}
                          className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                            isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground'
                          }`}
                        >
                          {collection.name}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {bookmarksError && (
                <div className="py-2 space-y-2">
                  <p className="text-sm font-medium text-destructive">Error loading bookmarks</p>
                  <p className="text-xs text-muted-foreground">{bookmarksError}</p>
                </div>
              )}

              {loadingBookmarks ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : !bookmarksError && bookmarks.length === 0 ? (
                <div className="rounded-md border border-border/50 bg-muted/20 px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    This collection has no verse bookmarks to memorize.
                  </p>
                </div>
              ) : bookmarks.length > 0 ? (
                <>
                  <ScrollArea className="max-h-[40vh] rounded-md border border-border/50">
                    <div className="space-y-3 p-3">
                      {Object.entries(groupedBookmarks).map(([surahStr, items]) => {
                        const surahNum = parseInt(surahStr);
                        return (
                          <div key={surahNum}>
                            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                              {surahNum}. {surahNameMap[surahNum]?.arabic ?? ''} — {surahNameMap[surahNum]?.simple ?? `Surah ${surahNum}`}
                            </p>
                            <div className="space-y-1">
                              {items.map((bookmark) => (
                                <label
                                  key={bookmark.id}
                                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/50"
                                >
                                  <Checkbox
                                    checked={selected.has(bookmark.id)}
                                    onCheckedChange={() => toggleBookmark(bookmark.id)}
                                  />
                                  <span className="text-sm">
                                    Ayah {bookmark.verseNumber} ({surahNum}:{bookmark.verseNumber})
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
                    className="w-full"
                  >
                    Memorize {selected.size} selected {selected.size === 1 ? 'verse' : 'verses'}
                  </Button>
                </>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
