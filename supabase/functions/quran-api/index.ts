import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  getChapters,
  getChapter,
  getVersesByChapter,
  getVerseByKey,
  getVerseRange,
  getVerseTafsir,
  getChapterAudio,
  getVerseAudio,
  getTranslations,
  getTafsirs,
  getReciters,
  DEFAULT_TRANSLATION_ID,
  DEFAULT_TAFSIR_ID,
  DEFAULT_RECITER_ID,
} from "../_shared/quranClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400) {
  return json({ success: false, error: message }, status);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── Chapters ──────────────────────────────────────────
    if (action === "chapters") {
      const data = await getChapters();
      return json({ success: true, data });
    }

    if (action === "chapter") {
      const ch = url.searchParams.get("chapter");
      if (!ch) return err("chapter parameter required");
      const data = await getChapter(Number(ch));
      return json({ success: true, data });
    }

    // ── Verses ────────────────────────────────────────────
    if (action === "verses") {
      const chapter = url.searchParams.get("chapter");
      if (!chapter) return err("chapter parameter required");
      const page = url.searchParams.get("page") || "1";
      const perPage = url.searchParams.get("per_page") || "50";
      const translationId = Number(url.searchParams.get("translation_id") || DEFAULT_TRANSLATION_ID);
      const data = await getVersesByChapter(Number(chapter), {
        page: Number(page),
        perPage: Number(perPage),
        translationId,
      });
      return json({ success: true, data });
    }

    if (action === "verse") {
      const key = url.searchParams.get("verse_key");
      if (!key) return err("verse_key parameter required (e.g. 2:255)");
      const translationId = Number(url.searchParams.get("translation_id") || DEFAULT_TRANSLATION_ID);
      const data = await getVerseByKey(key, { translationId });
      return json({ success: true, data });
    }

    if (action === "verse-range") {
      const chapter = url.searchParams.get("chapter");
      const start = url.searchParams.get("start");
      const end = url.searchParams.get("end");
      if (!chapter || !start || !end) return err("chapter, start, end parameters required");
      const translationId = Number(url.searchParams.get("translation_id") || DEFAULT_TRANSLATION_ID);
      const data = await getVerseRange(Number(chapter), Number(start), Number(end), { translationId });
      return json({ success: true, data });
    }

    // ── Page-based ────────────────────────────────────────
    if (action === "page") {
      const pageNum = url.searchParams.get("page_number");
      if (!pageNum) return err("page_number parameter required");
      // Use the raw Quran API for page-based access
      const QURAN_API_BASE = Deno.env.get("QURAN_API_BASE_URL") || "https://api.quran.com/api/v4";
      const res = await fetch(
        `${QURAN_API_BASE}/verses/by_page/${pageNum}?language=en&words=true&word_fields=text_uthmani&fields=text_uthmani&translations=${DEFAULT_TRANSLATION_ID}`,
        { headers: { Accept: "application/json" } }
      );
      const data = await res.json();
      return json({ success: true, data });
    }

    // ── Tafsir ────────────────────────────────────────────
    if (action === "tafsir") {
      const key = url.searchParams.get("verse_key");
      if (!key) return err("verse_key parameter required");
      const tafsirId = Number(url.searchParams.get("tafsir_id") || DEFAULT_TAFSIR_ID);
      const data = await getVerseTafsir(key, { tafsirId });
      return json({ success: true, data });
    }

    // ── Audio ─────────────────────────────────────────────
    if (action === "chapter-audio") {
      const ch = url.searchParams.get("chapter");
      if (!ch) return err("chapter parameter required");
      const reciterId = Number(url.searchParams.get("reciter_id") || DEFAULT_RECITER_ID);
      const data = await getChapterAudio(Number(ch), { reciterId });
      return json({ success: true, data });
    }

    if (action === "verse-audio") {
      const ch = url.searchParams.get("chapter");
      if (!ch) return err("chapter parameter required");
      const reciterId = Number(url.searchParams.get("reciter_id") || DEFAULT_RECITER_ID);
      const data = await getVerseAudio(Number(ch), { reciterId });
      return json({ success: true, data });
    }

    // ── Resources / metadata ──────────────────────────────
    if (action === "translations") {
      const data = await getTranslations();
      return json({ success: true, data });
    }

    if (action === "tafsirs-list") {
      const data = await getTafsirs();
      return json({ success: true, data });
    }

    if (action === "reciters") {
      const data = await getReciters();
      return json({ success: true, data });
    }

    // ── Test endpoint ─────────────────────────────────────
    if (action === "test-verse") {
      const data = await getVerseByKey("1:1");
      return json({ success: true, data });
    }

    return err(
      "Unknown action. Available: chapters, chapter, verses, verse, verse-range, page, tafsir, chapter-audio, verse-audio, translations, tafsirs-list, reciters, test-verse"
    );
  } catch (error) {
    console.error("Quran API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ success: false, error: message }, 500);
  }
});
