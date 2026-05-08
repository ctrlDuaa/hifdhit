/**
 * Side panel (Sheet) showing all Quran.com collections and their bookmarks.
 * Supports deleting entire collections or individual verses within them.
 *
 * Source-of-truth model:
 *  - Signed-in QF users → Quran Foundation PRE-LIVE API
 *  - Signed-out users   → local/Supabase (not yet implemented)
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

type DebugEntry = {
  ts: string;
  label: string;
  status: 'ok' | 'error' | 'info';
  detail?: any;
};

/**
 * Try every known field name the QF API might use for collection membership.
 * Returns an array of collection IDs the resource belongs to.
 */
function getCollectionIdsForItem(item: any): string[] {
  const ids = new Set<string>();

  if (item.collectionId != null) ids.add(String(item.collectionId));
  if (item.collection_id != null) ids.add(String(item.collection_id));
  if (item.collectionID != null) ids.add(String(item.collectionID));
  if (item.collection?.id != null) ids.add(String(item.collection.id));
  if (item.collection?.url != null) ids.add(String(item.collection.url));
  if (item.bookmark?.collectionId != null) ids.add(String(item.bookmark.collectionId));
  if (item.bookmark?.collection_id != null) ids.add(String(item.bookmark.collection_id));
  if (item.resource?.collectionId != null) ids.add(String(item.resource.collectionId));
  if (item.resource?.collection_id != null) ids.add(String(item.resource.collection_id));

  if (Array.isArray(item.collections)) {
    item.collections.forEach((c: any) => {
      if (typeof c === 'string') ids.add(c);
      else {
        if (c?.id != null) ids.add(String(c.id));
        if (c?.url != null) ids.add(String(c.url));
      }
    });
  }
  if (Array.isArray(item.collectionIds)) {
    item.collectionIds.forEach((id: any) => ids.add(String(id)));
  }
  if (Array.isArray(item.collection_ids)) {
    item.collection_ids.forEach((id: any) => ids.add(String(id)));
  }

  // Handle default/favorites detection
  if (item.collection?.isDefault === true || item.isDefault === true) {
    ids.add('**default**');
  }
  if (item.url === '**default**' || item.collection?.url === '**default**') {
    ids.add('**default**');
  }

  return [...ids].filter(Boolean);
}

function normalizeBookmark(raw: any): Bookmark | null {
  const id = raw.id ?? raw.verseKey ?? `${raw.key ?? raw.chapterId}:${raw.verseNumber ?? raw.ayah}`;
  const key = raw.key ?? raw.chapterId ?? raw.chapter_id ?? raw.surahId
    ?? (typeof raw.verseKey === 'string' ? parseInt(raw.verseKey.split(':')[0]) : null);
  const verseNumber = raw.verseNumber ?? raw.verse_number ?? raw.ayah
    ?? (typeof raw.verseKey === 'string' ? parseInt(raw.verseKey.split(':')[1]) : null);

  if (key != null && verseNumber != null && !isNaN(Number(key)) && !isNaN(Number(verseNumber))) {
    return { id: String(id), key: Number(key), verseNumber: Number(verseNumber) };
  }
  return null;
}

