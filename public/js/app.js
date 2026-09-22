/** CareFlow AI — SPA shell: router, layout, delegated events. */
import { store, startPolling } from './store.js';
import { api, detectServer, useLocalBackend } from './api.js';
import {
  icon, esc, avatar, toast, openModal, closeOverlay, timeAgo, initials, empty,
} from './ui.js';
import { landingPage, mountLanding } from './views/landing.js';
import { loginPage, mountLogin } from './views/login.js';
import * as reception from './views/reception.js';
import * as doctor from './views/doctor.js';
import * as nurse from './views/nurse.js';
import * as admin from './views/admin.js';
import { openPatientDrawer } from './views/patient.js';

/* ------------------------------------------------------------------ routes */

const DASHBOARDS = {
  reception: {
    view: reception,
    title: 'Front Desk',
    subtitle: 'Registration, check-in, live queue & scheduling',
    tabs: [
      { id: 'queue', label: 'Live queue', icon: 'inbox' },
      { id: 'appointments', label: 'Appointments', icon: 'calendar' },
      { id: 'patients', label: 'Patients', icon: 'users' },
    ],
  },
  doctor: {
    view: doctor,
    title: 'Consultation',
    subtitle: 'AI summaries, notes, labs and prescribing',
    tabs: [
      { id: 'list', label: 'My patients', icon: 'users' },
      { id: 'notes', label: 'Consultation notes', icon: 'file' },
      { id: 'labs', label: 'Lab reports', icon: 'flask' },
    ],
  },
  nurse: {
    view: nurse,
    title: 'Nursing Station',
    subtitle: 'Dynamic tasks, care plans and vitals monitoring',
    tabs: [
      { id: 'tasks', label: 'Task board', icon: 'clipboard' },
      { id: 'vitals', label: 'Vitals monitor', icon: 'activity' },
      { id: 'plans', label: 'Care plans', icon: 'heart' },
    ],
  },
  admin: {
    view: admin,
    title: 'Operations Command',
    subtitle: 'Staff, occupancy, revenue and Coordinator AI',
    tabs: [
      { id: 'overview', label: 'Overview', icon: 'grid' },
      { id: 'staff', label: 'Staff', icon: 'users' },
      { id: 'analytics', label: 'Analytics', icon: 'barChart' },
      { id: 'agents', label: 'Agent log', icon: 'cpu' },
    ],
  },
};

const ROLE_LABEL = { reception: 'Reception', doctor: 'Doctor', nurse: 'Nurse', admin: 'Admin', lab: 'Laboratory', pharmacy: 'Pharmacy' };

/* ---------------------------------------------------------------- handlers */

let handlers = {};
let cleanups = [];

function resetHandlers() {
  handlers = {};
  cleanups.forEach((fn) => { try { fn(); } catch { /* noop */ } });
  cleanups = [];
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = handlers[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  Promise.resolve(fn(el, e)).catch((err) => toast({ title: 'Something went wrong', desc: err.message, type: 'error' }));
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  const fn = handlers[form.dataset.form];
  if (!fn) return;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  Promise.resolve(fn(data, form, e)).catch((err) => toast({ title: 'Something went wrong', desc: err.message, type: 'error' }));
});

document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
    const s = document.querySelector('#global-search');
    if (s) { e.preventDefault(); s.focus(); }
  }
});

/* ------------------------------------------------------------------ router */

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(qs || '').entries());
  if (!parts.length) return { name: 'landing', params };
  if (parts[0] === 'login') return { name: 'login', params };
  if (DASHBOARDS[parts[0]]) return { name: parts[0], tab: parts[1] || DASHBOARDS[parts[0]].tabs[0].id, params };
  return { name: 'landing', params };
}

export function go(hash) {
  if (location.hash === hash) { render(); return; }
  location.hash = hash;
}

window.addEventListener('hashchange', () => { closeOverlay(); render(); });

/* ------------------------------------------------------------------- shell */

function navFor(role, route) {
  const cfg = DASHBOARDS[role];
  if (!cfg) return '';
  const q = store.data?.queue || [];
  const tasks = store.data?.tasks || [];
  const counts = {
    queue: q.filter((x) => x.status === 'waiting').length,
    appointments: (store.data?.appointments || []).filter((a) => a.status !== 'cancelled').length,
    patients: store.data?.patients.length || 0,
    tasks: tasks.filter((t) => t.status !== 'done').length,
    vitals: (store.data?.alerts || []).filter((a) => a.kind === 'Vitals').length,
    labs: (store.data?.labs || []).filter((l) => l.status === 'processing').length,
    notes: (store.data?.notes || []).length,
    list: q.filter((x) => x.status === 'waiting').length,
    plans: store.data?.patients.length || 0,
    staff: store.data?.users.length || 0,
  };
  return cfg.tabs.map((t) => `
    <button class="nav-item ${route.tab === t.id ? 'active' : ''}" data-act="nav" data-tab="${t.id}">
      ${icon(t.icon, 17)}<span>${t.label}</span>
      ${counts[t.id] ? `<span class="count">${counts[t.id]}</span>` : ''}
    </button>`).join('');
}

