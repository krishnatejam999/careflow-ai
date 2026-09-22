/**
 * End-to-end smoke test.
 *   1) start the server:  npm start
 *   2) in another shell:  node scripts/smoke-test.js
 *
 * Exercises every workflow the prototype claims to support, in the same order
 * a real user would trigger them.
 */
const BASE = process.env.BASE || 'http://localhost:4000';

let pass = 0;
let fail = 0;

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function check(label, condition, extra = '') {
  if (condition) { pass += 1; console.log(`  PASS  ${label}${extra ? `  ${extra}` : ''}`); }
  else { fail += 1; console.log(`  FAIL  ${label}${extra ? `  ${extra}` : ''}`); }
}

// Unique name per run so the test is idempotent against a dirty database.
const SMOKE_NAME = `Test Patient ${Date.now().toString(36).slice(-5)}`;

const SAMPLE_FORM = `Name: ${SMOKE_NAME}
Age: 66
Gender: Male
Mobile No: +91 98765 12034
Blood Group: A+
Address: Sion, Mumbai
Chief Complaint: Breathlessness and chest tightness since 2 days
Known Allergies: Sulfa drugs
Past History: Hypertension, Type 2 Diabetes
Insurance: Star Health
Policy No: SH-2291-8842`;

async function main() {
  console.log(`\nCareFlow AI smoke test → ${BASE}\n`);

  console.log('Page shell');
  for (const [path, needle] of [
    ['/', '<div id="app">'],
    ['/css/styles.css', '--grad-brand'],
    ['/js/app.js', 'parseHash'],
    ['/js/views/reception.js', 'AI check-in'],
  ]) {
    const res = await fetch(BASE + path);
    const text = await res.text();
    check(`GET ${path}`, res.ok && text.includes(needle), `(${res.status}, ${text.length} bytes)`);
  }

  console.log('\nAuth & bootstrap');
  const boot = await call('GET', '/api/bootstrap');
  check('GET /api/bootstrap', boot.status === 200 && boot.data.agents?.length === 5, `${boot.data.agents?.length} agents`);
  check('4 demo role accounts', boot.data.demoAccounts?.length === 4);

  const login = await call('POST', '/api/auth/login', { email: 'doctor@careflow.ai', password: 'careflow' });
  check('POST /api/auth/login (doctor)', login.status === 200 && login.data.user?.role === 'doctor', login.data.user?.name);

  console.log('\nSnapshot');
  const state = await call('GET', '/api/state');
  const s = state.data;
  check('GET /api/state', state.status === 200 && Array.isArray(s.patients) && s.patients.length > 0, `${s.patients?.length} patients, ${s.queue?.length} tokens`);
  check('Derived alerts present', Array.isArray(s.alerts) && s.alerts.length > 0, `${s.alerts?.length} alerts`);
  check('Coordinator insights computed', Array.isArray(s.insights) && s.insights.length > 0, `${s.insights?.length} insights`);

  console.log('\nAI check-in (OCR → triage → route → tasks → comms)');
  const ocr = await call('POST', '/api/ai/ocr', { rawForm: SAMPLE_FORM });
  const f = ocr.data.extract?.fields || {};
  check('OCR extracts a name', f.name === SMOKE_NAME, f.name);
  check('OCR extracts age', f.age === 66, String(f.age));
  check('OCR extracts symptom list', Array.isArray(f.symptoms) && f.symptoms.length === 2, JSON.stringify(f.symptoms));
  check('OCR extracts allergies', Array.isArray(f.allergies) && f.allergies[0] === 'Sulfa drugs', JSON.stringify(f.allergies));
  check('OCR confidence reported', ocr.data.extract?.confidenceScore > 0.8, `${Math.round((ocr.data.extract?.confidenceScore || 0) * 100)}%`);

  const checkin = await call('POST', '/api/checkin', { rawForm: SAMPLE_FORM });
  const ci = checkin.data;
  check('POST /api/checkin', checkin.status === 200 && !!ci.patient, ci.patient?.mrn);
  check('Triage flagged critical', ci.triage?.level === 'critical', `score ${ci.triage?.score}`);
  check('Routed to Cardiology', ci.route?.department === 'Cardiology', ci.route?.room);
  check('Queue token issued', /^OPD-\d+$/.test(ci.queueEntry?.token || ''), ci.queueEntry?.token);
  check('Workflow AI created tasks', ci.tasks?.length >= 2, `${ci.tasks?.length} tasks`);
  check('Comm. AI notified patient', !!ci.notification?.body, ci.notification?.template);

  console.log('\nQueue management');
  const callNext = await call('POST', '/api/queue/call-next', {});
  check('POST /api/queue/call-next picks highest priority', callNext.status === 200 && callNext.data.queueEntry?.status === 'in-consult', callNext.data.queueEntry?.token);
  const advance = await call('POST', `/api/queue/${ci.queueEntry.id}/advance`);
  check('POST /api/queue/:id/advance', advance.status === 200, advance.data.queueEntry?.status);

  console.log('\nNursing: vitals + escalation');
  const vitals = await call('POST', '/api/vitals', {
    patientId: ci.patient.id, recordedBy: 'u_nurse', hr: 118, spo2: 88, bpSys: 168, bpDia: 98, temp: 38.9, rr: 26, pain: 4, note: 'Hypoxic',
  });
  check('POST /api/vitals flags critical', vitals.data.vital?.flag === 'critical', vitals.data.reasons?.join('; '));
  check('Critical reading escalates to a consultant task', !!vitals.data.escalatedTask);

  console.log('\nClinical: summary, SOAP, prescribing');
  const summary = await call('POST', '/api/ai/summary', { patientId: ci.patient.id });
  check('POST /api/ai/summary', summary.status === 200 && summary.data.summary?.bullets?.length >= 4, `${summary.data.summary?.riskFlags?.length} risk flags`);

  const soap = await call('POST', '/api/ai/soap', { patientId: ci.patient.id, transcript: 'Started on IV furosemide' });
  check('POST /api/ai/soap drafts S/O/A/P', soap.data.draft?.assessment && soap.data.draft?.plan, soap.data.draft?.chiefComplaint);

  const note = await call('POST', '/api/ai/notes', { ...soap.data.draft, patientId: ci.patient.id, doctorId: 'u_doctor', aiGenerated: true });
  check('POST /api/ai/notes saves the note', note.status === 200 && note.data.note?.id, note.data.note?.id);

  const allergyRx = await call('POST', '/api/ai/prescribe', {
    patientId: ci.patient.id, doctorId: 'u_doctor', items: [{ drug: 'Sulfamethoxazole 500mg', dose: '1 tab', freq: 'BD', duration: '5 days' }],
  });
  check('Prescribing catches the recorded allergy', allergyRx.data.allergyWarnings?.length > 0, allergyRx.data.allergyWarnings?.[0]);

  const okRx = await call('POST', '/api/ai/prescribe', {
    patientId: ci.patient.id, doctorId: 'u_doctor', items: [{ drug: 'Furosemide 40mg', dose: '1 tab', freq: 'OD', duration: '7 days' }],
  });
  check('Safe prescription accepted', okRx.status === 200 && okRx.data.allergyWarnings?.length === 0);

  console.log('\nRecords AI search');
  const search = await call('POST', '/api/ai/search', { q: 'chest' });
  check('POST /api/ai/search finds records', search.data.results?.length > 0, `${search.data.results?.length} matches · ${search.data.summary}`);

  console.log('\nTasks, labs, appointments, comms');
  const openTask = s.tasks.find((t) => t.status !== 'done' && t.patientId);
  const patched = await call('PATCH', `/api/tasks/${openTask.id}`, { status: 'done' });
  check('PATCH /api/tasks/:id', patched.data.task?.status === 'done', openTask.title?.slice(0, 40));

  const reassign = await call('POST', '/api/tasks/reassign', { taskIds: [s.tasks.filter((t) => t.status !== 'done').slice(0, 2).map((t) => t.id)[0]], assignedTo: 'u_nurse2' });
  check('POST /api/tasks/reassign', reassign.status === 200, reassign.data.message || reassign.data.error);

  const processing = s.labs.find((l) => l.status === 'processing');
  if (processing) {
    const released = await call('POST', `/api/labs/${processing.id}/release`);
    check('POST /api/labs/:id/release notifies the patient', released.data.lab?.status === 'reported' && !!released.data.notification);
  } else {
    check('POST /api/labs/:id/release (no processing lab, skipped)', true, 'skipped');
  }

  const appt = await call('POST', '/api/appointments', { patientId: ci.patient.id, doctorId: 'u_doctor', department: 'General Medicine', datetime: new Date(Date.now() + 86400000).toISOString(), type: 'Follow-up' });
  check('POST /api/appointments', appt.status === 200 && !!appt.data.appointment?.id);

  const notify = await call('POST', '/api/notifications/send', { patientId: ci.patient.id, body: 'Smoke test message', template: 'Care plan update' });
  check('POST /api/notifications/send', notify.status === 200 && notify.data.notification?.status === 'delivered');

  console.log('\nAdmin');
  const analytics = await call('GET', '/api/analytics');
  check('GET /api/analytics', analytics.status === 200 && analytics.data.occupancy?.pct > 0, `${analytics.data.queue?.live} live tokens, ${analytics.data.occupancy?.pct}% occupancy`);
  for (const action of ['rebalance', 'stepdown', 'express-slots']) {
    const res = await call('POST', '/api/ai/actions', { action });
    check(`POST /api/ai/actions → ${action}`, res.status === 200, res.data.message);
  }
  const staff = await call('PATCH', '/api/staff/u_nurse2', { status: 'on-shift' });
  check('PATCH /api/staff/:id', staff.data.user?.status === 'on-shift');

  console.log('\nError handling');
  const bad = await call('POST', '/api/checkin', { rawForm: 'no name field at all' });
  check('Check-in without a name is rejected', bad.status === 400 && bad.data.ok === false, bad.data.error);
  const missing = await call('GET', '/api/patients/does-not-exist');
  check('Unknown patient returns 404', missing.status === 404);
  const noQueue = await call('GET', '/api/nope');
  check('Unknown route returns 404', noQueue.status === 404);

  console.log('\nPersistence');
  const after = await call('GET', '/api/state');
  check('State persisted across requests', after.data.patients.length === s.patients.length + 1, `${after.data.patients.length} patients`);
  check('Activity stream grew', after.data.activity.length >= 10, `${after.data.activity.length} events`);

  console.log(`\n${'─'.repeat(52)}`);
  console.log(`  ${pass} passed, ${fail} failed`);
  console.log(`${'─'.repeat(52)}\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error('\nSmoke test crashed:', err.message);
  console.error('Is the server running?  npm start');
  process.exit(1);
});
