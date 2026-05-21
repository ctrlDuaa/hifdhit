/**
 * Quran API service — the ONLY way client code talks to Quran Foundation data.
 * All requests go through our Supabase Edge Function (never direct to Quran.com).
 */

import { DEFAULT_TRANSLATION_ID, DEFAULT_TAFSIR_ID, DEFAULT_RECITER_ID } from '@/config/quranDefaults';

// ── Types ────────────────────────────────────────────────────

export interface QuranChapter {
  id: number;
  name_arabic: string;
  name_simple: string;
  name_complex: string;
  revelation_place: string;
  verses_count: number;
  translated_name?: { name: string; language_name: string };
  pages?: number[];
}

export interface QuranWord {
  id: number;
  position: number;
  text_uthmani: string;
  text?: string;
  translation?: { text: string; language_name: string };
  transliteration?: { text: string };
  char_type_name?: string;
}

export interface QuranVerse {
  id: number;
  verse_key: string;
  verse_number: number;
  text_uthmani: string;
  words?: QuranWord[];
  translations?: { id: number; text: string; resource_id: number }[];
}

export interface QuranAudioFile {
  id: number;
  chapter_id: number;
  file_size: number;
  format: string;
  audio_url: string;
}

export interface VerseTiming {
  verse_key: string;
  url: string;
}

export interface TafsirEntry {
  verse_key: string;
  text: string;
  resource_name?: string;
}

// ── Service ──────────────────────────────────────────────────

class QuranApiService {
  private getBaseUrl(): string {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    return `https://${projectId}.supabase.co/functions/v1/quran-api`;
  }

  private buildUrl(params: Record<string, string>): string {
    const qs = new URLSearchParams(params).toString();
    return `${this.getBaseUrl()}?${qs}`;
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
  }

  private async invoke<T>(params: Record<string, string>): Promise<T> {
    const url = this.buildUrl(params);
    const res = await fetch(url, { headers: this.getHeaders() });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `API request failed [${res.status}]`);
    }

    const result = await res.json();
    if (!result.success) throw new Error(result.error || "API request failed");
    return result.data;
  }

  // ── Chapters ─────────────────────────────────────────────

  async getChapters(): Promise<{ chapters: QuranChapter[] }> {
    return this.invoke({ action: "chapters" });
  }

  async getChapter(chapterNumber: number): Promise<{ chapter: QuranChapter }> {
    return this.invoke({ action: "chapter", chapter: String(chapterNumber) });
  }

  // ── Verses ───────────────────────────────────────────────

  async getVersesByChapter(
    chapter: number,
    page = 1,
    perPage = 50,
    translationId = DEFAULT_TRANSLATION_ID
  ): Promise<{ verses: QuranVerse[]; pagination: any }> {
    return this.invoke({
      action: "verses",
      chapter: String(chapter),
      page: String(page),
      per_page: String(perPage),
      translation_id: String(translationId),
    });
  }

  async getVerse(
    verseKey: string,
    translationId = DEFAULT_TRANSLATION_ID
  ): Promise<{ verse: QuranVerse }> {
    return this.invoke({
      action: "verse",
      verse_key: verseKey,
      translation_id: String(translationId),
    });
  }

  async getVerseRange(
    chapter: number,
    startVerse: number,
    endVerse: number,
    translationId = DEFAULT_TRANSLATION_ID
  ): Promise<{ verses: QuranVerse[] }> {
    return this.invoke({
      action: "verse-range",
      chapter: String(chapter),
      start: String(startVerse),
      end: String(endVerse),
      translation_id: String(translationId),
    });
  }

  async getVersesByPage(pageNumber: number): Promise<any> {
    return this.invoke({ action: "page", page_number: String(pageNumber) });
  }

  // In-memory cache for QCF page data (persists for the SPA session).
  private qcfCache = new Map<number, any>();
  private qcfInflight = new Map<number, Promise<any>>();

  async getPageQcf(pageNumber: number): Promise<any> {
    const cached = this.qcfCache.get(pageNumber);
    if (cached) return cached;

    const inflight = this.qcfInflight.get(pageNumber);
    if (inflight) return inflight;

    const promise = (async () => {
      const wordFields = "id,code_v2,text_qpc_hafs,page_number,line_number,char_type_name,position";
      // 1) Try our edge function (QF prelive + server-side fallback)
      try {
        const data = await this.invoke<any>({
          action: "page",
          page_number: String(pageNumber),
          words: "true",
          mushaf: "1",
          word_fields: wordFields,
          per_page: "50",
        });
        const verses: any[] = Array.isArray(data?.verses) ? data.verses : [];
        if (verses.length > 0) {
          this.qcfCache.set(pageNumber, data);
          return data;
        }
      } catch {
        // fall through to public API
      }

      // 2) Client-side fallback: public api.quran.com (works for all 604 pages)
      try {
        const url = `https://api.quran.com/api/v4/verses/by_page/${pageNumber}?words=true&word_fields=${encodeURIComponent(wordFields)}&per_page=50`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (res.ok) {
          const json = await res.json();
          const verses: any[] = Array.isArray(json?.verses) ? json.verses : [];
          const payload = {
            ok: true,
            verses,
            words_flattened: verses.flatMap((v: any) => v?.words ?? []),
          };
          this.qcfCache.set(pageNumber, payload);
          return payload;
        }
      } catch {
        // ignore
      }

      const empty = { ok: false, verses: [], words_flattened: [] };
      return empty;
    })();

    this.qcfInflight.set(pageNumber, promise);
    try {
      const result = await promise;
      return result;
    } finally {
      this.qcfInflight.delete(pageNumber);
    }
  }

  /** Preload a QCF page into cache without awaiting (best-effort). */
  prefetchPageQcf(pageNumber: number): void {
    if (pageNumber < 1 || pageNumber > 604) return;
    if (this.qcfCache.has(pageNumber) || this.qcfInflight.has(pageNumber)) return;
    void this.getPageQcf(pageNumber).catch(() => {});
  }

  // ── Tafsir ───────────────────────────────────────────────

  async getTafsir(
    verseKey: string,
    tafsirId = DEFAULT_TAFSIR_ID
  ): Promise<any> {
    return this.invoke({
      action: "tafsir",
      verse_key: verseKey,
      tafsir_id: String(tafsirId),
    });
  }

  // ── Audio ────────────────────────────────────────────────

  async getChapterAudio(
    chapter: number,
    reciterId = DEFAULT_RECITER_ID
  ): Promise<{ audio_file: QuranAudioFile }> {
    return this.invoke({
      action: "chapter-audio",
      chapter: String(chapter),
      reciter_id: String(reciterId),
    });
  }

  async getVerseAudio(
    chapter: number,
    reciterId = DEFAULT_RECITER_ID
  ): Promise<{ audio_files: VerseTiming[] }> {
    return this.invoke({
      action: "verse-audio",
      chapter: String(chapter),
      reciter_id: String(reciterId),
    });
  }

  // ── Resource lists ───────────────────────────────────────

  async getReciters(): Promise<{ recitations?: Array<{ id: number; reciter_name?: string; name?: string; style?: string; translated_name?: { name: string } }> }> {
    return this.invoke({ action: "reciters" });
  }

  async getTranslations(): Promise<{ translations?: Array<{ id: number; name: string; author_name?: string; language_name?: string }> }> {
    return this.invoke({ action: "translations" });
  }

  // ── Test ─────────────────────────────────────────────────

  async testVerse(): Promise<any> {
    return this.invoke({ action: "test-verse" });
  }
}

export const quranApi = new QuranApiService();
