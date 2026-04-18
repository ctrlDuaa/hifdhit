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
    "authorization, x-client-info, apikey, content-type, x-action",
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

function getQfConfig() {
  const clientId = Deno.env.get("QURAN_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("QURAN_CLIENT_SECRET") || "";
  const authBaseUrl = (Deno.env.get("QF_OAUTH_AUTH_BASE_URL") || "https://prelive-oauth2.quran.foundation").replace(/\/+$/, "");
  const apiBaseUrl = (Deno.env.get("QF_OAUTH_API_BASE_URL") || "https://apis-prelive.quran.foundation").replace(/\/+$/, "");

  if (!clientId) {
    throw new Error("Missing Quran Foundation API credentials");
  }

  return { clientId, clientSecret, authBaseUrl, apiBaseUrl };
}

async function exchangeQfCode(code: string, redirectUri: string, codeVerifier: string) {
  const { clientId, clientSecret, authBaseUrl } = getQfConfig();

  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirectUri);
  params.append("code_verifier", codeVerifier);

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (clientSecret) {
    headers["Authorization"] = "Basic " + btoa(`${clientId}:${clientSecret}`);
  } else {
    params.append("client_id", clientId);
  }

  const res = await fetch(`${authBaseUrl}/oauth2/token`, {
    method: "POST",
    headers,
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("QF token exchange failed:", res.status, text);
    throw new Error(`Token exchange failed (${res.status})`);
  }

  return res.json();
}

async function refreshQfToken(refreshTokenValue: string) {
  const { clientId, clientSecret, authBaseUrl } = getQfConfig();

  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshTokenValue);

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (clientSecret) {
    headers["Authorization"] = "Basic " + btoa(`${clientId}:${clientSecret}`);
  } else {
    params.append("client_id", clientId);
  }

  const res = await fetch(`${authBaseUrl}/oauth2/token`, {
    method: "POST",
    headers,
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("QF token refresh failed:", res.status, text);
    throw new Error(`Token refresh failed (${res.status})`);
  }

  return res.json();
}

async function proxyQfUserApi(path: string, accessToken: string, method = "GET", body?: string) {
  const { clientId, apiBaseUrl } = getQfConfig();

  const headers: Record<string, string> = {
    "x-auth-token": accessToken,
    "x-client-id": clientId,
  };

  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    ...(body ? { body } : {}),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  return { status: res.status, data };
}

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const reqBody = await req.json().catch(() => ({}));
    const action = url.searchParams.get("action") || reqBody.action || req.headers.get("x-action");

    if (action === "config") {
      const { clientId, authBaseUrl } = getQfConfig();
      return json({ success: true, data: { clientId, authBaseUrl } });
    }

    if (action === "exchange") {
      const { code, codeVerifier, redirectUri } = reqBody as {
        code?: string;
        codeVerifier?: string;
        redirectUri?: string;
      };

      if (!code || !codeVerifier || !redirectUri) {
        return err("code, codeVerifier, and redirectUri are required");
      }

      const tokenData = await exchangeQfCode(code, redirectUri, codeVerifier);
      const user = tokenData.id_token ? decodeJwt(tokenData.id_token) : null;

      return json({
        success: true,
        data: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          idToken: tokenData.id_token,
          expiresIn: tokenData.expires_in,
          scope: tokenData.scope,
          tokenType: tokenData.token_type,
          user,
        },
      });
    }

    if (action === "refresh") {
      const { refreshToken } = reqBody as { refreshToken?: string };
      if (!refreshToken) return err("refreshToken is required");

      const tokenData = await refreshQfToken(refreshToken);
      return json({
        success: true,
        data: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
          scope: tokenData.scope,
          tokenType: tokenData.token_type,
        },
      });
    }

    if (action === "user-api") {
      const { path, accessToken, method, body } = reqBody as {
        path?: string;
        accessToken?: string;
        method?: string;
        body?: string;
      };

      if (!path || !accessToken) return err("path and accessToken are required");

      const result = await proxyQfUserApi(path, accessToken, method || "GET", body);
      return json({ success: true, data: result.data }, result.status >= 400 ? result.status : 200);
    }

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

    if (action === "page") {
      const pageNum = url.searchParams.get("page_number");
      if (!pageNum) return err("page_number parameter required");
      const QURAN_API_BASE = Deno.env.get("QURAN_API_BASE_URL") || "https://api.quran.com/api/v4";
      const res = await fetch(
        `${QURAN_API_BASE}/verses/by_page/${pageNum}?language=en&words=true&word_fields=text_uthmani&fields=text_uthmani&translations=${DEFAULT_TRANSLATION_ID}`,
        { headers: { Accept: "application/json" } }
      );
      const data = await res.json();
      return json({ success: true, data });
    }

    // QCF V2 page data: per-word code_v2 glyphs + line/page metadata.
    // Used by the Quran Overview to render the Madani Mushaf with QCF V2 fonts.
    if (action === "qcf-page") {
      const pageNum = url.searchParams.get("page_number");
      if (!pageNum) return err("page_number parameter required");
      const QURAN_API_BASE = Deno.env.get("QURAN_API_BASE_URL") || "https://api.quran.com/api/v4";
      const wordFields = [
        "code_v2",
        "text_qpc_hafs",
        "page_number",
        "line_number",
        "char_type_name",
        "position",
      ].join(",");
      const res = await fetch(
        `${QURAN_API_BASE}/verses/by_page/${pageNum}?words=true&mushaf=1&word_fields=${wordFields}&per_page=50`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) {
        const text = await res.text();
        console.error("qcf-page upstream failed:", res.status, text);
        return json({ success: false, error: `Upstream ${res.status}` }, 502);
      }
      const data = await res.json();
      return json({ success: true, data });
    }

    if (action === "tafsir") {
      const key = url.searchParams.get("verse_key");
      if (!key) return err("verse_key parameter required");
      const tafsirId = Number(url.searchParams.get("tafsir_id") || DEFAULT_TAFSIR_ID);
      const data = await getVerseTafsir(key, { tafsirId });
      return json({ success: true, data });
    }

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

    if (action === "test-verse") {
      const data = await getVerseByKey("1:1");
      return json({ success: true, data });
    }

    return err(
      "Unknown action. Available: config, exchange, refresh, user-api, chapters, chapter, verses, verse, verse-range, page, tafsir, chapter-audio, verse-audio, translations, tafsirs-list, reciters, test-verse"
    );
  } catch (error) {
    console.error("Quran API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ success: false, error: message }, 500);
  }
});