function sidebar(route) {
  const u = store.user;
  const agents = store.data?.agents || store.boot?.agents || [];
  return `
  <aside class="sidebar ${store.sidebarOpen ? 'open' : ''}" id="sidebar">
    <div class="brand">
      <span class="logo-mark">${icon('plus', 17)}</span>
      <span><span class="name">CareFlow AI</span><span class="tag">AI Workforce for Ops</span></span>
    </div>
    <div class="role-switch">
      <div class="k">Signed in as</div>
      <div class="v">${avatar(u, 'sm')} <span class="truncate">${esc(u?.name || '')}</span></div>
    </div>
    <nav class="nav-group">
      <div class="lbl">Workspace</div>
      ${navFor(u?.role, route)}
      <button class="nav-item" data-act="nav" data-tab="__home">${icon('home', 17)}<span>Public site</span></button>
    </nav>
    <div class="agent-rail">
      <div class="lbl">AI workforce</div>
      ${agents.map((a) => `<div class="agent-mini"><span class="dot" style="background:${a.accent}"></span>${esc(a.name.replace(' AI', ''))}<span class="st">active</span></div>`).join('')}
    </div>
    <div class="who">
      ${avatar(u)}
      <div style="min-width:0">
        <div class="nm truncate">${esc(u?.name || '')}</div>
        <div class="rl">${ROLE_LABEL[u?.role] || ''} · ${esc(u?.department || '')}</div>
      </div>
      <button class="icon-btn" data-act="logout" title="Sign out" style="margin-left:auto;background:transparent;border-color:rgba(255,255,255,.15);color:#fff">
        ${icon('logout', 15)}
      </button>
    </div>
  </aside>
  ${store.sidebarOpen ? '<div class="scrim" data-act="close-sidebar"></div>' : ''}`;
}

function topbar(route, cfg) {
  const alerts = store.data?.alerts || [];
  const critical = alerts.filter((a) => a.severity === 'critical' || a.severity === 'high').length;
  return `
  <header class="topbar">
    <button class="icon-btn burger" data-act="toggle-sidebar" aria-label="Menu">${icon('menu', 17)}</button>
    <div>
      <h1>${esc(cfg.title)}</h1>
      <div class="sub">${esc(cfg.subtitle)}</div>
    </div>
    <div class="search">
      ${icon('search', 15)}
      <input id="global-search" placeholder="Search patients, MRN, symptoms, insurer…" autocomplete="off" />
      <span class="kbd">/</span>
      <div id="search-results" class="search-results hidden"></div>
    </div>
    <div class="row gap-sm" style="margin-left:auto">
      ${store.localMode
        ? `<span class="chip chip-amber nowrap" title="No server needed — the data layer and all five AI agents run in this browser and save to localStorage">${icon('cpu', 13)} <span class="mono">runs in browser</span></span>`
        : `<span class="chip chip-teal nowrap" title="Live data layer connected">${icon('wifi', 13)} <span class="mono">${store.lastSync ? timeAgo(store.lastSync.toISOString ? store.lastSync.toISOString() : store.lastSync) : 'syncing'}</span></span>`}
      <button class="icon-btn" data-act="refresh" title="Refresh from the data layer">${icon('refresh', 15)}</button>
      <button class="icon-btn" data-act="alerts" title="Alerts and notifications">
        ${icon('bell', 15)}
        ${critical ? `<span class="pip">${critical}</span>` : ''}
      </button>
    </div>
  </header>`;
}

/* ------------------------------------------------------------ page render */

let lastFocus = null;

