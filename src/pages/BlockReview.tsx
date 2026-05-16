/**
 * Block Review Page — orchestrates the full review flow:
 * Setup → Word Marking → Rating → Summary
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBlockReview, BlockInfo } from '@/hooks/useBlockReview';
import { useMemorizationBlocks } from '@/hooks/useMemorizationBlocks';
import { useSurahList } from '@/hooks/useQuranData';
import { BlockReviewMarking } from '@/components/review/BlockReviewMarking';
import { SessionRatingScreen } from '@/components/review/SessionRatingScreen';
import { ReviewSummary } from '@/components/review/ReviewSummary';
import { getMasteryLabel, getMasteryColor, formatNextReview, SessionRating } from '@/lib/reviewScheduler';
import { getQuickInsight } from '@/lib/reviewInsights';
import { getBlockProjectedReviewDates, getCurrentProjectedReviewDate } from '@/lib/memorizationReviewTimeline';
import { AppHeader } from '@/components/AppHeader';
import { StartSessionDialog } from '@/components/StartSessionDialog';
import { JoinSessionDialog } from '@/components/JoinSessionDialog';
import { Plus, Play, Trash2, AlertTriangle, Shield, Calendar, Lightbulb, ChevronLeft, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const BlockReviewPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: chapters } = useSurahList();
  const { blocks, loading: blocksLoading, dueToday, focusReviewBlocks, needsAttention, createBlock, deleteBlock, refetch } = useMemorizationBlocks();
  const review = useBlockReview();

  // Create block form
  const [showCreate, setShowCreate] = useState(false);
  const [newSurah, setNewSurah] = useState('');
  const [newStart, setNewStart] = useState('1');
  const [newEnd, setNewEnd] = useState('5');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Auto-start review if blockId in URL
  useEffect(() => {
    const blockId = searchParams.get('blockId');
    if (blockId && blocks.length > 0 && review.phase === 'idle') {
      const block = blocks.find(b => b.id === blockId);
      if (block) {
        const surah = chapters?.find(c => c.id === block.surah_id);
        handleStartReview({
          id: block.id,
          surahId: block.surah_id,
          surahName: surah?.name_simple || `Surah ${block.surah_id}`,
          startAyah: block.start_ayah,
          endAyah: block.end_ayah,
        });
      }
    }
  }, [searchParams, blocks, review.phase]);

  const handleCreateBlock = async () => {
    if (!newSurah) return;
    try {
      await createBlock.mutateAsync({
        surahId: parseInt(newSurah),
        startAyah: parseInt(newStart),
        endAyah: parseInt(newEnd),
      });
      setShowCreate(false);
      setNewSurah('');
      setNewStart('1');
      setNewEnd('5');
      toast({ title: 'Block created', description: 'Your memorization block has been added.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to create block.', variant: 'destructive' });
    }
  };

  const handleStartReview = async (blockInfo: BlockInfo) => {
    try {
      await review.startReview(blockInfo);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load verses for review.', variant: 'destructive' });
    }
  };

  const handleRate = async (rating: SessionRating) => {
    setSubmittingRating(true);
    try {
      await review.submitRating(rating);
      refetch();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save review.', variant: 'destructive' });
    } finally {
      setSubmittingRating(false);
    }
  };

  // ── Review phase rendering ──
  if (review.phase === 'reviewing' && review.block) {
    return (
      <>
        <AppHeader />
        <BlockReviewMarking
          verses={review.verses}
          getMistakeForWord={review.getMistakeForWord}
          onToggleMistake={review.toggleMistake}
          onRemoveMistake={review.removeMistake}
          onFinishMarking={review.goToRating}
          surahName={review.block.surahName}
          surahId={review.block.surahId}
          startAyah={review.block.startAyah}
          endAyah={review.block.endAyah}
        />
      </>
    );
  }

  if (review.phase === 'rating' && review.block) {
    return (
      <>
        <AppHeader />
        <SessionRatingScreen
          surahName={review.block.surahName}
          mistakes={review.mistakes}
          verses={review.verses}
          onRate={handleRate}
          onBack={() => review.goBackToMarking()}
          submitting={submittingRating}
        />
      </>
    );
  }

  if (review.phase === 'summary' && review.block && review.schedulingResult) {
    return (
      <>
        <AppHeader />
        <ReviewSummary
          surahName={review.block.surahName}
          startAyah={review.block.startAyah}
          endAyah={review.block.endAyah}
          blockId={review.block.id}
          result={review.schedulingResult}
          mistakes={review.mistakes}
          onDone={() => { review.resetReview(); navigate('/dashboard', { state: { refreshStats: true } }); }}
          onReviewAgain={() => {
            const b = review.block!;
            review.resetReview();
            handleStartReview(b);
          }}
        />
      </>
    );
  }

  // ── Block list / setup ──
  const selectedSurah = chapters?.find(c => c.id === parseInt(newSurah));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 space-y-6 max-w-2xl">
        <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2 mb-2" onClick={() => navigate('/dashboard')}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Block Review</h1>
            <p className="text-sm text-muted-foreground">Mistake-aware review with adaptive scheduling</p>
          </div>
          <Button onClick={() => setShowCreate(true)} size="sm" className="bg-[#C6A477] hover:bg-[#b8956a] text-white">
            <Plus className="w-4 h-4 mr-1" /> Add Block
          </Button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{dueToday.length}</p>
              <p className="text-xs text-muted-foreground">Due Today</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{blocks.length}</p>
              <p className="text-xs text-muted-foreground">Total Blocks</p>
            </CardContent>
          </Card>
        </div>

        {/* Create block form */}
        {showCreate && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Create New Block</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">Surah</Label>
                <Select value={newSurah} onValueChange={v => { setNewSurah(v); setNewStart('1'); setNewEnd('5'); }}>
                  <SelectTrigger><SelectValue placeholder="Select surah" /></SelectTrigger>
                  <SelectContent>
                    {chapters?.map(ch => (
                      <SelectItem key={ch.id} value={String(ch.id)}>
                        {ch.id}. {ch.name_simple}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Start Ayah</Label>
                  <Input type="number" min="1" max={selectedSurah?.verses_count || 286} value={newStart} onChange={e => setNewStart(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">End Ayah</Label>
                  <Input type="number" min="1" max={selectedSurah?.verses_count || 286} value={newEnd} onChange={e => setNewEnd(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateBlock} disabled={!newSurah || createBlock.isPending} className="flex-1">
                  {createBlock.isPending ? 'Creating...' : 'Create Block'}
                </Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Needs Attention */}
        {needsAttention.length > 0 && (
          <Card className="border-destructive/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {needsAttention.slice(0, 5).map(b => {
                const surah = chapters?.find(c => c.id === b.surah_id);
                return (
                  <div key={b.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {surah?.name_simple || `Surah ${b.surah_id}`} {b.start_ayah === b.end_ayah ? `Ayah ${b.start_ayah}` : `${b.start_ayah}–${b.end_ayah}`}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className={`text-[10px] ${getMasteryColor(b.mastery_status as any)}`}>
                          {getMasteryLabel(b.mastery_status as any)}
                        </Badge>
                        {b.needs_focus_review && <Badge variant="destructive" className="text-[10px]">Focus</Badge>}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => {
                      handleStartReview({
                        id: b.id,
                        surahId: b.surah_id,
                        surahName: surah?.name_simple || `Surah ${b.surah_id}`,
                        startAyah: b.start_ayah,
                        endAyah: b.end_ayah,
                      });
                    }}>
                      <Play className="w-3 h-3 mr-1" /> Review
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Live revision with a friend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-[#C6A477]" />
              Revising with a friend?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 [&>*]:w-full [&_button]:w-full">
              <StartSessionDialog />
              <JoinSessionDialog />
            </div>
          </CardContent>
        </Card>

        {/* All blocks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">All Blocks</CardTitle>
          </CardHeader>
          <CardContent>
            {blocksLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
            {!blocksLoading && blocks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No blocks yet. Create one to start reviewing.</p>
            )}
            <div className="space-y-3">
              {blocks.map(b => {
                const surah = chapters?.find(c => c.id === b.surah_id);
                const now = new Date();
                const isDue = getBlockProjectedReviewDates(b).some(d => d <= now);
                const quickInsight = getQuickInsight(b as any);
                return (
                  <div key={b.id} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {surah?.name_simple || `Surah ${b.surah_id}`} {b.start_ayah === b.end_ayah ? `Ayah ${b.start_ayah}` : `${b.start_ayah}–${b.end_ayah}`}
                        </p>
                        {isDue && <Badge className="text-[10px] bg-accent/20 text-accent-foreground">Due</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className={`text-[10px] ${getMasteryColor(b.mastery_status as any)}`}>
                          {getMasteryLabel(b.mastery_status as any)}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Shield className="w-3 h-3" /> {b.strength_score}
                        </span>
                        {getCurrentProjectedReviewDate(b) && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {formatNextReview(getCurrentProjectedReviewDate(b)!)}
                          </span>
                        )}
                        {b.needs_focus_review && <Badge variant="destructive" className="text-[10px]">Focus</Badge>}
                      </div>
                      {quickInsight && (
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Lightbulb className="w-2.5 h-2.5 text-accent" /> {quickInsight}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button size="sm" variant={isDue ? 'default' : 'outline'} onClick={() => {
                        handleStartReview({
                          id: b.id,
                          surahId: b.surah_id,
                          surahName: surah?.name_simple || `Surah ${b.surah_id}`,
                          startAyah: b.start_ayah,
                          endAyah: b.end_ayah,
                        });
                      }}>
                        <Play className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => {
                        if (confirm('Delete this revision session?')) deleteBlock.mutate(b.id);
                      }}>
                        <Trash2 className="w-3 h-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default BlockReviewPage;
