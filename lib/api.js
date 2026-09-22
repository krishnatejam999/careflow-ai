/**
 * CareFlow AI — REST API.
 *
 * Every route handler receives ({ body, query, params, db }) and returns a
 * plain object. The HTTP layer in server.js turns that into JSON.
 */
import { db, commit, resetDb, uid, now, minutesAgo } from './db.js';
import {
  ocrExtract, recordSearch, triage, route, generateTasks,
  composeNotification, coordinatorInsights, logActivity, flagLabs,
} from './ai.js';

const ok = (payload = {}) => ({ ok: true, ...payload });
const fail = (message, status = 400) => ({ ok: false, error: message, __status: status });

const publicUser = (u) => {
  const { ...rest } = u;
  return rest;
};

/* ------------------------------------------------------------------ helpers */

function alertsFor(state) {
  const alerts = [];
  const order = { critical: 0, high: 1, medium: 2, low: 3 };

  for (const v of state.vitals) {
    if (v.flag === 'critical' || v.flag === 'high') {
      const p = state.patients.find((x) => x.id === v.patientId);
      if (!p) continue;
      alerts.push({
        id: `al_v_${v.id}`,
        severity: v.flag,
        kind: 'Vitals',
        title: `${p.name} — abnormal vitals`,
        detail: `HR ${v.hr}, BP ${v.bpSys}/${v.bpDia}, SpO₂ ${v.spo2}%, RR ${v.rr}${v.note ? ` · ${v.note}` : ''}`,
        patientId: p.id,
        ts: v.recordedAt,
        agent: 'Workflow AI',
      });
    }
  }
  for (const l of state.labs) {
    if (l.flag === 'critical' || l.flag === 'high') {
      const p = state.patients.find((x) => x.id === l.patientId);
      if (!p) continue;
      alerts.push({
        id: `al_l_${l.id}`,
        severity: l.flag,
        kind: 'Lab',
        title: `${p.name} — ${l.test}`,
        detail: `Result ${l.result} ${l.unit} (reference ${l.range}).`,
        patientId: p.id,
        ts: l.reportedAt || now(),
        agent: 'Records AI',
      });
    }
  }
  for (const t of state.tasks) {
    if (t.status !== 'done' && t.priority === 'critical') {
      alerts.push({
        id: `al_t_${t.id}`,
        severity: 'critical',
        kind: 'Task',
        title: t.title,
        detail: `${t.category} · assigned to ${state.users.find((u) => u.id === t.assignedTo)?.name || 'unassigned'}`,
        patientId: t.patientId,
        ts: t.dueAt,
        agent: t.source,
      });
    }
  }

  return alerts
    .sort((a, b) => (order[a.severity] - order[b.severity]) || new Date(b.ts) - new Date(a.ts))
    .slice(0, 12);
}