function render() {
  const route = parseHash();
  const app = document.getElementById('app');
  const active = document.activeElement;
  if (active && active.id) lastFocus = { id: active.id, start: active.selectionStart };

  const isDash = Boolean(DASHBOARDS[route.name]);

  if (isDash && !store.user) { location.hash = '#/login'; return; }
  if (route.name === 'login' && store.user && DASHBOARDS[store.user.role]) {
    location.hash = `#/${store.user.role}`;
    return;
  }

  store.set({ route });
  resetHandlers();

  if (route.name === 'landing') {
    app.innerHTML = landingPage(store.data || store.boot || {}, { localMode: store.localMode });
    mountLanding(app);
    handlers = { open: () => go('#/login') };
    return;
  }

  if (route.name === 'login') {
    app.innerHTML = loginPage(store.boot);
    mountLogin(app, {
      onLogin: async (payload) => {
        const user = await store.login(payload);
        toast({ title: `Welcome, ${user.name.split(' ')[0]}`, desc: `Signed in to the ${ROLE_LABEL[user.role]} dashboard.`, type: 'success' });
        await store.refresh({ silent: true });
        go(`#/${user.role}`);
      },
    });
    return;
  }

  const cfg = DASHBOARDS[route.name];
  const tab = cfg.tabs.some((t) => t.id === route.tab) ? route.tab : cfg.tabs[0].id;
  route.tab = tab;

  const body = store.data
    ? cfg.view.html({ ...store.data }, { ...route, user: store.user })
    : `<div class="card">${empty('cpu', 'Connecting to the data layer…', 'Loading the hospital snapshot from the CareFlow AI server.')}</div>`;

  app.innerHTML = `
    <div class="shell">
      ${sidebar(route)}
      <div class="main">
        ${topbar(route, cfg)}
        <main class="content" id="content">${body}</main>
      </div>
    </div>`;

  const ctx = {
    route, cfg, api, store,
    root: app,
    go,
    rerender: render,
    async refresh(opts) { await store.refresh(opts); render(); },
    on(name, fn) { handlers[name] = fn; },
    onCleanup(fn) { cleanups.push(fn); },
  };

  handlers = { ...commonHandlers(), ...(cfg.view.mount ? cfg.view.mount(app, ctx) || {} : {}) };
  if (cfg.view.afterRender) cfg.view.afterRender(app, ctx);

  if (lastFocus?.id) {
    const el = document.getElementById(lastFocus.id);
    if (el && el.focus) { el.focus(); if (el.setSelectionRange && lastFocus.start != null) { try { el.setSelectionRange(lastFocus.start, lastFocus.start); } catch { /* noop */ } } }
    lastFocus = null;
  }

  wireSearch();
}

/* ------------------------------------------------------- common handlers */

function commonHandlers() {
  return {
    nav: (el) => {
      if (el.dataset.tab === '__home') { go('#/'); return; }
      go(`#/${store.user.role}/${el.dataset.tab}`);
    },
    'toggle-sidebar': () => { store.set({ sidebarOpen: !store.sidebarOpen }); render(); },
    'close-sidebar': () => { store.set({ sidebarOpen: false }); render(); },
    logout: () => {
      store.logout();
      toast({ title: 'Signed out', desc: 'Session ended.', type: 'info' });
      go('#/');
    },
    refresh: async () => {
      await store.refresh({ silent: true });
      toast({ title: 'Synced', desc: 'Hospital snapshot reloaded from the data layer.', type: 'info' });
      render();
    },
    alerts: () => openAlertsModal(),
    'open-patient': (el) => openPatientDrawer(el.dataset.id),
    'switch-role': (el) => go(`#/${el.dataset.role}`),
  };
}

/* ------------------------------------------------------------ alert modal */

function openAlertsModal() {
  const alerts = store.data?.alerts || [];
  const notifications = store.data?.notifications || [];
  const sev = { critical: 'critical', high: 'high', medium: 'medium', low: 'info' };
  openModal({
    title: 'Alerts & notifications',
    subtitle: `${alerts.length} live alert${alerts.length === 1 ? '' : 's'} · ${notifications.length} patient messages sent`,
    wide: true,
    body: `
      <div class="section-title">Live alerts from the AI workforce</div>
      <div class="grid" style="gap:10px">
        ${alerts.length ? alerts.map((a) => `
          <div class="alert ${sev[a.severity] || 'info'}">
            <div class="ic">${icon(a.severity === 'critical' ? 'octagon' : a.severity === 'high' ? 'alert' : 'sparkles', 15)}</div>
            <div class="grow">
              <div class="row between"><div class="ttl">${esc(a.title)}</div><span class="badge badge-${a.severity}"><span class="dot"></span>${a.severity}</span></div>
              <div class="dsc">${esc(a.detail)}</div>
              <div class="tiny muted" style="margin-top:6px">${esc(a.agent)} · ${a.kind} · ${timeAgo(a.ts)}</div>
            </div>
            ${a.patientId ? `<button class="btn btn-sm" data-close data-act="open-patient" data-id="${a.patientId}">Open</button>` : ''}
          </div>`).join('') : empty('checkCircle', 'No alerts', 'Every monitored parameter is within range.')}
      </div>
      <div class="section-title" style="margin-top:8px">Patient communication log</div>
      <div class="grid" style="gap:10px">
        ${notifications.slice(0, 8).map((n) => {
          const p = store.patient(n.patientId);
          return `<div class="card card-pad" style="box-shadow:none">
            <div class="row between">
              <div class="row gap-sm">${icon('message', 14, 'muted')}<span class="strong small">${esc(n.template || 'Message')}</span>
                <span class="badge badge-neutral">${esc(n.channel || 'WhatsApp')}</span></div>
              <span class="tiny muted">${timeAgo(n.ts)}</span>
            </div>
            <div class="small muted" style="margin-top:6px">${esc(p?.name || '')}</div>
            <div class="small" style="margin-top:4px">${esc(n.body || '')}</div>
          </div>`;
        }).join('') || empty('message', 'No messages yet', 'Comm. AI messages will appear here.')}
      </div>`,
    footer: `<button class="btn btn-ghost" data-close>Close</button>`,
  });
}

