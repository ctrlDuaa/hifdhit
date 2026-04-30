/**
 * Dialog to save verses to a Quran.com collection.
 * Supports selecting an existing collection or creating a new one.
 */

import { useState, useEffect } from 'react';
import { callQfUserApi, isQfSessionValid } from '@/services/qfAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus, BookmarkPlus, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Collection {
  id: string;
  name: string;
}

interface Props {
  /** The verses to save — { surahId, ayah } pairs */
  verses: { surahId: number; ayah: number }[];
  /** CTA label shown on the trigger */
  ctaText: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SaveToCollectionDialog = ({ verses, ctaText, open, onOpenChange }: Props) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isConnected = isQfSessionValid();

  const fetchCollections = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await callQfUserApi('/auth/v1/collections?first=20&type=ayah') as any;
      const innerData = res?.data;
      const items: Collection[] = Array.isArray(innerData?.data)
        ? innerData.data
        : Array.isArray(innerData) ? innerData : [];
      setCollections(items.filter(c => !!c?.id));
      if (items.length > 0 && !selectedId) {
        setSelectedId(items[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && isConnected) {
      setSaved(false);
      fetchCollections();
    }
  }, [open]);

  const extractUpstreamError = (res: any): string | null => {
    const status = res?.upstreamStatus;
    if (status && status >= 400) {
      const body = res?.data;
      const msg = body?.message || body?.error || body?.details?.error || (typeof body === 'string' ? body : JSON.stringify(body));
      return `HTTP ${status}: ${msg}`;
    }
    return null;
  };

  const handleCreateCollection = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      // QF Collections API: only `name` is allowed on create. Type is set per-bookmark on add.
      const res = await callQfUserApi('/auth/v1/collections', 'POST', {
        name: newName.trim(),
      }) as any;

      const upstreamErr = extractUpstreamError(res);
      if (upstreamErr) throw new Error(upstreamErr);

      // QF wraps the created object in various shapes — try them all.
      const created =
        res?.data?.data?.collection ??
        res?.data?.collection ??
        res?.data?.data ??
        res?.data;

      if (!created?.id) {
        throw new Error(`Collection created but no id returned. Response: ${JSON.stringify(res?.data)?.slice(0, 200)}`);
      }

      const normalized: Collection = { id: String(created.id), name: created.name ?? newName.trim() };
      setCollections(prev => [normalized, ...prev]);
      setSelectedId(normalized.id);
      setShowCreate(false);
      setNewName('');
      toast({ title: 'Collection created', description: `"${normalized.name}" is ready.` });
    } catch (err) {
      toast({
        title: 'Failed to create collection',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedId || verses.length === 0) return;
    setSaving(true);
    try {
      for (const v of verses) {
        const res = await callQfUserApi(`/auth/v1/collections/${selectedId}/bookmarks`, 'POST', {
          key: v.surahId,
          type: 'ayah',
          verseNumber: v.ayah,
          mushaf: 1,
        }) as any;
        const upstreamErr = extractUpstreamError(res);
        if (upstreamErr) throw new Error(upstreamErr);
      }
      setSaved(true);
      toast({
        title: 'Saved!',
        description: `${verses.length} ${verses.length === 1 ? 'verse' : 'verses'} added to your collection.`,
      });
    } catch (err) {
      toast({ title: 'Failed to save', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!isConnected) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save to Collection</DialogTitle>
          <DialogDescription>
            {ctaText}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="py-4 space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchCollections}>Try Again</Button>
          </div>
        ) : saved ? (
          <div className="py-8 text-center space-y-3">
            <Check className="w-10 h-10 text-surah-completed mx-auto" />
            <p className="text-sm font-medium text-foreground">
              {verses.length} {verses.length === 1 ? 'verse' : 'verses'} saved successfully!
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Collection list */}
            <ScrollArea className="max-h-48 rounded-md border border-border/50">
              <div className="p-2 space-y-1">
                {collections.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      selectedId === c.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
                {collections.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">No collections yet — create one below.</p>
                )}
              </div>
            </ScrollArea>

            {/* Create new */}
            {showCreate ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Collection name..."
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateCollection()}
                  autoFocus
                />
                <Button onClick={handleCreateCollection} disabled={saving || !newName.trim()} size="sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4 mr-1" /> New Collection
              </Button>
            )}

            {/* Save button */}
            <Button
              onClick={handleSave}
              disabled={saving || !selectedId}
              className="w-full gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BookmarkPlus className="w-4 h-4" />
              )}
              Save {verses.length} {verses.length === 1 ? 'verse' : 'verses'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
