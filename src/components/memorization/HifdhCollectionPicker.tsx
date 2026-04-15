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
  _raw?: any;
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
  const [debugInfo, setDebugInfo] = useState<string>('');
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
    setDebugInfo('fetching...');

    try {
      const path = '/auth/v1/collections?first=1&type=ayah';
      const collectionsRes = await callQfUserApi(path) as any;
      console.log('[HifdhPicker] Raw response:', JSON.stringify(collectionsRes, null, 2));

      const upstreamStatus = collectionsRes?.upstreamStatus;
      if (upstreamStatus && upstreamStatus >= 400) {
        throw new Error(`HTTP ${upstreamStatus}: ${JSON.stringify(collectionsRes?.data, null, 2)}`);
      }

      // Response shape: { success, data: { success, data: [...], pagination }, upstreamStatus }
      const innerData = collectionsRes?.data;
      const pageItems: Collection[] = Array.isArray(innerData?.data)
        ? innerData.data
        : Array.isArray(innerData)
          ? innerData
          : [];

      const filtered = pageItems.filter((c) => !!c?.id);
      const info = `setCollections(${filtered.length} items: ${JSON.stringify(filtered)})\nloadingCollections → false\ncollectionsError → null`;
      console.log('[HifdhPicker]', info);
      setDebugInfo(info);
      setCollections(filtered);
      if (filtered.length > 0) {
        setSelectedCollectionId(filtered[0].id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load collections';
      console.error('[HifdhPicker] Collections error:', msg);
      setCollectionsError(msg);
      setDebugInfo(`collectionsError set: ${msg}`);
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
      const path = `/auth/v1/collections/${collectionId}?first=10`;
      console.log('[HifdhPicker] Bookmarks request path:', path);
      setDebugInfo(prev => prev + `\nBookmarks path: ${path}`);

      const itemsRes = await callQfUserApi(path) as any;
      console.log('[HifdhPicker] Bookmarks raw response:', JSON.stringify(itemsRes, null, 2));
      setDebugInfo(prev => prev + `\nBookmarks response: ${JSON.stringify(itemsRes, null, 2)?.slice(0, 500)}`);

      if (itemsRes?.success === false || itemsRes?.type === 'not_found') {
        setBookmarksError(`API returned: ${JSON.stringify(itemsRes, null, 2)}`);
        return;
      }

      // The collection endpoint returns items inside the collection data
      const resData = itemsRes?.data?.data ?? itemsRes?.data;
      const pageItems: CollectionBookmark[] = Array.isArray(resData?.items)
        ? resData.items
        : Array.isArray(resData?.bookmarks)
          ? resData.bookmarks
          : Array.isArray(resData)
            ? resData
            : [];

      console.log('[HifdhPicker] Parsed bookmarks array:', pageItems);
      setDebugInfo(prev => prev + `\nParsed bookmarks: ${pageItems.length} items`);

      const filtered = pageItems.filter((bookmark) => bookmark.type === 'ayah' && bookmark.verseNumber != null);
      setBookmarks(filtered);
      setDebugInfo(prev => prev + `\nFiltered ayah bookmarks: ${filtered.length}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load collection verses';
      console.error('[HifdhPicker] Bookmarks error:', msg);
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

  const handleOpen = () => {
    setOpen(true);
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

  // Debug: log render state
  console.log('[HifdhPicker] RENDER — collections:', collections.length, 'loadingCollections:', loadingCollections, 'collectionsError:', collectionsError, 'bookmarksError:', bookmarksError);

  return (
    <>
      <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-2">
        <p className="text-sm text-muted-foreground">Memorize verses that are meaningful to you</p>
        <Button
          variant="outline"
          onClick={handleOpen}
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

          {/* Debug panel */}
          <div className="rounded-md bg-muted/50 p-2 text-xs font-mono space-y-1 max-h-32 overflow-auto">
            <p><strong>collections.length:</strong> {collections.length}</p>
            <p><strong>loadingCollections:</strong> {String(loadingCollections)}</p>
            <p><strong>collectionsError:</strong> {collectionsError ?? 'null'}</p>
            <p><strong>bookmarksError:</strong> {bookmarksError ?? 'null'}</p>
            <p><strong>selectedCollectionId:</strong> {selectedCollectionId ?? 'null'}</p>
            <p><strong>bookmarks.length:</strong> {bookmarks.length}</p>
            <p><strong>debug:</strong> {debugInfo}</p>
          </div>

          {loadingCollections && collections.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {collectionsError && (
            <div className="py-4 space-y-2">
              <p className="text-sm font-medium text-destructive">Error loading collections</p>
              <pre className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                {collectionsError}
              </pre>
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
                  <pre className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 max-h-32 overflow-auto whitespace-pre-wrap break-all">
                    {bookmarksError}
                  </pre>
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
