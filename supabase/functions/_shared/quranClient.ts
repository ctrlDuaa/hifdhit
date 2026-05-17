/**
 * Shared Quran Foundation API client for all edge functions.
 * Handles authentication and provides typed API methods.
 * This is the ONLY place Quran Foundation API calls should be made.
 */

const QURAN_API_BASE_CUSTOM = Deno.env.get("QURAN_API_BASE_URL") || "";
const QURAN_API_BASE_PUBLIC = "https://api.quran.com/api/v4";
const CLIENT_ID = Deno.env.get("QURAN_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("QURAN_CLIENT_SECRET") || "";
const AUTH_URL = Deno.env.get("QURAN_AUTH_URL") || "";

// Use custom URL if set, otherwise public API
const QURAN_API_BASE = QURAN_API_BASE_CUSTOM || QURAN_API_BASE_PUBLIC;

// ── Token cache ──────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET || !AUTH_URL) return null;
  if (cachedToken && Date.now() < tokenExpiresAt - 30_000) return cachedToken;

  try {
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });
    if (!res.ok) {
      console.warn("OAuth token request failed:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    console.log("OAuth token acquired successfully");
    return cachedToken;
  } catch (err) {
    console.warn("OAuth error:", err);
    return null;
  }
}

// ── Low-level fetch with fallback ────────────────────────────
async function quranFetch(path: string): Promise<any> {
  // Try primary endpoint first
  const primaryUrl = `${QURAN_API_BASE}${path}`;
  
  try {
    const result = await attemptFetch(primaryUrl);
    return result;
  } catch (primaryErr) {
    // If primary fails and we have a custom URL, try public API as fallback
    if (QURAN_API_BASE !== QURAN_API_BASE_PUBLIC) {
      console.warn(`Primary API failed, falling back to public API: ${primaryErr}`);
      const fallbackUrl = `${QURAN_API_BASE_PUBLIC}${path}`;
      return attemptFetch(fallbackUrl);
    }
    throw primaryErr;
  }
}

async function attemptFetch(url: string): Promise<any> {
  const headers: Record<string, string> = { Accept: "application/json" };
  
  // Add auth headers
  const token = await getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // Also try x-client-id / x-client-secret headers (some Quran Foundation APIs use these)
  if (CLIENT_ID) headers["x-client-id"] = CLIENT_ID;
  if (CLIENT_SECRET) headers["x-client-secret"] = CLIENT_SECRET;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Quran API [${res.status}] ${url}: ${text}`);
  }
  return res.json();
}

// ── Default IDs (configurable) ───────────────────────────────
export const DEFAULT_TRANSLATION_ID = 20;    // Saheeh International
export const DEFAULT_TAFSIR_ID = 169;         // Ibn Kathir (English)
export const DEFAULT_RECITER_ID = 7;          // Mishary Rashid Alafasy

// ── Public API ───────────────────────────────────────────────

/** List all 114 chapters */
export async function getChapters(language = "en") {
  return quranFetch(`/chapters?language=${language}`);
}

/** Get single chapter info */
export async function getChapter(chapterNumber: number, language = "en") {
  return quranFetch(`/chapters/${chapterNumber}?language=${language}`);
}

/** Get verses for a chapter (paginated) */
export async function getVersesByChapter(
  chapter: number,
  { page = 1, perPage = 50, translationId = DEFAULT_TRANSLATION_ID } = {}
) {
  return quranFetch(
    `/verses/by_chapter/${chapter}?language=en&words=true&word_fields=text_uthmani,text_indopak&fields=text_uthmani&translations=${translationId}&per_page=${perPage}&page=${page}`
  );
}

/** Get a single verse by key e.g. "2:255" */
export async function getVerseByKey(
  verseKey: string,
  { translationId = DEFAULT_TRANSLATION_ID } = {}
) {
  return quranFetch(
    `/verses/by_key/${verseKey}?language=en&words=true&word_fields=text_uthmani,page_number&fields=text_uthmani,page_number&translations=${translationId}`
  );
}

/** Get a range of verses */
export async function getVerseRange(
  chapter: number,
  startVerse: number,
  endVerse: number,
  { translationId = DEFAULT_TRANSLATION_ID } = {}
) {
  const allVerses: any[] = [];
  let page = 1;
  const perPage = 50;

  while (true) {
    const data = await getVersesByChapter(chapter, { page, perPage, translationId });
    const verses = data.verses || [];
    for (const v of verses) {
      const vNum = parseInt(v.verse_key.split(":")[1]);
      if (vNum >= startVerse && vNum <= endVerse) allVerses.push(v);
      if (vNum > endVerse) return { verses: allVerses };
    }
    if (!data.pagination || page >= data.pagination.total_pages) break;
    page++;
  }

  return { verses: allVerses };
}

/** Get tafsir for a verse */
export async function getVerseTafsir(
  verseKey: string,
  { tafsirId = DEFAULT_TAFSIR_ID } = {}
) {
  return quranFetch(`/tafsirs/${tafsirId}/by_ayah/${verseKey}`);
}

/** Get chapter audio for default reciter */
export async function getChapterAudio(
  chapterNumber: number,
  { reciterId = DEFAULT_RECITER_ID } = {}
) {
  return quranFetch(`/chapter_recitations/${reciterId}/${chapterNumber}`);
}

/** Get verse-by-verse audio for a chapter */
export async function getVerseAudio(
  chapterNumber: number,
  { reciterId = DEFAULT_RECITER_ID } = {}
) {
  // per_page=300 ensures all verses (longest surah is 286 ayat) are returned in one call.
  return quranFetch(`/recitations/${reciterId}/by_chapter/${chapterNumber}?per_page=300`);
}

/** Get available translations */
export async function getTranslations(language = "en") {
  return quranFetch(`/resources/translations?language=${language}`);
}

/** Get available tafsirs */
export async function getTafsirs(language = "en") {
  return quranFetch(`/resources/tafsirs?language=${language}`);
}

/** Get available reciters */
export async function getReciters(language = "en") {
  return quranFetch(`/resources/recitations?language=${language}`);
}
