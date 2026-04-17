import { useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMemorizationBlocks } from '@/hooks/useMemorizationBlocks';
import { useSurahList } from '@/hooks/useQuranData';
import { Sparkles, Play, Pause, RotateCcw } from 'lucide-react';
import { MemorizationSessionState, MemorizationSessionConfig } from '@/types/memorization';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const STORAGE_KEY = 'memorization_session';
const VERSES_KEY = 'memorization_verses';

function getSavedSession(): { config: MemorizationSessionConfig; currentAyah: number; completedAyahs: number; totalAyahs: number } | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const s: MemorizationSessionState = JSON.parse(saved);
    if (s.phase === 'summary') return null;
    const chunk = s.chunks[s.currentChunkIndex];
    const currentAyah = chunk ? chunk.ayahStart + s.currentAyahInChunk : s.config.ayahStart;
    const completedAyahs = Object.values(s.ayahPerformance).filter(p => p.confidenceRating !== null).length;
    const totalAyahs = s.config.ayahEnd - s.config.ayahStart + 1;
    return { config: s.config, currentAyah, completedAyahs, totalAyahs };
  } catch { return null; }
}

export const ContinueMemorizationCard = () => {
  const navigate = useNavigate();
  const { blocks, loading } = useMemorizationBlocks();
  const { data: chapters } = useSurahList();
  const [showResumeDialog, setShowResumeDialog] = useState(false);

  const savedSession = useMemo(() => getSavedSession(), []);

  const isSurahFullyMemorized = useCallback((surahId: number) => {
    const ch = chapters?.find(c => c.id === surahId);
    if (!ch) return false;
    const surahBlocks = blocks.filter(b => b.surah_id === surahId);
    const memorizedAyahs = new Set<number>();
    for (const block of surahBlocks) {
      for (let ayah = block.start_ayah; ayah <= block.end_ayah; ayah++) {
        memorizedAyahs.add(ayah);
      }
    }
    return memorizedAyahs.size >= (ch.verses_count || 999);
  }, [blocks, chapters]);

  const activeBlock = useMemo(() => {
    if (blocks.length === 0) return null;
    const sorted = [...blocks].sort((a, b) => {
      const aDate = a.last_reviewed_at || a.created_at;
      const bDate = b.last_reviewed_at || b.created_at;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
    return sorted.find(b => !isSurahFullyMemorized(b.surah_id)) || null;
  }, [blocks, isSurahFullyMemorized]);

  const surah = activeBlock ? chapters?.find(c => c.id === activeBlock.surah_id) : null;

  const { progressPercent, memorizedCount } = useMemo(() => {
    if (!activeBlock || !surah) return { progressPercent: 0, memorizedCount: 0 };
    const surahBlocks = blocks.filter(b => b.surah_id === activeBlock.surah_id);
    const memorizedAyahs = new Set<number>();
    for (const block of surahBlocks) {
      for (let ayah = block.start_ayah; ayah <= block.end_ayah; ayah++) {
        memorizedAyahs.add(ayah);
      }
    }
    return {
      progressPercent: Math.min(100, Math.round((memorizedAyahs.size / (surah.verses_count || 1)) * 100)),
      memorizedCount: memorizedAyahs.size,
    };
  }, [activeBlock, surah, blocks]);

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  const getNextAyahStart = () => {
    if (!activeBlock || !surah) return 1;
    const surahBlocks = blocks.filter(b => b.surah_id === activeBlock.surah_id);
    const maxEndAyah = Math.max(...surahBlocks.map(b => b.end_ayah));
    const nextAyah = maxEndAyah + 1;
    return nextAyah > (surah.verses_count || 999) ? 1 : nextAyah;
  };

  const handleResume = () => {
    setShowResumeDialog(false);
    navigate('/memorize'); // Memorization page will detect saved session and resume
  };

  const handleStartNew = () => {
    setShowResumeDialog(false);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(VERSES_KEY);
    if (activeBlock) {
      navigate('/memorize', {
        state: { surahId: activeBlock.surah_id, nextAyahStart: getNextAyahStart() },
      });
    } else {
      navigate('/memorize');
    }
  };

  if (loading) return null;

  // ── Paused session takes priority ────────────────────────────
  if (savedSession) {
    const pausedProgressPercent = savedSession.totalAyahs > 0
      ? Math.round((savedSession.completedAyahs / savedSession.totalAyahs) * 100)
      : 0;
    const pausedStrokeDashoffset = circumference - (pausedProgressPercent / 100) * circumference;
    const pausedSurah = chapters?.find(c => c.id === savedSession.config.surahId);
    const pausedEnglishName = pausedSurah?.translated_name?.name || pausedSurah?.name_simple;

    return (
      <>
        <Card className="bg-[#2a363b] col-span-1 md:col-span-2">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-5">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r={radius} fill="none" stroke="hsl(var(--muted) / 0.3)" strokeWidth="4" />
                  <circle
                    cx="32" cy="32" r={radius} fill="none"
                    stroke="hsl(var(--gold))"
                    strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={pausedStrokeDashoffset}
                    className="transition-all duration-500"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center">
                  <Pause className="w-5 h-5 text-gold" />
                </span>
              </div>

              <div>
                <p className="text-xs text-[#C6A477] uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                  Paused Session
                </p>
                <h3 className="text-lg font-semibold text-[#fbf6ed]">
                  {savedSession.config.surahName}
                  {pausedEnglishName && pausedEnglishName !== savedSession.config.surahName && (
                    <span className="text-stone-400 font-normal text-base ml-2">({pausedEnglishName})</span>
                  )}
                </h3>
                <p className="text-sm text-stone-400">
                  Ayah {savedSession.currentAyah}
                  <span className="mx-2">·</span>
                  {savedSession.completedAyahs}/{savedSession.totalAyahs} ayat done
                </p>
              </div>
            </div>

            <Button onClick={() => setShowResumeDialog(true)} className="gap-2 bg-gold text-gold-foreground hover:bg-gold/90">
              <Play className="w-4 h-4" />
              Resume
            </Button>
          </CardContent>
        </Card>

        <Dialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl">Resume Session?</DialogTitle>
              <DialogDescription>
                You have an unfinished memorization session.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-muted/50 p-4 space-y-1.5 my-2">
              <p className="font-semibold text-foreground">{savedSession.config.surahName}</p>
              <p className="text-sm text-muted-foreground">
                Ayat {savedSession.config.ayahStart}–{savedSession.config.ayahEnd}
              </p>
              <p className="text-sm text-muted-foreground">
                Progress: {savedSession.completedAyahs}/{savedSession.totalAyahs} ayat completed · Currently on Ayah {savedSession.currentAyah}
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <Button onClick={handleResume} className="w-full gap-2 bg-[#C6A477] hover:bg-[#b8956a] text-white">
                <Play className="w-4 h-4" />
                Resume Session
              </Button>
              <Button onClick={handleStartNew} variant="outline" className="w-full gap-2">
                <RotateCcw className="w-4 h-4" />
                Start New Session
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ── No active block — fresh start ───────────────────────────
  if (!activeBlock) {
    return (
      <Card className="bg-[#2a363b] col-span-1 md:col-span-2">
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r={radius} fill="none" stroke="hsl(var(--gold) / 0.3)" strokeWidth="4" />
                <circle cx="32" cy="32" r={radius} fill="none" stroke="hsl(var(--gold))" strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={0} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-gold" />
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#fbf6ed]">Start Memorizing</h3>
              <p className="text-sm text-stone-300">Keep going—Allah sees your effort.</p>
            </div>
          </div>
          <Button onClick={() => navigate('/memorize')} className="gap-2 bg-gold text-gold-foreground hover:bg-gold/90">
            <Play className="w-4 h-4" /> Start
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Active surah in progress — continue next block ──────────
  const nextAyah = getNextAyahStart();

  const handleContinue = () => {
    navigate('/memorize', {
      state: { surahId: activeBlock.surah_id, nextAyahStart: nextAyah },
    });
  };

  return (
    <Card className="bg-[#2a363b] col-span-1 md:col-span-2">
      <CardContent className="flex items-center justify-between p-6">
        <div className="flex items-center gap-5">
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r={radius} fill="none" stroke="hsl(var(--muted) / 0.3)" strokeWidth="4" />
              <circle
                cx="32" cy="32" r={radius} fill="none"
                stroke="hsl(var(--gold))" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gold">
              {progressPercent}%
            </span>
          </div>

          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wider mb-0.5">Continue Memorizing</p>
            <h3 className="text-lg font-semibold text-[#fbf6ed]">
              {surah?.name_simple || `Surah ${activeBlock.surah_id}`}
            </h3>
            <p className="text-sm text-stone-400">
              Next: Ayah {nextAyah}
              <span className="mx-2">·</span>
              {memorizedCount} ayat memorized
            </p>
          </div>
        </div>

        <Button onClick={handleContinue} className="gap-2 bg-gold text-gold-foreground hover:bg-gold/90">
          <Play className="w-4 h-4" /> Continue
        </Button>
      </CardContent>
    </Card>
  );
};