/* --------------------------------------------------------- global search */

function wireSearch() {
  const input = document.getElementById('global-search');
  const box = document.getElementById('search-results');
  if (!input || !box) return;
  let t = null;

  const hide = () => box.classList.add('hidden');

  input.addEventListener('input', () => {
    clearTimeout(t);
    const q = input.value.trim();
    if (q.length < 2) { hide(); return; }
    t = setTimeout(async () => {
      try {
        const { results, summary } = await api.search(q);
        box.innerHTML = `
          <div class="sr-head">${icon('sparkles', 13)} Records AI · ${esc(summary)}</div>
          ${results.length ? results.map((p) => `
            <button class="sr-item" data-act="open-patient" data-id="${p.id}">
              ${avatar({ name: p.name, role: 'doctor', initials: initials(p.name) }, 'sm')}
              <span style="min-width:0;flex:1">
                <span class="sr-name truncate">${esc(p.name)}</span>
                <span class="sr-sub truncate">${esc(p.mrn)} · ${p.age}${p.gender === 'Female' ? 'F' : 'M'} · ${esc((p.symptoms || []).join(', ') || 'no complaints')}</span>
              </span>
              <span class="badge badge-${p.riskLevel}"><span class="dot"></span>${p.riskLevel}</span>
            </button>`).join('') : `<div class="sr-empty">No records matched “${esc(q)}”.</div>`}`;
        box.classList.remove('hidden');
      } catch { hide(); }
    }, 220);
  });

  input.addEventListener('blur', () => setTimeout(hide, 180));
  input.addEventListener('focus', () => { if (input.value.trim().length > 1) box.classList.remove('hidden'); });
}

/* ------------------------------------------------------------------- boot */

async function boot() {
  // If no CareFlow server answers on this origin (static hosting, GitHub Pages),
  // run the entire backend — data layer, route table and all five AI agents —
  // inside the browser. Same code, same behaviour, no server required.
  const server = await detectServer();
  if (server) {
    store.set({ localMode: false, serverInfo: server });
  } else {
    try {
      const { createLocalBackend } = await import('./local-backend.js');
      const backend = await createLocalBackend();
      useLocalBackend(backend);
      store.set({ localMode: true, localInfo: backend.info });
    } catch (err) {
      toast({ title: 'Could not start the in-browser backend', desc: err.message, type: 'error', ms: 9000 });
    }
  }

  try { await store.bootstrap(); } catch (err) {
    toast({ title: 'Cannot reach the CareFlow server', desc: 'Start it with `npm start` and reload.', type: 'error', ms: 9000 });
  }
  store.restore();
  const route = parseHash();
  if (!route.name || route.name === 'landing') {
    if (store.user && DASHBOARDS[store.user.role]) location.hash = `#/${store.user.role}`;
  }
  render();
  if (store.user) {
    try { await store.refresh({ silent: true }); } catch { /* handled by UI */ }
    render();
  }
  if (store.user) setupLive();
  if (store.localMode) {
    toast({
      title: 'Running as a static site',
      desc: 'No server needed — the data layer and all five AI agents run in this browser and save to localStorage.',
      type: 'info',
      ms: 7000,
    });
  }
}

function setupLive() {
  // In-browser mode has no other writer to poll for, and polling would only
  // interrupt typing — so only the server-backed app runs the sync loop.
  const stop = store.localMode ? () => {} : startPolling(15000);
  window.addEventListener('beforeunload', () => { stop(); cleanups.forEach((f) => f()); });
}

boot();
