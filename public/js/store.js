/** Client-side store: session, hospital snapshot, and live refresh. */
import { api } from './api.js';

const SESSION_KEY = 'careflow.session.v1';

const listeners = new Set();

export const store = {
  boot: null,
  user: null,
  data: null,
  route: { name: 'landing', params: {} },
  loading: false,
  online: true,
  lastSync: null,

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit() { listeners.forEach((fn) => fn(this)); },

  set(patch) { Object.assign(this, patch); this.emit(); },

  /* --------------------------------------------------------------- session */
  restore() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) this.user = JSON.parse(raw);
    } catch { this.user = null; }
    return this.user;
  },

  persist() {
    if (this.user) localStorage.setItem(SESSION_KEY, JSON.stringify(this.user));
    else localStorage.removeItem(SESSION_KEY);
  },

  async bootstrap() {
    if (this.boot) return this.boot;
    this.boot = await api.bootstrap();
    return this.boot;
  },

  async login(payload) {
    const { user } = await api.login(payload);
    this.user = user;
    this.persist();
    this.emit();
    return user;
  },

  logout() {
    this.user = null;
    this.persist();
    this.emit();
  },

  /* ----------------------------------------------------------------- data */
  async refresh({ silent = false } = {}) {
    if (!silent) this.set({ loading: true });
    try {
      const data = await api.state();
      this.set({ data, loading: false, online: true, lastSync: new Date() });
      return data;
    } catch (err) {
      this.set({ loading: false, online: false });
      throw err;
    }
  },

  /** Merge a partial server response into the snapshot without a full refetch. */
  merge(patch) {
    if (!this.data) return;
    const next = { ...this.data };
    for (const [k, v] of Object.entries(patch)) {
      if (Array.isArray(v) && Array.isArray(next[k])) next[k] = v;
      else if (v && typeof v === 'object' && next[k] && typeof next[k] === 'object') next[k] = { ...next[k], ...v };
      else next[k] = v;
    }
    this.set({ data: next, lastSync: new Date() });
  },

  /* ------------------------------------------------------------- selectors */
  patient(id) { return this.data?.patients.find((p) => p.id === id) || null; },
  userById(id) { return this.data?.users.find((u) => u.id === id) || null; },
  nameOf(id) { return this.userById(id)?.name || 'Unassigned'; },
};

/** Poll for changes so dashboards feel live without websockets. */
export function startPolling(intervalMs = 15000) {
  let timer = null;
  const tick = async () => {
    if (!store.user?.role) { timer = setTimeout(tick, intervalMs); return; }
    if (document.visibilityState === 'visible') {
      try { await store.refresh({ silent: true }); } catch { /* offline is fine */ }
    }
    timer = setTimeout(tick, intervalMs);
  };
  timer = setTimeout(tick, intervalMs);
  return () => clearTimeout(timer);
}
