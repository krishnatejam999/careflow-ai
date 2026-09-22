/**
 * CareFlow AI — the AI workforce.
 *
 * Five agents that "act on data rather than storing it". They run fully
 * offline and deterministically, so the prototype never depends on an
 * external model provider, while still producing explainable output:
 * every decision returns the reasons behind it.
 *
 *   Reception AI   — OCR intake extraction, check-in
 *   Records AI     — record assembly, search, critical-value flagging
 *   Workflow AI    — triage, routing, task generation
 *   Comm. AI       — patient + internal notifications
 *   Coordinator AI — operational insight and resource allocation
 */
import { uid, now } from './db.js';

/* ------------------------------------------------------------- Reception AI */

const LABELED_FIELDS = [
  { key: 'name', labels: ['name', 'patient name', 'full name'], type: 'text' },
  { key: 'age', labels: ['age'], type: 'number' },
  { key: 'gender', labels: ['gender', 'sex'], type: 'text' },
  { key: 'phone', labels: ['phone', 'mobile', 'contact', 'phone no', 'mobile no'], type: 'phone' },
  { key: 'bloodGroup', labels: ['blood group', 'blood', 'bg'], type: 'text' },
  { key: 'address', labels: ['address', 'city', 'residence'], type: 'text' },
  { key: 'allergies', labels: ['allergies', 'allergy', 'known allergies'], type: 'list' },
  { key: 'conditions', labels: ['conditions', 'chronic', 'history', 'past history', 'comorbidities'], type: 'list' },
  { key: 'symptoms', labels: ['symptoms', 'complaint', 'chief complaint', 'reason for visit', 'presenting complaint'], type: 'list' },
  { key: 'insurance', labels: ['insurance', 'insurer', 'payer'], type: 'text' },
  { key: 'policyNo', labels: ['policy', 'policy no', 'policy number'], type: 'text' },
];

const splitList = (value) =>
  String(value)
    .split(/[,;/|]|\band\b/gi)
    .map((v) => v.trim().replace(/\.$/, ''))
    .filter((v) => v && !/^(nil|none|no|na|n\/a|-)$/i.test(v));

/**
 * Turn a raw intake blob (typed, pasted, or OCR'd) into structured fields.
 * Handles both "Label: value" forms and free prose.
 */
export function ocrExtract(raw = '') {
  const text = String(raw).replace(/\r/g, '');
  const fields = {};
  const confidence = {};
  const lines = text.split(/\n|(?<=[.;])\s{2,}/);

  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z][A-Za-z ./#-]{1,30}?)\s*[:\-–]\s*(.+?)\s*$/);
    if (!m) continue;
    const label = m[1].toLowerCase().trim();
    const value = m[2].trim();
    const field = LABELED_FIELDS.find((f) => f.labels.some((l) => label === l || label.startsWith(l)));
    if (!field) continue;

    if (field.type === 'list') {
      fields[field.key] = splitList(value);
      confidence[field.key] = 0.94;
    } else if (field.type === 'number') {
      const n = parseInt(value, 10);
      if (!Number.isNaN(n)) {
        fields[field.key] = n;
        confidence[field.key] = 0.97;
      }
    } else if (field.type === 'phone') {
      const digits = value.replace(/[^\d+]/g, '');
      if (digits.length >= 8) {
        fields[field.key] = value;
        confidence[field.key] = 0.91;
      }
    } else {
      fields[field.key] = value;
      confidence[field.key] = 0.93;
    }
  }

  // Free-prose fallback: pull symptoms out of sentences when unlabelled.
  if (!fields.symptoms) {
    const prose = text.match(/(?:complains? of|presenting with|reports? of|since)\s+([^.\n]+)/i);
    if (prose) {
      fields.symptoms = splitList(prose[1]);
      confidence.symptoms = 0.72;
    }
  }
  if (!fields.age) {
    const ageMatch = text.match(/\b(\d{1,3})\s*(?:y\/?o|years?\s*old|yr|yrs)\b/i);
    if (ageMatch) {
      fields.age = parseInt(ageMatch[1], 10);
      confidence.age = 0.74;
    }
  }
  if (!fields.gender) {
    if (/\b(female|woman|lady|she)\b/i.test(text)) { fields.gender = 'Female'; confidence.gender = 0.7; }
    else if (/\b(male|man|gentleman|he)\b/i.test(text)) { fields.gender = 'Male'; confidence.gender = 0.7; }
  }
  if (!fields.bloodGroup) {
    const bg = text.match(/\b(A|B|AB|O)\s?[+-]\b/);
    if (bg) { fields.bloodGroup = bg[0].replace(/\s+/g, ''); confidence.bloodGroup = 0.8; }
  }

  const extracted = Object.keys(fields).length;
  const avg = extracted
    ? Object.values(confidence).reduce((a, b) => a + b, 0) / extracted
    : 0;

  return {
    agent: 'Reception AI',
    fields,
    confidence,
    summary: extracted
      ? `Extracted ${extracted} field${extracted === 1 ? '' : 's'} from the intake form.`
      : 'No structured fields detected — the form needs a manual pass.',
    confidenceScore: Number(avg.toFixed(2)),
    needsReview: Object.values(confidence).some((c) => c < 0.8),
  };
}

