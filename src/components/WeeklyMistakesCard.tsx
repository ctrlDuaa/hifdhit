import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TrendingUp, TrendingDown, BarChart3, Flame } from 'lucide-react';
import { getStartOfWeekInTimezone } from '@/utils/timezoneMapping';
export const WeeklyMistakesCard = () => {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const [thisWeekMistakes, setThisWeekMistakes] = useState(0);
  const [lastWeekMistakes, setLastWeekMistakes] = useState(0);
  const [thisWeekPages, setThisWeekPages] = useState(0);
  const [lastWeekPages, setLastWeekPages] = useState(0);
  const [consistencyStreak, setConsistencyStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userTimezone, setUserTimezone] = useState<string>('UTC');
  useEffect(() => {
    if (user) {
      loadUserTimezone();
    }
  }, [user]);

  useEffect(() => {
    if (user && userTimezone) {
      loadWeeklyMistakes();
    }
  }, [user, userTimezone]);

  const loadUserTimezone = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      if (data?.timezone) {
        setUserTimezone(data.timezone);
      }
    } catch (error) {
      console.error('Error loading user timezone:', error);
      setUserTimezone('UTC');
    }
  };
  const loadWeeklyMistakes = async () => {
    try {
      const now = new Date();

      // Calculate start of this week (Monday) in user's timezone
      const thisWeekStartInTZ = getStartOfWeekInTimezone(now, userTimezone);
      
      // Calculate start of last week using milliseconds to handle month/year boundaries
      const lastWeekStart = new Date(thisWeekStartInTZ.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      console.log('Weekly stats debug:', {
        now: now.toISOString(),
        userTimezone,
        thisWeekStart: thisWeekStartInTZ.toISOString(),
        lastWeekStart: lastWeekStart.toISOString()
      });

      // Fetch this week's mistakes
      const {
        data: thisWeekData
      } = await supabase.from('mistakes').select('id').eq('reciter_id', user?.id).gte('created_at', thisWeekStartInTZ.toISOString());

      // Fetch last week's mistakes
      const {
        data: lastWeekData
      } = await supabase.from('mistakes').select('id').eq('reciter_id', user?.id).gte('created_at', lastWeekStart.toISOString()).lt('created_at', thisWeekStartInTZ.toISOString());
      setThisWeekMistakes(thisWeekData?.length || 0);
      setLastWeekMistakes(lastWeekData?.length || 0);

      // Fetch this week's pages revised
      const {
        data: thisWeekProgress
      } = await supabase.from('progress').select('id').eq('user_id', user?.id).gte('updated_at', thisWeekStartInTZ.toISOString());

      // Fetch last week's pages revised
      const {
        data: lastWeekProgress
      } = await supabase.from('progress').select('id').eq('user_id', user?.id).gte('updated_at', lastWeekStart.toISOString()).lt('updated_at', thisWeekStartInTZ.toISOString());
      setThisWeekPages(thisWeekProgress?.length || 0);
      setLastWeekPages(lastWeekProgress?.length || 0);

      // Calculate consistency streak (consecutive days with activity)
      const { data: allActivity } = await supabase
        .from('session_activity')
        .select('completed_at')
        .eq('user_id', user?.id)
        .order('completed_at', { ascending: false });

      if (allActivity && allActivity.length > 0) {
        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Check each day going backwards
        for (let i = 0; i <= 365; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(checkDate.getDate() - i);
          const nextDate = new Date(checkDate);
          nextDate.setDate(nextDate.getDate() + 1);
          
          const hasActivity = allActivity.some(a => {
            const actDate = new Date(a.completed_at);
            return actDate >= checkDate && actDate < nextDate;
          });
          
          if (hasActivity) {
            streak++;
          } else if (i === 0) {
            // Today has no activity yet, that's ok, continue checking
            continue;
          } else {
            break;
          }
        }
        setConsistencyStreak(streak);
      }
    } catch (error) {
      console.error('Error loading weekly mistakes:', error);
    } finally {
      setLoading(false);
    }
  };
  const mistakesDifference = thisWeekMistakes - lastWeekMistakes;
  const isMistakesImprovement = mistakesDifference <= 0;
  const pagesDifference = thisWeekPages - lastWeekPages;
  const isPagesImprovement = pagesDifference >= 0;
  if (loading) {
    return <Card>
        <CardContent className="p-6">
          <div className="h-24 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>;
  }
  return <Card className="bg-[#2a363b]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-[#fbf6ed]">This Week</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 divide-x divide-border">
            <div>
              <p className="text-xs mb-1 text-stone-300">Ayat</p>
              <div className="text-2xl font-bold text-stat-pages">
                {thisWeekPages}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isPagesImprovement ? <span className="inline-flex items-center" style={{ color: '#99B898' }}>
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {pagesDifference >= 0 ? '+' : ''}{pagesDifference}
                  </span> : <span className="inline-flex items-center" style={{ color: '#F28A8A' }}>
                    <TrendingDown className="w-3 h-3 mr-1" />
                    {pagesDifference}
                  </span>}
              </p>
            </div>
            <div className="pl-4">
              <p className="text-xs mb-1 text-stone-300">Streak</p>
              <div className="text-2xl font-bold inline-flex items-center gap-1.5" style={{ color: '#C6A477' }}>
                <Flame className="w-5 h-5" />
                {consistencyStreak}
              </div>
              <p className="text-xs mt-1" style={{ color: '#C6A477' }}>
                {consistencyStreak === 1 ? 'day' : 'days'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/stats')} className="w-full bg-[#fbf6ed] text-slate-800">
            View all stats
          </Button>
        </div>
      </CardContent>
    </Card>;
};