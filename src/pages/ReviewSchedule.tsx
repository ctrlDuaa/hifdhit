import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek, formatDistanceToNow, isPast } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppHeader } from '@/components/AppHeader';
import { useMemorizationBlocks, MemorizationBlock } from '@/hooks/useMemorizationBlocks';
import { useSurahList } from '@/hooks/useQuranData';
import { getMasteryLabel, getMasteryColor } from '@/lib/reviewScheduler';
import { getBlockProjectedDateKeys, getCurrentProjectedReviewDate } from '@/lib/memorizationReviewTimeline';
import { ChevronLeft, ChevronRight, CalendarDays, Play, ArrowLeft, Clock, Shield, BookOpen } from 'lucide-react';

const ReviewSchedule = () => {
  const navigate = useNavigate();
  const { blocks, loading } = useMemorizationBlocks();
  const { data: chapters } = useSurahList();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const blocksByDate = useMemo(() => {
    const map = new Map<string, MemorizationBlock[]>();
    for (const block of blocks) {
      for (const dateKey of getBlockProjectedDateKeys(block)) {
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey)!.push(block);
      }
    }
    return map;
  }, [blocks]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const selectedBlocks = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, 'yyyy-MM-dd');
    return blocksByDate.get(key) || [];
  }, [selectedDate, blocksByDate]);

  const overdueBlocks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return blocks.filter(b => {
      const firstScheduled = getBlockProjectedDateKeys(b)[0];
      if (!firstScheduled) return true;
      return new Date(firstScheduled) < today;
    });
  }, [blocks]);

  const getBlockCountForDay = (day: Date): number => {
    const key = format(day, 'yyyy-MM-dd');
    return blocksByDate.get(key)?.length || 0;
  };

  const getSurahName = (surahId: number) => {
    return chapters?.find(c => c.id === surahId)?.name_simple || `Surah ${surahId}`;
  };

  const getReviewStatus = (block: MemorizationBlock) => {
    const reviewDate = getCurrentProjectedReviewDate(block);
    if (!reviewDate) return { label: 'No review scheduled', color: 'text-muted-foreground' };
    const now = new Date();
    if (isPast(reviewDate)) {
      return { label: `Overdue by ${formatDistanceToNow(reviewDate)}`, color: 'text-destructive' };
    }
    if (isToday(reviewDate)) {
      return { label: 'Due today', color: 'text-gold' };
    }
    return { label: `Due ${formatDistanceToNow(reviewDate, { addSuffix: true })}`, color: 'text-muted-foreground' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Review Schedule</h2>
              <p className="text-sm text-muted-foreground">{blocks.length} blocks tracked</p>
            </div>
          </div>
        </div>

        {overdueBlocks.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                  {overdueBlocks.length} overdue {overdueBlocks.length === 1 ? 'block' : 'blocks'}
                </span>
              </div>
              <Button size="sm" variant="destructive" onClick={() => navigate('/review')}>
                <Play className="w-3 h-3 mr-1" /> Review Now
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="w-5 h-5" />
                  {format(currentMonth, 'MMMM yyyy')}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  const count = getBlockCountForDay(day);
                  const inMonth = isSameMonth(day, currentMonth);
                  const selected = selectedDate && isSameDay(day, selectedDate);
                  const today = isToday(day);
                  const hasReviews = count > 0 && inMonth;

                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        relative flex flex-col items-center justify-center p-2 rounded-lg border text-sm transition-colors min-h-[3.5rem]
                        ${!inMonth ? 'text-muted-foreground/30' : 'text-foreground'}
                        ${selected ? 'border-gold/50 bg-gold/20 ring-1 ring-gold/30' : hasReviews ? 'border-gold/25 bg-gold/10 hover:bg-gold/15' : 'border-transparent hover:bg-muted/50'}
                        ${today && !selected && !hasReviews ? 'bg-primary/10 font-bold' : ''}
                      `}
                    >
                      <span className={today ? 'text-primary' : ''}>{format(day, 'd')}</span>
                      {hasReviews && (
                        <span className="mt-0.5 text-[10px] font-semibold text-gold">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {selectedDate ? (isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEE, MMM d')) : 'Select a date'}
              </CardTitle>
              {selectedDate && (
                <p className="text-xs text-muted-foreground">
                  {selectedBlocks.length} {selectedBlocks.length === 1 ? 'block' : 'blocks'} scheduled
                </p>
              )}
            </CardHeader>
            <CardContent>
              {selectedBlocks.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {selectedBlocks.map(b => (
                    <div key={`${b.id}-${selectedDate ? format(selectedDate, 'yyyy-MM-dd') : 'none'}`} className="p-3 rounded-lg bg-muted/50 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{getSurahName(b.surah_id)}</p>
                        <Badge className={`text-[9px] px-1.5 py-0 ${getMasteryColor(b.mastery_status as any)}`}>
                          {getMasteryLabel(b.mastery_status as any)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Ayah {b.start_ayah === b.end_ayah ? b.start_ayah : `${b.start_ayah}–${b.end_ayah}`}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Strength: {b.strength_score}
                        </span>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => navigate(`/review?blockId=${b.id}`)}>
                          <Play className="w-2.5 h-2.5 mr-1" /> Review
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedDate ? (
                <div className="text-center py-8">
                  <CalendarDays className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No reviews scheduled</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Upcoming 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, i) => {
                const day = new Date();
                day.setDate(day.getDate() + i);
                const count = getBlockCountForDay(day);
                return (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedDate(day);
                      setCurrentMonth(day);
                    }}
                    className={`text-center p-3 rounded-lg border transition-colors ${count > 0 ? 'border-gold/25 bg-gold/10 hover:bg-gold/15' : 'border-transparent bg-muted/30 hover:bg-muted/60'}`}
                  >
                    <p className="text-[10px] text-muted-foreground">{format(day, 'EEE')}</p>
                    <p className="text-xs font-medium">{format(day, 'd')}</p>
                    <p className={`text-lg font-bold mt-1 ${count > 0 ? 'text-gold' : 'text-muted-foreground/30'}`}>{count}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default ReviewSchedule;
