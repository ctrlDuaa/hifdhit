import { useState, useCallback, useEffect, useRef } from 'react';
import {
  MemorizationSessionState,
  MemorizationSessionConfig,
  MemorizationStage,
  ConfidenceRating,
  SessionPhase,
  ChunkProgress,
  AyahPerformance,
} from '@/types/memorization';
import { quranApi, QuranVerse } from '@/services/quranApi';

const STAGE_ORDER: MemorizationStage[] = [
  'listen',
  'hide-third',
  'hide-half',
  'first-letters',
  'self-assess',
];

const STORAGE_KEY = 'memorization_session';
const VERSES_KEY = 'memorization_verses';

function buildChunks(start: number, end: number, chunkSize: number): ChunkProgress[] {
  const chunks: ChunkProgress[] = [];
  let i = start;
  let idx = 0;
  while (i <= end) {
    const chunkEnd = Math.min(i + chunkSize - 1, end);
    chunks.push({ chunkIndex: idx, ayahStart: i, ayahEnd: chunkEnd, completed: false, needsRepeat: false });
    i = chunkEnd + 1;
    idx++;
  }
  return chunks;
}

// Block-level scheduling is now handled in Memorization.tsx saveSessionStats

/** Adapter: convert QuranVerse to the shape GuidedMemorization expects */
export interface MemorizationAyah {
  number: number;
  text: string;
  translation: string;
  transliteration: string;
  words: string[];
  audioUrl?: string;
}

function quranVerseToAyah(v: QuranVerse, audioUrls?: Record<string, string>): MemorizationAyah {
  const verseNum = parseInt(v.verse_key.split(':')[1]);
  return {
    number: verseNum,
    text: v.text_uthmani,
    translation: v.translations?.[0]?.text?.replace(/<sup[^>]*>.*?<\/sup>/gi, '').replace(/<[^>]*>/g, '').trim() || '',
    transliteration: '',
    words: v.words
      ? v.words.filter(w => w.char_type_name !== 'end').map(w => w.text_uthmani)
      : v.text_uthmani.split(' '),
    audioUrl: audioUrls?.[v.verse_key],
  };
}

function buildAudioUrlMap(audioResult: unknown): Record<string, string> {
  const audioUrls: Record<string, string> = {};
  const audioFiles = (audioResult as { audio_files?: Array<{ verse_key?: string; url?: string }> })?.audio_files || [];

  for (const af of audioFiles) {
    if (af.verse_key && af.url) {
      audioUrls[af.verse_key] = af.url.startsWith('http') ? af.url : `https://verses.quran.com/${af.url}`;
    }
  }

  return audioUrls;
}

function hasAudioForRange(verses: Record<number, MemorizationAyah>, start: number, end: number): boolean {
  for (let ayah = start; ayah <= end; ayah++) {
    if (!verses[ayah]?.audioUrl) return false;
  }
  return true;
}