function patientSummary(patient, state) {
  const vitals = state.vitals.filter((v) => v.patientId === patient.id).sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
  const labs = state.labs.filter((l) => l.patientId === patient.id);
  const notes = state.notes.filter((n) => n.patientId === patient.id);
  const rx = state.prescriptions.filter((r) => r.patientId === patient.id);
  const t = triage(patient, state.vitals);

  const riskFlags = [];
  if ((patient.allergies || []).length) riskFlags.push({ level: 'high', text: `Allergies: ${patient.allergies.join(', ')} — verify every order.` });
  if (patient.age >= 65) riskFlags.push({ level: 'medium', text: `Age ${patient.age} — senior patient, review polypharmacy.` });
  if (patient.age <= 12) riskFlags.push({ level: 'medium', text: `Paediatric patient (age ${patient.age}) — weight-based dosing required.` });
  for (const c of patient.conditions || []) riskFlags.push({ level: 'medium', text: `Chronic: ${c}` });
  for (const l of labs.filter((x) => x.flag === 'critical' || x.flag === 'high')) {
    riskFlags.push({ level: l.flag, text: `${l.test} ${l.result} ${l.unit} — outside reference range (${l.range}).` });
  }
  const latest = vitals[0];
  if (latest) {
    if (latest.spo2 < 92) riskFlags.push({ level: 'critical', text: `SpO₂ ${latest.spo2}% — hypoxia, escalate.` });
    if (latest.bpSys >= 160) riskFlags.push({ level: 'high', text: `Systolic BP ${latest.bpSys} mmHg — hypertensive.` });
    if (latest.temp >= 38.5) riskFlags.push({ level: 'high', text: `Temperature ${latest.temp}°C — febrile.` });
  }
  if (!patient.insurance?.valid) riskFlags.push({ level: 'low', text: 'Insurance validity not confirmed.' });

  const uniqueFlags = riskFlags.filter((f, i, arr) => arr.findIndex((x) => x.text === f.text) === i);

  const bullets = [
    `${patient.age}${patient.gender === 'Female' ? 'F' : 'M'} · ${patient.mrn} · Blood group ${patient.bloodGroup}`,
    patient.symptoms?.length ? `Presenting with ${patient.symptoms.join(', ').toLowerCase()}.` : 'No presenting complaints recorded.',
    patient.conditions?.length ? `Known ${patient.conditions.join(' and ')}.` : 'No known chronic conditions.',
    patient.medications?.length ? `Current medications: ${patient.medications.join(', ')}.` : 'Not on regular medication.',
    patient.lastVisit ? `Last encounter ${patient.lastVisit}.` : 'First recorded visit to this facility.',
    `Insurance: ${patient.insurance?.provider} (${patient.insurance?.policyNo}) — ${patient.insurance?.scheme}.`,
  ];

  const suggestedFocus = [];
  if (labs.some((l) => l.flag === 'critical' || l.flag === 'high')) suggestedFocus.push('Review flagged lab results before examining.');
  if ((patient.allergies || []).length) suggestedFocus.push(`Avoid ${patient.allergies.join(', ')} in all prescriptions.`);
  if (patient.conditions?.includes('Type 2 Diabetes')) suggestedFocus.push('Check glycaemic control and foot examination.');
  if (latest && latest.spo2 < 92) suggestedFocus.push('Repeat SpO₂ after 10 minutes of oxygen therapy.');
  if (!suggestedFocus.length) suggestedFocus.push('Routine consultation — no AI-flagged risks.');

  return {
    agent: 'Records AI',
    patientId: patient.id,
    headline: `${patient.name} — ${patient.age}${patient.gender === 'Female' ? 'F' : 'M'} presenting with ${(patient.symptoms || ['no recorded complaint']).join(', ').toLowerCase()}`,
    bullets,
    riskFlags: uniqueFlags,
    suggestedFocus,
    triage: t,
    history: {
      encounters: notes.length + rx.length,
      lastVitals: latest || null,
      labs: labs.map((l) => ({ test: l.test, result: l.result, unit: l.unit, flag: l.flag })),
      medications: patient.medications || [],
    },
  };
}

function generateSoap(patient, transcript = '', state) {
  const vitals = state.vitals.filter((v) => v.patientId === patient.id).sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))[0];
  const labs = state.labs.filter((l) => l.patientId === patient.id);
  const t = triage(patient, state.vitals);

  const complaint = (patient.symptoms || []).join(' and ') || 'general review';
  const objectiveBits = [];
  if (vitals) {
    objectiveBits.push(`HR ${vitals.hr} bpm`, `BP ${vitals.bpSys}/${vitals.bpDia} mmHg`, `Temp ${vitals.temp}°C`, `SpO₂ ${vitals.spo2}%`, `RR ${vitals.rr}/min`);
  }
  for (const l of labs) objectiveBits.push(`${l.test} ${l.result} ${l.unit}`);

  const assessmentParts = [];
  if (t.level === 'critical' || t.level === 'high') assessmentParts.push('Acute presentation requiring prompt intervention');
  if (patient.conditions?.length) assessmentParts.push(patient.conditions.join(' with '));
  if (!assessmentParts.length) assessmentParts.push('Stable presentation, no red flags');

  const planParts = [
    vitals && vitals.spo2 < 92 ? 'Oxygen therapy titrated to SpO₂ 94–98%' : 'Continue current management',
    'Review flagged investigations and repeat abnormal parameters in 24h',
  ];
  if ((patient.allergies || []).length) planParts.push(`Medication allergy alert: avoid ${patient.allergies.join(', ')}`);
  if (transcript.trim()) planParts.push('Counsel patient on lifestyle and adherence as discussed');

  return {
    agent: 'Records AI',
    patientId: patient.id,
    aiGenerated: true,
    chiefComplaint: complaint.charAt(0).toUpperCase() + complaint.slice(1),
    subjective: `${patient.age}${patient.gender === 'Female' ? 'F' : 'M'} known ${patient.conditions?.join(', ') || 'no chronic illness'}. Reports ${complaint.toLowerCase()}. ${patient.lastVisit ? `Last encounter ${patient.lastVisit}.` : 'First recorded encounter.'}${transcript.trim() ? ` Clinician notes: ${transcript.trim()}` : ''}`,
    objective: objectiveBits.length ? objectiveBits.join(' · ') : 'Vitals not yet recorded — obtain baseline before prescribing.',
    assessment: `${assessmentParts.join('. ')}. AI triage score ${t.score}/100 (${t.level}).`,
    plan: planParts.join('. ') + '.',
    triage: t,
  };
}

/* ------------------------------------------------------------------ routes */

