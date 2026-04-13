/**
 * Dashboard "Needs Attention" card showing blocks that need urgent review.
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMemorizationBlocks } from '@/hooks/useMemorizationBlocks';
import { useSurahList } from '@/hooks/useQuranData';
import { getMasteryLabel, getMasteryColor, formatNextReview } from '@/lib/reviewScheduler';
import { AlertTriangle, Play, Shield, BookOpen } from 'lucide-react';

export const NeedsAttentionCard = () => {
  const navigate = useNavigate();
  const { blocks, needsAttention, dueToday, focusReviewBlocks, loading } = useMemorizationBlocks();
  const { data: chapters } = useSurahList();

  if (loading || blocks.length === 0) return null;

  return (
    <Card className="bg-[#fbf6ed] dark:bg-[#2a363b]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Review Queue
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/review')} className="text-xs">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 rounded-lg bg-background/50">
            <p className="text-lg font-bold text-foreground">{dueToday.length}</p>
            <p className="text-[10px] text-muted-foreground">Due Today</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-background/50">
            <p className="text-lg font-bold text-foreground">{focusReviewBlocks.length}</p>
            <p className="text-[10px] text-muted-foreground">Focus</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-background/50">
            <p className="text-lg font-bold text-foreground">{blocks.length}</p>
            <p className="text-[10px] text-muted-foreground">Blocks</p>
          </div>
        </div>

        {/* Attention items */}
        {needsAttention.length > 0 ? (
          <div className="space-y-2">
            {needsAttention.slice(0, 3).map(b => {
              const surah = chapters?.find(c => c.id === b.surah_id);
              return (
                <div key={b.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">
                      {surah?.name_simple || `Surah ${b.surah_id}`} {b.start_ayah === b.end_ayah ? `Ayah ${b.start_ayah}` : `${b.start_ayah}–${b.end_ayah}`}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge className={`text-[9px] px-1.5 py-0 ${getMasteryColor(b.mastery_status as any)}`}>
                        {getMasteryLabel(b.mastery_status as any)}
                      </Badge>
                      {b.needs_focus_review && (
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Focus</Badge>
                      )}
                      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5" />{b.strength_score}
                      </span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs ml-2"
                    onClick={() => navigate(`/review?blockId=${b.id}`)}>
                    <Play className="w-3 h-3 mr-1" /> Review
                  </Button>
                </div>
              );
            })}
            {needsAttention.length > 3 && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">
                +{needsAttention.length - 3} more need attention
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-3">
            <BookOpen className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">All blocks up to date</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
