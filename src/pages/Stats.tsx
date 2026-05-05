import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/runtimeClient';
import { useAuth } from '@/hooks/useAuth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Calendar, RefreshCw, Download } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatInTimezone } from '@/utils/timezoneMapping';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
interface HeatmapDay {
  date: string;
  count: number;
  displayDate: Date | null;
  month: number;
  day: number;
  isEmpty: boolean;
}
interface MonthlyMistakes {
  month: string;
  tajweed: number;
  missed: number;
  harakah: number;
}
interface SurahRange {
  surahNumber: number;
  surahName: string;
  startingAyah: number;
  endingAyah: number;
}
interface RecentSession {
  id: string;
  date: string;
  time?: string;
  surahRanges: SurahRange[];
  mistakes: number;
  role: string;
}

interface SurahRating {
  surah_number: number;
  rating: 'weak' | 'moderate' | 'strong';
}
const surahNames = ['Al-Fatihah', 'Al-Baqarah', 'Ali \'Imran', 'An-Nisa', 'Al-Ma\'idah', 'Al-An\'am', 'Al-A\'raf', 'Al-Anfal', 'At-Tawbah', 'Yunus', 'Hud', 'Yusuf', 'Ar-Ra\'d', 'Ibrahim', 'Al-Hijr', 'An-Nahl', 'Al-Isra', 'Al-Kahf', 'Maryam', 'Ta-Ha', 'Al-Anbya', 'Al-Hajj', 'Al-Mu\'minun', 'An-Nur', 'Al-Furqan', 'Ash-Shu\'ara', 'An-Naml', 'Al-Qasas', 'Al-\'Ankabut', 'Ar-Rum', 'Luqman', 'As-Sajdah', 'Al-Ahzab', 'Saba', 'Fatir', 'Ya-Sin', 'As-Saffat', 'Sad', 'Az-Zumar', 'Ghafir', 'Fussilat', 'Ash-Shuraa', 'Az-Zukhruf', 'Ad-Dukhan', 'Al-Jathiyah', 'Al-Ahqaf', 'Muhammad', 'Al-Fath', 'Al-Hujurat', 'Qaf', 'Adh-Dhariyat', 'At-Tur', 'An-Najm', 'Al-Qamar', 'Ar-Rahman', 'Al-Waqi\'ah', 'Al-Hadid', 'Al-Mujadila', 'Al-Hashr', 'Al-Mumtahanah', 'As-Saf', 'Al-Jumu\'ah', 'Al-Munafiqun', 'At-Taghabun', 'At-Talaq', 'At-Tahrim', 'Al-Mulk', 'Al-Qalam', 'Al-Haqqah', 'Al-Ma\'arij', 'Nuh', 'Al-Jinn', 'Al-Muzzammil', 'Al-Muddaththir', 'Al-Qiyamah', 'Al-Insan', 'Al-Mursalat', 'An-Naba', 'An-Nazi\'at', 'Abasa', '\'At-Takwir', 'Al-Infitar', 'Al-Mutaffifin', 'Al-Inshiqaq', 'Al-Buruj', 'At-Tariq', 'Al-A\'la', 'Al-Ghashiyah', 'Al-Fajr', 'Al-Balad', 'Ash-Shams', 'Al-Layl', 'Ad-Duhaa', 'Ash-Sharh', 'At-Tin', 'Al-\'Alaq', 'Al-Qadr', 'Al-Bayyinah', 'Az-Zalzalah', 'Al-\'Adiyat', 'Al-Qari\'ah', 'At-Takathur', 'Al-\'Asr', 'Al-Humazah', 'Al-Fil', 'Quraysh', 'Al-Ma\'un', 'Al-Kawthar', 'Al-Kafirun', 'An-Nasr', 'Al-Masad', 'Al-Ikhlas', 'Al-Falaq', 'An-Nas'];
export const Stats = () => {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme } = useTheme();
  const [heatmapData, setHeatmapData] = useState<HeatmapDay[]>([]);
  const [monthlyMistakes, setMonthlyMistakes] = useState<MonthlyMistakes[]>([]);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revisionStartDate, setRevisionStartDate] = useState<Date | null>(null);
  const [daysSinceStart, setDaysSinceStart] = useState(0);
  const [surahRatings, setSurahRatings] = useState<SurahRating[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [userTimezone, setUserTimezone] = useState<string>('UTC');
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);
  const [heatmapYear, setHeatmapYear] = useState<number>(new Date().getFullYear());
  const [mistakesYear, setMistakesYear] = useState<number>(new Date().getFullYear());
  
  // Check for refresh state from navigation
  useEffect(() => {
    const state = location.state as { refreshStats?: boolean } | null;
    if (state?.refreshStats && user) {
      console.log('🔄 Stats page refresh requested from session');
      loadRecentSessions();
      // Clear the state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, user]);
  useEffect(() => {
    if (user) {
      loadUserTimezone();
      loadRevisionStartDate();
      loadSurahRatings();
    }
  }, [user]);

  // Load timezone-dependent data after timezone is loaded
  useEffect(() => {
    if (user && userTimezone) {
      loadAvailableYears();
      loadRecentSessions();
    }
  }, [user, userTimezone]);

  // Load heatmap data when year changes
  useEffect(() => {
    if (user && userTimezone) {
      loadHeatmapData(heatmapYear);
    }
  }, [user, userTimezone, heatmapYear]);

  // Load mistakes data when year changes
  useEffect(() => {
    if (user && userTimezone) {
      loadMonthlyMistakes(mistakesYear);
    }
  }, [user, userTimezone, mistakesYear]);
  useEffect(() => {
    if (!user) return;

    // Subscribe to ALL session changes and filter client-side
    const sessionChannel = supabase.channel('session-updates').on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'private_sessions'
    }, (payload) => {
      console.log('📝 Session table updated:', payload.new);
      loadRecentSessions();
    }).subscribe();

    // Subscribe to session activity changes
    const activityChannel = supabase.channel('activity-updates').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'session_activity',
      filter: `user_id=eq.${user.id}`
    }, () => {
      console.log('Session activity change detected - reloading recent sessions');
      loadRecentSessions();
    }).subscribe();

    // Subscribe to progress changes (when surah blocks update)
    const progressChannel = supabase.channel('progress-updates').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'progress',
      filter: `user_id=eq.${user.id}`
    }, (payload) => {
      console.log('📊 Progress table change detected:', payload.eventType);
      loadRecentSessions();
    }).subscribe();

    return () => {
      sessionChannel.unsubscribe();
      activityChannel.unsubscribe();
      progressChannel.unsubscribe();
    };
  }, [user]);
  const loadUserTimezone = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('user_id', user?.id)
        .single();
      
      if (data?.timezone) {
        setUserTimezone(data.timezone);
        console.log('📍 User timezone loaded:', data.timezone);
      }
    } catch (error) {
      console.error('Error loading user timezone:', error);
    }
  };

  const loadRevisionStartDate = async () => {
    try {
      const {
        data
      } = await supabase.from('progress').select('created_at').eq('user_id', user?.id).order('created_at', {
        ascending: true
      }).limit(1);
      if (data && data.length > 0) {
        const startDate = new Date(data[0].created_at);
        setRevisionStartDate(startDate);

        // Calculate days since start
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setDaysSinceStart(diffDays);
      }
    } catch (error) {
      console.error('Error loading revision start date:', error);
    }
  };
  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all your revision data? This action cannot be undone.')) {
      return;
    }
    try {
      // Delete all user data comprehensively
      await Promise.all([
        supabase.from('block_review_mistakes').delete().eq('user_id', user?.id),
        supabase.from('block_word_stats').delete().eq('user_id', user?.id),
        supabase.from('block_ayah_stats').delete().eq('user_id', user?.id),
        supabase.from('block_reviews').delete().eq('user_id', user?.id),
        supabase.from('memorization_blocks').delete().eq('user_id', user?.id),
        supabase.from('progress').delete().eq('user_id', user?.id),
        supabase.from('mistakes').delete().eq('reciter_id', user?.id),
        supabase.from('session_participants').delete().eq('user_id', user?.id),
        supabase.from('private_sessions').delete().eq('created_by', user?.id),
        supabase.from('session_activity').delete().eq('user_id', user?.id),
        supabase.from('surah_ratings').delete().eq('user_id', user?.id),
      ]);
      toast.success('All revision data has been reset');

      // Reload all data
      setRevisionStartDate(null);
      setDaysSinceStart(0);
      setHeatmapData([]);
      setMonthlyMistakes([]);
      setRecentSessions([]);
      loadHeatmapData(heatmapYear);
      loadMonthlyMistakes(mistakesYear);
      loadRecentSessions();
    } catch (error) {
      console.error('Error resetting data:', error);
      toast.error('Failed to reset data');
    }
  };
  const loadAvailableYears = async () => {
    try {
      // Get earliest session activity date
      const { data: activityData } = await supabase
        .from('session_activity')
        .select('completed_at')
        .eq('user_id', user?.id)
        .order('completed_at', { ascending: true })
        .limit(1);

      // Get earliest mistakes date
      const { data: mistakesData } = await supabase
        .from('mistakes')
        .select('created_at')
        .eq('reciter_id', user?.id)
        .order('created_at', { ascending: true })
        .limit(1);

      const currentYear = new Date().getFullYear();
      const years = new Set<number>([currentYear]);

      if (activityData && activityData.length > 0) {
        const earliestActivityYear = new Date(activityData[0].completed_at).getFullYear();
        for (let year = earliestActivityYear; year <= currentYear; year++) {
          years.add(year);
        }
      }

      if (mistakesData && mistakesData.length > 0) {
        const earliestMistakesYear = new Date(mistakesData[0].created_at).getFullYear();
        for (let year = earliestMistakesYear; year <= currentYear; year++) {
          years.add(year);
        }
      }

      const sortedYears = Array.from(years).sort((a, b) => b - a);
      setAvailableYears(sortedYears);
    } catch (error) {
      console.error('Error loading available years:', error);
    }
  };

  const loadHeatmapData = async (year: number) => {
    try {
      // Load session activity for the selected year (tracks total verses revised per session)
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59);
      const {
        data: activityData
      } = await supabase.from('session_activity').select('completed_at, ayat_revised').eq('user_id', user?.id).gte('completed_at', startOfYear.toISOString()).lte('completed_at', endOfYear.toISOString());

      // Group by date using user's timezone, summing ayat_revised
      const dateMap: {
        [key: string]: number;
      } = {};
      activityData?.forEach(item => {
        // Convert UTC timestamp to user's timezone for date grouping
        const dateInTimezone = formatInTimezone(item.completed_at, userTimezone, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        // Parse the formatted date to get consistent YYYY-MM-DD format
        const [month, day, yearStr] = dateInTimezone.split('/');
        const dateStr = `${yearStr}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        dateMap[dateStr] = (dateMap[dateStr] || 0) + (item.ayat_revised || 0);
      });

      // Create array of all days for 12 months x 31 days grid
      const heatmap: HeatmapDay[] = [];

      // Create data for each month (Jan to Dec of selected year)
      for (let month = 0; month < 12; month++) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Add actual days in the month
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const date = new Date(year, month, day);
          heatmap.push({
            date: dateStr,
            count: dateMap[dateStr] || 0,
            displayDate: date,
            month: month,
            day: day,
            isEmpty: false
          });
        }

        // Pad with empty cells to reach 31 columns
        for (let day = daysInMonth + 1; day <= 31; day++) {
          heatmap.push({
            date: '',
            count: 0,
            displayDate: null,
            month: month,
            day: day,
            isEmpty: true
          });
        }
      }
      setHeatmapData(heatmap);
    } catch (error) {
      console.error('Error loading heatmap data:', error);
    } finally {
      setLoading(false);
    }
  };
  const loadMonthlyMistakes = async (year: number) => {
    try {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59);
      const {
        data: mistakesData
      } = await supabase.from('mistakes').select('created_at, mistake_category').eq('reciter_id', user?.id).gte('created_at', startOfYear.toISOString()).lte('created_at', endOfYear.toISOString());

      // Group by month and category
      const monthlyData: {
        [key: string]: {
          tajweed: number;
          missed: number;
          harakah: number;
          incorrect: number;
        };
      } = {};
      mistakesData?.forEach(mistake => {
        const month = new Date(mistake.created_at).getMonth();
        const monthName = monthNames[month];
        if (!monthlyData[monthName]) {
          monthlyData[monthName] = {
            tajweed: 0,
            missed: 0,
            harakah: 0,
            incorrect: 0
          };
        }
        const category = mistake.mistake_category?.toLowerCase() || 'other';
        if (category === 'tajweed' || category === 'missed' || category === 'harakah' || category === 'incorrect') {
          monthlyData[monthName][category]++;
        }
      });

      // Convert to array format for chart
      const chartData = monthNames.map(month => ({
        month,
        tajweed: monthlyData[month]?.tajweed || 0,
        missed: monthlyData[month]?.missed || 0,
        harakah: monthlyData[month]?.harakah || 0,
        incorrect: monthlyData[month]?.incorrect || 0
      }));
      setMonthlyMistakes(chartData);
    } catch (error) {
      console.error('Error loading monthly mistakes:', error);
    }
  };
  const loadRecentSessions = async () => {
    console.log('📊 Loading recent sessions from session_activity for user:', user?.id);
    try {
      const {
        data: activityData,
        error: activityError
      } = await supabase
        .from('session_activity')
        .select('*')
        .eq('user_id', user?.id)
        .order('completed_at', { ascending: false });

      if (activityError) {
        console.error('❌ Error loading session activity:', activityError);
        setRecentSessions([]);
        return;
      }

      if (!activityData || activityData.length === 0) {
        setRecentSessions([]);
        return;
      }

      // Group by session_id so multi-surah sessions become one row
      const sessionMap = new Map<string, typeof activityData>();
      for (const activity of activityData) {
        const key = activity.session_id;
        if (!sessionMap.has(key)) {
          sessionMap.set(key, []);
        }
        sessionMap.get(key)!.push(activity);
      }

      const grouped: RecentSession[] = [];
      for (const [, activities] of sessionMap) {
        // Use the latest completed_at for date/time display
        const latest = activities.reduce((a, b) => 
          new Date(a.completed_at) > new Date(b.completed_at) ? a : b
        );

        const surahRanges: SurahRange[] = activities.map(a => ({
          surahNumber: a.surah_number,
          surahName: surahNames[a.surah_number - 1] || `Surah ${a.surah_number}`,
          startingAyah: a.starting_ayah,
          endingAyah: a.ending_ayah,
        }));

        // Sort ranges by surah number, then starting ayah
        surahRanges.sort((a, b) => a.surahNumber - b.surahNumber || a.startingAyah - b.startingAyah);

        grouped.push({
          id: latest.id,
          date: formatInTimezone(latest.completed_at, userTimezone, {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          time: formatInTimezone(latest.completed_at, userTimezone, {
            hour: '2-digit',
            minute: '2-digit'
          }),
          surahRanges,
          mistakes: latest.mistake_count,
          role: latest.role,
        });
      }

      // Sort by date descending (already ordered by completed_at from query, but grouping may shuffle)
      grouped.sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        return db - da;
      });

      setRecentSessions(grouped);
    } catch (error) {
      console.error('Error loading recent sessions:', error);
    }
  };

  const exportSessionData = () => {
    if (recentSessions.length === 0) {
      toast.error('No session data to export');
      return;
    }

    // Create CSV content
    const headers = ['Date', 'Time', 'Surah', 'Ayat Revised', 'Mistakes', 'Role'];
    const rows = recentSessions.map(session => {
      const ranges = session.surahRanges || [];
      const surahStr = ranges.map(r => `${r.surahName} (${r.startingAyah}-${r.endingAyah})`).join(' | ');
      return [
        session.date,
        session.time || '',
        surahStr,
        ranges.map(r => `Ayat ${r.startingAyah}-${r.endingAyah}`).join(' | '),
        session.mistakes.toString(),
        session.role
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `revision-activity-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Session data exported successfully');
  };

  const loadSurahRatings = async () => {
    try {
      const { data } = await supabase
        .from('surah_ratings')
        .select('surah_number, rating')
        .eq('user_id', user?.id);
      
      if (data) {
        setSurahRatings(data as SurahRating[]);
      }
    } catch (error) {
      console.error('Error loading surah ratings:', error);
    }
  };

  const handleSurahClick = (surahNumber: number) => {
    setSelectedSurah(surahNumber);
    setRatingDialogOpen(true);
  };

  const handleRatingSelect = async (rating: 'weak' | 'moderate' | 'strong') => {
    if (!selectedSurah || !user) return;

    try {
      const { error } = await supabase
        .from('surah_ratings')
        .upsert({
          user_id: user.id,
          surah_number: selectedSurah,
          rating: rating,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,surah_number'
        });

      if (error) throw error;

      // Update local state
      setSurahRatings(prev => {
        const existing = prev.find(r => r.surah_number === selectedSurah);
        if (existing) {
          return prev.map(r => 
            r.surah_number === selectedSurah 
              ? { ...r, rating } 
              : r
          );
        } else {
          return [...prev, { surah_number: selectedSurah, rating }];
        }
      });

      toast.success('Rating updated successfully');
      setRatingDialogOpen(false);
    } catch (error) {
      console.error('Error updating rating:', error);
      toast.error('Failed to update rating');
    }
  };

  const getSurahRatingColor = (surahNumber: number) => {
    const rating = surahRatings.find(r => r.surah_number === surahNumber);
    if (!rating) return 'hsl(var(--muted))';
    
    switch (rating.rating) {
      case 'weak':
        return '#F28A8A';
      case 'moderate':
        return '#FFE0B2';
      case 'strong':
        return '#99B898';
      default:
        return 'hsl(var(--muted))';
    }
  };

  const noRevisionColor = resolvedTheme === 'dark' ? '#2a2a2a' : '#F2FBF6';
  const getHeatmapColor = (count: number, isEmpty: boolean) => {
    if (isEmpty) return 'transparent';
    if (count === 0) return noRevisionColor;
    if (count >= 100) return '#4F8A6A';           // 100+ ayat
    return '#99B898';                             // 1+ ayat
  };
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>;
  }
  return <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-[#c6a477]">Your Statistics</h1>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Revision Round</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Calendar className="h-8 w-8 text-primary" />
                <div>
                  {revisionStartDate ? <>
                      <p className="text-sm text-muted-foreground">Started on</p>
                      <p className="text-lg font-semibold text-foreground">
                        {revisionStartDate.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {daysSinceStart} {daysSinceStart === 1 ? 'day' : 'days'} ago
                      </p>
                    </> : <p className="text-sm text-muted-foreground">No revision data yet</p>}
                </div>
              </div>
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Analytics</CardTitle>
            {availableYears.length > 1 && (
              <Select value={heatmapYear.toString()} onValueChange={(value) => setHeatmapYear(parseInt(value))}>
                <SelectTrigger className="w-[100px] h-8">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="consistency" className="w-full">
              <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
                <TabsTrigger value="consistency">Consistency Map</TabsTrigger>
                <TabsTrigger value="strength">Revision Strength</TabsTrigger>
              </TabsList>

              <TabsContent value="consistency">
            <div className="space-y-3">
              <TooltipProvider>
                <div className="w-full overflow-x-auto">
                  <div className="grid gap-1 w-full min-w-[600px]" style={{
                  gridTemplateColumns: 'auto repeat(31, minmax(0, 1fr))',
                  gridTemplateRows: 'auto repeat(12, minmax(0, 1fr))'
                }}>
                    {/* Empty top-left corner */}
                    <div />
                    
                    {/* Day numbers header */}
                    {Array.from({
                    length: 31
                  }, (_, i) => i + 1).map(day => <div key={`day-${day}`} className="text-[8px] text-muted-foreground text-center pb-1">
                        {day}
                      </div>)}
                    
                    {/* Heatmap cells grouped by month with month labels */}
                    {Array.from({
                    length: 12
                  }, (_, monthIndex) => {
                    const monthData = heatmapData.slice(monthIndex * 31, (monthIndex + 1) * 31);
                    return <>
                          {/* Month label on the left */}
                          <div className="text-xs text-muted-foreground pr-2 flex items-center">
                            {monthNames[monthIndex]}
                          </div>
                          
                          {/* Day cells for this month */}
                          {monthData.map((day, idx) => {
                        if (day.isEmpty) {
                          return <div key={`empty-${monthIndex}-${idx}`} className="aspect-square" style={{
                            backgroundColor: 'transparent'
                          }} />;
                        }
                        return <Tooltip key={day.date}>
                                <TooltipTrigger asChild>
                                  <div style={{
                              backgroundColor: getHeatmapColor(day.count, day.isEmpty)
                            }} className="aspect-square rounded-sm cursor-pointer transition-transform hover:scale-110 bg-orange-50" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    {day.count} ayat revised on{' '}
                                    {day.displayDate?.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                                  </p>
                                </TooltipContent>
                              </Tooltip>;
                      })}
                        </>;
                  })}
                  </div>
                </div>
              </TooltipProvider>

              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: noRevisionColor }} />
                  <span>No revision</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#99B898' }} />
                  <span>1+ verses</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#4F8A6A' }} />
                  <span>100+ verses</span>
                </div>
              </div>
            </div>
              </TabsContent>

              <TabsContent value="strength">
                <div className="space-y-4">
                  <TooltipProvider>
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
                      {Array.from({ length: 114 }, (_, i) => i + 1).map(surahNumber => {
                        const surahName = surahNames[surahNumber - 1];
                        const color = getSurahRatingColor(surahNumber);
                        
                        return (
                          <Tooltip key={surahNumber}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleSurahClick(surahNumber)}
                                className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg flex flex-col items-center justify-center text-xs font-medium w-full rounded py-2 gap-0.5"
                                style={{ backgroundColor: color }}
                              >
                                <span className="font-bold">{surahNumber}</span>
                                <span className="text-[10px] leading-tight text-center px-1">{surahName}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs font-medium">{surahName}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </TooltipProvider>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: '#F28A8A' }} />
                      <span>Weak</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FFE0B2' }} />
                      <span>Moderate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: '#99B898' }} />
                      <span>Strong</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--muted))' }} />
                      <span>Not Rated</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={ratingDialogOpen} onOpenChange={setRatingDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Rate Your Memorization</DialogTitle>
              <DialogDescription>
                How confident are you with {selectedSurah ? surahNames[selectedSurah - 1] : 'this Surah'}?
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-4">
              <Button
                onClick={() => handleRatingSelect('weak')}
                className="w-full justify-start gap-3 h-auto py-4"
                variant="outline"
              >
                <div className="w-6 h-6 rounded" style={{ backgroundColor: '#F28A8A' }} />
                <div className="text-left">
                  <div className="font-semibold">Weak</div>
                  <div className="text-xs text-muted-foreground">Needs significant review</div>
                </div>
              </Button>
              <Button
                onClick={() => handleRatingSelect('moderate')}
                className="w-full justify-start gap-3 h-auto py-4"
                variant="outline"
              >
                <div className="w-6 h-6 rounded" style={{ backgroundColor: '#FFE0B2' }} />
                <div className="text-left">
                  <div className="font-semibold">Moderate</div>
                  <div className="text-xs text-muted-foreground">Somewhat confident</div>
                </div>
              </Button>
              <Button
                onClick={() => handleRatingSelect('strong')}
                className="w-full justify-start gap-3 h-auto py-4"
                variant="outline"
              >
                <div className="w-6 h-6 rounded" style={{ backgroundColor: '#99B898' }} />
                <div className="text-left">
                  <div className="font-semibold">Strong</div>
                  <div className="text-xs text-muted-foreground">Very confident</div>
                </div>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Mistakes by Category</CardTitle>
            {availableYears.length > 1 && (
              <Select value={mistakesYear.toString()} onValueChange={(value) => setMistakesYear(parseInt(value))}>
                <SelectTrigger className="w-[100px] h-8">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyMistakes}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{
                fill: 'hsl(var(--muted-foreground))'
              }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{
                fill: 'hsl(var(--muted-foreground))'
              }} />
                <RechartsTooltip contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
                color: 'hsl(var(--popover-foreground))'
              }} />
                <Legend wrapperStyle={{
                color: 'hsl(var(--foreground))'
              }} />
                <Line type="monotone" dataKey="incorrect" stroke="#f28a8a" strokeWidth={2} name="Incorrect" dot={{
                fill: '#f28a8a'
              }} />
                <Line type="monotone" dataKey="missed" stroke="#FFE0B2" strokeWidth={2} name="Missed" dot={{
                fill: '#FFE0B2'
              }} />
                <Line type="monotone" dataKey="tajweed" stroke="#D3e7ee" strokeWidth={2} name="Tajweed" dot={{
                fill: '#D3e7ee'
              }} />
                <Line type="monotone" dataKey="harakah" stroke="#bec4ed" strokeWidth={2} name="Harakah" dot={{
                fill: '#bec4ed'
              }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {false && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Activity</CardTitle>
            {recentSessions.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportSessionData}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export All
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {recentSessions.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No recent sessions found</p> : <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">Date</TableHead>
                      <TableHead className="text-center">Time</TableHead>
                      <TableHead className="text-center">Surah</TableHead>
                      <TableHead className="text-center">Ayat Revised</TableHead>
                      <TableHead className="text-center">Mistakes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSessions.slice(0, 10).map(session => <TableRow key={session.id}>
                        <TableCell className="text-center">{session.date}</TableCell>
                        <TableCell className="text-center">{session.time}</TableCell>
                        <TableCell className="text-center">
                          {(session.surahRanges || []).map((r, i) => (
                            <div key={i}>{r.surahName}</div>
                          ))}
                        </TableCell>
                        <TableCell className="text-center">
                          {(session.surahRanges || []).map((r, i) => (
                            <div key={i}>Ayat {r.startingAyah} - {r.endingAyah}</div>
                          ))}
                        </TableCell>
                        <TableCell className="text-center">{session.mistakes}</TableCell>
                      </TableRow>)}
                  </TableBody>
                </Table>
                {recentSessions.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center mt-4">
                    Showing latest 10 of {recentSessions.length} sessions. Export to view all.
                  </p>
                )}
              </>}
          </CardContent>
        </Card>
        )}
      </main>
    </div>;
};
export default Stats;