import { useEffect, useState } from 'react';
import { getQfPreferences, isQfSessionValid, QfPreferences } from '@/services/qfAuth';
import { quranApi } from '@/services/quranApi';
import { DEFAULT_RECITER_ID, DEFAULT_TRANSLATION_ID } from '@/config/quranDefaults';
import { useAuth } from '@/hooks/useAuth';

export interface ResolvedQfPreferences {
  /** Whether the user has an authenticated Quran.com session */
  qfConnected: boolean;
  /** True while preferences are loading */
  loading: boolean;
  /** Reciter id to use (preferred → fallback default) */
  reciterId: number;
  /** Translation id to use (preferred → fallback default) */
  translationId: number;
  /** ISO language code (e.g. "en") */
  language: string;
  /** Human-readable reciter name (e.g. "Mishary Rashid Alafasy") */
  reciterName: string;
  /** Human-readable translation name (e.g. "Sahih International") */
  translationName: string;
  /** True if any value came from QF preferences (vs app defaults) */
  fromQfPreferences: boolean;
}

const FALLBACK = {
  reciterId: DEFAULT_RECITER_ID,
  translationId: DEFAULT_TRANSLATION_ID,
  language: 'en',
  reciterName: 'Mishary Rashid Alafasy',
  translationName: 'Sahih International',
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — pick up Quran.com changes quickly.
let cache: ResolvedQfPreferences | null = null;
let cacheTimestamp = 0;
let cacheUserId: string | null = null;

/**
 * Resolve Quran Foundation user preferences (reciter / translation / language)
 * to concrete IDs + display names, falling back to app defaults.
 */
export function useQfPreferences(): ResolvedQfPreferences {
  const { user } = useAuth();
  const appUserId = user?.id || null;
  const cacheFresh = cache && cacheUserId === appUserId && Date.now() - cacheTimestamp < CACHE_TTL_MS;
  const [state, setState] = useState<ResolvedQfPreferences>(
    () => (cacheFresh ? cache! : {
      qfConnected: isQfSessionValid(appUserId),
      loading: true,
      reciterId: FALLBACK.reciterId,
      translationId: FALLBACK.translationId,
      language: FALLBACK.language,
      reciterName: FALLBACK.reciterName,
      translationName: FALLBACK.translationName,
      fromQfPreferences: false,
    })
  );

  useEffect(() => {
    // Skip re-fetching if we already have a fresh cache.
    if (cache && cacheUserId === appUserId && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
      setState(cache);
      return;
    }

    let cancelled = false;

    (async () => {
      const connected = isQfSessionValid(appUserId);
      let prefs: QfPreferences | null = null;
      if (connected) {
        prefs = await getQfPreferences(appUserId);
      }

      const reciterId = prefs?.reciterId ?? FALLBACK.reciterId;
      const translationId = prefs?.translationId ?? FALLBACK.translationId;
      const language = prefs?.language ?? FALLBACK.language;

      console.log('[QF Prefs Hook] connected=', connected, 'reciterId=', reciterId, 'translationId=', translationId);

      // Resolve names in parallel; tolerate failures with defaults.
      const [recitersRes, translationsRes] = await Promise.all([
        quranApi.getReciters().catch(() => null),
        quranApi.getTranslations().catch(() => null),
      ]);

      const reciterMatch = recitersRes?.recitations?.find(r => r.id === reciterId);
      const reciterName = reciterMatch?.reciter_name
        || reciterMatch?.name
        || (reciterMatch?.translated_name?.name)
        || FALLBACK.reciterName;

      const translationMatch = translationsRes?.translations?.find(t => t.id === translationId);
      const translationName = translationMatch
        ? `${translationMatch.name}${translationMatch.author_name ? ` — ${translationMatch.author_name}` : ''}`
        : FALLBACK.translationName;

      const next: ResolvedQfPreferences = {
        qfConnected: connected,
        loading: false,
        reciterId,
        translationId,
        language,
        reciterName,
        translationName,
        fromQfPreferences: !!prefs,
      };
      cache = next;
      cacheUserId = appUserId;
      cacheTimestamp = Date.now();
      if (!cancelled) setState(next);
    })();

    return () => { cancelled = true; };
  }, [appUserId]);

  return state;
}
