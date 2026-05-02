/**
 * Side panel (Sheet) showing:
 *   1. Local (Hifdh it) collections from local_collections / local_bookmarks
 *   2. Quran.com collections (if the user is connected via QF OAuth)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { callQfUserApi, isQfSessionValid, logoutQf, startQfLogin } from '@/services/qfAuth';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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

/* ---------- types ---------- */

interface Collection {
  id: string;
  name: string;
  source: 'local' | 'qf';
}

interface Bookmark {
  id: string;
  key: number;        // surah number
  verseNumber: number; // ayah number
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ---------- component ---------- */

export const BookmarksPanel = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bookmarksMap, setBookmarksMap] = useState<Record<string, Bookmark[]>>({});
  const [bookmarksErrorMap, setBookmarksErrorMap] = useState<Record<string, string>>({});
  const [loadingBookmarks, setLoadingBookmarks] = useState<string | null>(null);
  const [deletingCollection, setDeletingCollection] = useState<Collection | null>(null);
  const [deletingBookmark, setDeletingBookmark] = useState<{ collectionId: string; source: 'local' | 'qf'; bookmark: Bookmark } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { data: chapters } = useSurahList();
  const surahNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    chapters?.forEach(s => { map[s.id] = s.name_simple; });
    return map;
  }, [chapters]);

  /* ============================
   *  Fetch collections (local + QF)
   * ============================ */

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const merged: Collection[] = [];

    // 1. Local collections
    if (user) {
      try {
        const { data, error } = await supabase
          .from('local_collections')
          .select('id, name')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        (data ?? []).forEach(c => merged.push({ id: c.id, name: c.name, source: 'local' }));
      } catch (err: any) {
        console.error('Failed to load local collections', err);
      }
    }

    // 2. QF collections (only when connected)
    if (isQfSessionValid()) {
      try {
        const res = await callQfUserApi('/auth/v1/collections?first=50') as any;
        const innerData = res?.data?.data ?? res?.data;
        const items = Array.isArray(innerData?.data)
          ? innerData.data
          : Array.isArray(innerData?.collections)
            ? innerData.collections
            : Array.isArray(innerData)
              ? innerData
              : [];

        items
          .filter((c: any) => !!c?.id)
          .forEach((c: any) => merged.push({ id: String(c.id), name: c.name ?? c.title ?? 'Untitled', source: 'qf' }));
      } catch (err: any) {
        // QF errors are non-fatal — local collections still show
        console.warn('QF collections fetch failed', err?.message);
      }
    }

    if (merged.length === 0 && !user) {
      setLoadError('Please sign in to view your collections.');
    }

    setCollections(merged);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (open) {
      fetchCollections();
      setExpandedId(null);
      setBookmarksMap({});
    }
  }, [open, fetchCollections]);

  /* ============================
   *  Fetch bookmarks for a collection
   * ============================ */

  const fetchBookmarks = async (collection: Collection, force = false) => {
    if (!force && bookmarksMap[collection.id]) return;
    setLoadingBookmarks(collection.id);
    setBookmarksErrorMap(prev => { const n = { ...prev }; delete n[collection.id]; return n; });

    try {
      if (collection.source === 'local') {
        const { data, error } = await supabase
          .from('local_bookmarks')
          .select('id, surah_id, ayah_number')
          .eq('collection_id', collection.id)
          .order('created_at', { ascending: true });
        if (error) throw error;
        const normalized: Bookmark[] = (data ?? []).map(b => ({
          id: b.id,
          key: b.surah_id,
          verseNumber: b.ayah_number,
        }));
        setBookmarksMap(prev => ({ ...prev, [collection.id]: normalized }));
      } else {
        // QF source
        const res = await callQfUserApi(`/auth/v1/collections/${collection.id}/bookmarks?first=50`) as any;
        const resData = res?.data?.data ?? res?.data;
        let rawItems: any[] = [];
        if (Array.isArray(resData?.items)) rawItems = resData.items;
        else if (Array.isArray(resData?.bookmarks)) rawItems = resData.bookmarks;
        else if (Array.isArray(resData?.data)) rawItems = resData.data;
        else if (Array.isArray(resData)) rawItems = resData;

        if (rawItems.length === 0 && res?.data) {
          const d = res.data;
          if (Array.isArray(d.items)) rawItems = d.items;
          else if (Array.isArray(d.bookmarks)) rawItems = d.bookmarks;
          else if (Array.isArray(d.data?.items)) rawItems = d.data.items;
          else if (Array.isArray(d.data?.bookmarks)) rawItems = d.data.bookmarks;
        }

        const normalized: Bookmark[] = [];
        for (const raw of rawItems) {
          const id = raw.id ?? raw.verseKey ?? `${raw.key ?? raw.chapterId}:${raw.verseNumber ?? raw.ayah}`;
          const key = raw.key ?? raw.chapterId ?? raw.chapter_id ?? raw.surahId
            ?? (typeof raw.verseKey === 'string' ? parseInt(raw.verseKey.split(':')[0]) : null);
          const verseNumber = raw.verseNumber ?? raw.verse_number ?? raw.ayah
            ?? (typeof raw.verseKey === 'string' ? parseInt(raw.verseKey.split(':')[1]) : null);
          if (key != null && verseNumber != null && !isNaN(Number(key)) && !isNaN(Number(verseNumber))) {
            normalized.push({ id: String(id), key: Number(key), verseNumber: Number(verseNumber) });
          }
        }
        setBookmarksMap(prev => ({ ...prev, [collection.id]: normalized }));
      }
    } catch (err: any) {
      const message = err?.message ?? 'Failed to load bookmarks';
      setBookmarksErrorMap(prev => ({ ...prev, [collection.id]: message }));
      toast({ title: 'Failed to load bookmarks', description: message, variant: 'destructive' });
    } finally {
      setLoadingBookmarks(null);
    }
  };

  const toggleExpand = (collection: Collection) => {
    if (expandedId === collection.id) {
      setExpandedId(null);
    } else {
      setExpandedId(collection.id);
      fetchBookmarks(collection);
    }
  };

  /* ============================
   *  Delete collection
   * ============================ */

  const handleDeleteCollection = async () => {
    if (!deletingCollection) return;
    setActionLoading(true);
    try {
      if (deletingCollection.source === 'local') {
        // Delete bookmarks first, then collection
        await supabase.from('local_bookmarks').delete().eq('collection_id', deletingCollection.id);
        const { error } = await supabase.from('local_collections').delete().eq('id', deletingCollection.id);
        if (error) throw error;
      } else {
        await callQfUserApi(`/auth/v1/collections/${deletingCollection.id}`, 'DELETE');
      }
      setCollections(prev => prev.filter(c => c.id !== deletingCollection.id));
      setBookmarksMap(prev => { const n = { ...prev }; delete n[deletingCollection.id]; return n; });
      if (expandedId === deletingCollection.id) setExpandedId(null);
      toast({ title: 'Collection deleted' });
    } catch {
      toast({ title: 'Failed to delete collection', variant: 'destructive' });
    } finally {
      setActionLoading(false);
      setDeletingCollection(null);
    }
  };

  /* ============================
   *  Delete bookmark
   * ============================ */

  const handleDeleteBookmark = async () => {
    if (!deletingBookmark) return;
    const { collectionId, source, bookmark } = deletingBookmark;
    setActionLoading(true);
    try {
      if (source === 'local') {
        const { error } = await supabase.from('local_bookmarks').delete().eq('id', bookmark.id);
        if (error) throw error;
      } else {
        await callQfUserApi(`/auth/v1/collections/${collectionId}/bookmarks/${bookmark.id}`, 'DELETE');
      }
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

  /* ============================
   *  Helpers
   * ============================ */

  const groupBookmarks = (bookmarks: Bookmark[]) =>
    bookmarks.reduce<Record<number, Bookmark[]>>((acc, b) => {
      if (!acc[b.key]) acc[b.key] = [];
      acc[b.key].push(b);
      return acc;
    }, {});

  const localCollections = collections.filter(c => c.source === 'local');
  const qfCollections = collections.filter(c => c.source === 'qf');

  /* ============================
   *  Render a single collection row
   * ============================ */

  const renderCollection = (collection: Collection) => {
    const isExpanded = expandedId === collection.id;
    const collectionBookmarks = bookmarksMap[collection.id];
    const isLoadingThis = loadingBookmarks === collection.id;
    const errMsg = bookmarksErrorMap[collection.id];
    const isScopeIssue = errMsg ? /insufficient_scope|required scopes/i.test(errMsg) : false;

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
              : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
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
            ) : errMsg ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-xs text-destructive">{isScopeIssue ? 'Permission missing' : 'Failed to load verses'}</p>
                <p className="text-[11px] text-muted-foreground px-3 break-words">
                  {isScopeIssue
                    ? 'Your Quran.com session needs to be refreshed to grant bookmark access.'
                    : errMsg}
                </p>
                {isScopeIssue ? (
                  <Button variant="outline" size="sm" onClick={async () => {
                    logoutQf();
                    try { await startQfLogin(); } catch (e: any) {
                      toast({ title: 'Failed to reconnect', description: e?.message ?? String(e), variant: 'destructive' });
                    }
                  }}>Reconnect Quran.com</Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => fetchBookmarks(collection, true)}>Try Again</Button>
                )}
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
                          <span className="text-sm text-foreground">Ayah {bookmark.verseNumber}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeletingBookmark({ collectionId: collection.id, source: collection.source, bookmark })}
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
  };

  /* ============================
   *  Main render
   * ============================ */

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
              Manage your saved verses and collections
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 px-4 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : loadError ? (
              <div className="text-center py-12 space-y-3">
                <p className="text-sm text-destructive">{loadError}</p>
                <Button variant="outline" size="sm" onClick={fetchCollections}>Try Again</Button>
              </div>
            ) : collections.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">No collections found. Save verses during a memorization session to get started.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Local collections section */}
                {localCollections.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Hifdh it</p>
                    {localCollections.map(renderCollection)}
                  </div>
                )}

                {/* QF collections section */}
                {qfCollections.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Quran.com</p>
                    {qfCollections.map(renderCollection)}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Delete collection confirmation */}
      <AlertDialog open={!!deletingCollection} onOpenChange={o => { if (!o) setDeletingCollection(null); }}>
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
      <AlertDialog open={!!deletingBookmark} onOpenChange={o => { if (!o) setDeletingBookmark(null); }}>
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
