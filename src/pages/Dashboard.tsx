import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NeedsAttentionCard } from '@/components/dashboard/NeedsAttentionCard';
import { ContinueMemorizationCard } from '@/components/dashboard/ContinueMemorizationCard';
import { UsernameSetup } from '@/components/UsernameSetup';
import { StartSessionDialog } from '@/components/StartSessionDialog';
import { JoinSessionDialog } from '@/components/JoinSessionDialog';
import { WeeklyMistakesCard } from '@/components/WeeklyMistakesCard';
import { useAuth } from '@/hooks/useAuth';
import { useSurahList } from '@/hooks/useQuranData';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, BarChart3, GraduationCap, ClipboardCheck, Play, Calendar } from 'lucide-react';
import { useMemorizationBlocks } from '@/hooks/useMemorizationBlocks';
import { useSurahList as useSurahListForReview } from '@/hooks/useQuranData';
import { getMasteryLabel, getMasteryColor } from '@/lib/reviewScheduler';
import { AppHeader } from '@/components/AppHeader';

interface UserProgress {
  totalAyahs: number;
  revisedAyahs: number;
  needsReviewAyahs: number;
  percentage: number;
  revisedJuz: number;
}
interface SurahProgress {
  [surahNumber: number]: 'pending' | 'progress' | 'revised';
}

