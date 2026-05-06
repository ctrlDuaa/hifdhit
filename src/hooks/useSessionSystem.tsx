import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface SessionData {
  id: string;
  session_code: string;
  session_name: string;
  surah_number: number;
  current_ayah: number;
  starting_ayah: number;
  ending_ayah: number | null;
  current_page: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string;
  created_by: string | null;
}

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

export const useSessionSystem = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [userRole, setUserRole] = useState<'reciter' | 'checker' | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [loading, setLoading] = useState(false);

  // Create a new session
  const createSession = async (
    sessionName: string, 
    surahNumber: number = 1, 
    startAyah: number = 1,
    endAyah: number = 1,
    sessionRanges?: { surah_number: number; starting_ayah: number; ending_ayah: number }[]
  ): Promise<string | null> => {
    if (!user) return null;

    try {
      setLoading(true);
      
      console.log('🎬 CREATE SESSION CALLED WITH:', { 
        sessionName, 
        surahNumber, 
        startAyah, 
        endAyah 
      });
      
      // Find the page number for this surah and start ayah
      console.log('🔍 Querying words and pages for:', { surahNumber, startAyah });
      
      // First, get a word from this surah and ayah
      const { data: word, error: wordError } = await supabase
        .from('words')
        .select('id')
        .eq('surah', surahNumber)
        .eq('ayah', startAyah)
        .limit(1)
        .maybeSingle();

      if (wordError) {
        console.error('❌ Error querying words:', wordError);
      }

      let pageNumber = 1;
      if (word?.id) {
        // Find which page this word is on
        const { data: pageData, error: pageError } = await supabase
          .from('pages')
          .select('page_number')
          .lte('first_word_id', word.id)
          .gte('last_word_id', word.id)
          .eq('line_type', 'ayah')
          .limit(1)
          .maybeSingle();

        if (pageError) {
          console.error('❌ Error querying pages:', pageError);
        }

        pageNumber = pageData?.page_number || 1;
      }

      console.log('📖 CREATING SESSION - Query result:', { 
        surahNumber, 
        startAyah, 
        pageNumber, 
        hasWord: !!word,
        wordId: word?.id
      });
      
      // Create session - creator is automatically set via created_by
      const rangesPayload = sessionRanges && sessionRanges.length > 0 
        ? sessionRanges 
        : [{ surah_number: surahNumber, starting_ayah: startAyah, ending_ayah: endAyah }];

      const { data: sessionData, error: sessionError } = await supabase
        .from('private_sessions')
        .insert([{
          session_name: sessionName,
          surah_number: surahNumber,
          current_ayah: startAyah,
          starting_ayah: startAyah,
          ending_ayah: endAyah,
          current_page: pageNumber,
          is_active: true,
          created_by: user.id,
          session_ranges: rangesPayload,
        }])
        .select()
        .single();

      if (sessionError) throw sessionError;
      
      console.log('✅ SESSION CREATED in DB:', {
        id: sessionData.id,
        code: sessionData.session_code,
        surah_number: sessionData.surah_number,
        starting_ayah: sessionData.starting_ayah,
        current_page: sessionData.current_page
      });

      // Join as first participant (checker - session creator is always checker)
      const { error: participantError } = await supabase
        .from('session_participants')
        .insert([{
          session_id: sessionData.id,
          user_id: user.id,
          role: 'checker',
        }]);

      if (participantError) throw participantError;

      setCurrentSession(sessionData);
      setUserRole('checker');

      toast({
        title: "Session Created!",
        description: `Session code: ${sessionData.session_code}`,
      });

      return sessionData.session_code;
    } catch (error) {
      console.error('Error creating session:', error);
      toast({
        title: "Error",
        description: "Failed to create session. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Load a session by ID and set as current
  const loadSessionById = async (sessionId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      setLoading(true);

      // Load session
      const { data: sessionData, error: sessionError } = await supabase
        .from('private_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('is_active', true)
        .single();

      if (sessionError || !sessionData) {
        console.error('❌ Failed to load session:', sessionError);
        return false;
      }
      
      console.log('✅ SESSION LOADED from DB:', {
        id: sessionData.id,
        code: sessionData.session_code,
        surah_number: sessionData.surah_number,
        starting_ayah: sessionData.starting_ayah,
        current_page: sessionData.current_page
      });

      // Check user's role in this session
      const { data: participation } = await supabase
        .from('session_participants')
        .select('role')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!participation) {
        return false;
      }

      setCurrentSession(sessionData);
      setUserRole(participation.role as 'reciter' | 'checker');
      
      // Load participants immediately
      const { data: participantsData } = await supabase
        .from('session_participants')
        .select('id, user_id, role, joined_at, has_been_reciter')
        .eq('session_id', sessionId);

      if (participantsData) {
        const userIds = participantsData.map(p => p.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, full_name')
          .in('user_id', userIds);

        const participantsWithProfiles = participantsData.map(participant => ({
          ...participant,
          profiles: profiles?.find(p => p.user_id === participant.user_id)
        }));

        console.log('Initial participants loaded:', participantsWithProfiles);
        setParticipants(participantsWithProfiles as SessionParticipant[]);
      }
      
      return true;
    } catch (error) {
      console.error('Error loading session:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Join a session by code
  const joinSessionByCode = async (sessionCode: string): Promise<string | null> => {
    if (!user) return null;

    try {
      setLoading(true);

      // Find session by code
      const { data: sessionData, error: sessionError } = await supabase
        .from('private_sessions')
        .select('*')
        .eq('session_code', sessionCode.toUpperCase())
        .eq('is_active', true)
        .single();

      if (sessionError || !sessionData) {
        toast({
          title: "Session Not Found",
          description: "Invalid or expired session code.",
          variant: "destructive",
        });
        return null;
      }

      // Check if already in session
      const { data: existingParticipant } = await supabase
        .from('session_participants')
        .select()
        .eq('session_id', sessionData.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingParticipant) {
        // Already in session - just set state
        setCurrentSession(sessionData);
        setUserRole(existingParticipant.role as 'reciter' | 'checker');
      } else {
        // Join session for the first time as reciter (non-creators are always reciters)
        const { error } = await supabase
          .from('session_participants')
          .insert([{
            session_id: sessionData.id,
            user_id: user.id,
            role: 'reciter',
          }]);

        if (error) throw error;
        
        setCurrentSession(sessionData);
        setUserRole('reciter');
      }

      toast({
        title: "Joined Session!",
        description: `Connected to ${sessionData.session_name}`,
      });

      return sessionData.id;
    } catch (error) {
      console.error('Error joining session:', error);
      toast({
        title: "Error",
        description: "Failed to join session. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Leave current session
  const leaveSession = async (revisedRanges?: { surahNumber: number; startAyah: number; endAyah: number }[]) => {
    if (!user || !currentSession) return;

    try {
      console.log('🚪 Leaving session:', currentSession.id);

      // Count mistakes for this user in this session
      const { data: mistakesData } = await supabase
        .from('mistakes')
        .select('id')
        .eq('session_id', currentSession.id)
        .eq('reciter_id', user.id);
      
      const mistakeCount = mistakesData?.length || 0;
      
      // Only record session activity if user provided revised ranges (didn't skip)
      if (revisedRanges && revisedRanges.length > 0) {
        // Record one session_activity entry per revised surah range
        const activityRecords = revisedRanges.map(r => ({
          user_id: user.id,
          session_id: currentSession.id,
          surah_number: r.surahNumber,
          starting_ayah: r.startAyah,
          ending_ayah: r.endAyah,
          ayat_revised: Math.max(0, r.endAyah - r.startAyah + 1),
          mistake_count: mistakeCount,
          role: userRole || 'reciter',
          started_at: currentSession.created_at,
          completed_at: new Date().toISOString()
        }));

        const { error: activityError } = await supabase
          .from('session_activity')
          .insert(activityRecords);

        if (activityError) {
          console.error('❌ Error recording session activity:', activityError);
        } else {
          console.log('✅ Session activity recorded for', activityRecords.length, 'range(s)');
        }
      } else {
        console.log('⏭️ Skipped recording session activity - user clicked skip');
      }

      const { error } = await supabase
        .from('session_participants')
        .delete()
        .eq('session_id', currentSession.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setCurrentSession(null);
      setUserRole(null);
      setParticipants([]);

      toast({
        title: "Left Session",
        description: "You have left the session.",
      });
    } catch (error) {
      console.error('Error leaving session:', error);
    }
  };

  // Switch role in session (only creator can switch)
  const switchRole = async () => {
    if (!currentSession || !userRole || !user) return false;

    // Only session creator can switch roles
    if (currentSession.created_by !== user.id) {
      toast({
        title: "Not Allowed",
        description: "Only the session creator can switch roles.",
        variant: "destructive",
      });
      return false;
    }

    try {
      // Find the other participant (not the creator)
      const otherParticipant = participants.find(p => p.user_id !== user.id);
      
      if (!otherParticipant) {
        toast({
          title: "Error",
          description: "Cannot switch roles: no other participant found.",
          variant: "destructive",
        });
        return false;
      }

      // Toggle roles - simple swap
      const creatorNewRole: 'reciter' | 'checker' = userRole === 'reciter' ? 'checker' : 'reciter';
      const otherNewRole: 'reciter' | 'checker' = otherParticipant.role === 'reciter' ? 'checker' : 'reciter';
      
      console.log('Switching roles:', { 
        creator: { old: userRole, new: creatorNewRole }, 
        other: { old: otherParticipant.role, new: otherNewRole } 
      });

      // Update both participants' roles
      const updates = [
        supabase
          .from('session_participants')
          .update({ role: creatorNewRole })
          .eq('session_id', currentSession.id)
          .eq('user_id', user.id),
        supabase
          .from('session_participants')
          .update({ role: otherNewRole })
          .eq('session_id', currentSession.id)
          .eq('user_id', otherParticipant.user_id)
      ];

      const [creatorResult, otherResult] = await Promise.all(updates);

      if (creatorResult.error) {
        console.error('Creator role update error:', creatorResult.error);
        throw creatorResult.error;
      }

      if (otherResult.error) {
        console.error('Other participant role update error:', otherResult.error);
        throw otherResult.error;
      }

      console.log('✅ Roles swapped successfully in database');
      
      // Broadcast the role change via realtime channel
      const channel = supabase.channel(`session-${currentSession.id}`);
      await channel.send({
        type: 'broadcast',
        event: 'role_changed',
        payload: {
          sessionId: currentSession.id,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log('📡 Broadcast role change event sent');
      
      // Update local state immediately
      setUserRole(creatorNewRole);
      await loadParticipants();
      
      toast({
        title: "Roles Swapped",
        description: `You are now the ${creatorNewRole}.`,
      });

      return true;
    } catch (error) {
      console.error('Error switching role:', error);
      toast({
        title: "Error",
        description: "Failed to switch role. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Update current page/ayah
  const updateSessionPosition = async (page: number, surah: number, ayah: number) => {
    if (!currentSession) return;

    try {
      const { error } = await supabase
        .from('private_sessions')
        .update({ 
          current_page: page,
          current_ayah: ayah,
          // Do NOT update surah_number - it should remain the originally selected surah
        })
        .eq('id', currentSession.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating session position:', error);
    }
  };

  // Load participants
  const loadParticipants = async () => {
    if (!currentSession) return;

    try {
      console.log('Loading participants for session:', currentSession.id);
      const { data, error } = await supabase
        .from('session_participants')
        .select('id, user_id, role, joined_at, has_been_reciter')
        .eq('session_id', currentSession.id);

      if (error) throw error;

      console.log('Found participants:', data?.length || 0, data);

      // Load profiles
      const userIds = data?.map(p => p.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, full_name')
        .in('user_id', userIds);

      const participantsWithProfiles = data?.map(participant => ({
        ...participant,
        profiles: profiles?.find(p => p.user_id === participant.user_id)
      })) || [];

      console.log('Updating participants state:', participantsWithProfiles);
      setParticipants(participantsWithProfiles as SessionParticipant[]);
      
      // Update current user's role if found in participants
      if (user) {
        const currentUserParticipant = data?.find(p => p.user_id === user.id);
        if (currentUserParticipant && (currentUserParticipant.role === 'reciter' || currentUserParticipant.role === 'checker')) {
          setUserRole(currentUserParticipant.role as 'reciter' | 'checker');
        }
      }
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  // Real-time subscriptions
  useEffect(() => {
    console.log('🔄 Real-time subscription effect triggered:', {
      hasUser: !!user,
      userId: user?.id,
      hasCurrentSession: !!currentSession,
      sessionId: currentSession?.id,
      timestamp: new Date().toISOString()
    });

    if (!user?.id || !currentSession?.id) {
      console.log('⚠️ Skipping subscription setup - missing required data');
      return;
    }

    const sessionId = currentSession.id;
    const userId = user.id;

    console.log('🚀 SETTING UP REAL-TIME SUBSCRIPTIONS:', {
      sessionId,
      userId,
      timestamp: new Date().toISOString()
    });

    // Use broadcast channel for role changes instead of postgres_changes
    const broadcastChannel = supabase
      .channel(`session-${sessionId}`)
      .on('broadcast', { event: 'role_changed' }, async (payload) => {
        console.log('📻 BROADCAST: Role change detected:', payload);
        
        // Reload participants from database
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const { data: freshParticipants, error: fetchError } = await supabase
          .from('session_participants')
          .select('id, user_id, role, joined_at, has_been_reciter')
          .eq('session_id', sessionId);

        if (fetchError) {
          console.error('❌ Error fetching participants:', fetchError);
          return;
        }

        console.log('✅ Fresh participants from DB after broadcast:', freshParticipants);

        if (freshParticipants) {
          const userIds = freshParticipants.map(p => p.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, username, full_name')
            .in('user_id', userIds);

          const participantsWithProfiles = freshParticipants.map(participant => ({
            ...participant,
            profiles: profiles?.find(p => p.user_id === participant.user_id)
          }));

          console.log('📋 Setting participants from broadcast:', participantsWithProfiles.map(p => ({
            username: p.profiles?.username,
            role: p.role,
            isCurrentUser: p.user_id === userId
          })));
          
          setParticipants(participantsWithProfiles as SessionParticipant[]);
          
          // Update current user's role
          const currentUserParticipant = freshParticipants.find(p => p.user_id === userId);
          if (currentUserParticipant && (currentUserParticipant.role === 'reciter' || currentUserParticipant.role === 'checker')) {
            console.log('✅ Setting current user role from broadcast to:', currentUserParticipant.role);
            setUserRole(currentUserParticipant.role as 'reciter' | 'checker');
          }
        }
      })
      .subscribe((status) => {
        console.log('📡 Broadcast channel status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to broadcast channel');
        }
      });

    // Subscribe to session changes
    const sessionChannel = supabase
      .channel(`session-updates-${sessionId}`)
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'private_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          console.log('📝 Session updated:', payload);
          setCurrentSession(payload.new as SessionData);
        }
      )
      .subscribe((status) => {
        console.log('📡 Session update channel status:', status);
      });

    // Load initial participants
    console.log('📥 Loading initial participants...');
    loadParticipants();

    return () => {
      console.log('🧹 Cleaning up subscriptions for session:', sessionId, 'user:', userId);
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, [user?.id, currentSession?.id]);

  return {
    currentSession,
    userRole,
    participants,
    loading,
    createSession,
    joinSessionByCode,
    loadSessionById,
    leaveSession,
    switchRole,
    updateSessionPosition,
    loadParticipants,
  };
};