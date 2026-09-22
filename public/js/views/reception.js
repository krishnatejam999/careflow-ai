/** Reception dashboard — registration, AI check-in, live queue, scheduling. */
import { api } from '../api.js';
import { store } from '../store.js';
import {
  icon, esc, badge, avatar, timeAgo, fmtTime, fmtDate, minsSince, toast,
  openModal, closeOverlay, empty, initials, typewrite,
} from '../ui.js';
import { sparkline, ring, bars } from '../charts.js';

const SAMPLE_FORM = `CITY GENERAL HOSPITAL — OPD INTAKE FORM
Name: Sanjay Bhosale
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

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

/* --------------------------------------------------------------------- html */

export function html(state, route) {
  const live = state.queue.filter((q) => q.status !== 'completed');
  const waiting = live.filter((q) => q.status === 'waiting');
  const avgWait = live.length ? Math.round(live.reduce((a, q) => a + (q.waitMinutes || 0), 0) / live.length) : 0;
  const seenToday = state.queue.filter((q) => q.status === 'completed').length;
  const aiActions = state.activity.filter((a) => minsSince(a.ts) < 240).length;
  const waitSeries = state.throughput.map((t) => t.waiting);
  const seenSeries = state.throughput.map((t) => t.seen);

  return `
  <div class="page-head">
    <div>
      <h2>Front desk operations</h2>
      <p>Register patients with AI check-in, run the live queue, and keep the schedule full — Reception AI handles the data entry.</p>
    </div>
    <div class="actions">
      <button class="btn" data-act="new-patient">${icon('user', 14)} New patient</button>
      <button class="btn" data-act="book">${icon('calendar', 14)} Book appointment</button>
      <button class="btn btn-primary" data-act="ai-checkin">${icon('wand', 14)} AI check-in</button>
    </div>
  </div>

  <div class="cols cols-4" style="margin-bottom:18px">
    <div class="stat">
      <div class="label">In queue now</div>
      <div class="value"><span data-stat="live">0</span><span class="unit">patients</span></div>
      <div class="delta up">${icon('arrowUp', 12)} ${waiting.length} waiting · ${live.length - waiting.length} in consult</div>
      <div class="spark">${sparkline(waitSeries, { w: 74, h: 26 })}</div>
    </div>
    <div class="stat ${avgWait > 40 ? 'warn' : ''}">
      <div class="label">Average wait</div>
      <div class="value"><span data-stat="avgwait">0</span><span class="unit">min</span></div>
      <div class="delta ${avgWait > 35 ? 'down' : 'up'}">${icon(avgWait > 35 ? 'arrowUp' : 'arrowDown', 12)} target 35 min</div>
      <div class="spark">${sparkline(waitSeries.map((x) => x * 3), { w: 74, h: 26, color: '#f59e0b' })}</div>
    </div>
    <div class="stat violet">
      <div class="label">Seen today</div>
      <div class="value"><span data-stat="seen">0</span><span class="unit">consults</span></div>
      <div class="delta up">${icon('check', 12)} ${seenToday} closed encounters</div>
      <div class="spark">${sparkline(seenSeries, { w: 74, h: 26, color: '#8b5cf6' })}</div>
    </div>
    <div class="stat">
      <div class="label">AI actions (4h)</div>
      <div class="value"><span data-stat="ai">0</span><span class="unit">automated</span></div>
      <div class="delta up">${icon('zap', 12)} 0 manual re-entries</div>
      <div class="spark">${sparkline(seenSeries.map((x) => x / 3), { w: 74, h: 26, color: '#0ea5e9' })}</div>
    </div>
  </div>

  <div class="layout-main">
    <div class="col" style="gap:18px" id="reception-main">
      ${route.tab === 'appointments' ? appointmentsCard(state) : route.tab === 'patients' ? patientsCard(state) : queueCard(state)}
    </div>

    <div class="sticky-col">
      <div class="card ai-panel">
        <div class="card-hd">
          <h3>${icon('sparkles', 15)} Reception AI</h3>
          <span class="badge" style="background:rgba(20,184,166,.2);color:#5eead4;border-color:rgba(20,184,166,.3)"><span class="dot"></span>online</span>
        </div>
        <div class="card-bd" style="display:grid;gap:14px">
          <div class="small" style="color:rgba(223,241,244,.8)">
            Drop in a scanned intake form — Reception AI extracts the fields, Records AI de-duplicates against existing
            records, and Workflow AI triages, routes and assigns the team.
          </div>
          <button class="btn btn-primary btn-block" data-act="ai-checkin">${icon('wand', 14)} Run AI check-in</button>
          <div class="row gap-sm" style="flex-wrap:wrap">
            <span class="chip chip-teal">OCR · ${Object.keys(SAMPLE_FORM).length ? '11 fields' : ''}</span>
            <span class="chip chip-teal">0 re-entries</span>
            <span class="chip chip-teal">&lt; 30 s</span>
          </div>
          <div class="section-title" style="margin:6px 0 0">Latest agent activity</div>
          <div class="col" style="gap:0">
            ${state.activity.slice(0, 5).map((a) => `
              <div class="ai-msg">
                <div class="ic" style="background:${a.level === 'critical' ? 'rgba(225,29,72,.22)' : 'rgba(255,255,255,.08)'};color:${a.level === 'critical' ? '#fda4af' : '#5eead4'}">
                  ${icon(a.level === 'critical' ? 'octagon' : 'zap', 14)}
                </div>
                <div class="txt">
                  <div style="color:rgba(255,255,255,.9)">${esc(a.message)}</div>
                  <div class="why">${esc(a.agent)} · ${timeAgo(a.ts)}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      ${alertsCard(state)}
      ${commsCard(state)}
    </div>
  </div>`;
}

/* --------------------------------------------------------------- fragments */

function queueCard(state) {
  const live = state.queue
    .filter((q) => q.status !== 'completed')
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'in-consult' ? -1 : 1)
      || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      || b.waitMinutes - a.waitMinutes);

  return `
  <div class="card">
    <div class="card-hd">
      <h3>${icon('inbox', 16)} Live queue <span class="sub">${live.length} active tokens</span></h3>
      <div class="row gap-sm">
        <button class="btn btn-sm" data-act="call-next">${icon('play', 13)} Call next</button>
        <button class="btn btn-sm btn-primary" data-act="ai-checkin">${icon('plus', 13)} Check in</button>
      </div>
    </div>
    ${live.length ? `<div class="list">${live.map((q) => queueRow(state, q)).join('')}</div>`
      : empty('inbox', 'Queue is clear', 'Every checked-in patient has been seen. Run an AI check-in to add the next patient.', `<button class="btn btn-primary" data-act="ai-checkin">${icon('wand', 14)} AI check-in</button>`)}
    <div class="card-ft row between">
      <span class="tiny muted">Workflow AI re-orders the queue every 15 seconds using live triage scores.</span>
      <span class="chip chip-teal">${icon('zap', 12)} auto-prioritised</span>
    </div>
  </div>`;
}

