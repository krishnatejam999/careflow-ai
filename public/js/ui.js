/** Shared UI toolkit — icons, formatting, toasts, modals, drawers. */

/* ---------------------------------------------------------------- icons */
const P = {
  plus: 'M12 5v14M5 12h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  check: 'M20 6L9 17l-5-5',
  checkCircle: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3',
  alert: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  octagon: 'M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2zM12 8v4M12 16h.01',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  stethoscope: 'M4 2v6a5 5 0 0 0 10 0V2M9 13v3a5 5 0 0 0 5 5 5 5 0 0 0 5-5v-1M20 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  calendar: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  chevronRight: 'M9 18l6-6-6-6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronLeft: 'M15 18l-6-6 6-6',
  x: 'M18 6L6 18M6 6l12 12',
  menu: 'M3 12h18M3 6h18M3 18h18',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  barChart: 'M12 20V10M18 20V4M6 20v-4',
  pie: 'M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z',
  message: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z',
  pin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  heart: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  thermometer: 'M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z',
  droplet: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z',
  cpu: 'M4 4h16v16H4zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3',
  sparkles: 'M12 3l1.9 4.8L18.7 9.7l-4.8 1.9L12 16.4l-1.9-4.8L5.3 9.7l4.8-1.9zM19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8zM5 2l.7 1.7L7.4 4.4 5.7 5.1 5 6.8 4.3 5.1 2.6 4.4l1.7-.7z',
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
  arrowUp: 'M12 19V5M5 12l7-7 7 7',
  arrowDown: 'M12 5v14M19 12l-7 7-7-7',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  scan: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M3 12h18',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54z',
  play: 'M5 3l14 9-14 9z',
  pill: 'M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7zM8.5 8.5l7 7',
  bed: 'M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9',
  card: 'M1 4h22v16H1zM1 10h22',
  trending: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  layers: 'M12 2L2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  brain: 'M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2zM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z',
  route: 'M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 16h6a3 3 0 0 0 3-3V9',
  door: 'M4 22h16V2H4zM14 12h.01',
  flask: 'M9 2v6L4 19a2 2 0 0 0 1.8 3h12.4A2 2 0 0 0 20 19L15 8V2M8 2h8M6.5 15h11',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  lock: 'M5 11h14v11H5zM8 11V7a4 4 0 0 1 8 0v4',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  dollar: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  clipboard: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z',
  wand: 'M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M17.8 6.2l1.4-1.4M12.2 11.8l-1.4 1.4M3 21l9-9M12.2 6.2L10.8 4.8',
  wifi: 'M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  image: 'M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
};

export function icon(name, size = 16, cls = '') {
  const d = P[name] || P.grid;
  const paths = d.split(' z').length; // keep simple
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    d.split('M').filter(Boolean).map((seg) => `<path d="M${seg.trim()}"/>`).join('')
  }</svg>`;
}

export const ICON_NAMES = P;

/* ------------------------------------------------------------ formatting */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function initials(name = '') {
  return name.replace(/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?)\s+/i, '')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0].toUpperCase()).join('') || '?';
}

export function timeAgo(isoDate) {
  if (!isoDate) return '—';
  const diff = Math.round((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function fmtTime(isoDate) {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(isoDate, opts = { day: '2-digit', month: 'short' }) {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleDateString('en-IN', opts);
}

export function fmtDateTime(isoDate) {
  if (!isoDate) return '—';
  return `${fmtDate(isoDate, { day: '2-digit', month: 'short' })} · ${fmtTime(isoDate)}`;
}

export function minsSince(isoDate) {
  if (!isoDate) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 60000));
}

export const LEVEL_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
export const badge = (level) => `<span class="badge badge-${level || 'neutral'}"><span class="dot"></span>${LEVEL_LABEL[level] || 'Info'}</span>`;

export function avatar(user, cls = '') {
  if (!user) return '';
  const tone = { doctor: 'sky', nurse: 'violet', admin: 'ink', lab: 'amber', pharmacy: 'amber', reception: '' }[user.role] || '';
  return `<span class="avatar ${tone} ${cls}" title="${esc(user.name)}">${esc(user.initials || initials(user.name))}</span>`;
}

/* ---------------------------------------------------------------- toasts */
const ICONS = { success: 'checkCircle', error: 'octagon', warn: 'alert', info: 'sparkles' };

export function toast({ title, desc = '', type = 'success', ms = 4200 }) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <div class="ic">${icon(ICONS[type] || 'sparkles', 15)}</div>
    <div style="min-width:0;flex:1">
      <div class="ttl">${esc(title)}</div>
      ${desc ? `<div class="dsc">${esc(desc)}</div>` : ''}
    </div>
    <button class="btn-ghost btn-icon" aria-label="Dismiss" style="margin:-4px -6px 0 0">${icon('x', 14)}</button>`;
  el.querySelector('button').addEventListener('click', () => el.remove());
  stack.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 320);
  }, ms);
  return el;
}

