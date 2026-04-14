/**
 * Quran Foundation OAuth2 client-side service.
 *
 * Handles PKCE generation, authorization URL building, and
 * communication with the backend edge function for token exchange.
 *
 * Architecture: Confidential client —
 *   - Client generates PKCE + state + nonce
 *   - Client redirects user to QF hosted login
 *   - On callback, client sends code + code_verifier to backend
 *   - Backend exchanges using CLIENT_SECRET
 */

// ── PKCE helpers ─────────────────────────────────────────────

function base64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
}

export async function generatePkce() {
  const codeVerifier = randomString(32);
  const codeChallenge = base64url(await sha256(codeVerifier));
  return { codeVerifier, codeChallenge };
}

// ── Storage keys ─────────────────────────────────────────────

const PKCE_KEY = 'qf_oauth_pkce';

interface PkceState {
  codeVerifier: string;
  state: string;
  nonce: string;
  redirectUri: string;
}

function storePkceState(data: PkceState) {
  sessionStorage.setItem(PKCE_KEY, JSON.stringify(data));
}

export function getPkceState(): PkceState | null {
  try {
    const raw = sessionStorage.getItem(PKCE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPkceState() {
  sessionStorage.removeItem(PKCE_KEY);
}

// ── QF OAuth session storage ─────────────────────────────────

const QF_SESSION_KEY = 'qf_oauth_session';

export interface QfOAuthSession {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number; // timestamp ms
  scope?: string;
  user?: {
    sub?: string;
    email?: string;
    first_name?: string;
    name?: string;
    [key: string]: unknown;
  };
}

export function getQfSession(): QfOAuthSession | null {
  try {
    const raw = localStorage.getItem(QF_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setQfSession(session: QfOAuthSession) {
  localStorage.setItem(QF_SESSION_KEY, JSON.stringify(session));
}

export function clearQfSession() {
  localStorage.removeItem(QF_SESSION_KEY);
}

export function isQfSessionValid(): boolean {
  const session = getQfSession();
  if (!session) return false;
  return Date.now() < session.expiresAt;
}

// ── Edge function caller ─────────────────────────────────────

import { supabase } from '@/integrations/supabase/client';

async function callEdgeFunction(action: string, body: Record<string, unknown>) {
  console.log(`[QF OAuth] Calling edge function: ${action}`, body);

  try {
    const { data, error } = await supabase.functions.invoke('qf-oauth', {
      body: { ...body, action },
      headers: { 'x-action': action },
    });

    if (error) {
      // Try to extract the response body that supabase-js may have attached
      const context = (error as any).context;
      let responseBody = '';
      if (context instanceof Response) {
        try { responseBody = await context.text(); } catch {}
      }
      const detail = responseBody
        ? `[${action}] HTTP error — body: ${responseBody}`
        : `[${action}] ${error.message || 'QF OAuth request failed'}`;
      console.error('[QF OAuth] Invoke error:', detail);
      throw new Error(detail);
    }

    // supabase.functions.invoke already parses JSON
    const result = typeof data === 'string' ? JSON.parse(data) : data;
    console.log(`[QF OAuth] ${action} response:`, JSON.stringify(result, null, 2).slice(0, 1000));

    if (!result.success) {
      const detail = JSON.stringify(result);
      console.error('[QF OAuth] Error response:', detail);
      throw new Error(detail);
    }
    return result.data;
  } catch (err) {
    console.error('[QF OAuth] Call failed:', err);
    throw err;
  }
}

// ── Public API ───────────────────────────────────────────────

/**
 * Fetch the public OAuth config (clientId, authBaseUrl) from the edge function.
 */
export async function getQfOAuthConfig(): Promise<{ clientId: string; authBaseUrl: string }> {
  return callEdgeFunction('config', {});
}

/**
 * Start the OAuth2 login flow:
 * 1. Fetch config from edge function
 * 2. Generate PKCE, state, nonce
 * 3. Redirect to QF hosted login
 */
export async function startQfLogin(scopes = 'openid offline_access user bookmark collection reading_session preference') {
  if (window.location.hostname.startsWith('id-preview--')) {
    throw new Error('Quran.com OAuth must be started from the published app URL: https://hifdhit.lovable.app. Preview URLs use a different origin, so the registered redirect URI will be rejected.');
  }

  const { clientId, authBaseUrl } = await getQfOAuthConfig();
  const { codeVerifier, codeChallenge } = await generatePkce();
  const state = randomString(16);
  const nonce = randomString(16);

  // Build redirect URI — the /callback page in our app
  const redirectUri = `${window.location.origin}/callback`;

  // Store PKCE state for the callback
  storePkceState({ codeVerifier, state, nonce, redirectUri });

  // Build authorization URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  // Redirect to QF hosted login
  window.location.href = `${authBaseUrl}/oauth2/auth?${params.toString()}`;
}

/**
 * Handle the OAuth2 callback:
 * 1. Validate state
 * 2. Send code + code_verifier to backend for exchange
 * 3. Store session
 */
export async function handleQfCallback(searchParams: URLSearchParams): Promise<QfOAuthSession> {
  const code = searchParams.get('code');
  const returnedState = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    const desc = searchParams.get('error_description') || error;
    throw new Error(`OAuth error: ${desc}`);
  }

  if (!code) throw new Error('No authorization code received');

  // Retrieve and validate PKCE state
  const pkce = getPkceState();
  if (!pkce) throw new Error('No PKCE state found — session may have expired');
  if (pkce.state !== returnedState) throw new Error('State mismatch — possible CSRF attack');

  // Exchange code for tokens via backend
  const data = await callEdgeFunction('exchange', {
    code,
    codeVerifier: pkce.codeVerifier,
    redirectUri: pkce.redirectUri,
  });

  // Validate nonce from id_token if present
  if (data.user && data.user.nonce && data.user.nonce !== pkce.nonce) {
    clearPkceState();
    throw new Error('Nonce mismatch — id_token may be compromised');
  }

  // Clean up PKCE state
  clearPkceState();

  // Build session
  const session: QfOAuthSession = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    idToken: data.idToken,
    expiresAt: Date.now() + (data.expiresIn || 3600) * 1000,
    scope: data.scope,
    user: data.user,
  };

  setQfSession(session);
  return session;
}

/**
 * Refresh the access token using the backend.
 */
export async function refreshQfToken(): Promise<QfOAuthSession | null> {
  const current = getQfSession();
  if (!current?.refreshToken) return null;

  try {
    const data = await callEdgeFunction('refresh', {
      refreshToken: current.refreshToken,
    });

    const session: QfOAuthSession = {
      ...current,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || current.refreshToken,
      expiresAt: Date.now() + (data.expiresIn || 3600) * 1000,
      scope: data.scope || current.scope,
    };

    setQfSession(session);
    return session;
  } catch {
    clearQfSession();
    return null;
  }
}

/**
 * Get a valid access token, refreshing if needed.
 */
export async function getValidAccessToken(): Promise<string | null> {
  let session = getQfSession();
  if (!session) return null;

  // Refresh if expired or about to expire (30s buffer)
  if (Date.now() >= session.expiresAt - 30_000) {
    session = await refreshQfToken();
  }

  return session?.accessToken || null;
}

/**
 * Call a Quran Foundation User API through the backend proxy.
 * Automatically refreshes token on 401.
 */
export async function callQfUserApi(
  path: string,
  method = 'GET',
  body?: unknown
): Promise<unknown> {
  let accessToken = await getValidAccessToken();
  if (!accessToken) throw new Error('Not authenticated with Quran Foundation');

  try {
    return await callEdgeFunction('user-api', {
      path,
      accessToken,
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // Try one refresh + retry on failure
    const refreshed = await refreshQfToken();
    if (!refreshed) throw err;

    return callEdgeFunction('user-api', {
      path: path,
      accessToken: refreshed.accessToken,
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

/**
 * Log out from Quran Foundation (client-side only).
 */
export function logoutQf() {
  clearQfSession();
  clearPkceState();
}