function queueRow(state, q) {
  const p = state.patient ? state.patient(q.patientId) : state.patients.find((x) => x.id === q.patientId);
  if (!p) return '';
  const doctor = state.users.find((u) => u.id === q.doctorId);
  const wait = q.status === 'in-consult' ? q.waitMinutes : minsSince(q.checkedInAt);
  const over = wait > 35;
  const pct = Math.min(100, Math.round((wait / 60) * 100));

  return `
  <div class="list-item queue-row" data-act="open-patient" data-id="${p.id}" role="button" tabindex="0">
    <div class="token ${q.priority}">
      <span class="t">TOKEN</span>${esc(q.token)}
    </div>
    <div class="meta">
      <div class="name">
        ${esc(p.name)}
        ${badge(q.priority)}
        ${q.status === 'in-consult' ? '<span class="badge badge-info"><span class="dot"></span>in consult</span>' : ''}
      </div>
      <div class="sub">${esc(q.department)} · ${esc(doctor?.name || 'unassigned')} · ${esc(q.source)}</div>
      <div class="wait-bar" style="margin-top:8px">
        <span class="track"><span class="fill ${over ? 'over' : ''}" style="width:${pct}%"></span></span>
        <span class="tiny ${over ? 'strong' : 'muted'} nowrap" style="${over ? 'color:#c2410c' : ''}">${wait} min</span>
        <span class="tiny muted nowrap">· triage ${q.triageScore}</span>
      </div>
    </div>
    <div class="trail">
      ${q.status === 'waiting'
        ? `<button class="btn btn-sm btn-primary" data-act="advance" data-id="${q.id}" title="Call this patient now">${icon('play', 12)} Call</button>`
        : `<button class="btn btn-sm" data-act="advance" data-id="${q.id}" title="Close this encounter">${icon('check', 12)} Complete</button>`}
    </div>
  </div>`;
}

