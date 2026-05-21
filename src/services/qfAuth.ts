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

import { supabase } from '@/integrations/supabase/client';

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
  appUserId: string;
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

// ── QF OAuth session storage (per app user) ──────────────────

const QF_SESSION_PREFIX = 'qf_oauth_session::';
const QF_LEGACY_KEY = 'qf_oauth_session';

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

/**
 * Synchronously read the current Supabase user id from the supabase-js
 * persisted auth token in localStorage. Returns null when nobody is signed in.
 * This lets us namespace the QF session per app user without making callers async.
 */
function getCurrentAppUserId(): string | null {
  try {
    const candidates: Array<{ userId: string; expiresAt: number; lastSeen: number }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const userId = parsed?.user?.id || parsed?.currentSession?.user?.id;
        if (!userId) continue;
        const expiresAt = Number(parsed?.expires_at || parsed?.currentSession?.expires_at || 0);
        if (expiresAt && expiresAt * 1000 < Date.now()) continue;
        const lastSignInAt = parsed?.user?.last_sign_in_at || parsed?.currentSession?.user?.last_sign_in_at;
        const lastSeen = lastSignInAt ? Date.parse(lastSignInAt) || 0 : expiresAt;
        candidates.push({ userId: userId as string, expiresAt, lastSeen });
      }
    }
    candidates.sort((a, b) => (b.lastSeen || b.expiresAt) - (a.lastSeen || a.expiresAt));
    return candidates[0]?.userId || null;
  } catch {}
  return null;
}

function qfSessionKey(appUserId?: string | null): string | null {
  const uid = appUserId || getCurrentAppUserId();
  return uid ? `${QF_SESSION_PREFIX}${uid}` : null;
}

async function resolveAppUserId(appUserId?: string | null): Promise<string | null> {
  if (appUserId) return appUserId;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || getCurrentAppUserId();
}

export function getQfSession(appUserId?: string | null): QfOAuthSession | null {
  try {
    const key = qfSessionKey(appUserId);
    if (!key) return null;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setQfSession(session: QfOAuthSession, appUserId?: string | null) {
  const key = qfSessionKey(appUserId);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(session));
}

export function clearQfSession(appUserId?: string | null) {
  const key = qfSessionKey(appUserId);
  if (key) localStorage.removeItem(key);
  // Always drop the legacy global key so older shared sessions can't leak across users.
  localStorage.removeItem(QF_LEGACY_KEY);
}

export function isQfSessionValid(appUserId?: string | null): boolean {
  const session = getQfSession(appUserId);
  if (!session) return false;
  return Date.now() < session.expiresAt;
}

// Drop any legacy global session left from before per-user namespacing so it
// can't be inherited by whichever app user happens to be signed in.
try {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(QF_LEGACY_KEY);
  }
} catch {}

// ── Edge function caller ─────────────────────────────────────

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

    const result = typeof data === 'string' ? JSON.parse(data) : data;
    console.log(`[QF OAuth] ${action} response:`, JSON.stringify(result, null, 2).slice(0, 1000));

    if (!result.success) {
      const detail = JSON.stringify(result);
      console.error('[QF OAuth] Error response:', detail);
      throw new Error(detail);
    }

    return action === 'user-api'
      ? result
      : result.data;
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
export async function startQfLogin(scopes = 'openid offline_access user bookmark collection reading_session preference goal streak') {
  if (window.location.hostname.startsWith('id-preview--')) {
    throw new Error('Quran.com OAuth must be started from the published app URL: https://hifdhit.lovable.app. Preview URLs use a different origin, so the registered redirect URI will be rejected.');
  }

  const { data: { user } } = await supabase.auth.getUser();
  const appUserId = user?.id || getCurrentAppUserId();
  if (!appUserId) throw new Error('Please sign in before connecting Quran.com.');

  const { clientId, authBaseUrl } = await getQfOAuthConfig();
  const { codeVerifier, codeChallenge } = await generatePkce();
  const state = randomString(16);
  const nonce = randomString(16);

  // Build redirect URI — the /callback page in our app
  const redirectUri = `${window.location.origin}/callback`;

  // Store PKCE state for the callback
  storePkceState({ codeVerifier, state, nonce, redirectUri, appUserId });

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
    prompt: 'login',
    max_age: '0',
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

  const { data: { user } } = await supabase.auth.getUser();
  const currentAppUserId = user?.id || getCurrentAppUserId();
  if (!currentAppUserId || currentAppUserId !== pkce.appUserId) {
    clearPkceState();
    throw new Error('App sign-in changed during Quran.com connection. Please try again.');
  }

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

  setQfSession(session, pkce.appUserId);
  return session;
}