const ReviewCard = ({ navigate }: { navigate: (path: string) => void }) => {
  const { dueToday, blocks } = useMemorizationBlocks();
  const { data: chapters } = useSurahListForReview();

  return (
    <Card className="bg-[#2a363b] row-span-2 flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-[#fbf6ed]">Review</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#C6A477' }}>Due Today</p>
          {dueToday.length > 0 ? (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
              {dueToday.map(b => {
                const surah = chapters?.find(c => c.id === b.surah_id);
                return (
                  <div key={b.id} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-background/10 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[#fbf6ed] truncate">
                        {surah?.name_simple || `Surah ${b.surah_id}`}
                      </p>
                      <p className="text-[10px] text-stone-400">
                        Ayah {b.start_ayah === b.end_ayah ? b.start_ayah : `${b.start_ayah}–${b.end_ayah}`}
                      </p>
                    </div>
                    <Badge className={`text-[9px] px-1.5 py-0 ml-2 ${getMasteryColor(b.mastery_status as any)}`}>
                      {getMasteryLabel(b.mastery_status as any)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-stone-400">No blocks due today</p>
              <p className="text-[10px] text-stone-500 mt-1">
                {blocks.length > 0 ? "You're all caught up!" : 'Complete a memorization session to start'}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2 mt-4">
          <Button size="lg" className="w-full bg-gold text-gold-foreground hover:bg-gold/90" onClick={() => navigate('/review')}>
            <Play className="w-4 h-4 mr-2" />
            Start Review
          </Button>
          <Button size="lg" className="w-full bg-[#fbf6ed] text-slate-800 hover:bg-[#fbf6ed]/90" variant="outline" onClick={() => navigate('/review-schedule')}>
            <Calendar className="w-4 h-4 mr-2" />
            Review Schedule
          </Button>
        </div>

        {/* Preserved for future use */}
        {false && (
          <div className="space-y-2">
            <StartSessionDialog />
            <JoinSessionDialog />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const {
    user,
    signOut,
    loading: authLoading
  } = useAuth();
  const { data: chaptersData } = useSurahList();
  // Adapt chapters to the shape Dashboard expects
  const surahs = (chaptersData || []).map(ch => ({
    number: ch.id,
    name: ch.name_arabic,
    englishName: ch.name_simple,
    numberOfAyahs: ch.verses_count,
    startPage: 0,
    endPage: 0,
  }));
  const navigate = useNavigate();
  const location = useLocation();
  const [progress, setProgress] = useState<UserProgress>({
    totalAyahs: 6236,
    // Total ayahs in Quran
    revisedAyahs: 0,
    needsReviewAyahs: 0,
    percentage: 0,
    revisedJuz: 0
  });
  const [surahProgress, setSurahProgress] = useState<SurahProgress>({});
  const [surahStats, setSurahStats] = useState<{
    [key: number]: {
      revised: number;
      total: number;
    };
  }>({});
  const [surahMistakes, setSurahMistakes] = useState<{
    [key: number]: number;
  }>({});
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showUsernameSetup, setShowUsernameSetup] = useState(false);


  // Juz to ayah ranges mapping - each juz contains specific ayah ranges from various surahs
  const juzAyahRanges = [
  // Juz 1
  [{
    surah: 1,
    startAyah: 1,
    endAyah: 7
  }, {
    surah: 2,
    startAyah: 1,
    endAyah: 141
  }],
  // Juz 2
  [{
    surah: 2,
    startAyah: 142,
    endAyah: 252
  }],
  // Juz 3
  [{
    surah: 2,
    startAyah: 253,
    endAyah: 286
  }, {
    surah: 3,
    startAyah: 1,
    endAyah: 92
  }],
  // Juz 4
  [{
    surah: 3,
    startAyah: 93,
    endAyah: 200
  }, {
    surah: 4,
    startAyah: 1,
    endAyah: 23
  }],
  // Juz 5
  [{
    surah: 4,
    startAyah: 24,
    endAyah: 147
  }],
  // Juz 6
  [{
    surah: 4,
    startAyah: 148,
    endAyah: 176
  }, {
    surah: 5,
    startAyah: 1,
    endAyah: 81
  }],
  // Juz 7
  [{
    surah: 5,
    startAyah: 82,
    endAyah: 120
  }, {
    surah: 6,
    startAyah: 1,
    endAyah: 110
  }],
  // Juz 8
  [{
    surah: 6,
    startAyah: 111,
    endAyah: 165
  }, {
    surah: 7,
    startAyah: 1,
    endAyah: 87
  }],
  // Juz 9
  [{
    surah: 7,
    startAyah: 88,
    endAyah: 206
  }, {
    surah: 8,
    startAyah: 1,
    endAyah: 40
  }],
  // Juz 10
  [{
    surah: 8,
    startAyah: 41,
    endAyah: 75
  }, {
    surah: 9,
    startAyah: 1,
    endAyah: 92
  }],
  // Juz 11
  [{
    surah: 9,
    startAyah: 93,
    endAyah: 129
  }, {
    surah: 10,
    startAyah: 1,
    endAyah: 109
  }, {
    surah: 11,
    startAyah: 1,
    endAyah: 5
  }],
  // Juz 12
  [{
    surah: 11,
    startAyah: 6,
    endAyah: 123
  }, {
    surah: 12,
    startAyah: 1,
    endAyah: 52
  }],
  // Juz 13
  [{
    surah: 12,
    startAyah: 53,
    endAyah: 111
  }, {
    surah: 13,
    startAyah: 1,
    endAyah: 43
  }, {
    surah: 14,
    startAyah: 1,
    endAyah: 52
  }],
  // Juz 14
  [{
    surah: 15,
    startAyah: 1,
    endAyah: 99
  }, {
    surah: 16,
    startAyah: 1,
    endAyah: 128
  }, {
    surah: 17,
    startAyah: 1,
    endAyah: 1
  }],
  // Juz 15
  [{
    surah: 17,
    startAyah: 2,
    endAyah: 111
  }, {
    surah: 18,
    startAyah: 1,
    endAyah: 74
  }],
  // Juz 16
  [{
    surah: 18,
    startAyah: 75,
    endAyah: 110
  }, {
    surah: 19,
    startAyah: 1,
    endAyah: 98
  }, {
    surah: 20,
    startAyah: 1,
    endAyah: 135
  }],
  // Juz 17
  [{
    surah: 21,
    startAyah: 1,
    endAyah: 112
  }, {
    surah: 22,
    startAyah: 1,
    endAyah: 78
  }],
  // Juz 18
  [{
    surah: 23,
    startAyah: 1,
    endAyah: 118
  }, {
    surah: 24,
    startAyah: 1,
    endAyah: 64
  }, {
    surah: 25,
    startAyah: 1,
    endAyah: 20
  }],
  // Juz 19
  [{
    surah: 25,
    startAyah: 21,
    endAyah: 77
  }, {
    surah: 26,
    startAyah: 1,
    endAyah: 227
  }, {
    surah: 27,
    startAyah: 1,
    endAyah: 55
  }],
  // Juz 20
  [{
    surah: 27,
    startAyah: 56,
    endAyah: 93
  }, {
    surah: 28,
    startAyah: 1,
    endAyah: 88
  }, {
    surah: 29,
    startAyah: 1,
    endAyah: 45
  }],
  // Juz 21
  [{
    surah: 29,
    startAyah: 46,
    endAyah: 69
  }, {
    surah: 30,
    startAyah: 1,
    endAyah: 60
  }, {
    surah: 31,
    startAyah: 1,
    endAyah: 34
  }, {
    surah: 32,
    startAyah: 1,
    endAyah: 30
  }, {
    surah: 33,
    startAyah: 1,
    endAyah: 30
  }],
  // Juz 22
  [{
    surah: 33,
    startAyah: 31,
    endAyah: 73
  }, {
    surah: 34,
    startAyah: 1,
    endAyah: 54
  }, {
    surah: 35,
    startAyah: 1,
    endAyah: 45
  }, {
    surah: 36,
    startAyah: 1,
    endAyah: 27
  }],
  // Juz 23
  [{
    surah: 36,
    startAyah: 28,
    endAyah: 83
  }, {
    surah: 37,
    startAyah: 1,
    endAyah: 182
  }, {
    surah: 38,
    startAyah: 1,
    endAyah: 88
  }, {
    surah: 39,
    startAyah: 1,
    endAyah: 31
  }],
  // Juz 24
  [{
    surah: 39,
    startAyah: 32,
    endAyah: 75
  }, {
    surah: 40,
    startAyah: 1,
    endAyah: 85
  }, {
    surah: 41,
    startAyah: 1,
    endAyah: 46
  }],
  // Juz 25
  [{
    surah: 41,
    startAyah: 47,
    endAyah: 54
  }, {
    surah: 42,
    startAyah: 1,
    endAyah: 53
  }, {
    surah: 43,
    startAyah: 1,
    endAyah: 89
  }, {
    surah: 44,
    startAyah: 1,
    endAyah: 59
  }, {
    surah: 45,
    startAyah: 1,
    endAyah: 37
  }],
  // Juz 26
  [{
    surah: 46,
    startAyah: 1,
    endAyah: 35
  }, {
    surah: 47,
    startAyah: 1,
    endAyah: 38
  }, {
    surah: 48,
    startAyah: 1,
    endAyah: 29
  }, {
    surah: 49,
    startAyah: 1,
    endAyah: 18
  }, {
    surah: 50,
    startAyah: 1,
    endAyah: 45
  }, {
    surah: 51,
    startAyah: 1,
    endAyah: 30
  }],
  // Juz 27
  [{
    surah: 51,
    startAyah: 31,
    endAyah: 60
  }, {
    surah: 52,
    startAyah: 1,
    endAyah: 49
  }, {
    surah: 53,
    startAyah: 1,
    endAyah: 62
  }, {
    surah: 54,
    startAyah: 1,
    endAyah: 55
  }, {
    surah: 55,
    startAyah: 1,
    endAyah: 78
  }, {
    surah: 56,
    startAyah: 1,
    endAyah: 96
  }, {
    surah: 57,
    startAyah: 1,
    endAyah: 29
  }],
  // Juz 28
  [{
    surah: 58,
    startAyah: 1,
    endAyah: 22
  }, {
    surah: 59,
    startAyah: 1,
    endAyah: 24
  }, {
    surah: 60,
    startAyah: 1,
    endAyah: 13
  }, {
    surah: 61,
    startAyah: 1,
    endAyah: 14
  }, {
    surah: 62,
    startAyah: 1,
    endAyah: 11
  }, {
    surah: 63,
    startAyah: 1,
    endAyah: 11
  }, {
    surah: 64,
    startAyah: 1,
    endAyah: 18
  }, {
    surah: 65,
    startAyah: 1,
    endAyah: 12
  }, {
    surah: 66,
    startAyah: 1,
    endAyah: 12
  }],
  // Juz 29
  [{
    surah: 67,
    startAyah: 1,
    endAyah: 30
  }, {
    surah: 68,
    startAyah: 1,
    endAyah: 52
  }, {
    surah: 69,
    startAyah: 1,
    endAyah: 52
  }, {
    surah: 70,
    startAyah: 1,
    endAyah: 44
  }, {
    surah: 71,
    startAyah: 1,
    endAyah: 28
  }, {
    surah: 72,
    startAyah: 1,
    endAyah: 28
  }, {
    surah: 73,
    startAyah: 1,
    endAyah: 20
  }, {
    surah: 74,
    startAyah: 1,
    endAyah: 56
  }, {
    surah: 75,
    startAyah: 1,
    endAyah: 40
  }, {
    surah: 76,
    startAyah: 1,
    endAyah: 31
  }, {
    surah: 77,
    startAyah: 1,
    endAyah: 50
  }],
  // Juz 30
  [{
    surah: 78,
    startAyah: 1,
    endAyah: 40
  }, {
    surah: 79,
    startAyah: 1,
    endAyah: 46
  }, {
    surah: 80,
    startAyah: 1,
    endAyah: 42
  }, {
    surah: 81,
    startAyah: 1,
    endAyah: 29
  }, {
    surah: 82,
    startAyah: 1,
    endAyah: 19
  }, {
    surah: 83,
    startAyah: 1,
    endAyah: 36
  }, {
    surah: 84,
    startAyah: 1,
    endAyah: 25
  }, {
    surah: 85,
    startAyah: 1,
    endAyah: 22
  }, {
    surah: 86,
    startAyah: 1,
    endAyah: 17
  }, {
    surah: 87,
    startAyah: 1,
    endAyah: 19
  }, {
    surah: 88,
    startAyah: 1,
    endAyah: 26
  }, {
    surah: 89,
    startAyah: 1,
    endAyah: 30
  }, {
    surah: 90,
    startAyah: 1,
    endAyah: 20
  }, {
    surah: 91,
    startAyah: 1,
    endAyah: 15
  }, {
    surah: 92,
    startAyah: 1,
    endAyah: 21
  }, {
    surah: 93,
    startAyah: 1,
    endAyah: 11
  }, {
    surah: 94,
    startAyah: 1,
    endAyah: 8
  }, {
    surah: 95,
    startAyah: 1,
    endAyah: 8
  }, {
    surah: 96,
    startAyah: 1,
    endAyah: 19
  }, {
    surah: 97,
    startAyah: 1,
    endAyah: 5
  }, {
    surah: 98,
    startAyah: 1,
    endAyah: 8
  }, {
    surah: 99,
    startAyah: 1,
    endAyah: 8
  }, {
    surah: 100,
    startAyah: 1,
    endAyah: 11
  }, {
    surah: 101,
    startAyah: 1,
    endAyah: 11
  }, {
    surah: 102,
    startAyah: 1,
    endAyah: 8
  }, {
    surah: 103,
    startAyah: 1,
    endAyah: 3
  }, {
    surah: 104,
    startAyah: 1,
    endAyah: 9
  }, {
    surah: 105,
    startAyah: 1,
    endAyah: 5
  }, {
    surah: 106,
    startAyah: 1,
    endAyah: 4
  }, {
    surah: 107,
    startAyah: 1,
    endAyah: 7
  }, {
    surah: 108,
    startAyah: 1,
    endAyah: 3
  }, {
    surah: 109,
    startAyah: 1,
    endAyah: 6
  }, {
    surah: 110,
    startAyah: 1,
    endAyah: 3
  }, {
    surah: 111,
    startAyah: 1,
    endAyah: 5
  }, {
    surah: 112,
    startAyah: 1,
    endAyah: 4
  }, {
    surah: 113,
    startAyah: 1,
    endAyah: 5
  }, {
    surah: 114,
    startAyah: 1,
    endAyah: 6
  }]];

  // Calculate different progress totals
  const getProgressStats = () => {
    const revisedSurahs = Object.values(surahProgress).filter(status => status === 'revised').length;
    return {
      ayat: {
        current: progress.revisedAyahs,
        total: progress.totalAyahs,
        percentage: progress.percentage
      },
      surahs: {
        current: revisedSurahs,
        total: 114,
        percentage: revisedSurahs / 114 * 100
      },
      juz: {
        current: progress.revisedJuz || 0,
        total: 30,
        percentage: (progress.revisedJuz || 0) / 30 * 100
      }
    };
  };
  useEffect(() => {
    if (user && surahs.length > 0) {
      loadUserProgress();
      loadUserProfile();
      loadUserMistakes();
    }
  }, [user, surahs]);

  // Handle refresh when returning from a session
  useEffect(() => {
    const state = location.state as { refreshStats?: boolean } | null;
    if (state?.refreshStats && user && surahs.length > 0) {
      console.log('🔄 Dashboard refresh requested from session exit');
      loadUserProgress();
      loadUserMistakes();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, user, surahs]);

  // Real-time subscription for progress and mistakes changes
  useEffect(() => {
    if (!user || surahs.length === 0) return;

    const progressChannel = supabase
      .channel(`dashboard-progress-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'progress',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        console.log('📊 Progress change detected — refreshing dashboard');
        loadUserProgress();
      })
      .subscribe();

    const mistakesChannel = supabase
      .channel(`dashboard-mistakes-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mistakes',
        filter: `reciter_id=eq.${user.id}`,
      }, () => {
        console.log('📊 Mistakes change detected — refreshing dashboard');
        loadUserMistakes();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'block_review_mistakes',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        console.log('📊 Block review mistakes change detected — refreshing dashboard');
        loadUserMistakes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(progressChannel);
      supabase.removeChannel(mistakesChannel);
    };
  }, [user, surahs]);
  const loadUserProfile = async () => {
    if (!user) return;
    try {
      const {
        data,
        error
      } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      if (error) throw error;
      setUserProfile(data);

      // Show username setup if user doesn't have a username
      if (!data?.username) {
        setShowUsernameSetup(true);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };
  const loadUserProgress = async () => {
    // Guard: Don't process if surahs data hasn't loaded yet
    if (surahs.length === 0) {
      console.log('⏳ Waiting for Quran data to load...');
      return;
    }
    try {
      // Fetch all progress rows - paginate to avoid the 1000-row default limit
      let allData: { surah_number: number; ayah_number: number; status: string }[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: page, error } = await supabase
          .from('progress')
          .select('surah_number, ayah_number, status')
          .eq('user_id', user?.id)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!page || page.length === 0) break;
        allData = allData.concat(page);
        if (page.length < pageSize) break;
        from += pageSize;
      }
      const data = allData;

      // Build surah-specific progress map
      const surahProgressMap: SurahProgress = {};

      // Track which specific ayahs are revised for each surah
      const surahAyahsRevised: {
        [key: number]: Set<number>;
      } = {};
      const surahStats: {
        [key: number]: {
          revised: number;
          total: number;
        };
      } = {};
      data?.forEach(p => {
        if (!surahAyahsRevised[p.surah_number]) {
          surahAyahsRevised[p.surah_number] = new Set();
        }
        if (!surahStats[p.surah_number]) {
          surahStats[p.surah_number] = {
            revised: 0,
            total: 0
          };
        }
        surahStats[p.surah_number].total++;
        if (p.status === 'revised') {
          surahAyahsRevised[p.surah_number].add(p.ayah_number);
          surahStats[p.surah_number].revised++;
        }
      });

      // Get total ayahs per surah from API
      const surahAyahCounts: {
        [key: number]: number;
      } = {};
      surahs.forEach(surah => {
        surahAyahCounts[surah.number] = surah.numberOfAyahs;
      });

      // Determine status for each surah
      Object.entries(surahStats).forEach(([surahNum, stats]) => {
        const surahNumber = parseInt(surahNum);
        const totalAyahsInSurah = surahAyahCounts[surahNumber] || 0;
        const revisedAyahs = surahAyahsRevised[surahNumber] || new Set();

        // A surah is 'revised' only if ALL its ayahs (1 to totalAyahsInSurah) are revised
        let allAyahsRevised = true;
        for (let ayahNum = 1; ayahNum <= totalAyahsInSurah; ayahNum++) {
          if (!revisedAyahs.has(ayahNum)) {
            allAyahsRevised = false;
            break;
          }
        }
        console.log(`Surah ${surahNumber}: ${stats.revised}/${totalAyahsInSurah} revised, allAyahsRevised=${allAyahsRevised}`);
        if (allAyahsRevised && totalAyahsInSurah > 0) {
          surahProgressMap[surahNumber] = 'revised';
          console.log(`✓ Surah ${surahNumber} marked as REVISED`);
        } else if (stats.revised > 0 || stats.total > 0) {
          // At least some ayahs are tracked, so it's in progress
          surahProgressMap[surahNumber] = 'progress';
          console.log(`→ Surah ${surahNumber} marked as IN PROGRESS`);
        }
      });
      setSurahProgress(surahProgressMap);
      setSurahStats(surahStats);

      // Build a map of all revised ayahs by surah and ayah number
      const revisedAyahsMap: {
        [key: string]: boolean;
      } = {};
      data?.forEach(p => {
        if (p.status === 'revised') {
          const key = `${p.surah_number}-${p.ayah_number}`;
          revisedAyahsMap[key] = true;
        }
      });

      // Calculate revised Juz based on ayah completion
      let revisedJuzCount = 0;
      juzAyahRanges.forEach(juzRanges => {
        let allAyahsRevised = true;

        // Check if all ayahs in this juz are revised
        for (const range of juzRanges) {
          for (let ayahNum = range.startAyah; ayahNum <= range.endAyah; ayahNum++) {
            const key = `${range.surah}-${ayahNum}`;
            if (!revisedAyahsMap[key]) {
              allAyahsRevised = false;
              break;
            }
          }
          if (!allAyahsRevised) break;
        }
        if (allAyahsRevised) {
          revisedJuzCount++;
        }
      });
      const revisedCount = data?.filter(p => p.status === 'revised').length || 0;
      const needsReviewCount = data?.filter(p => p.status === 'needsReview').length || 0;
      const percentage = revisedCount / 6236 * 100;
      setProgress({
        totalAyahs: 6236,
        revisedAyahs: revisedCount,
        needsReviewAyahs: needsReviewCount,
        percentage,
        revisedJuz: revisedJuzCount
      });
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setLoadingProgress(false);
    }
  };
  const loadUserMistakes = async () => {
    if (!user) return;
    try {
      // Load from mistakes table
      const { data: mistakesData, error: err1 } = await supabase
        .from('mistakes')
        .select('surah_number')
        .eq('reciter_id', user.id);
      
      // Load from block_review_mistakes table
      const { data: blockData, error: err2 } = await supabase
        .from('block_review_mistakes')
        .select('surah_id')
        .eq('user_id', user.id);

      if (err1) throw err1;
      
      // Count mistakes per surah from both sources
      const mistakeCount: { [key: number]: number } = {};
      mistakesData?.forEach(mistake => {
        mistakeCount[mistake.surah_number] = (mistakeCount[mistake.surah_number] || 0) + 1;
      });
      if (!err2 && blockData) {
        blockData.forEach(bm => {
          mistakeCount[bm.surah_id] = (mistakeCount[bm.surah_id] || 0) + 1;
        });
      }
      
      setSurahMistakes(mistakeCount);
    } catch (error) {
      console.error('Error loading mistakes:', error);
    }
  };

  const loadActiveRooms = async () => {
    // This function is no longer needed - we use invite system now
  };
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>;
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  const getSurahStatus = (surahNumber: number) => {
    return surahProgress[surahNumber] || 'pending';
  };
  const getSurahProgressPercentage = (surahNumber: number) => {
    const surah = surahs.find(s => s.number === surahNumber);
    if (!surah) return 0;
    const stats = surahStats[surahNumber];
    if (!stats || !stats.revised) return 0;
    return stats.revised / surah.numberOfAyahs * 100;
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'revised':
        return 'bg-surah-completed';
      case 'progress':
        return 'bg-surah-progress';
      case 'pending':
        return 'bg-surah-pending';
      default:
        return 'bg-surah-pending';
    }
  };
  return <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 space-y-8 bg-background">
        {/* Greeting Section */}
        <div className="text-center md:text-left">
          <h2 className="text-2xl font-semibold mb-2 text-foreground">
            As-Salāmu 'Alaykum, {userProfile?.username || 'Brother/Sister'}!
          </h2>
          <p className="text-muted-foreground">Welcome back to your hifdh.</p>
        </div>



        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ContinueMemorizationCard />
          <ReviewCard navigate={navigate} />
          <Card className="bg-[#2a363b]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#fbf6ed]">Total Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="ayat" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-3">
                  <TabsTrigger value="ayat" className="text-xs dark:data-[state=active]:text-black">Ayat</TabsTrigger>
                  <TabsTrigger value="surahs" className="text-xs dark:data-[state=active]:text-black">Surahs</TabsTrigger>
                  <TabsTrigger value="juz" className="text-xs dark:data-[state=active]:text-black">Ajzā'</TabsTrigger>
                </TabsList>
                
                <TabsContent value="ayat" className="mt-0">
                  <div className="text-2xl font-bold" style={{
                  color: '#C6A477'
                }}>
                    {getProgressStats().ayat.current}/{getProgressStats().ayat.total}
                  </div>
                  <p className="text-xs text-stone-300">
                    {getProgressStats().ayat.percentage.toFixed(1)}% completed
                  </p>
                  <Progress value={getProgressStats().ayat.percentage} className="mt-2" indicatorColor="#C6A477" />
                </TabsContent>
                
                <TabsContent value="surahs" className="mt-0">
                  <div className="text-2xl font-bold" style={{
                  color: '#C6A477'
                }}>
                    {getProgressStats().surahs.current}/{getProgressStats().surahs.total}
                  </div>
                  <p className="text-xs text-stone-300">
                    {getProgressStats().surahs.percentage.toFixed(1)}% completed
                  </p>
                  <Progress value={getProgressStats().surahs.percentage} className="mt-2" indicatorColor="#C6A477" />
                </TabsContent>
                
                <TabsContent value="juz" className="mt-0">
                  <div className="text-2xl font-bold" style={{
                  color: '#C6A477'
                }}>
                    {getProgressStats().juz.current}/{getProgressStats().juz.total}
                  </div>
                  <p className="text-xs text-stone-300">
                    {getProgressStats().juz.percentage.toFixed(1)}% completed
                  </p>
                  <Progress value={getProgressStats().juz.percentage} className="mt-2" indicatorColor="#C6A477" />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <WeeklyMistakesCard />
        </div>

        {/* Review Queue removed - now handled by dedicated Review page */}

        {/* Surah Grid */}
        <Card className="bg-[#fbf6ed] dark:bg-[#2a363b]">
          <CardHeader>
            <CardTitle className="text-foreground">Quran Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {Array.from({
              length: 114
            }, (_, i) => i + 1).map(surahNumber => {
              const status = getSurahStatus(surahNumber);
              const surah = surahs.find(s => s.number === surahNumber);
              const surahName = surah?.englishName || `Surah ${surahNumber}`;
              const progressPercentage = getSurahProgressPercentage(surahNumber);
              const stats = surahStats[surahNumber];
              const mistakeCount = surahMistakes[surahNumber] || 0;
              return <div key={surahNumber} className={`px-3 py-2 rounded flex flex-col items-center justify-center text-xs font-medium cursor-pointer hover:opacity-80 transition-all hover:scale-105 ${getStatusColor(status)} ${status !== 'pending' ? 'dark:text-black' : ''} min-h-[3.5rem] relative`} title={`${surahName} (${surahNumber}) - ${stats?.revised || 0}/${surah?.numberOfAyahs || 0} ayat${mistakeCount > 0 ? ` - ${mistakeCount} mistakes` : ''} - Click to read`} onClick={() => navigate(`/surah/${surahNumber}`)}>
                    {mistakeCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[8px] rounded-full"
                      >
                        {mistakeCount > 99 ? '99+' : mistakeCount}
                      </Badge>
                    )}
                    <span className="text-center truncate mb-1">{surahName}</span>
                    {status === 'progress' && stats && surah && <div className="w-full">
                        <Progress 
                          value={progressPercentage} 
                          className="h-1 bg-background/30"
                          indicatorColor="#C6A477"
                        />
                        <span className="text-[10px] opacity-80 mt-0.5">
                          {stats.revised}/{surah.numberOfAyahs}
                        </span>
                      </div>}
                    {status === 'revised' && <span className="text-[10px] opacity-80">✓ Complete</span>}
                  </div>;
            })}
            </div>
            <div className="flex gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-surah-completed rounded"></div>
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-surah-progress rounded"></div>
                <span>In Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-surah-pending rounded"></div>
                <span>Not Started</span>
              </div>
            </div>
          </CardContent>
        </Card>

      </main>

      {/* Username Setup Modal */}
      <UsernameSetup isOpen={showUsernameSetup} onComplete={() => {
      setShowUsernameSetup(false);
      loadUserProfile();
    }} />
    </div>;
};
export default Dashboard;