function appointmentsCard(state) {
  const rows = [...state.appointments].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  return `
  <div class="card">
    <div class="card-hd">
      <h3>${icon('calendar', 16)} Appointments <span class="sub">${rows.length} booked</span></h3>
      <button class="btn btn-sm btn-primary" data-act="book">${icon('plus', 13)} Book</button>
    </div>
    <div class="table-scroll">
      <table class="table">
        <thead><tr><th>Patient</th><th>When</th><th>Type</th><th>Doctor</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${rows.map((a) => {
            const p = state.patients.find((x) => x.id === a.patientId);
            const doc = state.users.find((u) => u.id === a.doctorId);
            if (!p) return '';
            return `<tr>
              <td>
                <div class="row gap-sm">
                  <span class="avatar sm sky">${esc(initials(p.name))}</span>
                  <div>
                    <div class="strong">${esc(p.name)}</div>
                    <div class="tiny muted">${esc(p.mrn)} · ${p.age}${p.gender === 'Female' ? 'F' : 'M'}</div>
                  </div>
                </div>
              </td>
              <td class="num">${esc(fmtDate(a.datetime, { day: '2-digit', month: 'short' }))} · ${esc(fmtTime(a.datetime))}</td>
              <td><span class="chip">${esc(a.type)}</span></td>
              <td class="small">${esc(doc?.name || '—')}<div class="tiny muted">${esc(a.department)}</div></td>
              <td><span class="badge badge-${a.status === 'confirmed' ? 'low' : a.status === 'checked-in' ? 'info' : 'neutral'}"><span class="dot"></span>${esc(a.status)}</span></td>
              <td class="right">
                <button class="btn btn-sm" data-act="open-patient" data-id="${p.id}">Open</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function patientsCard(state) {
  const rows = [...state.patients].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return `
  <div class="card">
    <div class="card-hd">
      <h3>${icon('users', 16)} Registered patients <span class="sub">${rows.length} records</span></h3>
      <button class="btn btn-sm" data-act="new-patient">${icon('plus', 13)} Register</button>
    </div>
    <div class="table-scroll" style="max-height:620px">
      <table class="table">
        <thead><tr><th>Patient</th><th>MRN</th><th>Complaint</th><th>Coverage</th><th>Risk</th><th></th></tr></thead>
        <tbody>
          ${rows.map((p) => `<tr>
            <td>
              <div class="row gap-sm">
                <span class="avatar sm ${p.riskLevel === 'critical' ? 'rose' : 'sky'}">${esc(initials(p.name))}</span>
                <div><div class="strong">${esc(p.name)}</div><div class="tiny muted">${p.age}${p.gender === 'Female' ? 'F' : 'M'} · ${esc(p.bloodGroup)}</div></div>
              </div>
            </td>
            <td class="mono tiny">${esc(p.mrn)}</td>
            <td class="small muted truncate" style="max-width:220px">${esc((p.symptoms || []).join(', ') || '—')}</td>
            <td class="small">${esc(p.insurance?.scheme || 'Self pay')}${p.insurance?.valid ? '' : ' <span class="badge badge-medium"><span class="dot"></span>verify</span>'}</td>
            <td>${badge(p.riskLevel)}</td>
            <td class="right"><button class="btn btn-sm" data-act="open-patient" data-id="${p.id}">Record</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function alertsCard(state) {
  return `
  <div class="card">
    <div class="card-hd">
      <h3>${icon('alert', 15)} Needs attention</h3>
      <span class="sub">${state.alerts.length}</span>
    </div>
    <div class="card-bd" style="display:grid;gap:10px">
      ${state.alerts.slice(0, 4).map((a) => `
        <div class="alert ${a.severity}">
          <div class="ic">${icon(a.severity === 'critical' ? 'octagon' : a.severity === 'high' ? 'alert' : 'sparkles', 15)}</div>
          <div class="grow">
            <div class="ttl small">${esc(a.title)}</div>
            <div class="dsc">${esc(a.detail)}</div>
          </div>
        </div>`).join('') || '<div class="small muted">All clear — no flagged values.</div>'}
    </div>
  </div>`;
}

function commsCard(state) {
  return `
  <div class="card">
    <div class="card-hd"><h3>${icon('message', 15)} Comm. AI log</h3><span class="sub">auto-sent</span></div>
    <div class="card-bd" style="display:grid;gap:11px">
      ${state.notifications.slice(0, 4).map((n) => {
        const p = state.patients.find((x) => x.id === n.patientId);
        return `<div>
          <div class="row between">
            <span class="small strong">${esc(p?.name || '')}</span>
            <span class="tiny muted">${timeAgo(n.ts)}</span>
          </div>
          <div class="tiny muted">${esc(n.channel || 'WhatsApp')} · ${esc(n.template)}</div>
        </div>`;
      }).join('') || '<div class="small muted">No messages sent yet.</div>'}
    </div>
  </div>`;
}

/* ------------------------------------------------------------------- mount */

export function mount(root, ctx) {
  const state = () => store.data || {};
  const refresh = async () => { await store.refresh({ silent: true }); ctx.rerender(); };

  const handlers = {
    'ai-checkin': () => openCheckinModal(ctx),
    book: () => openBookingModal(ctx),
    'new-patient': () => openNewPatientModal(ctx),

    'call-next': async (el) => {
      el.disabled = true;
      try {
        const { queueEntry } = await api.callNext();
        const p = store.patient(queueEntry.patientId);
        toast({
          title: `${queueEntry.token} called — ${p?.name}`,
          desc: `Priority ${queueEntry.priority}, waited ${queueEntry.waitMinutes} min. Comm. AI notified the patient.`,
          type: queueEntry.priority === 'critical' ? 'warn' : 'success',
        });
        await refresh();
      } catch (err) {
        toast({ title: 'No one to call', desc: err.message, type: 'warn' });
        el.disabled = false;
      }
    },

    advance: async (el) => {
      el.disabled = true;
      try {
        const { queueEntry } = await api.advanceQueue(el.dataset.id);
        const p = store.patient(queueEntry.patientId);
        if (queueEntry.status === 'in-consult') {
          toast({ title: `${p?.name} called in`, desc: `${queueEntry.token} → ${queueEntry.department}. Task board updated.`, type: 'success' });
        } else if (queueEntry.status === 'completed') {
          toast({ title: `Encounter closed for ${p?.name}`, desc: 'Open tasks auto-closed and discharge summary queued.', type: 'info' });
        }
        await refresh();
      } catch (err) {
        toast({ title: 'Could not update the queue', desc: err.message, type: 'error' });
        el.disabled = false;
      }
    },
  };

  // count-up animations
  requestAnimationFrame(() => {
    const d = state();
    const live = (d.queue || []).filter((q) => q.status !== 'completed');
    const avg = live.length ? Math.round(live.reduce((a, q) => a + (q.waitMinutes || 0), 0) / live.length) : 0;
    import('../ui.js').then(({ animateCount }) => {
      animateCount(root.querySelector('[data-stat="live"]'), live.length);
      animateCount(root.querySelector('[data-stat="avgwait"]'), avg);
      animateCount(root.querySelector('[data-stat="seen"]'), (d.queue || []).filter((q) => q.status === 'completed').length);
      animateCount(root.querySelector('[data-stat="ai"]'), (d.activity || []).filter((a) => minsSince(a.ts) < 240).length);
    });
  });

  return handlers;
}

/* --------------------------------------------------------- AI check-in flow */

function openCheckinModal(ctx) {
  const modal = openModal({
    title: 'AI check-in',
    subtitle: 'Paste or scan an intake form — the AI workforce does the rest.',
    wide: true,
    body: `
      <div class="steps" id="ci-steps">
        <div class="step active" data-step="1"><span class="n">1</span> Capture the intake form</div>
        <div class="step" data-step="2"><span class="n">2</span> Records AI extracts every field</div>
        <div class="step" data-step="3"><span class="n">3</span> Workflow AI triages and routes</div>
        <div class="step" data-step="4"><span class="n">4</span> Token issued, team assigned, patient notified</div>
      </div>
      <div class="layout-2" style="gap:16px">
        <div class="col" style="gap:12px">
          <div class="row between">
            <span class="section-title" style="margin:0">Intake form</span>
            <div class="row gap-sm">
              <button class="btn btn-sm" id="ci-sample">${icon('image', 13)} Load sample form</button>
              <button class="btn btn-sm btn-primary" id="ci-run">${icon('scan', 13)} Run AI extraction</button>
            </div>
          </div>
          <textarea class="textarea" id="ci-input" style="min-height:236px;font-family:var(--mono);font-size:.78rem;line-height:1.8">${esc(SAMPLE_FORM)}</textarea>
          <div class="tiny muted">Works with typed text, pasted OCR output or a scanned form transcript. Try deleting lines to see confidence drop.</div>
        </div>
        <div class="col" style="gap:12px" id="ci-result">
          <span class="section-title" style="margin:0">AI output</span>
          <div class="card card-pad" style="box-shadow:none;background:#f8fbfd">
            ${empty('wand', 'Waiting for a form', 'Run AI extraction to see field-level confidence, triage scoring and routing.')}
          </div>
        </div>
      </div>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="ci-confirm" disabled>${icon('check', 14)} Confirm check-in</button>`,
  });

  const input = modal.querySelector('#ci-input');
  const result = modal.querySelector('#ci-result');
  const confirmBtn = modal.querySelector('#ci-confirm');
  let extraction = null;

  const setStep = (n) => {
    modal.querySelectorAll('.step').forEach((s) => {
      const i = Number(s.dataset.step);
      s.classList.toggle('active', i === n);
      s.classList.toggle('done', i < n);
    });
  };

  modal.querySelector('#ci-sample').addEventListener('click', () => { input.value = SAMPLE_FORM; });
  modal.querySelector('#ci-run').addEventListener('click', run);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(); });

  async function run() {
    const raw = input.value.trim();
    if (!raw) { toast({ title: 'Nothing to extract', desc: 'Paste an intake form first.', type: 'warn' }); return; }

    setStep(2);
    const btn = modal.querySelector('#ci-run');
    btn.disabled = true;
    result.innerHTML = `<span class="section-title" style="margin:0">AI output</span>
      <div class="card card-pad" style="box-shadow:none;background:#f8fbfd">
        <div class="row gap"><span class="skeleton" style="width:16px;height:16px;border-radius:50%"></span>
        <span class="small muted" id="ci-status">Reception AI is reading the form…</span></div>
      </div>`;

    try {
      extraction = await api.ocr(raw);
      const fields = extraction.fields;
      const tri = await api.triage({
        age: fields.age, symptoms: fields.symptoms, conditions: fields.conditions, allergies: fields.allergies,
      });

      setStep(3);
      const f = Object.entries(fields);
      const conf = Math.round(extraction.confidenceScore * 100);

      result.innerHTML = `
        <span class="section-title" style="margin:0">AI output</span>
        <div class="card" style="box-shadow:none">
          <div class="card-hd">
            <h3>${icon('file', 15)} Extracted fields</h3>
            <span class="badge badge-${conf > 88 ? 'low' : conf > 75 ? 'medium' : 'high'}"><span class="dot"></span>${conf}% confidence</span>
          </div>
          <div class="card-bd" style="display:grid;gap:9px;max-height:216px;overflow:auto">
            ${f.length ? f.map(([k, v]) => `
              <div class="row between" style="gap:12px;border-bottom:1px solid var(--line-2);padding-bottom:8px">
                <span class="tiny upper muted">${esc(k)}</span>
                <span class="small strong right" style="max-width:60%">${esc(Array.isArray(v) ? v.join(', ') : v)}</span>
              </div>`).join('') : '<div class="small muted">No structured fields detected.</div>'}
            <div class="confidence" style="margin-top:6px">
              <span class="tiny muted nowrap">field accuracy</span>
              <span class="track"><span class="fill" style="width:${conf}%"></span></span>
              <span class="tiny strong">${conf}%</span>
            </div>
          </div>
        </div>

        <div class="card" style="box-shadow:none">
          <div class="card-hd"><h3>${icon('route', 15)} Workflow AI decision</h3></div>
          <div class="card-bd">
            <div class="row gap-lg" style="align-items:center;flex-wrap:wrap">
              ${ring(tri.triage.score, tri.triage.level)}
              <div class="grow" style="min-width:190px">
                <div class="row gap-sm" style="margin-bottom:8px">
                  ${badge(tri.triage.level)}
                  <span class="badge badge-info"><span class="dot"></span>${esc(tri.suggestedRoute.department)}</span>
                </div>
                <div class="kv" style="grid-template-columns:96px minmax(0,1fr)">
                  <div class="k">Room</div><div class="v">${esc(tri.suggestedRoute.room)}</div>
                  <div class="k">Est. wait</div><div class="v">${tri.suggestedRoute.estimatedWaitMinutes} min</div>
                </div>
              </div>
            </div>
            <div class="section-title" style="margin:16px 0 10px">Why this decision</div>
            <div class="reasons">
              ${[...tri.triage.reasons, ...tri.suggestedRoute.reasons].slice(0, 6).map((r) => `<div class="reason"><span class="b"></span><span>${esc(r)}</span></div>`).join('')}
            </div>
          </div>
        </div>`;

      confirmBtn.disabled = false;
      toast({ title: 'Extraction complete', desc: `${f.length} fields · triage ${tri.triage.score}/100 · ${tri.suggestedRoute.department}`, type: 'info' });
    } catch (err) {
      toast({ title: 'Extraction failed', desc: err.message, type: 'error' });
    } finally {
      btn.disabled = false;
    }
  }

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="skeleton" style="width:15px;height:15px;border-radius:50%"></span> Checking in…';
    try {
      const res = await api.checkin({ rawForm: input.value.trim() });
      setStep(4);
      const { patient, queueEntry, tasks, triage: tri, route: r, notification } = res;

      result.innerHTML = `
        <span class="section-title" style="margin:0">AI output</span>
        <div class="card" style="box-shadow:none;border-color:var(--teal-200);background:linear-gradient(180deg,#f5fdfb,#fff)">
          <div class="card-bd">
            <div class="row gap" style="margin-bottom:14px">
              <span class="avatar lg" style="background:var(--teal-500);color:#fff">${icon('check', 20)}</span>
              <div>
                <h3>Checked in successfully</h3>
                <div class="tiny muted">${esc(patient.name)} · ${esc(patient.mrn)} · ${esc(queueEntry.token)}</div>
              </div>
            </div>
            <div class="tag-list" style="margin-bottom:14px">
              ${badge(tri.level)}
              <span class="chip chip-teal">${icon('route', 12)} ${esc(r.department)}</span>
              <span class="chip chip-teal">${icon('pin', 12)} ${esc(r.room)}</span>
              <span class="chip chip-amber">${icon('clock', 12)} ~${r.estimatedWaitMinutes} min</span>
            </div>
            <div class="section-title" style="margin:0 0 10px">Tasks created by Workflow AI</div>
            <div class="col" style="gap:8px">
              ${tasks.map((t) => `<div class="task ${t.priority}" style="padding:10px">
                <div class="grow"><div class="t-title">${esc(t.title)}</div>
                <div class="t-meta">${esc(store.nameOf(t.assignedTo))} · ${esc(t.category)}</div></div>
                ${badge(t.priority)}
              </div>`).join('')}
            </div>
            <div class="section-title" style="margin:16px 0 10px">Patient notified</div>
            <div class="card card-pad" style="box-shadow:none;background:#f8fbfd">
              <div class="row between tiny muted"><span>${icon('message', 12)} ${esc(notification.channel)} · ${esc(notification.template)}</span><span class="badge badge-low"><span class="dot"></span>delivered</span></div>
              <div class="small" style="margin-top:8px">${esc(notification.body)}</div>
            </div>
          </div>
        </div>`;

      toast({
        title: `${patient.name} checked in`,
        desc: `${queueEntry.token} → ${r.department}. ${tasks.length} tasks assigned, patient notified.`,
        type: tri.level === 'critical' ? 'warn' : 'success',
        ms: 6000,
      });
      confirmBtn.innerHTML = `${icon('check', 14)} Done`;
      await store.refresh({ silent: true });
      setTimeout(() => { closeOverlay(); ctx.rerender(); }, 1600);
    } catch (err) {
      toast({ title: 'Check-in failed', desc: err.message, type: 'error' });
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `${icon('check', 14)} Confirm check-in`;
    }
  });

  // auto-run once so the demo lands immediately
  setTimeout(run, 450);
}

