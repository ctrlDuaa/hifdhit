/**
 * Quran Foundation OAuth2 Token Exchange Edge Function (v2)
 *
 * Confidential client pattern: CLIENT_SECRET stays server-side.
 * The browser client generates PKCE, redirects to QF login, receives
 * the authorization code, then sends code + code_verifier here.
 *
 * Endpoints:
 *   POST ?action=config    — return public OAuth config (clientId, authBaseUrl)
 *   POST ?action=exchange  — exchange authorization code for tokens
 *   POST ?action=refresh   — refresh an expired access_token
 *   POST ?action=user-api  — proxy a User API call
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

// ── Config ───────────────────────────────────────────────────
function getConfig() {
  const clientId = Deno.env.get("QURAN_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("QURAN_CLIENT_SECRET") || "";
  const authBaseUrl = (Deno.env.get("QF_OAUTH_AUTH_BASE_URL") || "https://prelive-oauth2.quran.foundation").replace(/\/+$/, "");
  const apiBaseUrl = (Deno.env.get("QF_OAUTH_API_BASE_URL") || "https://apis-prelive.quran.foundation").replace(/\/+$/, "");

  if (!clientId) {
    throw new Error(
      "Missing Quran Foundation API credentials. Request access: https://api-docs.quran.foundation/request-access"
    );
  }

  return { clientId, clientSecret, authBaseUrl, apiBaseUrl };
}

// ── Token exchange (confidential client) ─────────────────────
async function exchangeCode(code: string, redirectUri: string, codeVerifier: string) {
  const { clientId, clientSecret, authBaseUrl } = getConfig();

  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirectUri);
  params.append("code_verifier", codeVerifier);

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  // Confidential client: use HTTP Basic auth with client_id:client_secret
  if (clientSecret) {
    headers["Authorization"] =
      "Basic " + btoa(`${clientId}:${clientSecret}`);
  } else {
    // Public client fallback (only if QF explicitly confirmed)
    params.append("client_id", clientId);
  }

  const res = await fetch(`${authBaseUrl}/oauth2/token`, {
    method: "POST",
    headers,
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Token exchange failed [${res.status}]`);
    throw new Error(`Token exchange failed: ${res.status}`);
  }

  return res.json();
}

// ── Token refresh ────────────────────────────────────────────
async function refreshToken(refreshTokenValue: string) {
  const { clientId, clientSecret, authBaseUrl } = getConfig();

  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshTokenValue);

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (clientSecret) {
    headers["Authorization"] =
      "Basic " + btoa(`${clientId}:${clientSecret}`);
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
    console.error(`Token refresh failed [${res.status}]`);
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  return res.json();
}

// ── User API proxy ───────────────────────────────────────────
async function proxyUserApi(path: string, accessToken: string, method = "GET", body?: string) {
  const { clientId, apiBaseUrl } = getConfig();

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

  return { status: res.status, data: await res.json() };
}

// ── Decode JWT without verification (for id_token claims) ────
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

// ── Handler ──────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const reqBody = await req.json().catch(() => ({}));
    const action = url.searchParams.get("action") || reqBody.action || req.headers.get("x-action");

    if (req.method !== "POST") {
      return err("POST required", 405);
    }

    // ── Exchange ──────────────────────────────────────────
    if (action === "exchange") {
      const { code, codeVerifier, redirectUri } = reqBody as {
        code?: string;
        codeVerifier?: string;
        redirectUri?: string;
      };

      if (!code || !codeVerifier || !redirectUri) {
        return err("code, codeVerifier, and redirectUri are required");
      }

      const tokenData = await exchangeCode(code, redirectUri, codeVerifier);
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

    // ── Refresh ───────────────────────────────────────────
    if (action === "refresh") {
      const { refreshToken: rt } = reqBody as { refreshToken?: string };
      if (!rt) return err("refreshToken is required");

      const tokenData = await refreshToken(rt);

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

    // ── User API proxy ────────────────────────────────────
    if (action === "user-api") {
      const { path, accessToken, method, body } = reqBody as {
        path?: string;
        accessToken?: string;
        method?: string;
        body?: string;
      };
      if (!path || !accessToken) return err("path and accessToken are required");

      const result = await proxyUserApi(path, accessToken, method || "GET", body);
      return json({ success: true, data: result.data }, result.status >= 400 ? result.status : 200);
    }

    // ── Config (public info only) ─────────────────────────
    if (action === "config") {
      const { clientId, authBaseUrl } = getConfig();
      return json({
        success: true,
        data: { clientId, authBaseUrl },
      });
    }

    return err("Unknown action. Available: exchange, refresh, user-api, config");
  } catch (error) {
    console.error("QF OAuth error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ success: false, error: message }, 500);
  }
});
