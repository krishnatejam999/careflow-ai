/** Thin API client. Every call returns the parsed JSON payload.
 *
 * Two interchangeable transports:
 *   • HTTP  — talks to the Node server at /api/*
 *   • local — calls the same lib/api.js route table in-process (static hosting)
 * app.js picks one at boot depending on whether a server answered.
 */

// Resolve API paths against the *page*, not the domain root, so the app also
// works when hosted under a subpath (e.g. github.io/<repo>/).
const url = (path) => new URL(path.replace(/^\//, ''), document.baseURI).href;

let localBackend = null;

/** Switch this client to the in-browser backend. */
export function useLocalBackend(backend) {
  localBackend = backend;
}

export const isLocalBackend = () => Boolean(localBackend);

async function request(method, path, body) {
  if (localBackend) return localBackend.request(method, path, body);

  const res = await fetch(url(path), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b ?? {}),
  patch: (p, b) => request('PATCH', p, b ?? {}),

  bootstrap: () => request('GET', '/api/bootstrap'),
  login: (payload) => request('POST', '/api/auth/login', payload),
  state: () => request('GET', '/api/state'),

  checkin: (payload) => request('POST', '/api/checkin', payload),
  ocr: (rawForm) => request('POST', '/api/ai/ocr', { rawForm }),
  search: (q) => request('POST', '/api/ai/search', { q }),
  summary: (patientId) => request('POST', '/api/ai/summary', { patientId }),
  soap: (patientId, transcript) => request('POST', '/api/ai/soap', { patientId, transcript }),
  saveNote: (payload) => request('POST', '/api/ai/notes', payload),
  prescribe: (payload) => request('POST', '/api/ai/prescribe', payload),
  triage: (payload) => request('POST', '/api/ai/triage', payload),
  insights: () => request('GET', '/api/ai/insights'),
  action: (action) => request('POST', '/api/ai/actions', { action }),

  patient: (id) => request('GET', `/api/patients/${id}`),
  createPatient: (payload) => request('POST', '/api/patients', payload),
  advanceQueue: (id) => request('POST', `/api/queue/${id}/advance`),
  callNext: (department) => request('POST', '/api/queue/call-next', { department }),
  bookAppointment: (payload) => request('POST', '/api/appointments', payload),
  updateTask: (id, payload) => request('PATCH', `/api/tasks/${id}`, payload),
  reassign: (taskIds, assignedTo) => request('POST', '/api/tasks/reassign', { taskIds, assignedTo }),
  recordVitals: (payload) => request('POST', '/api/vitals', payload),
  releaseLab: (id) => request('POST', `/api/labs/${id}/release`),
  sendNotification: (payload) => request('POST', '/api/notifications/send', payload),
  updateStaff: (id, payload) => request('PATCH', `/api/staff/${id}`, payload),
  analytics: () => request('GET', '/api/analytics'),
  reset: () => request('POST', '/api/reset'),
  health: () => request('GET', '/api/health'),
};

/** Does a CareFlow server answer on this origin? */
/**
 * Hosts that serve static files only, so they can never answer /api/health.
 * Skipping the probe avoids a pointless round trip and a 404 in the browser
 * console on GitHub/GitLab Pages and when opened straight off disk.
 */
function isStaticHost() {
  return location.protocol === 'file:' || /\.(github|gitlab)\.io$/.test(location.hostname);
}

export async function detectServer(timeoutMs = 4000) {
  if (isStaticHost()) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url('/api/health'), { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(timer);
    if (!res.ok) return null;
    if (!(res.headers.get('content-type') || '').includes('application/json')) return null;
    const body = await res.json();
    return body?.ok && body.status === 'healthy' ? body : null;
  } catch {
    return null;
  }
}