/**
 * Refresh the access token using the backend.
 */
export async function refreshQfToken(appUserId?: string | null): Promise<QfOAuthSession | null> {
  const resolvedAppUserId = await resolveAppUserId(appUserId);
  const current = getQfSession(resolvedAppUserId);
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

    setQfSession(session, resolvedAppUserId);
    return session;
  } catch {
    clearQfSession(resolvedAppUserId);
    return null;
  }
}

/**
 * Get a valid access token, refreshing if needed.
 */
export async function getValidAccessToken(appUserId?: string | null): Promise<string | null> {
  const resolvedAppUserId = await resolveAppUserId(appUserId);
  let session = getQfSession(resolvedAppUserId);
  if (!session) return null;

  // Refresh if expired or about to expire (30s buffer)
  if (Date.now() >= session.expiresAt - 30_000) {
    session = await refreshQfToken(resolvedAppUserId);
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
  body?: unknown,
  appUserId?: string | null
): Promise<unknown> {
  console.log("FINAL PATH:", path);
  let accessToken = await getValidAccessToken(appUserId);
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
    const refreshed = await refreshQfToken(appUserId);
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

// ── Preferences ──────────────────────────────────────────────

export interface QfPreferences {
  reciterId?: number;
  translationId?: number;
  language?: string;
}

/**
 * Fetch the user's Quran.com preferences (reciter, translations, language).
 * Returns null when the user is not authenticated with QF or the request fails.
 *
 * The QF response shape is:
 *   { success: true, data: { audio: { reciter }, translations: { selectedTranslations: [..] },
 *     reading: { selectedReadingTranslation }, language: { language }, ... } }
 *
 * Our edge-function proxy wraps it once more as:
 *   { success: true, data: <upstreamJSON>, upstreamStatus }
 *
 * We defensively unwrap any of these shapes so a stray layer doesn't drop prefs.
 */
export async function getQfPreferences(): Promise<QfPreferences | null> {
  if (!isQfSessionValid()) return null;
  try {
    const res: any = await callQfUserApi('/auth/v1/preferences');

    // Walk down through up to 3 layers of `.data` wrapping until we find the prefs object.
    let prefs: any = res;
    for (let i = 0; i < 4; i++) {
      if (!prefs || typeof prefs !== 'object') break;
      // Stop when we see the recognizable prefs shape.
      if (prefs.audio || prefs.translations || prefs.language || prefs.reading) break;
      if ('data' in prefs) {
        prefs = prefs.data;
      } else {
        break;
      }
    }

    console.log('[QF] Raw preferences payload:', JSON.stringify(prefs)?.slice(0, 800));

    if (!prefs || typeof prefs !== 'object') {
      console.warn('[QF] Preferences payload missing or unrecognised.');
      return null;
    }

    const toNumber = (v: unknown): number | undefined => {
      if (typeof v === 'number' && !isNaN(v)) return v;
      if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
      return undefined;
    };

    const reciterId = toNumber(prefs?.audio?.reciter);

    // Translation ID can live in several places depending on whether the user
    // customised "Reading translations" vs "Selected translations" on Quran.com:
    //   • prefs.translations.selectedTranslations  → integer[] (canonical)
    //   • prefs.reading.selectedReadingTranslation → string, sometimes CSV like "131,20"
    //   • prefs.translations                       → some rare API variants return a bare array
    const candidates: unknown[] = [];
    const sel = prefs?.translations?.selectedTranslations;
    if (Array.isArray(sel)) candidates.push(...sel);
    if (Array.isArray(prefs?.translations)) candidates.push(...prefs.translations);
    const readingSel = prefs?.reading?.selectedReadingTranslation;
    if (typeof readingSel === 'string') {
      candidates.push(...readingSel.split(',').map(s => s.trim()).filter(Boolean));
    } else if (Array.isArray(readingSel)) {
      candidates.push(...readingSel);
    } else if (typeof readingSel === 'number') {
      candidates.push(readingSel);
    }

    let translationId: number | undefined;
    for (const c of candidates) {
      const n = toNumber(c);
      if (n !== undefined) { translationId = n; break; }
    }

    const language =
      typeof prefs?.language?.language === 'string' ? prefs.language.language : undefined;

    const result = { reciterId, translationId, language };
    console.log('[QF] Translation candidates considered:', candidates, '→ picked', translationId);
    console.log('[QF] Parsed preferences:', result);
    return result;
  } catch (err) {
    console.error('[QF] Failed to fetch preferences:', err);
    return null;
  }
}