/* ------------------------------------------------------- modal / drawer */
let escHandler = null;

export function closeOverlay() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
  if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
  document.body.style.overflow = '';
}

export function openModal({ title, subtitle = '', body = '', footer = '', wide = false }) {
  closeOverlay();
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="overlay" data-overlay>
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
        <header class="modal-hd">
          <div>
            <h3>${esc(title)}</h3>
            ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
          </div>
          <button class="btn btn-ghost btn-icon" data-close aria-label="Close">${icon('x', 16)}</button>
        </header>
        <div class="modal-bd">${body}</div>
        ${footer ? `<footer class="modal-ft">${footer}</footer>` : ''}
      </div>
    </div>`;
  document.body.style.overflow = 'hidden';
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeOverlay));
  root.querySelector('[data-overlay]').addEventListener('mousedown', (e) => {
    if (e.target.hasAttribute('data-overlay')) closeOverlay();
  });
  escHandler = (e) => { if (e.key === 'Escape') closeOverlay(); };
  document.addEventListener('keydown', escHandler);
  const focusable = root.querySelector('input,select,textarea,button.btn-primary');
  if (focusable) setTimeout(() => focusable.focus(), 60);
  return root.querySelector('.modal');
}

export function openDrawer({ title, subtitle = '', body = '', footer = '' }) {
  closeOverlay();
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="overlay" style="padding:0;align-items:stretch;justify-content:flex-end" data-overlay>
      <aside class="drawer" role="dialog" aria-modal="true">
        <header class="drawer-hd">
          <div>
            <h3>${esc(title)}</h3>
            ${subtitle ? `<p class="muted small" style="margin-top:4px">${esc(subtitle)}</p>` : ''}
          </div>
          <button class="btn btn-ghost btn-icon" data-close aria-label="Close">${icon('x', 16)}</button>
        </header>
        <div class="drawer-bd">${body}</div>
        ${footer ? `<footer class="modal-ft" style="border-radius:0">${footer}</footer>` : ''}
      </aside>
    </div>`;
  document.body.style.overflow = 'hidden';
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeOverlay));
  root.querySelector('[data-overlay]').addEventListener('mousedown', (e) => {
    if (e.target.hasAttribute('data-overlay')) closeOverlay();
  });
  escHandler = (e) => { if (e.key === 'Escape') closeOverlay(); };
  document.addEventListener('keydown', escHandler);
  return root.querySelector('.drawer');
}

/* ------------------------------------------------------------- animation */
export function animateCount(node, to, { duration = 900, decimals = 0, prefix = '', suffix = '' } = {}) {
  if (!node) return;
  const from = 0;
  const start = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    const value = from + (to - from) * eased;
    node.textContent = `${prefix}${value.toFixed(decimals)}${suffix}`;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function typewrite(node, text, speed = 12) {
  if (!node) return;
  node.textContent = '';
  node.classList.add('typewriter');
  let i = 0;
  const tick = () => {
    node.textContent = text.slice(0, i);
    i += 1;
    if (i <= text.length) setTimeout(tick, speed);
    else node.classList.remove('typewriter');
  };
  tick();
}

export function copy(text) {
  navigator.clipboard?.writeText(text).then(
    () => toast({ title: 'Copied to clipboard', type: 'info' }),
    () => toast({ title: 'Copy failed', type: 'error' }),
  );
}

/* ------------------------------------------------------------- fragments */
export function stat({ label, value, unit = '', delta = '', dir = 'up', tone = '', id = '' }) {
  return `
    <div class="stat ${tone}">
      <div class="label">${esc(label)}</div>
      <div class="value">${id ? `<span data-count="${value}">0</span>` : esc(value)}${unit ? `<span class="unit">${esc(unit)}</span>` : ''}</div>
      ${delta ? `<div class="delta ${dir}">${icon(dir === 'up' ? 'arrowUp' : 'arrowDown', 12)}${esc(delta)}</div>` : ''}
    </div>`;
}

export function skeleton(rows = 4) {
  return `<div style="padding:20px">
    <div class="skeleton skel-title"></div>
    ${Array.from({ length: rows }).map((_, i) => `<div class="skeleton skel-line" style="width:${92 - i * 9}%"></div>`).join('')}
  </div>`;
}

export function empty(iconName, title, desc = '', action = '') {
  return `<div class="empty">
    <div class="ic">${icon(iconName, 22)}</div>
    <h4>${esc(title)}</h4>
    ${desc ? `<p>${esc(desc)}</p>` : ''}
    ${action ? `<div style="margin-top:16px">${action}</div>` : ''}
  </div>`;
}
