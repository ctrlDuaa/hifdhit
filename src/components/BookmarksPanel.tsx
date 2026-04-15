/**
 * Side panel (Sheet) showing all Quran.com collections and their bookmarks.
 * Supports deleting entire collections or individual verses within them.
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

export const BookmarksPanel = ({ open, onOpenChange }: Props) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bookmarksMap, setBookmarksMap] = useState<Record<string, Bookmark[]>>({});
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

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callQfUserApi('/auth/v1/collections?first=50') as any;
      const innerData = res?.data;
      const items: Collection[] = Array.isArray(innerData?.data)
        ? innerData.data
        : Array.isArray(innerData) ? innerData : [];
      setCollections(items.filter(c => !!c?.id));
    } catch {
      toast({ title: 'Failed to load collections', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && isQfSessionValid()) {
      fetchCollections();
      setExpandedId(null);
      setBookmarksMap({});
    }
  }, [open, fetchCollections]);

  const fetchBookmarks = async (collectionId: string) => {
    if (bookmarksMap[collectionId]) return;
    setLoadingBookmarks(collectionId);
    try {
      const res = await callQfUserApi(`/auth/v1/collections/${collectionId}?first=50`) as any;
      const resData = res?.data?.data ?? res?.data;
      const rawItems: any[] = Array.isArray(resData?.items)
        ? resData.items
        : Array.isArray(resData?.bookmarks)
          ? resData.bookmarks
          : Array.isArray(resData) ? resData : [];

      const normalized: Bookmark[] = [];
      for (const raw of rawItems) {
        const id = raw.id ?? `${raw.key}:${raw.verseNumber}`;
        const key = raw.key ?? raw.chapterId ?? raw.chapter_id ?? (typeof raw.verseKey === 'string' ? parseInt(raw.verseKey.split(':')[0]) : null);
        const verseNumber = raw.verseNumber ?? raw.verse_number ?? raw.ayah ?? (typeof raw.verseKey === 'string' ? parseInt(raw.verseKey.split(':')[1]) : null);
        if (key != null && verseNumber != null && !isNaN(Number(key)) && !isNaN(Number(verseNumber))) {
          normalized.push({ id: String(id), key: Number(key), verseNumber: Number(verseNumber) });
        }
      }
      setBookmarksMap(prev => ({ ...prev, [collectionId]: normalized }));
    } catch {
      toast({ title: 'Failed to load bookmarks', variant: 'destructive' });
    } finally {
      setLoadingBookmarks(null);
    }
  };

  const toggleExpand = (collectionId: string) => {
    if (expandedId === collectionId) {
      setExpandedId(null);
    } else {
      setExpandedId(collectionId);
      fetchBookmarks(collectionId);
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
      await callQfUserApi(`/auth/v1/collections/${collectionId}/${bookmark.id}`, 'DELETE');
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
                      {/* Collection header */}
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
                        <button
                          type="button"
                          onClick={() => toggleExpand(collection.id)}
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

                      {/* Expanded bookmarks */}
                      {isExpanded && (
                        <div className="border-t border-border/30">
                          {isLoadingThis ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
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
              Are you sure you want to delete "{deletingCollection?.name}"? This will remove all bookmarks in it and cannot be undone.
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
