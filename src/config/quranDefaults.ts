/**
 * App-level Quran configuration constants.
 * Single source of truth for default translation, tafsir, and reciter.
 */

/** Sahih International */
export const DEFAULT_TRANSLATION_ID = 131;

/** Ibn Kathir (English) */
export const DEFAULT_TAFSIR_ID = 169;

/** Mishary Rashid Alafasy */
export const DEFAULT_RECITER_ID = 7;

/** Cache TTL in milliseconds (24 hours) */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
