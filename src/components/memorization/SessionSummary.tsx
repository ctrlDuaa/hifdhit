import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Calendar, BarChart3 } from 'lucide-react';
import { MemorizationSessionState, AyahPerformance } from '@/types/memorization';
import { useMemo } from 'react';

interface Props {
  state: MemorizationSessionState;
  confidenceSummary: { easy: number; shaky: number; hard: number };
  weakPassages: AyahPerformance[];
  onFinish: () => void;
  onStartRevision: () => void;
}

function formatDuration(startISO: string, endISO: string | null): string {
  const start = new Date(startISO).getTime();
  const end = endISO ? new Date(endISO).getTime() : Date.now();
  const mins = Math.floor((end - start) / 60000);
  if (mins < 1) return 'Less than a minute';
  if (mins === 1) return '1 minute';
  return `${mins} minutes`;
}

function getBlockReviewSchedule(summary: { easy: number; shaky: number; hard: number }): number[] {
  if (summary.hard > 0) return [1, 2, 3];
  if (summary.shaky > 0) return [1, 3, 5];
  return [1, 3, 7];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface DayInfo {
  dayLabel: string;
  dateNum: number;
  isToday: boolean;
  reviewCount: number;
}

function WeekCalendarStrip({ reviewDays }: { reviewDays: number[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reviewDaySet = useMemo(() => new Set(reviewDays), [reviewDays]);

  const days = useMemo(() => {
    const result: DayInfo[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      result.push({
        dayLabel: DAY_LABELS[d.getDay()],
        dateNum: d.getDate(),
        isToday: i === 0,
        reviewCount: reviewDaySet.has(i) ? 1 : 0,
      });
    }
    return result;
  }, [reviewDaySet]);

  return (
    <div className="flex gap-2 justify-between">
      {days.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span className="text-[10px] text-muted-foreground uppercase">{d.dayLabel}</span>
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              d.reviewCount > 0
                ? 'text-white'
                : d.isToday
                  ? 'border border-border text-foreground'
                  : 'text-muted-foreground'
            }`}
            style={d.reviewCount > 0 ? { backgroundColor: '#C6A477' } : undefined}
          >
            {d.dateNum}
          </div>
          {d.isToday && <span className="text-[9px] text-muted-foreground">Today</span>}
          {!d.isToday && <span className="text-[9px] invisible">.</span>}
        </div>
      ))}
    </div>
  );
}
export const SessionSummary = ({ state, confidenceSummary, weakPassages, onFinish, onStartRevision }: Props) => {
  const totalAyahs = state.config.ayahEnd - state.config.ayahStart + 1;
  const duration = formatDuration(state.startedAt, state.completedAt);
  const reviewScheduleDays = getBlockReviewSchedule(confidenceSummary);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Hero */}
        <Card className="shadow-lg border-border/50 overflow-hidden">
          <div className="p-8 text-center" style={{ background: 'linear-gradient(90deg, #C6A477, #DFCEBF)' }}>
            <h1 className="text-2xl font-bold text-white">Session Complete!</h1>
            <p className="text-white/80 mt-1">{state.config.surahName} — Ayah {state.config.ayahStart === state.config.ayahEnd ? state.config.ayahStart : `${state.config.ayahStart}–${state.config.ayahEnd}`}</p>
          </div>
        </Card>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-2xl font-bold text-foreground">{totalAyahs}</p>
              <p className="text-xs text-muted-foreground">Ayat Memorized</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-2xl font-bold text-foreground">{duration}</p>
              <p className="text-xs text-muted-foreground">Time Spent</p>
            </CardContent>
          </Card>
        </div>

        {/* Confidence breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> Confidence Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-4 rounded-xl bg-surah-completed/20">
                <p className="text-2xl font-bold text-foreground">{confidenceSummary.easy}</p>
                <p className="text-xs text-muted-foreground">😊 Easy</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-accent/20">
                <p className="text-2xl font-bold text-foreground">{confidenceSummary.shaky}</p>
                <p className="text-xs text-muted-foreground">🤔 Shaky</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-mistake/20">
                <p className="text-2xl font-bold text-foreground">{confidenceSummary.hard}</p>
                <p className="text-xs text-muted-foreground">😓 Hard</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weak passages */}
        {weakPassages.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-accent" /> Weak Passages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {weakPassages.map(p => (
                  <div key={p.ayahNumber} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <span className="text-sm text-foreground">Ayah {p.ayahNumber}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.confidenceRating === 'hard' ? 'destructive' : 'secondary'} className="text-xs">
                        {p.confidenceRating}
                      </Badge>
                      {p.markedWeak && <Badge variant="outline" className="text-xs">📌 Marked</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Review schedule - 7 day calendar strip showing ALL blocks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" /> Review Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This block's upcoming reviews
            </p>
            <WeekCalendarStrip reviewDays={reviewScheduleDays} />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button onClick={onFinish} size="lg" className="w-full text-white" style={{ backgroundColor: '#C6A477' }}>
            Finish Session
          </Button>
          <Button onClick={onStartRevision} variant="outline" size="lg" className="w-full">
            Start Revision
          </Button>
        </div>
      </div>
    </div>
  );
};