export function useMemorizationSession() {
  const [state, setState] = useState<MemorizationSessionState | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [versesMap, setVersesMap] = useState<Record<number, MemorizationAyah>>(() => {
    try {
      const saved = localStorage.getItem(VERSES_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [loadingVerses, setLoadingVerses] = useState(false);

  // Persist state
  useEffect(() => {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (Object.keys(versesMap).length > 0) {
      localStorage.setItem(VERSES_KEY, JSON.stringify(versesMap));
    }
  }, [versesMap]);

  useEffect(() => {
    if (!state || Object.keys(versesMap).length === 0) return;
    if (hasAudioForRange(versesMap, state.config.ayahStart, state.config.ayahEnd)) return;

    let cancelled = false;
    quranApi.getVerseAudio(state.config.surahId, state.config.reciterId)
      .then((audioResult) => {
        if (cancelled) return;
        const audioUrls = buildAudioUrlMap(audioResult);
        setVersesMap(prev => {
          const updated = { ...prev };
          let changed = false;

          for (let ayah = state.config.ayahStart; ayah <= state.config.ayahEnd; ayah++) {
            const verse = updated[ayah];
            const audioUrl = audioUrls[`${state.config.surahId}:${ayah}`];
            if (verse && audioUrl && verse.audioUrl !== audioUrl) {
              updated[ayah] = { ...verse, audioUrl };
              changed = true;
            }
          }

          return changed ? updated : prev;
        });
      })
      .catch(err => console.error('Failed to refresh memorization audio:', err));

    return () => { cancelled = true; };
  }, [state?.config.surahId, state?.config.ayahStart, state?.config.ayahEnd, state?.config.reciterId, versesMap]);

  const startSession = useCallback(async (config: MemorizationSessionConfig) => {
    setLoadingVerses(true);
    try {
      // Fetch verses from API using user's preferred translation + reciter when available
      const [versesResult, audioResult] = await Promise.all([
        quranApi.getVerseRange(config.surahId, config.ayahStart, config.ayahEnd, config.translationId),
        quranApi.getVerseAudio(config.surahId, config.reciterId).catch(() => ({ audio_files: [] })),
      ]);

      const audioUrls = buildAudioUrlMap(audioResult);

      // Convert to memorization ayahs
      const newVersesMap: Record<number, MemorizationAyah> = {};
      for (const v of versesResult.verses) {
        const ayah = quranVerseToAyah(v, audioUrls);
        newVersesMap[ayah.number] = ayah;
      }
      setVersesMap(newVersesMap);

      // Build session
      const chunks = buildChunks(config.ayahStart, config.ayahEnd, config.chunkSize);
      const perf: Record<number, AyahPerformance> = {};
      for (let a = config.ayahStart; a <= config.ayahEnd; a++) {
        perf[a] = { ayahNumber: a, confidenceRating: null, reviewScheduledFor: [], markedWeak: false, repetitionsCompleted: 0 };
      }

      setState({
        config,
        phase: 'memorizing',
        currentChunkIndex: 0,
        currentAyahInChunk: 0,
        currentStage: 'listen',
        currentRepetition: 1,
        ayahPerformance: perf,
        chunks,
        startedAt: new Date().toISOString(),
        completedAt: null,
        totalTimeSpentMs: 0,
      });
    } catch (err) {
      console.error('Failed to start session:', err);
      throw err;
    } finally {
      setLoadingVerses(false);
    }
  }, []);

  const getCurrentAyah = useCallback((): MemorizationAyah | null => {
    if (!state) return null;
    const chunk = state.chunks[state.currentChunkIndex];
    if (!chunk) return null;
    const ayahNum = chunk.ayahStart + state.currentAyahInChunk;
    return versesMap[ayahNum] || null;
  }, [state, versesMap]);

  const getChunkAyahs = useCallback((): MemorizationAyah[] => {
    if (!state) return [];
    const chunk = state.chunks[state.currentChunkIndex];
    if (!chunk) return [];
    const result: MemorizationAyah[] = [];
    for (let a = chunk.ayahStart; a <= chunk.ayahEnd; a++) {
      if (versesMap[a]) result.push(versesMap[a]);
    }
    return result;
  }, [state, versesMap]);

  const advanceStage = useCallback(() => {
    if (!state) return;
    const idx = STAGE_ORDER.indexOf(state.currentStage);
    if (idx < STAGE_ORDER.length - 1) {
      setState(s => s ? { ...s, currentStage: STAGE_ORDER[idx + 1] } : s);
    }
  }, [state]);

  const goBackStage = useCallback(() => {
    if (!state) return;
    const idx = STAGE_ORDER.indexOf(state.currentStage);
    if (idx > 0) {
      setState(s => s ? { ...s, currentStage: STAGE_ORDER[idx - 1] } : s);
    }
  }, [state]);

  const rateAyah = useCallback((rating: ConfidenceRating) => {
    if (!state) return;
    const chunk = state.chunks[state.currentChunkIndex];
    const ayahNum = chunk.ayahStart + state.currentAyahInChunk;
    
    setState(s => {
      if (!s) return s;
      const perf = { ...s.ayahPerformance };
      perf[ayahNum] = { ...perf[ayahNum], confidenceRating: rating, reviewScheduledFor: [] };
      
      const chunk = s.chunks[s.currentChunkIndex];
      const chunkAyahCount = chunk.ayahEnd - chunk.ayahStart + 1;
      const nextAyahInChunk = s.currentAyahInChunk + 1;
      
      if (nextAyahInChunk < chunkAyahCount) {
        return { ...s, ayahPerformance: perf, currentAyahInChunk: nextAyahInChunk, currentStage: 'listen', currentRepetition: 1 };
      } else {
        return { ...s, ayahPerformance: perf, phase: 'checkpoint' as SessionPhase };
      }
    });
  }, [state]);

  const handleCheckpointResult = useCallback((gotIt: boolean) => {
    if (!state) return;
    setState(s => {
      if (!s) return s;
      const chunks = [...s.chunks];
      chunks[s.currentChunkIndex] = { ...chunks[s.currentChunkIndex], completed: gotIt, needsRepeat: !gotIt };
      
      if (!gotIt) {
        return { ...s, chunks, phase: 'memorizing' as SessionPhase, currentAyahInChunk: 0, currentStage: 'listen' as MemorizationStage, currentRepetition: 1 };
      }
      
      const nextChunk = s.currentChunkIndex + 1;
      if (nextChunk < chunks.length) {
        return { ...s, chunks, phase: 'memorizing' as SessionPhase, currentChunkIndex: nextChunk, currentAyahInChunk: 0, currentStage: 'listen' as MemorizationStage, currentRepetition: 1 };
      } else {
        return { ...s, chunks, phase: 'summary' as SessionPhase, completedAt: new Date().toISOString() };
      }
    });
  }, [state]);

  const toggleWeakMark = useCallback((ayahNum: number) => {
    setState(s => {
      if (!s) return s;
      const perf = { ...s.ayahPerformance };
      perf[ayahNum] = { ...perf[ayahNum], markedWeak: !perf[ayahNum].markedWeak };
      return { ...s, ayahPerformance: perf };
    });
  }, []);

  /** Clear session data completely (used after completion or when user chooses "new session") */
  const endSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(VERSES_KEY);
    setState(null);
    setVersesMap({});
  }, []);

  /** Pause session — keep data in localStorage so user can resume later */
  const pauseSession = useCallback(() => {
    // State is already persisted via useEffect — just clear React state
    setState(null);
    setVersesMap({});
  }, []);

  /** Check if there's a saved session in localStorage (without loading it into React state) */
  const getSavedSessionInfo = useCallback((): { config: MemorizationSessionConfig; currentAyah: number; completedAyahs: number; totalAyahs: number } | null => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;
      const s: MemorizationSessionState = JSON.parse(saved);
      if (s.phase === 'summary') return null; // completed sessions don't count
      const chunk = s.chunks[s.currentChunkIndex];
      const currentAyah = chunk ? chunk.ayahStart + s.currentAyahInChunk : s.config.ayahStart;
      const completedAyahs = Object.values(s.ayahPerformance).filter(p => p.confidenceRating !== null).length;
      const totalAyahs = s.config.ayahEnd - s.config.ayahStart + 1;
      return { config: s.config, currentAyah, completedAyahs, totalAyahs };
    } catch { return null; }
  }, []);

  /** Resume a saved session — reload verses from API since versesMap may be empty */
  const resumeSession = useCallback(async () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const s: MemorizationSessionState = JSON.parse(saved);
      
      // Check if versesMap is already populated with current audio URLs
      const savedVerses = localStorage.getItem(VERSES_KEY);
      if (savedVerses) {
        const parsed = JSON.parse(savedVerses);
        if (Object.keys(parsed).length > 0 && hasAudioForRange(parsed, s.config.ayahStart, s.config.ayahEnd)) {
          setState(s);
          setVersesMap(parsed);
          return;
        }
      }
      
      // Re-fetch verses
      setLoadingVerses(true);
      const [versesResult, audioResult] = await Promise.all([
        quranApi.getVerseRange(s.config.surahId, s.config.ayahStart, s.config.ayahEnd, s.config.translationId),
        quranApi.getVerseAudio(s.config.surahId, s.config.reciterId).catch(() => ({ audio_files: [] })),
      ]);

      const audioUrls = buildAudioUrlMap(audioResult);

      const newVersesMap: Record<number, MemorizationAyah> = {};
      for (const v of versesResult.verses) {
        const ayah = quranVerseToAyah(v, audioUrls);
        newVersesMap[ayah.number] = ayah;
      }

      setState(s);
      setVersesMap(newVersesMap);
      setLoadingVerses(false);
    } catch (err) {
      console.error('Failed to resume session:', err);
      setLoadingVerses(false);
      throw err;
    }
  }, []);

  const getConfidenceSummary = useCallback(() => {
    if (!state) return { easy: 0, shaky: 0, hard: 0 };
    const perfs = Object.values(state.ayahPerformance);
    return {
      easy: perfs.filter(p => p.confidenceRating === 'easy').length,
      shaky: perfs.filter(p => p.confidenceRating === 'shaky').length,
      hard: perfs.filter(p => p.confidenceRating === 'hard').length,
    };
  }, [state]);

  const getWeakPassages = useCallback(() => {
    if (!state) return [];
    return Object.values(state.ayahPerformance).filter(p => p.markedWeak || p.confidenceRating === 'hard');
  }, [state]);

  return {
    state,
    loadingVerses,
    startSession,
    getCurrentAyah,
    getChunkAyahs,
    advanceStage,
    goBackStage,
    rateAyah,
    handleCheckpointResult,
    toggleWeakMark,
    endSession,
    pauseSession,
    resumeSession,
    getSavedSessionInfo,
    getConfidenceSummary,
    getWeakPassages,
  };
}