export const BookmarksPanel = ({ open, onOpenChange }: Props) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bookmarksMap, setBookmarksMap] = useState<Record<string, Bookmark[]>>({});
  const [bookmarksErrorMap, setBookmarksErrorMap] = useState<Record<string, string>>({});
  const [loadingBookmarks, setLoadingBookmarks] = useState<string | null>(null);
  const [deletingCollection, setDeletingCollection] = useState<Collection | null>(null);
  const [deletingBookmark, setDeletingBookmark] = useState<{ collectionId: string; bookmark: Bookmark } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugLog, setDebugLog] = useState<DebugEntry[]>([]);

  const pushDebug = useCallback((entry: Omit<DebugEntry, 'ts'>) => {
    setDebugLog(prev => [{ ts: new Date().toISOString().split('T')[1].replace('Z', ''), ...entry }, ...prev].slice(0, 80));
  }, []);

  const { data: chapters } = useSurahList();
  const surahNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    chapters?.forEach(s => { map[s.id] = s.name_simple; });
    return map;
  }, [chapters]);

  // Store all raw resources fetched via /collections/all (keep raw for field inspection)
  const [allRawResources, setAllRawResources] = useState<any[]>([]);

  const normalizeCollections = (res: any): Collection[] => {
    const upstreamStatus = res?.upstreamStatus;
    if (upstreamStatus && upstreamStatus >= 400) {
      throw new Error(`HTTP ${upstreamStatus}`);
    }
    const innerData = res?.data?.data ?? res?.data;
    const items = Array.isArray(innerData?.data)
      ? innerData.data
      : Array.isArray(innerData?.collections)
        ? innerData.collections
        : Array.isArray(innerData)
          ? innerData
          : [];
    return items
      .filter((c: any) => !!c?.id)
      .map((c: any) => ({ id: String(c.id), name: c.name ?? c.title ?? 'Untitled Collection' }));
  };

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const collectionsUrl = '/auth/v1/collections?type=ayah&first=20';
    pushDebug({ label: `GET ${collectionsUrl}`, status: 'info' });
    try {
      if (!isQfSessionValid()) {
        throw new Error('Not connected to Quran.com. Please reconnect from the header.');
      }

      const res: any = await callQfUserApi(collectionsUrl);
      const parsed = normalizeCollections(res);
      pushDebug({
        label: 'collections response',
        status: 'ok',
        detail: {
          collectionIds: parsed.map(c => c.id),
          collectionNames: parsed.map(c => c.name),
          itemCount: parsed.length,
        },
      });
      setCollections(parsed);

      // Fetch all resources for mapping to collections
      const resourcesUrl = '/auth/v1/collections/all?type=ayah&first=20&sortBy=recentlyAdded';
      pushDebug({ label: `GET ${resourcesUrl}`, status: 'info' });
      try {
        let allResources: any[] = [];
        let cursor: string | undefined;
        let page = 0;
        do {
          const paginatedUrl = cursor
            ? `${resourcesUrl}&after=${cursor}`
            : resourcesUrl;
          const rRes: any = await callQfUserApi(paginatedUrl);
          const rData = rRes?.data?.data ?? rRes?.data;

          let items: any[] = [];
          if (Array.isArray(rData?.data)) items = rData.data;
          else if (Array.isArray(rData?.resources)) items = rData.resources;
          else if (Array.isArray(rData?.items)) items = rData.items;
          else if (Array.isArray(rData?.bookmarks)) items = rData.bookmarks;
          else if (Array.isArray(rData)) items = rData;

          const nextCursor = rData?.pagination?.endCursor
            ?? rData?.meta?.nextCursor
            ?? rData?.nextCursor
            ?? rData?.pagination?.next_cursor;

          pushDebug({
            label: `resources page ${page}`,
            status: 'ok',
            detail: {
              upstreamUrl: paginatedUrl,
              itemCount: items.length,
              paginationCursor: nextCursor ?? null,
              sampleKeys: items.slice(0, 3).map((it: any) => Object.keys(it)),
              sampleItems: items.slice(0, 2),
            },
          });

          allResources = allResources.concat(items);
          cursor = nextCursor;
          page++;
        } while (cursor && page < 10);

        setAllRawResources(allResources);
        pushDebug({ label: 'all resources loaded', status: 'ok', detail: { totalItems: allResources.length } });
      } catch (resErr) {
        pushDebug({ label: 'resources fetch failed', status: 'error', detail: String((resErr as Error)?.message ?? resErr) });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load collections';
      setLoadError(message);
      pushDebug({ label: 'fetchCollections failed', status: 'error', detail: message });
      toast({ title: 'Failed to load collections', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [pushDebug]);

  useEffect(() => {
    if (open && isQfSessionValid()) {
      fetchCollections();
      setExpandedId(null);
      setBookmarksMap({});
    }
  }, [open, fetchCollections]);

  /**
   * Show bookmarks for a collection.
   * - Favorites (**default**): filter allRawResources by isInDefaultCollection === true
   * - Custom collections: fetch per-collection items from /auth/v1/collections/{id}/resources
   * NEVER falls back to local/Supabase data or shows all resources.
   */
  const fetchBookmarks = useCallback(async (collectionId: string, collectionName: string, force = false) => {
    if (!force && bookmarksMap[collectionId]) return;
    setLoadingBookmarks(collectionId);
    setBookmarksErrorMap(prev => { const n = { ...prev }; delete n[collectionId]; return n; });

    pushDebug({
      label: `expand collection`,
      status: 'info',
      detail: {
        selectedCollectionId: collectionId,
        selectedCollectionName: collectionName,
        source: 'quran_foundation',
        totalRawResources: allRawResources.length,
      },
    });

    try {
      // Always log raw sample for debugging
      console.log("RAW QF ITEMS SAMPLE", JSON.stringify(allRawResources.slice(0, 3), null, 2));
      console.log("selectedCollectionId", collectionId);

      let matching: any[] = [];

      const isFavorites = collectionId === 'default' || collectionId === '**default**';
      if (isFavorites) {
        // Favorites: use isInDefaultCollection from the /collections/all response
        matching = allRawResources.filter((r: any) => r.isInDefaultCollection === true);
        const defaultCount = matching.length;
        console.log(`Favorites filter: ${defaultCount} items with isInDefaultCollection=true out of ${allRawResources.length}`);
        pushDebug({
          label: `favorites filter`,
          status: 'ok',
          detail: {
            totalRawResources: allRawResources.length,
            itemsWithIsInDefaultCollection: defaultCount,
          },
        });
      } else {
        // Custom collections: /collections/all does NOT expose collectionId on items.
        // Fetch per-collection resources from the dedicated endpoint.
        pushDebug({
          label: `custom collection — fetching per-collection items`,
          status: 'info',
          detail: { note: '/collections/all does not expose collectionId on items, using per-collection endpoint' },
        });

        let cursor: string | undefined;
        let page = 0;
        do {
          const url = cursor
            ? `/auth/v1/collections/${collectionId}/resources?type=ayah&first=20&after=${cursor}`
            : `/auth/v1/collections/${collectionId}/resources?type=ayah&first=20`;
          console.log(`Fetching custom collection items: ${url}`);
          pushDebug({ label: `GET ${url}`, status: 'info' });

          const res: any = await callQfUserApi(url);
          const rData = res?.data?.data ?? res?.data;

          let items: any[] = [];
          if (Array.isArray(rData?.data)) items = rData.data;
          else if (Array.isArray(rData?.resources)) items = rData.resources;
          else if (Array.isArray(rData?.items)) items = rData.items;
          else if (Array.isArray(rData?.bookmarks)) items = rData.bookmarks;
          else if (Array.isArray(rData)) items = rData;

          const nextCursor = rData?.pagination?.endCursor
            ?? rData?.meta?.nextCursor
            ?? rData?.nextCursor
            ?? rData?.pagination?.next_cursor;

          pushDebug({
            label: `collection ${collectionId} resources page ${page}`,
            status: 'ok',
            detail: {
              upstreamUrl: url,
              statusCode: res?.upstreamStatus ?? 'n/a',
              itemCount: items.length,
              paginationCursor: nextCursor ?? null,
              sampleItem: items[0] ?? null,
            },
          });

          matching = matching.concat(items);
          cursor = nextCursor;
          page++;
        } while (cursor && page < 10);

        console.log(`Custom collection ${collectionId}: fetched ${matching.length} items via per-collection endpoint`);
      }

      const normalized: Bookmark[] = [];
      for (const raw of matching) {
        const bm = normalizeBookmark(raw);
        if (bm) normalized.push(bm);
      }

      console.log("filteredItems", matching);

      pushDebug({
        label: `collection ${collectionId} result`,
        status: 'ok',
        detail: {
          selectedCollectionId: collectionId,
          selectedCollectionName: collectionName,
          source: 'quran_foundation',
          qfItemsFetched: matching.length,
          filteredItemCount: normalized.length,
        },
      });

      setBookmarksMap(prev => ({ ...prev, [collectionId]: normalized }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load bookmarks';
      setBookmarksErrorMap(prev => ({ ...prev, [collectionId]: message }));
      pushDebug({ label: `fetchBookmarks ${collectionId} failed`, status: 'error', detail: message });
    } finally {
      setLoadingBookmarks(null);
    }
  }, [allRawResources, bookmarksMap, pushDebug]);

  const toggleExpand = (collection: Collection) => {
    if (expandedId === collection.id) {
      setExpandedId(null);
    } else {
      setExpandedId(collection.id);
      fetchBookmarks(collection.id, collection.name);
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
                              <Button variant="outline" size="sm" onClick={() => fetchBookmarks(collection.id, collection.name, true)}>
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

          {/* Debug panel */}
          <div className="border-t border-border/50 bg-muted/20 text-[11px] shrink-0 max-h-64 flex flex-col">
            <button
              type="button"
              onClick={() => setDebugOpen(o => !o)}
              className="flex items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                {debugOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Debug ({debugLog.length})
              </span>
              {debugOpen && debugLog.length > 0 && (
                <span className="flex items-center gap-3">
                  <span
                    role="button"
                    className="text-[10px] underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      const text = debugLog
                        .slice()
                        .reverse()
                        .map(en => {
                          const detail = en.detail === undefined
                            ? ''
                            : '\n' + (typeof en.detail === 'string' ? en.detail : JSON.stringify(en.detail, null, 2));
                          return `[${en.ts}] (${en.status}) ${en.label}${detail}`;
                        })
                        .join('\n\n');
                      const done = () => toast({ title: 'Debug logs copied' });
                      if (navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(text).then(done).catch(() => {
                          const ta = document.createElement('textarea');
                          ta.value = text; document.body.appendChild(ta); ta.select();
                          document.execCommand('copy'); document.body.removeChild(ta); done();
                        });
                      } else {
                        const ta = document.createElement('textarea');
                        ta.value = text; document.body.appendChild(ta); ta.select();
                        document.execCommand('copy'); document.body.removeChild(ta); done();
                      }
                    }}
                  >
                    copy
                  </span>
                  <span
                    role="button"
                    className="text-[10px] underline"
                    onClick={(e) => { e.stopPropagation(); setDebugLog([]); }}
                  >
                    clear
                  </span>
                </span>
              )}
            </button>
            {debugOpen && (
              <ScrollArea className="flex-1 px-3 pb-3">
                {debugLog.length === 0 ? (
                  <p className="text-muted-foreground py-2">No events yet.</p>
                ) : (
                  <div className="space-y-2 font-mono">
                    {debugLog.map((entry, i) => (
                      <div
                        key={i}
                        className={`rounded border px-2 py-1.5 ${
                          entry.status === 'error'
                            ? 'border-destructive/40 bg-destructive/5 text-destructive'
                            : entry.status === 'ok'
                              ? 'border-border/40 bg-background/50 text-foreground'
                              : 'border-border/40 bg-background/30 text-muted-foreground'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold truncate">{entry.label}</span>
                          <span className="text-[10px] opacity-60 shrink-0">{entry.ts}</span>
                        </div>
                        {entry.detail !== undefined && (
                          <pre className="mt-1 whitespace-pre-wrap break-words text-[10px] opacity-80 max-h-32 overflow-auto">
                            {typeof entry.detail === 'string' ? entry.detail : JSON.stringify(entry.detail, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>
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
