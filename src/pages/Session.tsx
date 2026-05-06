import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSessionSystem } from '@/hooks/useSessionSystem';
import { useAuth } from '@/hooks/useAuth';
import { SessionMushafViewer } from '@/components/SessionMushafViewer';
import { SessionExitDialog } from '@/components/SessionExitDialog';
import { Users, LogOut, RotateCcw, Navigation, Tag, Menu } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AppHeader } from '@/components/AppHeader';

interface SessionParticipant {
  id: string;
  user_id: string;
  role: 'reciter' | 'checker';
  joined_at: string;
  has_been_reciter: boolean;
  profiles?: {
    username: string;
    full_name: string;
  };
}

const Session = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0);
  const [jumpToPage, setJumpToPage] = useState('');
  const [jumpToAyah, setJumpToAyah] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [surahAyahCount, setSurahAyahCount] = useState<number | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [hasBeenReciter, setHasBeenReciter] = useState(false);
  const isMobile = useIsMobile();
  const {
    currentSession, 
    userRole, 
    participants,
    leaveSession, 
    switchRole, 
    updateSessionPosition,
    loading,
    loadSessionById,
  } = useSessionSystem();

  useEffect(() => {
    console.log('🎯 Session page mounted/updated:', {
      sessionId,
      hasUser: !!user,
      timestamp: new Date().toISOString()
    });
    
    if (sessionId && user) {
      console.log('📞 Calling loadSessionById...');
      loadSessionById(sessionId);
    }
  }, [sessionId, user]);

  // Trigger refresh when userRole or participants change
  useEffect(() => {
    console.log('🔄 Session state changed:', {
      participantsCount: participants.length,
      userRole,
      participants: participants.map(p => ({ 
        username: p.profiles?.username, 
        role: p.role,
        isMe: p.user_id === user?.id
      }))
    });
    
    if (participants.length > 0 && userRole && user) {
      const reciter = participants.find(p => p.role === 'reciter');
      const checker = participants.find(p => p.role === 'checker');
      const myRole = participants.find(p => p.user_id === user?.id)?.role;
      const myParticipant = participants.find(p => p.user_id === user?.id);
      
      // Track if current user has been a reciter
      if (myParticipant?.has_been_reciter) {
        setHasBeenReciter(true);
      }
      
      console.log('📊 Current roles - Reciter:', reciter?.profiles?.username, 'Checker:', checker?.profiles?.username);
      console.log('👤 My role in participants list:', myRole, 'My role in state:', userRole);
      console.log('🎤 Has been reciter:', myParticipant?.has_been_reciter);
      
      // Force refresh when both roles are present
      if (reciter && checker) {
        console.log('✅ Both roles present, triggering Mushaf refresh');
        setForceRefresh(prev => prev + 1);
      }
    }
  }, [participants, userRole, user]);

  const handleLeaveSession = async () => {
    // Show exit dialog for anyone who has been a reciter during the session
    if (hasBeenReciter) {
      setShowExitDialog(true);
    } else {
      await leaveSession();
      navigate('/dashboard');
    }
  };

  const handleExitComplete = async (revisedRanges?: { surahNumber: number; startAyah: number; endAyah: number }[]) => {
    await leaveSession(revisedRanges);
    console.log('🔄 Session exit completed, navigating to dashboard');
    navigate('/dashboard', { replace: true, state: { refreshStats: true } });
  };

  const handleToggleRole = async () => {
    console.log('Toggle role button clicked');
    const success = await switchRole();
    console.log('Switch role result:', success);
    if (success) {
      // Force a participants reload and UI refresh after role switch
      console.log('Forcing participants reload after role switch');
      setForceRefresh(prev => prev + 1);
    }
  };

  const handlePageChange = async (page: number, surah: number, ayah: number) => {
    setCurrentPage(page);
    await updateSessionPosition(page, surah, ayah);
  };

  const getSurahAyahCount = (surahNum: number): number => {
    const ayahCounts: { [key: number]: number } = {
      1: 7, 2: 286, 3: 200, 4: 176, 5: 120, 6: 165, 7: 206, 8: 75, 9: 129, 10: 109,
      11: 123, 12: 111, 13: 43, 14: 52, 15: 99, 16: 128, 17: 111, 18: 110, 19: 98, 20: 135,
      21: 112, 22: 78, 23: 118, 24: 64, 25: 77, 26: 227, 27: 93, 28: 88, 29: 69, 30: 60,
      31: 34, 32: 30, 33: 73, 34: 54, 35: 45, 36: 83, 37: 182, 38: 88, 39: 75, 40: 85,
      41: 54, 42: 53, 43: 89, 44: 59, 45: 37, 46: 35, 47: 38, 48: 29, 49: 18, 50: 45,
      51: 60, 52: 49, 53: 62, 54: 55, 55: 78, 56: 96, 57: 29, 58: 22, 59: 24, 60: 13,
      61: 14, 62: 11, 63: 11, 64: 18, 65: 12, 66: 12, 67: 30, 68: 52, 69: 52, 70: 44,
      71: 28, 72: 28, 73: 20, 74: 56, 75: 40, 76: 31, 77: 50, 78: 40, 79: 46, 80: 42,
      81: 29, 82: 19, 83: 36, 84: 25, 85: 22, 86: 17, 87: 19, 88: 26, 89: 30, 90: 20,
      91: 15, 92: 21, 93: 11, 94: 8, 95: 8, 96: 19, 97: 5, 98: 8, 99: 8, 100: 11,
      101: 11, 102: 8, 103: 3, 104: 9, 105: 5, 106: 4, 107: 7, 108: 3, 109: 6, 110: 3,
      111: 5, 112: 4, 113: 5, 114: 6
    };
    return ayahCounts[surahNum] || 0;
  };

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage);
    if (!pageNum || isNaN(pageNum)) return;
    if (pageNum < 1 || pageNum > 604) {
      alert('Please enter a page between 1 and 604.');
      return;
    }
    setCurrentPage(pageNum);
    updateSessionPosition(pageNum, currentSession?.surah_number || 1, 1);
    setJumpToPage('');
  };

  const handleJumpToAyah = async () => {
    const ayahNum = parseInt(jumpToAyah);
    const surahNum = currentSession?.surah_number || 1;
    
    console.log('🎯 Jump to Ayah requested:', { ayahNum, surahNum, jumpToAyah });
    
    if (!ayahNum || isNaN(ayahNum) || !surahNum) {
      console.log('❌ Invalid input:', { ayahNum, surahNum });
      return;
    }
    
    if (surahAyahCount && (ayahNum < 1 || ayahNum > surahAyahCount)) {
      alert(`Please enter an ayah between 1 and ${surahAyahCount} for this surah.`);
      return;
    }

    try {
      console.log('🔍 Querying words table for surah:', surahNum, 'ayah:', ayahNum);
      
      // First, get a word from this surah and ayah
      const { data: word, error: wordError } = await supabase
        .from('words')
        .select('id')
        .eq('surah', surahNum)
        .eq('ayah', ayahNum)
        .limit(1)
        .maybeSingle();

      console.log('📊 Words query result:', { word, wordError });

      if (wordError) throw wordError;
      if (!word?.id) {
        alert(`Ayah ${ayahNum} not found in this surah.`);
        return;
      }

      console.log('🔍 Querying pages table for word id:', word.id);

      // Find which page this word is on
      const { data: pageData, error: pageError } = await supabase
        .from('pages')
        .select('page_number')
        .lte('first_word_id', word.id)
        .gte('last_word_id', word.id)
        .eq('line_type', 'ayah')
        .limit(1)
        .maybeSingle();

      console.log('📊 Pages query result:', { pageData, pageError });

      if (pageError) throw pageError;
      if (!pageData?.page_number) {
        alert(`Page for ayah ${ayahNum} not found.`);
        return;
      }

      console.log('📖 Jumping to ayah:', { surahNum, ayahNum, page: pageData.page_number });

      setCurrentPage(pageData.page_number);
      updateSessionPosition(pageData.page_number, surahNum, ayahNum);
      setJumpToAyah('');
    } catch (err) {
      console.error('❌ Error finding ayah:', err);
      alert('Error finding ayah. Please try again.');
    }
  };

  // Update ayah count and current page when session loads
  useEffect(() => {
    if (currentSession?.surah_number) {
      const ayahCount = getSurahAyahCount(currentSession.surah_number);
      setSurahAyahCount(ayahCount);
      
      // Set current page from session data
      console.log('📖 SESSION STATE UPDATED in Session.tsx:', {
        sessionId: currentSession.id,
        surah: currentSession.surah_number,
        startingAyah: currentSession.starting_ayah,
        currentPage: currentSession.current_page,
        willPassToMushafViewer: currentSession.current_page
      });
      
      setCurrentPage(currentSession.current_page);
    }
  }, [currentSession?.id, currentSession?.current_page, currentSession?.surah_number, currentSession?.starting_ayah]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }


  if (!currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">Session not found</p>
            <Button onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Find the reciter participant - always use the actual reciter's ID
  const reciterParticipant = participants.find(p => p.role === 'reciter');
  const checkerParticipant = participants.find(p => p.role === 'checker');
  const reciterId = reciterParticipant?.user_id || '';

  // Wait for both participants before loading the Mushaf
  const bothParticipantsPresent = reciterParticipant && checkerParticipant;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      {/* Session Info */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 md:py-4">
          {isMobile ? (
            // Mobile: stacked compact layout
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-sm font-bold text-primary truncate">{currentSession.session_name}</h1>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${userRole === 'reciter' ? 'border-primary' : 'border-gold'}`}>
                    {userRole === 'reciter' ? 'Reciting' : 'Checking'}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground shrink-0">Code: {currentSession.session_code}</p>
              </div>
              <div className="flex items-center gap-2">
                {currentSession?.created_by === user?.id && (
                  <Button variant="outline" size="sm" onClick={handleToggleRole} className="h-7 text-xs flex-1">
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Switch Role
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleLeaveSession} className="h-7 text-xs flex-1">
                  <LogOut className="w-3 h-3 mr-1" />
                  Leave
                </Button>
              </div>
            </div>
          ) : (
            // Desktop/tablet: original layout
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-xl font-bold text-primary">{currentSession.session_name}</h1>
                  <p className="text-sm text-muted-foreground">Code: {currentSession.session_code}</p>
                </div>
                <Badge variant="outline" className={userRole === 'reciter' ? 'border-primary' : 'border-gold'}>
                  {userRole === 'reciter' ? 'Reciting' : 'Checking'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {currentSession?.created_by === user?.id && (
                  <Button variant="outline" size="sm" onClick={handleToggleRole}>
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Switch Role
                  </Button>
                )}
                <Button variant="outline" onClick={handleLeaveSession}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Leave Session
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-3 md:py-6">
        <div className="space-y-3 md:space-y-6">
          {/* Participants Card - Compact on mobile */}
          <Card>
            <CardContent className={isMobile ? 'py-2 px-3' : 'pt-6'}>
              {!isMobile && (
                <CardTitle className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4" />
                  Participants ({participants.length})
                </CardTitle>
              )}
              <div className="flex flex-wrap gap-2 md:gap-4">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center gap-2">
                    <Avatar className={isMobile ? 'w-6 h-6' : 'w-8 h-8'}>
                      <AvatarFallback className={isMobile ? 'text-xs' : ''}>
                        {participant.profiles?.username?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium truncate`}>
                        @{participant.profiles?.username || 'Unknown'}
                        {participant.user_id === user?.id && (
                          <span className="text-muted-foreground ml-1">(you)</span>
                        )}
                      </p>
                      <Badge 
                        variant={participant.role === 'reciter' ? 'default' : 'secondary'}
                        className={isMobile ? 'text-[10px] px-1.5 py-0' : 'text-xs'}
                      >
                        {participant.role}
                      </Badge>
                    </div>
                  </div>
                ))}
                
                {participants.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4 w-full">
                    No participants yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Main Content with Navigation Sidebar */}
          <div>
            {!bothParticipantsPresent ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-lg font-medium mb-2">Waiting for participants...</p>
                  <p className="text-sm text-muted-foreground">
                    {!reciterParticipant && 'Waiting for reciter to join'}
                    {!checkerParticipant && reciterParticipant && 'Waiting for checker to join'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex gap-4">
                {/* Navigation Sidebar - Desktop or Collapsible Mobile */}
                {!isMobile ? (
                  <div className="w-44 shrink-0">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Navigation className="w-4 h-4" />
                          Navigation
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Display current Surah info */}
                        {currentSession && (
                          <div className="text-xs text-muted-foreground border-b pb-2 mb-2 space-y-0.5">
                            {((currentSession as any).session_ranges?.length > 1
                              ? (currentSession as any).session_ranges
                              : null
                            )?.map((r: any, i: number) => (
                              <div key={i}>
                                <span className="font-medium">Surah {r.surah_number}</span>: {r.starting_ayah}–{r.ending_ayah}
                              </div>
                            )) ?? (
                              <>
                                <div className="font-medium">Surah {currentSession.surah_number}</div>
                                <div>Ayat: {currentSession.starting_ayah}-{currentSession.ending_ayah || currentSession.starting_ayah}</div>
                              </>
                            )}
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          <Label htmlFor="jump-page" className="text-xs">Jump to Page</Label>
                          <div className="flex gap-2">
                            <Input
                              id="jump-page"
                              type="number"
                              min={1}
                              max={604}
                              placeholder="Page #"
                              value={jumpToPage}
                              onChange={(e) => setJumpToPage(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleJumpToPage()}
                              className="h-8 text-sm"
                            />
                            <Button
                              onClick={handleJumpToPage}
                              size="sm"
                              disabled={!jumpToPage}
                              className="h-8 px-3"
                            >
                              Go
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="jump-ayah" className="text-xs">Jump to Ayah</Label>
                          <div className="flex gap-2">
                            <Input
                              id="jump-ayah"
                              type="number"
                              min="1"
                              max={surahAyahCount || undefined}
                              placeholder={surahAyahCount ? `1-${surahAyahCount}` : 'Ayah #'}
                              value={jumpToAyah}
                              onChange={(e) => setJumpToAyah(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleJumpToAyah()}
                              className="h-8 text-sm"
                            />
                            <Button
                              onClick={handleJumpToAyah}
                              size="sm"
                              disabled={!jumpToAyah}
                              className="h-8 px-3"
                            >
                              Go
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                      
                      {/* Mistake Legend */}
                      <div className="px-4 pb-4 pt-3 border-t border-border">
                        <div className="text-base font-semibold mb-3 flex items-center gap-2">
                          <Tag className="w-4 h-4" />
                          Mistake Types
                        </div>
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-center gap-2 text-xs">
                            <div
                              className="w-6 h-4 rounded"
                              style={{
                                backgroundColor: '#f28a8a'
                              }}
                            />
                            <span className="text-muted-foreground">Incorrect</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <div
                              className="w-6 h-4 rounded"
                              style={{
                                backgroundColor: '#FFE0B2'
                              }}
                            />
                            <span className="text-muted-foreground">Missed</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <div
                              className="w-6 h-4 rounded"
                              style={{
                                backgroundColor: '#D3e7ee'
                              }}
                            />
                            <span className="text-muted-foreground">Tajweed</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <div
                              className="w-6 h-4 rounded"
                              style={{
                                backgroundColor: '#bec4ed'
                              }}
                            />
                            <span className="text-muted-foreground">Harakah</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                ) : null}

                {/* Mushaf Viewer */}
                <div className="flex-1">
                  {/* Mobile Navigation and Legend - Above Everything */}
                  {isMobile && (
                    <div className="flex items-start gap-2 mb-4">
                      <Collapsible open={isNavOpen} onOpenChange={setIsNavOpen}>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="icon">
                            <Navigation className="w-4 h-4" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className={`mt-2 absolute left-4 z-10 ${isMobile ? 'w-72' : 'w-auto'}`}>
                          <Card>
                            <CardContent className="pt-4 space-y-4">
                              {/* Display current Surah info */}
                              {currentSession && (
                                <div className="text-xs text-muted-foreground border-b pb-2 mb-2 space-y-0.5">
                                  {((currentSession as any).session_ranges?.length > 1
                                    ? (currentSession as any).session_ranges
                                    : null
                                  )?.map((r: any, i: number) => (
                                    <div key={i}>
                                      <span className="font-medium">Surah {r.surah_number}</span>: {r.starting_ayah}–{r.ending_ayah}
                                    </div>
                                  )) ?? (
                                    <>
                                      <div className="font-medium">Surah {currentSession.surah_number}</div>
                                      <div>Ayat: {currentSession.starting_ayah}–{currentSession.ending_ayah || currentSession.starting_ayah}</div>
                                    </>
                                  )}
                                </div>
                              )}
                           
                           <div className="space-y-2">
                            <Label htmlFor="jump-page-mobile" className="text-xs">Jump to Page</Label>
                            <div className="flex gap-2">
                              <Input
                                id="jump-page-mobile"
                                type="number"
                                min={1}
                                max={604}
                                placeholder="Page #"
                                value={jumpToPage}
                                onChange={(e) => setJumpToPage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleJumpToPage()}
                                className="h-8 text-sm"
                              />
                              <Button
                                onClick={handleJumpToPage}
                                size="sm"
                                disabled={!jumpToPage}
                                className="h-8 px-3"
                              >
                                Go
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="jump-ayah-mobile" className="text-xs">Jump to Ayah</Label>
                            <div className="flex gap-2">
                              <Input
                                id="jump-ayah-mobile"
                                type="number"
                                min="1"
                                max={surahAyahCount || undefined}
                                placeholder={surahAyahCount ? `1-${surahAyahCount}` : 'Ayah #'}
                                value={jumpToAyah}
                                onChange={(e) => setJumpToAyah(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleJumpToAyah()}
                                className="h-8 text-sm"
                              />
                              <Button
                                onClick={handleJumpToAyah}
                                size="sm"
                                disabled={!jumpToAyah}
                                className="h-8 px-3"
                              >
                                Go
                              </Button>
                            </div>
                          </div>
                            </CardContent>
                          </Card>
                        </CollapsibleContent>
                      </Collapsible>
                      
                      {/* Mistake Types Legend - Horizontal (Mobile) */}
                      <Card className="flex-1">
                        <CardContent className="py-3">
                          <div className="flex items-center justify-around gap-1.5">
                            <div className="flex items-center gap-1 text-[10px]">
                              <div
                                className="w-5 h-3 rounded"
                                style={{
                                  backgroundColor: '#f28a8a'
                                }}
                              />
                              <span className="text-muted-foreground whitespace-nowrap">Incorrect</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <div
                                className="w-5 h-3 rounded"
                                style={{
                                  backgroundColor: '#FFE0B2'
                                }}
                              />
                              <span className="text-muted-foreground whitespace-nowrap">Missed</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <div
                                className="w-5 h-3 rounded"
                                style={{
                                  backgroundColor: '#D3e7ee'
                                }}
                              />
                              <span className="text-muted-foreground whitespace-nowrap">Tajweed</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <div
                                className="w-5 h-3 rounded"
                                style={{
                                  backgroundColor: '#bec4ed'
                                }}
                              />
                              <span className="text-muted-foreground whitespace-nowrap">Harakah</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                  <SessionMushafViewer
                    key={`${sessionId}-${reciterId}-${forceRefresh}-${currentPage}`}
                    sessionId={sessionId!}
                    initialPage={currentPage}
                    userRole={userRole!}
                    reciterId={reciterId}
                    onPageChange={handlePageChange}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Exit Dialog for Anyone Who Has Been a Reciter */}
      {currentSession && hasBeenReciter && (
        <SessionExitDialog
          open={showExitDialog}
          onOpenChange={setShowExitDialog}
          sessionData={{
            surahNumber: currentSession.surah_number,
            startAyah: currentSession.starting_ayah,
            endAyah: currentSession.ending_ayah || currentSession.starting_ayah,
            sessionRanges: ((currentSession as any).session_ranges as { surah_number: number; starting_ayah: number; ending_ayah: number }[])?.map(r => ({
              surahNumber: r.surah_number,
              startAyah: r.starting_ayah,
              endAyah: r.ending_ayah,
            })),
          }}
          sessionId={currentSession.id}
          onComplete={handleExitComplete}
        />
      )}
    </div>
  );
};

export default Session;