/* ------------------------------------------------------------- book / new */

function openBookingModal(ctx) {
  const s = store.data || {};
  const doctors = (s.users || []).filter((u) => u.role === 'doctor');
  const today = new Date();
  const local = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const modal = openModal({
    title: 'Book an appointment',
    subtitle: 'Reception AI confirms the slot and sends the reminder automatically.',
    body: `
      <div class="form-grid">
        <div class="field span-2"><label for="bk-patient">Patient</label>
          <select class="select" id="bk-patient">
            ${(s.patients || []).map((p) => `<option value="${p.id}">${esc(p.name)} — ${esc(p.mrn)}</option>`).join('')}
          </select></div>
        <div class="field"><label for="bk-type">Type</label>
          <select class="select" id="bk-type"><option>Consultation</option><option>Follow-up</option><option>Procedure</option><option>Vaccination</option></select></div>
        <div class="field"><label for="bk-doc">Doctor</label>
          <select class="select" id="bk-doc">
            ${doctors.map((d) => `<option value="${d.id}" data-dept="${esc(d.department)}">${esc(d.name)} · ${esc(d.department)}</option>`).join('')}
          </select></div>
        <div class="field"><label for="bk-when">Date & time</label>
          <input class="input" id="bk-when" type="datetime-local" value="${local}" /></div>
        <div class="field span-2"><label for="bk-notes">Notes</label>
          <input class="input" id="bk-notes" placeholder="Reason / preparation instructions" /></div>
      </div>
      <div class="alert info"><div class="ic">${icon('message', 15)}</div>
        <div><div class="ttl">Comm. AI will send a confirmation</div>
        <div class="dsc">WhatsApp confirmation with the room number, plus a reminder 2 hours before.</div></div></div>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="bk-save">${icon('calendar', 14)} Confirm booking</button>`,
  });

  modal.querySelector('#bk-save').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const docSel = modal.querySelector('#bk-doc');
    try {
      const { appointment } = await api.bookAppointment({
        patientId: modal.querySelector('#bk-patient').value,
        doctorId: docSel.value,
        department: docSel.selectedOptions[0]?.dataset.dept || 'General Medicine',
        datetime: new Date(modal.querySelector('#bk-when').value).toISOString(),
        type: modal.querySelector('#bk-type').value,
        notes: modal.querySelector('#bk-notes').value,
      });
      toast({ title: 'Appointment confirmed', desc: `${fmtDate(appointment.datetime, { day: '2-digit', month: 'short' })} at ${fmtTime(appointment.datetime)} — reminder queued.`, type: 'success' });
      closeOverlay();
      await store.refresh({ silent: true });
      ctx.rerender();
    } catch (err) {
      toast({ title: 'Booking failed', desc: err.message, type: 'error' });
      btn.disabled = false;
    }
  });
}

