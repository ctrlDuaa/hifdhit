/**
 * Post-review summary showing updated mastery, next review, and insights.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, TrendingUp, AlertTriangle, Shield, Lightbulb, PartyPopper, Info, ArrowUpRight } from 'lucide-react';
import {
  SchedulingResult,
  getMasteryLabel,
  getMasteryColor,
  getRatingLabel,
  formatNextReview,
  WordMistake,
} from '@/lib/reviewScheduler';
import { generateBlockInsights, BlockInsight } from '@/lib/reviewInsights';

interface Props {
  surahName: string;
  startAyah: number;
  endAyah: number;
  blockId: string;
  result: SchedulingResult;
  mistakes: Map<string, WordMistake>;
  onDone: () => void;
  onReviewAgain: () => void;
}

const insightIcons = {
  warning: AlertTriangle,
  improving: ArrowUpRight,
  info: Info,
  celebrate: PartyPopper,
};

const insightColors = {
  warning: 'text-destructive',
  improving: 'text-surah-completed',
  info: 'text-primary',
  celebrate: 'text-accent',
};

export const ReviewSummary = ({
  surahName,
  startAyah,
  endAyah,
  blockId,
  result,
  mistakes,
  onDone,
  onReviewAgain,
}: Props) => {
  const ns = result.newState;
  const mistakeList = Array.from(mistakes.values());
  const [insights, setInsights] = useState<BlockInsight[]>([]);

  useEffect(() => {
    generateBlockInsights(blockId, ns.masteryStatus, ns.strengthScore, ns.needsFocusReview)
      .then(setInsights)
      .catch(() => {});
  }, [blockId]);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-md mx-auto space-y-5">
        {/* Hero */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-6 text-center">
            <Trophy className="w-10 h-10 text-accent mx-auto mb-2" />
            <h1 className="text-xl font-bold text-foreground">Review Complete</h1>
            <p className="text-sm text-muted-foreground">{surahName} — Ayah {startAyah}–{endAyah}</p>
          </div>
        </Card>

        {/* Key stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <Shield className="w-4 h-4 text-primary mx-auto mb-1" />
              <Badge className={`text-[10px] ${getMasteryColor(ns.masteryStatus)}`}>
                {getMasteryLabel(ns.masteryStatus)}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{ns.strengthScore}</p>
              <p className="text-[10px] text-muted-foreground">Strength</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Calendar className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-xs font-medium text-foreground">{formatNextReview(result.nextReviewAt)}</p>
              <p className="text-[10px] text-muted-foreground">Next Review</p>
            </CardContent>
          </Card>
        </div>

        {/* Session details */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Rating</span>
              <span className="text-sm font-medium text-foreground">{getRatingLabel(ns.lastSessionRating!)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Mistakes</span>
              <span className="text-sm font-medium text-foreground">{mistakeList.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Streak</span>
              <span className="text-sm font-medium text-foreground">{ns.currentStreak} sessions</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Interval</span>
              <span className="text-sm font-medium text-foreground">
                {ns.intervalDays === 0 ? 'Same day' : `${ns.intervalDays} day${ns.intervalDays > 1 ? 's' : ''}`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Insights */}
        {insights.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-foreground">Insights</h3>
              </div>
              <div className="space-y-3">
                {insights.map((insight, i) => {
                  const Icon = insightIcons[insight.icon];
                  return (
                    <div key={i} className="flex items-start gap-2.5">
                      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${insightColors[insight.icon]}`} />
                      <p className="text-xs text-muted-foreground leading-relaxed">{insight.text}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Focus review notice */}
        {result.enteredFocusReview && (
          <Card className="border-destructive/30">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Focus Review Activated</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This block needs extra attention. It will be prioritized in your review queue until you complete a clean session.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overrides */}
        {result.overridesApplied.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Smart adjustments applied: {result.overridesApplied.join(', ')}
          </p>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button onClick={onDone} size="lg" className="w-full">
            Done
          </Button>
          <Button onClick={onReviewAgain} variant="outline" size="lg" className="w-full">
            Review Again
          </Button>
        </div>
      </div>
    </div>
  );
};