export const routes = {
  /* ---- health ---- */
  'GET /api/health': ({ db: state }) => ok({
    status: 'healthy',
    agents: state.agents.length,
    patients: state.patients.length,
    liveQueue: state.queue.filter((q) => q.status !== 'completed').length,
    uptimeSeconds: typeof process !== 'undefined' && process.uptime
      ? Math.round(process.uptime())
      : Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000),
    runtime: typeof process !== 'undefined' && process.versions ? `node ${process.versions.node}` : (typeof window !== 'undefined' ? 'browser' : 'unknown'),
    now: now(),
  }),

  /* ---- auth ---- */
  'POST /api/auth/login': ({ body, db: state }) => {
    const email = String(body.email || '').trim().toLowerCase();
    const user = state.users.find((u) => u.email.toLowerCase() === email)
      || state.users.find((u) => u.role === body.role);
    if (!user) return fail('No demo account matches that email. Try one of the quick-login buttons.');
    if (user.status === 'off-shift') user.status = 'on-shift';
    logActivity(state, 'Coordinator AI', 'info', `${user.name} signed in to the ${user.role} dashboard.`, user.role);
    commit();
    return ok({ user: publicUser(user), token: `demo.${user.id}` });
  },

  'GET /api/bootstrap': ({ db: state }) => ok({
    hospital: { name: 'Sunrise Multispeciality Hospital', site: 'Andheri West, Mumbai', beds: state.beds.reduce((a, b) => a + b.total, 0) },
    agents: state.agents,
    users: state.users.map(publicUser),
    demoAccounts: ['reception', 'doctor', 'nurse', 'admin']
      .map((role) => state.users.find((u) => u.role === role))
      .filter(Boolean)
      .map(publicUser),
  }),

  /* ---- full snapshot ---- */
  'GET /api/state': ({ db: state }) => ok({
    patients: state.patients,
    queue: state.queue,
    appointments: state.appointments,
    tasks: state.tasks,
    vitals: state.vitals,
    labs: state.labs,
    prescriptions: state.prescriptions,
    notes: state.notes,
    activity: state.activity,
    notifications: state.notifications,
    beds: state.beds,
    revenue: state.revenue,
    throughput: state.throughput,
    insights: coordinatorInsights(state),
    payments: state.payments,
    audit: state.audit,
    users: state.users,
    agents: state.agents,
    alerts: alertsFor(state),
    counters: state.counters,
    serverTime: now(),
  }),

  /* ---- patients ---- */
  'GET /api/patients': ({ query, db: state }) => {
    let list = [...state.patients];
    if (query.q) list = recordSearch(query.q, state).map((r) => r.patient);
    return ok({ patients: list });
  },

  'GET /api/patients/:id': ({ params, db: state }) => {
    const p = state.patients.find((x) => x.id === params.id);
    if (!p) return fail('Patient not found', 404);
    return ok({
      patient: p,
      summary: patientSummary(p, state),
      labs: state.labs.filter((l) => l.patientId === p.id),
      vitals: state.vitals.filter((v) => v.patientId === p.id),
      prescriptions: state.prescriptions.filter((r) => r.patientId === p.id),
      notes: state.notes.filter((n) => n.patientId === p.id),
      tasks: state.tasks.filter((t) => t.patientId === p.id),
    });
  },

  /** The showpiece: OCR → patient record → triage → routing → token → tasks → comms. */
  'POST /api/checkin': ({ body, db: state }) => {
    if (!body.rawForm && !body.fields?.name) return fail('Provide an intake form or a patient name.');

    const extract = body.rawForm ? ocrExtract(body.rawForm) : { fields: body.fields, confidence: {}, confidenceScore: 1, summary: 'Manual entry.', needsReview: false, agent: 'Reception AI' };
    const f = { ...extract.fields, ...(body.fields || {}) };
    if (!f.name) return fail('Could not find a patient name on the form. Add "Name: ..." and retry.');

    const existing = state.patients.find((p) => p.name.toLowerCase() === String(f.name).toLowerCase());
    const patient = existing || {
      id: uid('p'),
      mrn: `MRN-${++state.counters.mrn}`,
      name: f.name,
      age: f.age || 30,
      gender: f.gender || 'Not specified',
      phone: f.phone || '+91 00000 00000',
      bloodGroup: f.bloodGroup || 'Not known',
      address: f.address || '—',
      allergies: f.allergies || [],
      conditions: f.conditions || [],
      medications: f.medications || [],
      insurance: {
        provider: f.insurance || 'Self pay',
        policyNo: f.policyNo || '—',
        scheme: f.insurance ? 'Cashless / reimbursement' : 'Self pay',
        valid: Boolean(f.insurance),
      },
      symptoms: f.symptoms || [],
      riskLevel: 'medium',
      primaryDoctorId: null,
      lastVisit: null,
      createdAt: now(),
    };
    if (existing) {
      existing.symptoms = [...new Set([...(existing.symptoms || []), ...(f.symptoms || [])])];
      existing.allergies = [...new Set([...(existing.allergies || []), ...(f.allergies || [])])];
    } else {
      state.patients.unshift(patient);
    }

    const t = triage(patient, state.vitals);
    const r = route(patient, t);
    patient.riskLevel = t.level;
    patient.primaryDoctorId = patient.primaryDoctorId || r.doctorId;

    const token = `OPD-${++state.counters.token}`;
    const queueEntry = {
      id: uid('q'),
      token,
      patientId: patient.id,
      department: r.department,
      doctorId: r.doctorId,
      status: t.level === 'critical' ? 'in-consult' : 'waiting',
      priority: t.level,
      source: body.rawForm ? 'Reception AI' : 'Manual entry',
      checkedInAt: now(),
      calledAt: t.level === 'critical' ? now() : null,
      waitMinutes: 0,
      triageScore: t.score,
    };
    state.queue.unshift(queueEntry);

    const createdTasks = generateTasks(patient, t, r, state);

    const notification = composeNotification('check-in', patient, { token, department: r.department, wait: r.estimatedWaitMinutes });
    state.notifications.unshift({ id: uid('nt'), ts: now(), ...notification });

    logActivity(state, 'Reception AI', 'info', `OCR check-in complete for ${patient.name} — ${Object.keys(extract.fields).length} fields extracted, token ${token} issued.`);
    logActivity(state, 'Workflow AI', t.level === 'critical' ? 'critical' : 'info', `Triage score ${t.score}/100 (${t.level}) for ${patient.name}. Routed to ${r.department} · ${r.room}.`);
    logActivity(state, 'Workflow AI', 'info', `Assigned ${createdTasks.length} task${createdTasks.length === 1 ? '' : 's'} to the care team for ${patient.name}.`);
    logActivity(state, 'Comm. AI', 'info', notification.message);
    state.audit.unshift({ id: uid('au'), ts: now(), actor: 'Reception AI', action: `AI check-in created ${patient.mrn}`, entity: patient.mrn });
    commit();

    return ok({
      patient, queueEntry, tasks: createdTasks, triage: t, route: r,
      notification, extract, alerts: alertsFor(state),
    });
  },

  'POST /api/patients': ({ body, db: state }) => {
    if (!body.name) return fail('Patient name is required.');
    const patient = {
      id: uid('p'),
      mrn: `MRN-${++state.counters.mrn}`,
      name: body.name,
      age: Number(body.age) || 30,
      gender: body.gender || 'Not specified',
      phone: body.phone || '—',
      bloodGroup: body.bloodGroup || 'Not known',
      address: body.address || '—',
      allergies: body.allergies || [],
      conditions: body.conditions || [],
      medications: body.medications || [],
      insurance: { provider: body.insurance || 'Self pay', policyNo: body.policyNo || '—', scheme: body.scheme || 'Self pay', valid: Boolean(body.insurance) },
      symptoms: body.symptoms || [],
      riskLevel: 'low',
      primaryDoctorId: null,
      lastVisit: null,
      createdAt: now(),
    };
    state.patients.unshift(patient);
    state.audit.unshift({ id: uid('au'), ts: now(), actor: 'Reception', action: `Registered ${patient.mrn}`, entity: patient.mrn });
    commit();
    return ok({ patient });
  },

  'PATCH /api/patients/:id': ({ params, body, db: state }) => {
    const p = state.patients.find((x) => x.id === params.id);
    if (!p) return fail('Patient not found', 404);
    Object.assign(p, body, { id: p.id });
    commit();
    return ok({ patient: p });
  },

  /* ---- queue ---- */
  'GET /api/queue': ({ db: state }) => ok({ queue: state.queue }),

  'POST /api/queue/:id/advance': ({ params, db: state }) => {
    const q = state.queue.find((x) => x.id === params.id);
    if (!q) return fail('Queue entry not found', 404);
    const p = state.patients.find((x) => x.id === q.patientId);
    const order = ['waiting', 'in-consult', 'completed'];
    const next = order[Math.min(order.indexOf(q.status) + 1, order.length - 1)];

    q.status = next;
    if (next === 'in-consult') {
      q.calledAt = now();
      q.waitMinutes = Math.max(1, Math.round((Date.now() - new Date(q.checkedInAt)) / 60000));
      const doctor = state.users.find((u) => u.id === q.doctorId);
      const room = q.department === 'Cardiology' ? 'Room 04 · Block C' : 'Room 06 · Block B';
      const notification = composeNotification('queue-called', p, { token: q.token, room, doctor: doctor?.name || 'your doctor' });
      state.notifications.unshift({ id: uid('nt'), ts: now(), ...notification });
      logActivity(state, 'Reception AI', 'info', `${q.token} called — ${p.name} sent to ${room}.`);
    }
    if (next === 'completed') {
      q.completedAt = now();
      const done = state.tasks.filter((t) => t.patientId === q.patientId && t.status !== 'done');
      done.forEach((t) => { t.status = 'done'; t.completedAt = now(); });
      logActivity(state, 'Records AI', 'info', `Encounter closed for ${p.name}. ${done.length} task${done.length === 1 ? '' : 's'} auto-closed.`);
    }
    commit();
    return ok({ queueEntry: q, queue: state.queue, notifications: state.notifications.slice(0, 6), tasks: state.tasks });
  },

  'POST /api/queue/call-next': ({ body, db: state }) => {
    const dept = body.department;
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const candidates = state.queue
      .filter((q) => q.status === 'waiting' && (!dept || q.department === dept))
      .sort((a, b) => (priorityOrder[a.priority] - priorityOrder[b.priority]) || (b.waitMinutes - a.waitMinutes));
    if (!candidates.length) return fail('No patients are waiting in that queue.', 409);

    const q = candidates[0];
    q.status = 'in-consult';
    q.calledAt = now();
    q.waitMinutes = Math.max(1, Math.round((Date.now() - new Date(q.checkedInAt)) / 60000));

    const p = state.patients.find((x) => x.id === q.patientId);
    const doctor = state.users.find((u) => u.id === q.doctorId);
    logActivity(state, 'Workflow AI', 'info', `Called next patient ${q.token} (${p.name}) — priority ${q.priority}, waited ${q.waitMinutes} min.`);
    const notification = composeNotification('queue-called', p, { token: q.token, room: 'Room 06 · Block B', doctor: doctor?.name || 'your doctor' });
    state.notifications.unshift({ id: uid('nt'), ts: now(), ...notification });
    commit();
    return ok({ queueEntry: q, queue: state.queue, notification });
  },

  /* ---- appointments ---- */
  'GET /api/appointments': ({ db: state }) => ok({ appointments: state.appointments }),

  'POST /api/appointments': ({ body, db: state }) => {
    const p = state.patients.find((x) => x.id === body.patientId);
    if (!p) return fail('Select a patient for the appointment.');
    const appt = {
      id: uid('a'),
      patientId: p.id,
      doctorId: body.doctorId || 'u_doctor',
      department: body.department || 'General Medicine',
      datetime: body.datetime || now(),
      type: body.type || 'Consultation',
      status: 'confirmed',
      notes: body.notes || '',
    };
    state.appointments.unshift(appt);
    logActivity(state, 'Reception AI', 'info', `Booked ${appt.type.toLowerCase()} for ${p.name} on ${new Date(appt.datetime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`);
    commit();
    return ok({ appointment: appt, appointments: state.appointments });
  },

  /* ---- tasks ---- */
  'GET /api/tasks': ({ db: state }) => ok({ tasks: state.tasks }),

  'PATCH /api/tasks/:id': ({ params, body, db: state }) => {
    const t = state.tasks.find((x) => x.id === params.id);
    if (!t) return fail('Task not found', 404);
    Object.assign(t, body, { id: t.id });
    if (body.status === 'done') t.completedAt = now();
    logActivity(state, 'Workflow AI', body.status === 'done' ? 'info' : 'warning',
      `Task "${t.title}" moved to ${t.status}${body.assignedTo ? ` and reassigned to ${state.users.find((u) => u.id === body.assignedTo)?.name}` : ''}.`);
    commit();
    return ok({ task: t, tasks: state.tasks, activity: state.activity });
  },

  'POST /api/tasks/reassign': ({ body, db: state }) => {
    const target = state.users.find((u) => u.id === body.assignedTo);
    if (!target) return fail('Choose a staff member to reassign to.');
    const ids = body.taskIds || [];
    const moved = [];
    for (const id of ids) {
      const t = state.tasks.find((x) => x.id === id);
      if (!t) continue;
      t.assignedTo = target.id;
      moved.push(t);
    }
    if (!moved.length) return fail('No matching tasks found.');
    state.users.forEach((u) => {
      const open = state.tasks.filter((t) => t.assignedTo === u.id && t.status !== 'done').length;
      u.load = Math.min(99, 20 + open * 12);
    });
    logActivity(state, 'Coordinator AI', 'info', `Rebalanced ${moved.length} task${moved.length === 1 ? '' : 's'} to ${target.name} (approval by Admin).`);
    commit();
    return ok({ tasks: state.tasks, users: state.users });
  },

  /* ---- vitals ---- */
  'GET /api/vitals': ({ db: state }) => ok({ vitals: state.vitals }),

  'POST /api/vitals': ({ body, db: state }) => {
    const p = state.patients.find((x) => x.id === body.patientId);
    if (!p) return fail('Select a patient to record vitals.');
    const v = {
      id: uid('v'),
      patientId: p.id,
      recordedBy: body.recordedBy || 'u_nurse',
      recordedAt: now(),
      hr: Number(body.hr) || 0,
      bpSys: Number(body.bpSys) || 0,
      bpDia: Number(body.bpDia) || 0,
      temp: Number(body.temp) || 0,
      spo2: Number(body.spo2) || 0,
      rr: Number(body.rr) || 0,
      pain: Number(body.pain) || 0,
      note: body.note || '',
      flag: 'normal',
    };

    const reasons = [];
    if (v.spo2 && v.spo2 < 92) { v.flag = 'critical'; reasons.push(`SpO₂ ${v.spo2}% below safe threshold`); }
    if (v.hr && (v.hr > 110 || v.hr < 50)) { v.flag = v.flag === 'critical' ? 'critical' : 'high'; reasons.push(`HR ${v.hr} bpm out of range`); }
    if (v.bpSys && (v.bpSys >= 160 || v.bpSys <= 90)) { v.flag = v.flag === 'critical' ? 'critical' : 'high'; reasons.push(`Systolic BP ${v.bpSys} mmHg`); }
    if (v.temp && v.temp >= 38.5) { v.flag = v.flag === 'critical' ? 'critical' : 'medium'; reasons.push(`Temperature ${v.temp}°C`); }
    if (v.rr && v.rr >= 24) { v.flag = v.flag === 'critical' ? 'critical' : 'high'; reasons.push(`Respiratory rate ${v.rr}/min`); }

    state.vitals.unshift(v);
    const t = triage(p, state.vitals);
    p.riskLevel = t.level;

    let escalatedTask = null;
    if (v.flag === 'critical') {
      escalatedTask = {
        id: uid('t'), title: `Escalate ${p.name} — critical vitals (${reasons.join('; ')})`,
        patientId: p.id, assignedTo: 'u_doctor', priority: 'critical', status: 'todo',
        category: 'Escalation', dueAt: now(), source: 'Workflow AI', createdAt: now(),
      };
      state.tasks.unshift(escalatedTask);
      logActivity(state, 'Workflow AI', 'critical', `Critical vitals recorded for ${p.name}: ${reasons.join('; ')}. Escalated to Dr. Rohan Mehta.`);
    } else if (reasons.length) {
      logActivity(state, 'Workflow AI', 'warning', `Abnormal vitals for ${p.name}: ${reasons.join('; ')}. Flagged for review.`);
    } else {
      logActivity(state, 'Records AI', 'info', `Vitals recorded for ${p.name} — all parameters within range.`);
    }

    commit();
    return ok({ vital: v, vitals: state.vitals, triage: t, escalatedTask, patient: p, reasons, alerts: alertsFor(state) });
  },

  /* ---- labs ---- */
  'GET /api/labs': ({ db: state }) => ok({ labs: flagLabs(state.labs) }),

  'POST /api/labs/:id/release': ({ params, db: state }) => {
    const l = state.labs.find((x) => x.id === params.id);
    if (!l) return fail('Lab result not found', 404);
    l.status = 'reported';
    l.reportedAt = now();
    const p = state.patients.find((x) => x.id === l.patientId);
    const notification = composeNotification('lab-ready', p, { test: l.test, result: l.result, unit: l.unit });
    state.notifications.unshift({ id: uid('nt'), ts: now(), ...notification });
    logActivity(state, 'Records AI', l.flag === 'critical' ? 'critical' : 'info', `Released ${l.test} for ${p.name} (${l.result} ${l.unit}) and notified the patient.`);
    commit();
    return ok({ lab: l, labs: state.labs, notification });
  },

  /* ---- AI ---- */
  'POST /api/ai/ocr': ({ body }) => ok({ extract: ocrExtract(body.rawForm || '') }),

  'POST /api/ai/search': ({ body, db: state }) => {
    const results = recordSearch(body.q, state);
    return ok({
      results: results.map((r) => ({ ...r.patient, matchReasons: r.reasons, relevance: r.score })),
      agent: 'Records AI',
      summary: results.length ? `${results.length} record${results.length === 1 ? '' : 's'} matched "${body.q}".` : `No records matched "${body.q}".`,
    });
  },

  'POST /api/ai/summary': ({ body, db: state }) => {
    const p = state.patients.find((x) => x.id === body.patientId);
    if (!p) return fail('Patient not found', 404);
    return ok({ summary: patientSummary(p, state) });
  },

  'POST /api/ai/soap': ({ body, db: state }) => {
    const p = state.patients.find((x) => x.id === body.patientId);
    if (!p) return fail('Patient not found', 404);
    return ok({ draft: generateSoap(p, body.transcript || '', state) });
  },

  'POST /api/ai/notes': ({ body, db: state }) => {
    const p = state.patients.find((x) => x.id === body.patientId);
    if (!p) return fail('Patient not found', 404);
    const note = {
      id: uid('n'),
      patientId: p.id,
      doctorId: body.doctorId || 'u_doctor',
      createdAt: now(),
      aiGenerated: Boolean(body.aiGenerated),
      chiefComplaint: body.chiefComplaint || '',
      subjective: body.subjective || '',
      objective: body.objective || '',
      assessment: body.assessment || '',
      plan: body.plan || '',
    };
    state.notes.unshift(note);
    state.audit.unshift({ id: uid('au'), ts: now(), actor: body.doctorId === 'u_doctor' ? 'Dr. Rohan Mehta' : 'Clinician', action: body.aiGenerated ? 'Signed AI-drafted consultation note' : 'Saved consultation note', entity: p.mrn });
    logActivity(state, 'Records AI', 'info', `Consultation note ${body.aiGenerated ? 'AI-drafted and ' : ''}signed for ${p.name}.`);
    commit();
    return ok({ note, notes: state.notes });
  },

  'POST /api/ai/prescribe': ({ body, db: state }) => {
    const p = state.patients.find((x) => x.id === body.patientId);
    if (!p) return fail('Patient not found', 404);
    const items = (body.items || []).filter((i) => i.drug);
    if (!items.length) return fail('Add at least one medication.');

    const clashes = [];
    for (const i of items) {
      for (const a of p.allergies || []) {
        if (i.drug.toLowerCase().includes(a.toLowerCase().split(' ')[0])) clashes.push(`${i.drug} conflicts with recorded allergy: ${a}`);
      }
    }
    if (!clashes.length && (p.allergies || []).some((a) => /penicillin/i.test(a)) && items.some((i) => /amoxicillin|ampicillin|penicillin/i.test(i.drug))) {
      clashes.push('Penicillin-class antibiotic with documented penicillin allergy.');
    }

    const rx = { id: uid('rx'), patientId: p.id, doctorId: body.doctorId || 'u_doctor', status: 'active', createdAt: now(), items };
    state.prescriptions.unshift(rx);
    logActivity(state, 'Records AI', clashes.length ? 'critical' : 'info',
      clashes.length ? `ALLERGY ALERT blocked-safe review for ${p.name}: ${clashes.join('; ')}` : `Prescription issued for ${p.name} (${items.length} item${items.length === 1 ? '' : 's'}).`);
    commit();
    return ok({ prescription: rx, prescriptions: state.prescriptions, allergyWarnings: clashes });
  },

  'POST /api/ai/triage': ({ body, db: state }) => {
    const p = state.patients.find((x) => x.id === body.patientId) || { id: 'adhoc', age: body.age || 35, symptoms: body.symptoms || [], conditions: body.conditions || [], allergies: [] };
    return ok({ triage: triage(p, state.vitals), suggestedRoute: route(p, triage(p, state.vitals)) });
  },

  'GET /api/ai/insights': ({ db: state }) => ok({ insights: coordinatorInsights(state), agents: state.agents }),

  'POST /api/ai/actions': ({ body, db: state }) => {
    const action = body.action;
    if (action === 'rebalance') {
      const open = state.tasks.filter((t) => t.status !== 'done').sort((a, b) => (a.priority === 'critical' ? 1 : 0) - (b.priority === 'critical' ? 1 : 0));
      const target = [...state.users].filter((u) => ['nurse', 'lab'].includes(u.role)).sort((a, b) => (a.load || 0) - (b.load || 0))[0];
      const moved = open.slice(0, 2).map((t) => { t.assignedTo = target.id; return t; });
      state.users.forEach((u) => {
        const tasks = state.tasks.filter((t) => t.assignedTo === u.id && t.status !== 'done').length;
        u.load = Math.min(99, 20 + tasks * 12);
      });
      logActivity(state, 'Coordinator AI', 'info', `Applied rebalance recommendation — ${moved.length} tasks moved to ${target.name}.`);
      commit();
      return ok({ message: `Rebalanced ${moved.length} task${moved.length === 1 ? '' : 's'} to ${target.name}.`, tasks: state.tasks, users: state.users });
    }
    if (action === 'stepdown') {
      const icu = state.beds.find((b) => /icu/i.test(b.ward));
      const ward = state.beds.find((b) => /ward a/i.test(b.ward));
      if (icu && icu.occupied > 0) icu.occupied -= 1;
      if (ward) ward.occupied += 1;
      logActivity(state, 'Coordinator AI', 'info', 'Executed ICU step-down transfer — capacity reserved for incoming admissions.');
      commit();
      return ok({ message: 'ICU step-down prepared and capacity reserved.', beds: state.beds });
    }
    if (action === 'express-slots') {
      logActivity(state, 'Coordinator AI', 'info', 'Opened 2 express slots in Cardiology and re-routed stable follow-ups.');
      const q = state.queue.filter((x) => x.department === 'Cardiology' && x.status === 'waiting');
      q.forEach((x) => { x.waitMinutes = Math.max(2, Math.round(x.waitMinutes * 0.6)); });
      commit();
      return ok({ message: 'Express slots opened. Cardiology wait times reduced by ~40%.', queue: state.queue });
    }
    return fail('Unknown action.');
  },

  /* ---- notifications ---- */
  'POST /api/notifications/send': ({ body, db: state }) => {
    const p = state.patients.find((x) => x.id === body.patientId);
    if (!p) return fail('Patient not found', 404);
    const n = {
      id: uid('nt'),
      ts: now(),
      patientId: p.id,
      channel: body.channel || 'WhatsApp',
      status: 'delivered',
      template: body.template || 'Custom message',
      body: body.body || '',
      agent: 'Comm. AI',
    };
    state.notifications.unshift(n);
    logActivity(state, 'Comm. AI', 'info', `Sent "${n.template}" to ${p.name} via ${n.channel}.`);
    commit();
    return ok({ notification: n, notifications: state.notifications });
  },

  /* ---- admin ---- */
  'PATCH /api/staff/:id': ({ params, body, db: state }) => {
    const u = state.users.find((x) => x.id === params.id);
    if (!u) return fail('Staff member not found', 404);
    if (body.status) u.status = body.status;
    if (body.shift) u.shift = body.shift;
    if (body.load !== undefined) u.load = Number(body.load);
    Object.assign(u, body, { id: u.id });
    logActivity(state, 'Coordinator AI', 'info', `${u.name} updated to ${u.status}${body.shift ? ` (${u.shift})` : ''}.`);
    commit();
    return ok({ user: u, users: state.users });
  },

  'GET /api/analytics': ({ db: state }) => {
    const total = state.queue.length;
    const completed = state.queue.filter((q) => q.status === 'completed').length;
    const live = state.queue.filter((q) => q.status !== 'completed');
    const avgWait = live.length ? Math.round(live.reduce((a, q) => a + (q.waitMinutes || 0), 0) / live.length) : 0;
    const bedsTotal = state.beds.reduce((a, b) => a + b.total, 0);
    const bedsUsed = state.beds.reduce((a, b) => a + b.occupied, 0);
    const tasksOpen = state.tasks.filter((t) => t.status !== 'done').length;
    const revenueMonth = state.revenue[state.revenue.length - 1];
    const revenueTotal = revenueMonth.opd + revenueMonth.ipd + revenueMonth.pharmacy + revenueMonth.insurance;

    return ok({
      queue: { total, completed, live: live.length, avgWait, targetWait: 35 },
      occupancy: { total: bedsTotal, used: bedsUsed, pct: Math.round((bedsUsed / bedsTotal) * 100) },
      tasks: { open: tasksOpen, done: state.tasks.filter((t) => t.status === 'done').length },
      revenue: { ...revenueMonth, total: Number(revenueTotal.toFixed(1)), series: state.revenue },
      throughput: state.throughput,
      patients: { total: state.patients.length, critical: state.patients.filter((p) => p.riskLevel === 'critical').length, high: state.patients.filter((p) => p.riskLevel === 'high').length },
    });
  },

  'POST /api/reset': () => {
    resetDb();
    return ok({ message: 'Demo data reset to the seeded state.' });
  },

  'GET /api/agents': ({ db: state }) => ok({
    agents: state.agents.map((a) => ({
      ...a,
      recent: state.activity.filter((x) => x.agent === a.name).slice(0, 3),
    })),
  }),
};

export function handle(method, pathname, ctx) {
  const key = `${method} ${pathname}`;
  const state = db();
  const withDb = { ...ctx, db: state };
  if (routes[key]) return routes[key](withDb);

  // Pattern routes: /api/.../:id
  for (const routeKey of Object.keys(routes)) {
    const [m, pattern] = routeKey.split(' ');
    if (m !== method) continue;
    const pParts = pattern.split('/');
    const uParts = pathname.split('/');
    if (pParts.length !== uParts.length) continue;
    const params = {};
    let matched = true;
    for (let i = 0; i < pParts.length; i++) {
      if (pParts[i].startsWith(':')) params[pParts[i].slice(1)] = decodeURIComponent(uParts[i]);
      else if (pParts[i] !== uParts[i]) { matched = false; break; }
    }
    if (matched) return routes[routeKey]({ ...withDb, params });
  }
  return fail(`No API route for ${method} ${pathname}`, 404);
}