function openNewPatientModal(ctx) {
  const modal = openModal({
    title: 'Register a new patient',
    subtitle: 'Manual entry — for walk-ins without a form.',
    body: `
      <div class="form-grid">
        <div class="field span-2"><label for="np-name">Full name</label><input class="input" id="np-name" required /></div>
        <div class="field"><label for="np-age">Age</label><input class="input" id="np-age" type="number" min="0" max="120" /></div>
        <div class="field"><label for="np-gender">Gender</label>
          <select class="select" id="np-gender"><option>Female</option><option>Male</option><option>Other</option></select></div>
        <div class="field"><label for="np-phone">Phone</label><input class="input" id="np-phone" placeholder="+91 …" /></div>
        <div class="field"><label for="np-blood">Blood group</label><input class="input" id="np-blood" placeholder="B+" /></div>
        <div class="field span-2"><label for="np-complaint">Presenting complaint</label><input class="input" id="np-complaint" placeholder="Fever, cough, follow-up…" /></div>
        <div class="field span-2"><label for="np-allergies">Known allergies (comma separated)</label><input class="input" id="np-allergies" /></div>
        <div class="field span-2"><label for="np-insurance">Insurance / scheme</label><input class="input" id="np-insurance" placeholder="Star Health, PM-JAY, self pay…" /></div>
      </div>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="np-save">${icon('plus', 14)} Register patient</button>`,
  });

  modal.querySelector('#np-save').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const name = modal.querySelector('#np-name').value.trim();
    if (!name) { toast({ title: 'Name is required', type: 'warn' }); return; }
    btn.disabled = true;
    try {
      const { patient } = await api.createPatient({
        name,
        age: modal.querySelector('#np-age').value,
        gender: modal.querySelector('#np-gender').value,
        phone: modal.querySelector('#np-phone').value,
        bloodGroup: modal.querySelector('#np-blood').value,
        symptoms: modal.querySelector('#np-complaint').value.split(',').map((s) => s.trim()).filter(Boolean),
        allergies: modal.querySelector('#np-allergies').value.split(',').map((s) => s.trim()).filter(Boolean),
        insurance: modal.querySelector('#np-insurance').value,
      });
      toast({ title: `${patient.name} registered`, desc: `${patient.mrn} created by Reception.`, type: 'success' });
      closeOverlay();
      await store.refresh({ silent: true });
      ctx.rerender();
    } catch (err) {
      toast({ title: 'Registration failed', desc: err.message, type: 'error' });
      btn.disabled = false;
    }
  });
}
