/**
 * Dialog to save verses to a local Supabase collection (local_collections / local_bookmarks).
 * Supports selecting an existing collection or creating a new one.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  verses: { surahId: number; ayah: number }[];
  ctaText: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SaveToCollectionDialog = ({ verses, ctaText, open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await (supabase as any)
        .from('local_collections')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (err) throw err;
      const items = (data ?? []).map((c: any) => ({ id: c.id, name: c.name }));
      setCollections(items);
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
    if (open && user) {
      setSaved(false);
      fetchCollections();
    }
  }, [open, user]);

  const handleCreateCollection = async () => {
    if (!newName.trim() || !user) return;
    setSaving(true);
    try {
      const { data, error: err } = await (supabase as any)
        .from('local_collections')
        .insert({ name: newName.trim(), user_id: user.id })
        .select('id, name')
        .single();
      if (err) throw err;
      const normalized: Collection = { id: data.id, name: data.name };
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
    if (!selectedId || verses.length === 0 || !user) return;
    setSaving(true);
    try {
      const rows = verses.map(v => ({
        collection_id: selectedId,
        user_id: user.id,
        surah_id: v.surahId,
        ayah_number: v.ayah,
      }));
      const { error: err } = await supabase.from('local_bookmarks').insert(rows);
      if (err) throw err;
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

  if (!user) return null;

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
