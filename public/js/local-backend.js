/**
 * CareFlow AI — offline/static backend.
 *
 * When the app is served as static files (GitHub Pages, a USB stick, file://)
 * there is no HTTP API to call. This module loads the *same* isomorphic
 * modules the Node server uses — lib/db.js (data layer) and lib/api.js (the
 * five AI agents + every route) — and persists state to localStorage.
 *
 * Net effect: identical behaviour, identical AI output, zero server. The only
 * difference is that state is per-browser instead of shared between devices.
 *
 * Paths are derived from this module's own URL so the app works both at
 * localhost:4000/ and at username.github.io/<repo>/ without a base path config.
 */

const STORAGE_KEY = 'careflow.ai.db.v1';

// This module lives in the site's js/ directory, so one level up is the site
// root — whether that is http://localhost:4000/ or
// https://<user>.github.io/<repo>/. Resolving from import.meta.url keeps the
// lib/ imports base-path agnostic.
const BASE = new URL('../', import.meta.url);

const latency = (ms) => new Promise((r) => setTimeout(r, ms));

export async function createLocalBackend() {
  const store = await import(new URL('lib/db.js', BASE).href);
  const api = await import(new URL('lib/api.js', BASE).href);

  // 1. Point the data layer at localStorage.
  store.setPersistence((state) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  });

  // 2. Restore the previous session, or seed a fresh hospital.
  let restored = false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { store.hydrate(JSON.parse(raw)); restored = true; }
    else store.resetDb();
  } catch {
    store.resetDb();
  }

  const info = {
    restored,
    storageKey: STORAGE_KEY,
    patients: store.db().patients.length,
  };

  /**
   * Same signature as the HTTP client: (method, path, body) → parsed JSON.
   * Resolves the request in-process against the shared route table.
   */
  async function request(method, path, body) {
    // A touch of latency keeps spinners and optimistic UI honest.
    await latency(70 + Math.random() * 130);

    const [pathname, qs] = String(path).split('?');
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    const result = api.handle(method, pathname, { query, body: body ?? {}, params: {} });

    if (result && result.__status && result.__status >= 400) {
      const err = new Error(result.error || 'Request failed');
      err.status = result.__status;
      throw err;
    }
    return result;
  }

  return { request, info, store, api };
}
