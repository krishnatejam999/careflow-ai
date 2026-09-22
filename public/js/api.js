/** Thin API client. Every call returns the parsed JSON payload. */

const BASE = '';

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
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
};
