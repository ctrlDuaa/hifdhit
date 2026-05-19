/**
 * Side panel (Sheet) showing all Quran.com collections and their bookmarks.
 * Supports deleting entire collections or individual verses within them.
 *
 * Fetching mirrors HifdhCollectionPicker exactly (which works reliably):
 *   - Collections list: GET /auth/v1/collections?first=20&type=ayah
 *   - Per-collection items: GET /auth/v1/collections/{id}?first=20
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { callQfUserApi, isQfSessionValid } from '@/services/qfAuth';
import { useSurahList } from '@/hooks/useQuranData';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Trash2, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Collection {
  id: string;
  name: string;
}

interface Bookmark {
  id: string;
  key: number;
  verseNumber: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function normalizeBookmark(raw: any): Bookmark | null {
  const id = raw.id ?? raw.verseKey ?? `${raw.key ?? raw.chapterId ?? raw.surahId}:${raw.verseNumber ?? raw.ayah ?? raw.verse_number}`;
  const key = raw.key ?? raw.chapterId ?? raw.chapter_id ?? raw.surahId
    ?? (typeof raw.verseKey === 'string' ? parseInt(raw.verseKey.split(':')[0]) : null);
  const verseNumber = raw.verseNumber ?? raw.verse_number ?? raw.ayah
    ?? (typeof raw.verseKey === 'string' ? parseInt(raw.verseKey.split(':')[1]) : null);

  if (key != null && verseNumber != null && !isNaN(Number(key)) && !isNaN(Number(verseNumber))) {
    return { id: String(id), key: Number(key), verseNumber: Number(verseNumber) };
  }
  return null;
}

const PAGE_SIZE = 20;

export const BookmarksPanel = ({ open, onOpenChange }: Props) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [nextPage, setNextPage] = useState<number>(2);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bookmarksMap, setBookmarksMap] = useState<Record<string, Bookmark[]>>({});
  const [bookmarksErrorMap, setBookmarksErrorMap] = useState<Record<string, string>>({});
  const [loadingBookmarks, setLoadingBookmarks] = useState<string | null>(null);
  const [deletingCollection, setDeletingCollection] = useState<Collection | null>(null);
  const [deletingBookmark, setDeletingBookmark] = useState<{ collectionId: string; bookmark: Bookmark } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { data: chapters } = useSurahList();
  const surahNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    chapters?.forEach(s => { map[s.id] = s.name_simple; });
    return map;
  }, [chapters]);

  const loadCollectionPage = useCallback(async (opts: { cursor?: string | null; page?: number }) => {
    const params = new URLSearchParams();
    params.set('first', String(PAGE_SIZE));
    params.set('type', 'ayah');
    if (opts.cursor) params.set('after', opts.cursor);
    else if (opts.page && opts.page > 1) params.set('page', String(opts.page));

    const res = await callQfUserApi(`/auth/v1/collections?${params.toString()}`) as any;

    const upstreamStatus = res?.upstreamStatus;
    if (upstreamStatus && upstreamStatus >= 400) {
      throw new Error(`HTTP ${upstreamStatus}`);
    }

    const innerData = res?.data;
    const container = innerData?.data ?? innerData;
    const pageItems: any[] = Array.isArray(container)
      ? container
      : Array.isArray(container?.records)
        ? container.records
        : Array.isArray(container?.items)
          ? container.items
          : Array.isArray(innerData?.data) ? innerData.data : [];

    const parsed: Collection[] = pageItems
      .filter((c: any) => !!c?.id)
      .map((c: any) => ({ id: String(c.id), name: c.name ?? c.title ?? 'Untitled Collection' }));

    // Try multiple shapes to detect more pages
    const pagination = innerData?.pagination ?? container?.pagination ?? innerData?.meta ?? container?.meta ?? innerData?.pageInfo ?? container?.pageInfo;
    const endCursor: string | null = pagination?.endCursor ?? pagination?.end_cursor ?? pagination?.after ?? pagination?.next_cursor ?? pagination?.nextCursor ?? null;
    const explicitHasMore: boolean | undefined = pagination?.hasNextPage ?? pagination?.has_more ?? pagination?.hasMore;
    const currentPage = pagination?.currentPage ?? pagination?.current_page ?? pagination?.page;
    const totalPages = pagination?.totalPages ?? pagination?.total_pages;

    let more = false;
    if (typeof explicitHasMore === 'boolean') more = explicitHasMore;
    else if (currentPage != null && totalPages != null) more = Number(currentPage) < Number(totalPages);
    else more = parsed.length >= PAGE_SIZE;

    return { parsed, endCursor, more };
  }, []);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setNextCursor(null);
    setNextPage(2);
    setHasMore(false);
    try {
      if (!isQfSessionValid()) {
        throw new Error('Not connected to Quran.com. Please reconnect from the header.');
      }
      const { parsed, endCursor, more } = await loadCollectionPage({ page: 1 });
      setCollections(parsed);
      setNextCursor(endCursor);
      setHasMore(more);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load collections';
      setLoadError(message);
      toast({ title: 'Failed to load collections', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [loadCollectionPage]);

  const fetchMoreCollections = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { parsed, endCursor, more } = await loadCollectionPage({ cursor: nextCursor, page: nextPage });
      setCollections(prev => {
        const seen = new Set(prev.map(c => c.id));
        const additions = parsed.filter(c => !seen.has(c.id));
        return [...prev, ...additions];
      });
      setNextCursor(endCursor);
      setNextPage(p => p + 1);
      setHasMore(more && parsed.length > 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load more collections';
      toast({ title: 'Failed to load more', description: message, variant: 'destructive' });
    } finally {
      setLoadingMore(false);
    }
  }, [loadCollectionPage, loadingMore, hasMore, nextCursor, nextPage]);

  useEffect(() => {
    if (open && isQfSessionValid()) {
      fetchCollections();
      setExpandedId(null);
      setBookmarksMap({});
      setBookmarksErrorMap({});
    }
  }, [open, fetchCollections]);

  const fetchBookmarks = useCallback(async (collectionId: string, force = false) => {
    if (!force && bookmarksMap[collectionId]) return;
    setLoadingBookmarks(collectionId);
    setBookmarksErrorMap(prev => { const n = { ...prev }; delete n[collectionId]; return n; });

    try {
      const itemsRes = await callQfUserApi(`/auth/v1/collections/${collectionId}?first=20`) as any;

      if (itemsRes?.success === false || itemsRes?.type === 'not_found') {
        throw new Error('Collection not found');
      }

      const resData = itemsRes?.data?.data ?? itemsRes?.data;
      const rawItems: any[] = Array.isArray(resData?.items)
        ? resData.items
        : Array.isArray(resData?.bookmarks)
          ? resData.bookmarks
          : Array.isArray(resData)
            ? resData
            : [];

      const normalized: Bookmark[] = [];
      for (const raw of rawItems) {
        const bm = normalizeBookmark(raw);
        if (bm) normalized.push(bm);
      }

      setBookmarksMap(prev => ({ ...prev, [collectionId]: normalized }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load bookmarks';
      setBookmarksErrorMap(prev => ({ ...prev, [collectionId]: message }));
    } finally {
      setLoadingBookmarks(null);
    }
  }, [bookmarksMap]);

  const toggleExpand = (collection: Collection) => {
    if (expandedId === collection.id) {
      setExpandedId(null);
    } else {
      setExpandedId(collection.id);
      fetchBookmarks(collection.id);
    }
  };

  const handleDeleteCollection = async () => {
    if (!deletingCollection) return;
    setActionLoading(true);
    try {
      await callQfUserApi(`/auth/v1/collections/${deletingCollection.id}`, 'DELETE');
      setCollections(prev => prev.filter(c => c.id !== deletingCollection.id));
      setBookmarksMap(prev => {
        const next = { ...prev };
        delete next[deletingCollection.id];
        return next;
      });
      if (expandedId === deletingCollection.id) setExpandedId(null);
      toast({ title: 'Collection deleted' });
    } catch {
      toast({ title: 'Failed to delete collection', variant: 'destructive' });
    } finally {
      setActionLoading(false);
      setDeletingCollection(null);
    }
  };

  const handleDeleteBookmark = async () => {
    if (!deletingBookmark) return;
    const { collectionId, bookmark } = deletingBookmark;
    setActionLoading(true);
    try {
      await callQfUserApi(`/auth/v1/collections/${collectionId}/bookmarks/${bookmark.id}`, 'DELETE');
      setBookmarksMap(prev => ({
        ...prev,
        [collectionId]: (prev[collectionId] || []).filter(b => b.id !== bookmark.id),
      }));
      toast({ title: 'Verse removed from collection' });
    } catch {
      toast({ title: 'Failed to remove verse', variant: 'destructive' });
    } finally {
      setActionLoading(false);
      setDeletingBookmark(null);
    }
  };

  const groupBookmarks = (bookmarks: Bookmark[]) => {
    return bookmarks.reduce<Record<number, Bookmark[]>>((acc, b) => {
      if (!acc[b.key]) acc[b.key] = [];
      acc[b.key].push(b);
      return acc;
    }, {});
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50">
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[hsl(var(--gold-accent,35_37%_62%))]" />
              Your Collections
            </SheetTitle>
            <SheetDescription>
              Manage your Quran.com collections and saved verses
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 px-4 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : loadError ? (
              <div className="text-center py-12 space-y-3">
                <p className="text-sm text-destructive">Failed to load collections</p>
                <p className="text-xs text-muted-foreground">{loadError}</p>
                <Button variant="outline" size="sm" onClick={fetchCollections}>Try Again</Button>
              </div>
            ) : collections.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <p className="text-sm text-muted-foreground">No collections found</p>
                <Button variant="outline" size="sm" onClick={() => window.open('https://quran.com', '_blank')}>
                  Go to Quran.com
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {collections.map(collection => {
                  const isExpanded = expandedId === collection.id;
                  const collectionBookmarks = bookmarksMap[collection.id];
                  const isLoadingThis = loadingBookmarks === collection.id;

                  return (
                    <div key={collection.id} className="rounded-lg border border-border/50 overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
                        <button
                          type="button"
                          onClick={() => toggleExpand(collection)}
                          className="flex-1 flex items-center gap-2 text-left text-sm font-medium text-foreground"
                        >
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          }
                          {collection.name}
                          {collectionBookmarks && (
                            <span className="text-xs text-muted-foreground">({collectionBookmarks.length})</span>
                          )}
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeletingCollection(collection)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border/30">
                          {isLoadingThis ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            </div>
                          ) : bookmarksErrorMap[collection.id] ? (
                            <div className="text-center py-4 space-y-2">
                              <p className="text-xs text-destructive">Failed to load verses</p>
                              <p className="text-[11px] text-muted-foreground px-3 break-words">{bookmarksErrorMap[collection.id]}</p>
                              <Button variant="outline" size="sm" onClick={() => fetchBookmarks(collection.id, true)}>
                                Try Again
                              </Button>
                            </div>
                          ) : !collectionBookmarks || collectionBookmarks.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No verses in this collection</p>
                          ) : (
                            <div className="divide-y divide-border/20">
                              {Object.entries(groupBookmarks(collectionBookmarks)).map(([surahStr, items]) => {
                                const surahNum = parseInt(surahStr);
                                return (
                                  <div key={surahNum} className="px-3 py-2">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                      {surahNum}. {surahNameMap[surahNum] ?? `Surah ${surahNum}`}
                                    </p>
                                    {items.map(bookmark => (
                                      <div key={bookmark.id} className="flex items-center justify-between py-1 pl-4">
                                        <span className="text-sm text-foreground">
                                          Ayah {bookmark.verseNumber}
                                        </span>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                          onClick={() => setDeletingBookmark({ collectionId: collection.id, bookmark })}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Delete collection confirmation */}
      <AlertDialog open={!!deletingCollection} onOpenChange={open => { if (!open) setDeletingCollection(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingCollection?.name}&quot;? This will remove all bookmarks in it and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCollection} disabled={actionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete bookmark confirmation */}
      <AlertDialog open={!!deletingBookmark} onOpenChange={open => { if (!open) setDeletingBookmark(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Verse</AlertDialogTitle>
            <AlertDialogDescription>
              Remove Ayah {deletingBookmark?.bookmark.verseNumber} ({surahNameMap[deletingBookmark?.bookmark.key ?? 0] ?? `Surah ${deletingBookmark?.bookmark.key}`}) from this collection?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBookmark} disabled={actionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