/* --------------------------------------------------------------- Records AI */

const norm = (s) => String(s || '').toLowerCase();

export function recordSearch(q, db) {
  const needle = norm(q).trim();
  if (!needle) return [];
  return db.patients
    .map((p) => {
      let score = 0;
      const reasons = [];
      if (norm(p.name).includes(needle)) { score += 10; reasons.push('name match'); }
      if (norm(p.mrn).includes(needle)) { score += 10; reasons.push('MRN match'); }
      if (norm(p.phone).replace(/\s/g, '').includes(needle.replace(/\s/g, ''))) { score += 8; reasons.push('phone match'); }
      for (const s of [...(p.symptoms || []), ...(p.conditions || []), ...(p.allergies || [])]) {
        if (norm(s).includes(needle)) { score += 4; reasons.push(`${s} match`); }
      }
      if (p.insurance && (norm(p.insurance.provider).includes(needle) || norm(p.insurance.scheme).includes(needle))) {
        score += 3;
        reasons.push('insurance match');
      }
      return { patient: p, score, reasons };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export function flagLabs(labs, patientId) {
  const order = { critical: 3, high: 2, medium: 1, normal: 0 };
  return labs
    .filter((l) => !patientId || l.patientId === patientId)
    .sort((a, b) => (order[b.flag] || 0) - (order[a.flag] || 0));
}

/* -------------------------------------------------------------- Workflow AI */

const RISK_RULES = [
  { level: 'critical', weight: 34, match: /\b(chest pain|crush|unconscious|unresponsive|not breathing|haemorrhage|hemorrhage|bleeding|paralysis|slurred speech|seizure|stroke|cyanosis|low oxygen|spo2|collapsed|anaphyla)/i, label: 'Red-flag emergency presentation' },
  { level: 'critical', weight: 26, match: /\b(breathless|breathing difficult|shortness of breath|difficulty breathing|dyspnoea|dyspnea|severe asthma|wheez)/i, label: 'Respiratory distress indicator' },
  { level: 'high', weight: 18, match: /\b(chest tightness|palpitation|irregular heartbeat|high fever|vomiting|dehydrat|severe headache|blurred vision)/i, label: 'Acute symptom cluster' },
  { level: 'high', weight: 14, match: /\b(fracture|deep wound|burn|accident|trauma|injury)/i, label: 'Trauma indicator' },
  { level: 'medium', weight: 10, match: /\b(fever|giddiness|dizziness|fatigue|rash|itching|abdominal pain|joint pain|knee pain|cough|swelling|nausea)/i, label: 'Symptomatic but stable' },
  { level: 'low', weight: 4, match: /\b(follow[- ]?up|routine|review|screening|check[- ]?up|vaccination)/i, label: 'Routine / planned visit' },
];

const HIGH_RISK_CONDITIONS = /(diabetes|hypertension|cardiac|heart|copd|asthma|renal|kidney|cancer|immunosuppress|pregnan)/i;

export function triage(patient, vitals = []) {
  let score = 12;
  const reasons = [];

  const symptoms = (patient.symptoms || []).join('; ');
  for (const rule of RISK_RULES) {
    if (rule.match.test(symptoms)) {
      score += rule.weight;
      reasons.push(`${rule.label} (+${rule.weight})`);
    }
  }
  if (patient.age >= 65) { score += 12; reasons.push('Age ≥ 65 (+12)'); }
  else if (patient.age <= 5) { score += 10; reasons.push('Paediatric patient (+10)'); }
  if ((patient.conditions || []).length) {
    const comorbidity = (patient.conditions || []).join('; ');
    if (HIGH_RISK_CONDITIONS.test(comorbidity)) {
      score += 12;
      reasons.push(`High-risk comorbidity: ${patient.conditions.join(', ')} (+12)`);
    } else {
      score += 5;
      reasons.push(`${patient.conditions.length} pre-existing condition(s) (+5)`);
    }
  }
  if ((patient.allergies || []).length) {
    score += 3;
    reasons.push(`Allergy on file: ${patient.allergies.join(', ')} (+3)`);
  }

  const latest = vitals
    .filter((v) => v.patientId === patient.id)
    .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))[0];

  if (latest) {
    if (latest.spo2 && latest.spo2 < 92) { score += 18; reasons.push(`SpO₂ ${latest.spo2}% below 92% (+18)`); }
    if (latest.hr && (latest.hr > 110 || latest.hr < 50)) { score += 10; reasons.push(`HR ${latest.hr} bpm out of range (+10)`); }
    if (latest.bpSys && (latest.bpSys >= 160 || latest.bpSys <= 90)) { score += 12; reasons.push(`Systolic BP ${latest.bpSys} mmHg (+12)`); }
    if (latest.temp && latest.temp >= 38.5) { score += 9; reasons.push(`Temperature ${latest.temp}°C (+9)`); }
    if (latest.rr && latest.rr >= 24) { score += 8; reasons.push(`Respiratory rate ${latest.rr}/min (+8)`); }
  }

  score = Math.max(5, Math.min(99, Math.round(score)));
  const level = score >= 75 ? 'critical' : score >= 55 ? 'high' : score >= 30 ? 'medium' : 'low';

  return { score, level, reasons, basedOnVitals: latest || null, agent: 'Workflow AI' };
}

const ROUTES = [
  { dept: 'Cardiology', match: /(chest pain|chest tightness|palpitation|irregular heartbeat|cardiac|heart|bp |hypertension|breathless|dyspn|low oxygen|swelling in legs)/i, doctorId: 'u_doctor2', room: 'Room 04 · Block C', base: 35 },
  { dept: 'Emergency', match: /(unconscious|unresponsive|bleeding|fracture|accident|trauma|burn|seizure|stroke|paralysis)/i, doctorId: 'u_doctor2', room: 'Triage Bay 1', base: 5 },
  { dept: 'Dermatology', match: /(rash|itching|skin|eczema|acne|allergy reaction|hives)/i, doctorId: 'u_doctor', room: 'Room 11 · Block B', base: 20 },
  { dept: 'Orthopaedics', match: /(knee|joint|back pain|sprain|bone|arthritis)/i, doctorId: 'u_doctor', room: 'Room 07 · Block B', base: 30 },
  { dept: 'Paediatrics', match: /(paediatric|child|infant|baby)/i, doctorId: 'u_doctor', room: 'Room 02 · Block A', base: 18 },
  { dept: 'General Medicine', match: /.*/i, doctorId: 'u_doctor', room: 'Room 06 · Block B', base: 25 },
];

export function route(patient, triageResult) {
  const haystack = `${(patient.symptoms || []).join('; ')}; ${patient.age <= 12 ? 'paediatric child' : ''}`;
  const reasons = [];
  let chosen = ROUTES[ROUTES.length - 1];

  for (const r of ROUTES) {
    if (r.match.test(haystack)) {
      chosen = r;
      reasons.push(`Symptoms matched ${r.dept} rule set`);
      break;
    }
  }
  if (patient.primaryDoctorId && ROUTES.some((r) => r.doctorId === patient.primaryDoctorId)) {
    const sameDept = ROUTES.find((r) => r.dept === chosen.dept);
    if (sameDept) reasons.push('Preferred consultant available for this department');
  }

  let wait = chosen.base;
  if (triageResult.level === 'critical') { wait = 0; reasons.push('Critical triage score — bypasses queue'); }
  else if (triageResult.level === 'high') { wait = Math.round(wait * 0.4); reasons.push('High triage score — priority lane'); }
  else if (triageResult.level === 'medium') { wait = Math.round(wait * 0.8); reasons.push('Medium triage — standard lane, minor priority'); }

  return {
    agent: 'Workflow AI',
    department: chosen.dept,
    doctorId: chosen.doctorId,
    room: chosen.room,
    estimatedWaitMinutes: wait,
    reasons,
  };
}

const TASK_BLUEPRINTS = {
  critical: [
    { title: 'Attach continuous vitals monitor and alert on desaturation', category: 'Emergency', priority: 'critical', role: 'nurse', due: -2 },
    { title: 'Prepare emergency trolley and IV access at bedside', category: 'Emergency', priority: 'critical', role: 'nurse', due: -5 },
    { title: 'Notify consultant on call — immediate review required', category: 'Escalation', priority: 'critical', role: 'reception', due: -1 },
  ],
  high: [
    { title: 'Record baseline vitals before consult', category: 'Vitals', priority: 'high', role: 'nurse', due: -10 },
    { title: 'Verify insurance eligibility before billing', category: 'Insurance', priority: 'high', role: 'reception', due: -20 },
  ],
  medium: [
    { title: 'Record baseline vitals before consult', category: 'Vitals', priority: 'medium', role: 'nurse', due: -20 },
    { title: 'Confirm medication list and allergy reconciliation', category: 'Medication', priority: 'medium', role: 'nurse', due: -35 },
  ],
  low: [
    { title: 'Collect registration fee and issue receipt', category: 'Billing', priority: 'low', role: 'reception', due: -45 },
    { title: 'Share after-visit instructions over WhatsApp', category: 'Communication', priority: 'low', role: 'reception', due: -60 },
  ],
};

/** Workflow AI turns a registration into concrete, assigned work. */
export function generateTasks(patient, triageResult, routeResult, db) {
  const blueprints = TASK_BLUEPRINTS[triageResult.level] || TASK_BLUEPRINTS.low;
  const nurses = db.users.filter((u) => u.role === 'nurse' || u.role === 'lab');
  const pickStaff = (role) => {
    const pool = role === 'reception'
      ? db.users.filter((u) => u.role === 'reception')
      : nurses;
    const sorted = [...pool].sort((a, b) => (a.load ?? 50) - (b.load ?? 50));
    return sorted[0]?.id || 'u_nurse';
  };

  const created = blueprints.map((b) => ({
    id: uid('t'),
    title: b.title,
    patientId: patient.id,
    assignedTo: pickStaff(b.role),
    priority: b.priority,
    status: 'todo',
    category: b.category,
    dueAt: new Date(Date.now() - b.due * 60000).toISOString(),
    source: 'Workflow AI',
    createdAt: now(),
  }));

  db.tasks.unshift(...created);
  return created;
}

/* ----------------------------------------------------------------- Comm. AI */

export function composeNotification(kind, patient, extra = {}) {
  const templates = {
    'check-in': {
      template: 'Check-in confirmed',
      body: `Hello ${patient.name.split(' ')[0]}, you are checked in. Token ${extra.token} at ${extra.department}. Estimated wait ${extra.wait} min.`,
    },
    'queue-called': {
      template: 'Queue called',
      body: `Token ${extra.token}, please proceed to ${extra.room}. ${extra.doctor} is ready for you.`,
    },
    'lab-ready': {
      template: 'Lab report ready',
      body: `Your report for ${extra.test} is ready in the CareFlow app. Flagged value: ${extra.result} ${extra.unit}.`,
    },
    'discharge': {
      template: 'Discharge summary',
      body: `Your discharge summary and prescription are attached. Please follow up in 7 days.`,
    },
    'care-plan': {
      template: 'Care plan update',
      body: `Your care plan has been updated by the nursing team. Next step: ${extra.step}.`,
    },
  };
  const t = templates[kind] || templates['check-in'];
  return {
    agent: 'Comm. AI',
    channel: patient.phone ? 'WhatsApp' : 'SMS',
    status: 'delivered',
    patientId: patient.id,
    template: t.template,
    body: t.body,
    message: `Sent "${t.template}" to ${patient.name} via ${patient.phone ? 'WhatsApp' : 'SMS'}.`,
  };
}

/* ----------------------------------------------------------- Coordinator AI */

export function coordinatorInsights(db) {
  const live = db.queue.filter((q) => q.status !== 'completed');
  const byDept = {};
  for (const q of live) {
    byDept[q.department] = byDept[q.department] || { count: 0, wait: 0 };
    byDept[q.department].count += 1;
    byDept[q.department].wait += q.waitMinutes || 0;
  }

  const generated = [];
  const bench = live.length ? live.reduce((a, q) => a + (q.waitMinutes || 0), 0) / live.length : 0;

  for (const [dept, v] of Object.entries(byDept)) {
    const avg = v.wait / v.count;
    if (avg > bench + 15 && v.count >= 2) {
      generated.push({
        id: uid('i'),
        agent: 'Coordinator AI',
        severity: avg > 60 ? 'critical' : 'warning',
        title: `${dept} is the current bottleneck`,
        detail: `Average wait in ${dept} is ${Math.round(avg)} min against a hospital average of ${Math.round(bench)} min, across ${v.count} open tokens.`,
        action: `Open 2 express slots and re-route stable ${dept} follow-ups to General Medicine.`,
      });
    }
  }

  const icu = db.beds.find((b) => /icu/i.test(b.ward));
  if (icu && icu.occupied / icu.total >= 0.8) {
    generated.push({
      id: uid('i'),
      agent: 'Coordinator AI',
      severity: 'warning',
      title: `ICU at ${Math.round((icu.occupied / icu.total) * 100)}% occupancy`,
      detail: `${icu.occupied} of ${icu.total} ICU beds occupied. Triage scores predict further admissions within 6 hours.`,
      action: 'Prepare 2 step-down transfers to free surge capacity.',
    });
  }

  const staff = db.users.filter((u) => ['nurse', 'doctor', 'reception'].includes(u.role));
  const hottest = [...staff].sort((a, b) => (b.load || 0) - (a.load || 0));
  if (hottest.length >= 2 && (hottest[0].load || 0) - (hottest[hottest.length - 1].load || 0) > 35) {
    generated.push({
      id: uid('i'),
      agent: 'Coordinator AI',
      severity: 'warning',
      title: 'Workload imbalance across staff',
      detail: `${hottest[0].name} is at ${hottest[0].load}% load while ${hottest[hottest.length - 1].name} is at ${hottest[hottest.length - 1].load}%.`,
      action: `Reassign 2 low-acuity tasks from ${hottest[0].name.split(' ')[0]} to ${hottest[hottest.length - 1].name.split(' ')[0]}.`,
    });
  }

  const criticalTasks = db.tasks.filter((t) => t.priority === 'critical' && t.status !== 'done');
  if (criticalTasks.length) {
    generated.push({
      id: uid('i'),
      agent: 'Coordinator AI',
      severity: 'critical',
      title: `${criticalTasks.length} critical task${criticalTasks.length === 1 ? '' : 's'} still open`,
      detail: 'Critical tasks are past or near their due time and block safe patient flow.',
      action: 'Escalate to the nursing in-charge and confirm completion within 10 minutes.',
    });
  }

  return generated.length ? generated : db.insights;
}

/* ----------------------------------------------------------------- Utilities */

export function logActivity(db, agent, level, message, role = 'all') {
  const entry = { id: uid('ac'), ts: now(), agent, level, message, role };
  db.activity.unshift(entry);
  db.activity = db.activity.slice(0, 60);
  return entry;
}

export function fieldAccuracy(extract) {
  return Math.round((extract.confidenceScore || 0) * 100);
}
