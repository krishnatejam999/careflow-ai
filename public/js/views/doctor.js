/** Doctor dashboard — AI summaries, consultation notes, labs, prescribing. */
import { api } from '../api.js';
import { store } from '../store.js';
import {
  icon, esc, badge, timeAgo, fmtTime, fmtDate, minsSince, toast,
  openModal, closeOverlay, empty, initials, typewrite,
} from '../ui.js';
import { ring, sparkline } from '../charts.js';

let selectedId = null;
let soapDraft = null;

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const flagTone = { critical: 'critical', high: 'high', medium: 'medium', low: 'low', normal: 'low' };

/* --------------------------------------------------------------------- html */

export function html(state, route) {
  const me = route.user;
  const mine = myPatients(state, me);
  if (!selectedId || !mine.some((p) => p.id === selectedId)) selectedId = mine[0]?.id || null;
  const selected = state.patients.find((p) => p.id === selectedId) || null;

  const myQueue = state.queue.filter((q) => q.doctorId === me.id && q.status !== 'completed');
  const myLabs = state.labs.filter((l) => selected ? l.patientId === selected.id : l.orderedBy === me.id);
  const flagged = state.labs.filter((l) => l.flag === 'critical' || l.flag === 'high').length;

  return `
  <div class="page-head">
    <div>
      <h2>${esc(me.name)} · ${esc(me.department)}</h2>
      <p>Records AI assembles the chart and drafts your notes. You review, sign and prescribe — the paperwork is already done.</p>
    </div>
    <div class="actions">
      <button class="btn" data-act="call-next">${icon('play', 14)} Call next patient</button>
      <button class="btn btn-primary" data-act="new-note">${icon('wand', 14)} AI consultation note</button>
    </div>
  </div>

  <div class="cols cols-4" style="margin-bottom:18px">
    <div class="stat">
      <div class="label">My list today</div>
      <div class="value"><span data-stat="mine">0</span><span class="unit">patients</span></div>
      <div class="delta up">${icon('users', 12)} ${mine.length} in scope</div>
    </div>
    <div class="stat warn">
      <div class="label">Waiting for me</div>
      <div class="value"><span data-stat="waiting">0</span><span class="unit">tokens</span></div>
      <div class="delta down">${icon('clock', 12)} ${myQueue.length ? `longest ${Math.max(...myQueue.map((q) => minsSince(q.checkedInAt)))} min` : 'queue clear'}</div>
    </div>
    <div class="stat violet">
      <div class="label">Notes drafted by AI</div>
      <div class="value"><span data-stat="notes">0</span><span class="unit">this session</span></div>
      <div class="delta up">${icon('zap', 12)} −8.7 hrs/week paperwork</div>
    </div>
    <div class="stat rose">
      <div class="label">Flagged results</div>
      <div class="value"><span data-stat="flagged">0</span><span class="unit">need review</span></div>
      <div class="delta ${flagged ? 'down' : 'up'}">${icon(flagged ? 'alert' : 'check', 12)} ${flagged ? 'critical or high' : 'all clear'}</div>
    </div>
  </div>

  ${route.tab === 'labs' ? labsPage(state, me) : route.tab === 'notes' ? notesPage(state, me) : `
  <div class="layout-3">
    <div class="col" style="gap:14px">
      <div class="card">
        <div class="card-hd"><h3>${icon('users', 15)} My list</h3><span class="sub">${mine.length}</span></div>
        <div class="list scroll-y">
          ${mine.map((p) => {
            const q = state.queue.find((x) => x.patientId === p.id && x.status !== 'completed');
            return `<button class="list-item ${p.id === selectedId ? 'selected' : ''}" data-act="select-patient" data-id="${p.id}" style="width:100%;border:none;background:none;text-align:left">
              <span class="avatar sm ${p.riskLevel === 'critical' ? 'rose' : p.riskLevel === 'high' ? 'amber' : 'sky'}">${esc(initials(p.name))}</span>
              <span class="meta">
                <span class="name">${esc(p.name)} ${q ? `<span class="badge badge-${q.priority}"><span class="dot"></span>${esc(q.token)}</span>` : ''}</span>
                <span class="sub truncate">${p.age}${p.gender === 'Female' ? 'F' : 'M'} · ${esc((p.symptoms || []).join(', ') || 'no complaint')}</span>
              </span>
              ${icon('chevronRight', 15, 'muted')}
            </button>`;
          }).join('') || empty('users', 'No patients assigned', 'Patients routed to you by Workflow AI appear here.')}
        </div>
      </div>
      ${state.appointments.filter((a) => a.doctorId === me.id).length ? `
      <div class="card">
        <div class="card-hd"><h3>${icon('calendar', 15)} My schedule</h3></div>
        <div class="list">
          ${state.appointments.filter((a) => a.doctorId === me.id).sort((a, b) => new Date(a.datetime) - new Date(b.datetime)).map((a) => {
            const p = state.patients.find((x) => x.id === a.patientId);
            return `<div class="list-item" data-act="select-patient" data-id="${a.patientId}">
              <span class="token low" style="width:58px"><span class="t">TIME</span>${esc(fmtTime(a.datetime))}</span>
              <span class="meta"><span class="name">${esc(p?.name || '')}</span><span class="sub">${esc(a.type)} · ${esc(a.notes || 'no notes')}</span></span>
              <span class="trail"><span class="badge badge-neutral">${esc(a.status)}</span></span>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}
    </div>

    <div class="col" style="gap:14px">
      ${selected ? workspace(state, selected, me) : `<div class="card">${empty('stethoscope', 'Select a patient', 'Choose a patient from the list to open their AI-assembled chart.')}</div>`}
    </div>

    <div class="col sticky-col" style="gap:14px">
      ${copilotCard(state, selected)}
      ${alertsCard(state)}
    </div>
  </div>`}
  `;
}

/* --------------------------------------------------------------- fragments */

function lastNote(notes) {
  if (!notes.length) return '';
  const n = notes[0];
  const badgeText = n.aiGenerated ? 'AI drafted, clinician signed' : 'clinician';
  return `<div class="section-title" style="margin-top:20px">Last consultation (${badgeText})</div>
    <div class="card card-pad" style="box-shadow:none;background:#f8fbfd">
      <div class="kv" style="grid-template-columns:86px minmax(0,1fr);gap:8px 12px">
        <div class="k">Assessment</div><div class="v" style="font-weight:500">${esc(n.assessment)}</div>
        <div class="k">Plan</div><div class="v" style="font-weight:500">${esc(n.plan)}</div>
      </div>
    </div>`;
}

function workspace(state, p, me) {
  const vitals = state.vitals.filter((v) => v.patientId === p.id).sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
  const labs = state.labs.filter((l) => l.patientId === p.id);
  const rx = state.prescriptions.filter((r) => r.patientId === p.id);
  const notes = state.notes.filter((x) => x.patientId === p.id);
  const t = triageOf(state, p);
  const hrTrend = vitals.slice(0, 8).reverse().map((v) => v.hr);

  return `
  <div class="card">
    <div class="card-hd">
      <h3>
        <span class="avatar ${p.riskLevel === 'critical' ? 'rose' : 'sky'}">${esc(initials(p.name))}</span>
        ${esc(p.name)}
        ${badge(p.riskLevel)}
      </h3>
      <div class="row gap-sm">
        <button class="btn btn-sm" data-act="gen-summary" data-id="${p.id}">${icon('sparkles', 13)} Summarise</button>
        <button class="btn btn-sm btn-primary" data-act="new-note" data-id="${p.id}">${icon('wand', 13)} Draft note</button>
      </div>
    </div>
    <div class="card-bd">
      <div class="row gap-lg" style="align-items:center;flex-wrap:wrap;margin-bottom:18px">
        ${ring(t.score, t.level, { size: 84 })}
        <div class="grow" style="min-width:180px">
          <div class="kv" style="grid-template-columns:100px minmax(0,1fr)">
            <div class="k">MRN</div><div class="v mono">${esc(p.mrn)}</div>
            <div class="k">Age / Sex</div><div class="v">${p.age} · ${esc(p.gender)}</div>
            <div class="k">Blood group</div><div class="v">${esc(p.bloodGroup)}</div>
            <div class="k">Coverage</div><div class="v">${esc(p.insurance?.scheme || 'Self pay')}</div>
          </div>
        </div>
        <div class="col" style="gap:8px;min-width:150px">
          ${sparkline(hrTrend, { w: 150, h: 36, color: '#e11d48' })}
          <span class="tiny muted">${icon('activity', 12)} HR trend · last ${vitals.length} readings</span>
        </div>
      </div>

      <div class="tag-list" style="margin-bottom:16px">
        ${(p.allergies || []).length ? `<span class="chip chip-rose">${icon('alert', 12)} Allergy: ${esc(p.allergies.join(', '))}</span>` : ''}
        ${(p.conditions || []).map((c) => `<span class="chip">${esc(c)}</span>`).join('')}
        ${(p.medications || []).map((m) => `<span class="chip">${esc(m)}</span>`).join('')}
      </div>

      <div class="layout-2" style="gap:16px">
        <div>
          <div class="section-title">Presenting complaint</div>
          <div class="small" style="margin-bottom:14px">${esc((p.symptoms || []).join(', ') || 'No complaint recorded.')}</div>
          <div class="section-title">Latest vitals</div>
          ${vitals[0] ? `<table class="mini-table">
            <tr><td>HR</td><td>${vitals[0].hr} bpm</td></tr>
            <tr><td>BP</td><td>${vitals[0].bpSys}/${vitals[0].bpDia}</td></tr>
            <tr><td>SpO₂</td><td>${vitals[0].spo2}%</td></tr>
            <tr><td>Temp</td><td>${vitals[0].temp} °C</td></tr>
            <tr><td>Recorded</td><td>${timeAgo(vitals[0].recordedAt)}</td></tr>
          </table>` : '<div class="small muted">Not recorded yet — ask the nurse.</div>'}
        </div>
        <div>
          <div class="section-title">Investigations</div>
          ${labs.length ? `<table class="mini-table">
            ${labs.slice(0, 5).map((l) => `<tr><td>${esc(l.test)}</td><td>${esc(l.result)} ${esc(l.unit)} ${badge(l.flag === 'normal' ? 'low' : l.flag)}</td></tr>`).join('')}
          </table>` : '<div class="small muted">No lab orders.</div>'}
          <div class="section-title" style="margin-top:16px">Active medication</div>
          ${rx.length ? `<table class="mini-table">
            ${rx[0].items.map((i) => `<tr><td>${esc(i.drug)}</td><td>${esc(i.freq)}</td></tr>`).join('')}
          </table>` : '<div class="small muted">No active prescriptions.</div>'}
        </div>
      </div>

      ${lastNote(notes)}
    </div>
    <div class="card-ft row between">
      <span class="tiny muted">Records AI assembled this chart from ${labs.length + vitals.length + rx.length + notes.length} records · ${esc(p.mrn)}</span>
      <div class="row gap-sm">
        <button class="btn btn-sm" data-act="prescribe" data-id="${p.id}">${icon('pill', 13)} Prescribe</button>
        <button class="btn btn-sm" data-act="complete" data-id="${p.id}">${icon('check', 13)} Close encounter</button>
      </div>
    </div>
  </div>`;
}

function copilotCard(state, p) {
  return `
  <div class="card ai-panel">
    <div class="card-hd">
      <h3>${icon('brain', 15)} Clinical copilot</h3>
      <span class="badge" style="background:rgba(20,184,166,.2);color:#5eead4;border-color:rgba(20,184,166,.3)"><span class="dot"></span>Records AI</span>
    </div>
    <div class="card-bd" style="display:grid;gap:14px">
      <div class="small" style="color:rgba(223,241,244,.75)">
        ${p ? `Chart assembled for <strong style="color:#fff">${esc(p.name)}</strong> — ${esc(p.age)}${p.gender === 'Female' ? 'F' : 'M'}, ${esc((p.conditions || []).join(', ') || 'no chronic conditions')}.` : 'Select a patient to assemble their chart.'}
      </div>
      <div class="row gap-sm" style="flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-act="gen-summary" ${p ? `data-id="${p.id}"` : 'disabled'}>${icon('sparkles', 13)} Generate summary</button>
        <button class="btn btn-sm btn-outline-light" data-act="new-note" ${p ? `data-id="${p.id}"` : 'disabled'}>${icon('wand', 13)} Draft SOAP</button>
      </div>
      <div id="copilot-output">
        ${p ? summarySkeleton(p) : '<div class="small" style="color:rgba(223,241,244,.5)">No patient selected.</div>'}
      </div>
      <div class="section-title" style="margin:4px 0 0">Agent trail</div>
      <div class="col" style="gap:0">
        ${state.activity.filter((a) => /Records|Workflow/.test(a.agent)).slice(0, 4).map((a) => `
          <div class="ai-msg">
            <div class="ic" style="background:${a.level === 'critical' ? 'rgba(225,29,72,.22)' : 'rgba(255,255,255,.08)'};color:${a.level === 'critical' ? '#fda4af' : '#5eead4'}">
              ${icon(a.level === 'critical' ? 'octagon' : 'file', 14)}
            </div>
            <div class="txt"><div style="color:rgba(255,255,255,.86)">${esc(a.message)}</div>
            <div class="why">${esc(a.agent)} · ${timeAgo(a.ts)}</div></div>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function summarySkeleton(p) {
  const t = triageOf(store.data || {}, p);
  return `
    <div class="card card-pad" style="box-shadow:none;background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1)">
      <div class="row between" style="margin-bottom:10px">
        <span class="tiny upper" style="color:rgba(223,241,244,.5)">AI summary</span>
        <button class="btn btn-sm btn-outline-light" data-act="gen-summary" data-id="${p.id}">${icon('refresh', 12)} Regenerate</button>
      </div>
      <div id="copilot-text" class="small" style="color:rgba(255,255,255,.9);line-height:1.6">
        ${esc(p.name)} — ${p.age}${p.gender === 'Female' ? 'F' : 'M'} presenting with ${esc((p.symptoms || ['no recorded complaint']).join(', ').toLowerCase())}.
        AI triage score ${t.score}/100 (${t.level}). Known ${esc((p.conditions || ['no chronic illness']).join(', '))}.
        ${(p.allergies || []).length ? `Allergy alert: ${esc(p.allergies.join(', '))}.` : 'No known allergies.'}
      </div>
      <div class="tag-list" style="margin-top:12px">
        ${badge(t.level)}
        <span class="chip" style="background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.14);color:#dff1f4">${icon('target', 12)} score ${t.score}</span>
      </div>
    </div>`;
}

function alertsCard(state) {
  const alerts = state.alerts.filter((a) => a.kind === 'Lab' || a.kind === 'Vitals' || a.kind === 'Task');
  return `
  <div class="card">
    <div class="card-hd"><h3>${icon('alert', 15)} Flags for me</h3><span class="sub">${alerts.length}</span></div>
    <div class="card-bd" style="display:grid;gap:10px">
      ${alerts.slice(0, 4).map((a) => `
        <div class="alert ${a.severity}">
          <div class="ic">${icon(a.severity === 'critical' ? 'octagon' : 'alert', 15)}</div>
          <div class="grow">
            <div class="ttl small">${esc(a.title)}</div>
            <div class="dsc">${esc(a.detail)}</div>
            ${a.patientId ? `<button class="btn btn-sm" style="margin-top:8px" data-act="select-patient" data-id="${a.patientId}">Open chart</button>` : ''}
          </div>
        </div>`).join('') || '<div class="small muted">No flags right now.</div>'}
    </div>
  </div>`;
}

function labsPage(state, me) {
  const rows = [...state.labs].sort((a, b) => (PRIORITY_ORDER[a.flag === 'normal' ? 'low' : a.flag] - PRIORITY_ORDER[b.flag === 'normal' ? 'low' : b.flag]));
  return `
  <div class="card">
    <div class="card-hd">
      <h3>${icon('flask', 16)} Lab reports <span class="sub">flag-first ordering</span></h3>
      <span class="chip chip-rose">${rows.filter((r) => r.flag === 'critical').length} critical</span>
    </div>
    <div class="table-scroll" style="max-height:640px">
      <table class="table">
        <thead><tr><th>Patient</th><th>Test</th><th>Result</th><th>Reference</th><th>Flag</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${rows.map((l) => {
            const p = state.patients.find((x) => x.id === l.patientId);
            return `<tr>
              <td><div class="strong">${esc(p?.name || '')}</div><div class="tiny muted">${esc(p?.mrn || '')}</div></td>
              <td>${esc(l.test)}<div class="tiny muted">ordered by ${esc(store.nameOf(l.orderedBy))}</div></td>
              <td class="num">${esc(l.result)} <span class="tiny muted">${esc(l.unit)}</span></td>
              <td class="tiny muted">${esc(l.range)}</td>
              <td>${badge(l.flag === 'normal' ? 'low' : l.flag)}</td>
              <td><span class="badge badge-${l.status === 'reported' ? 'low' : 'info'}"><span class="dot"></span>${esc(l.status)}</span></td>
              <td class="right">
                <div class="row gap-sm" style="justify-content:flex-end">
                  <button class="btn btn-sm" data-act="select-patient" data-id="${l.patientId}">Chart</button>
                  ${l.status === 'processing'
                    ? `<button class="btn btn-sm btn-primary" data-act="release-lab" data-id="${l.id}">${icon('send', 12)} Release</button>`
                    : `<span class="tiny muted">${timeAgo(l.reportedAt)}</span>`}
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function notesPage(state, me) {
  const notes = [...state.notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return `
  <div class="layout-main">
    <div class="col" style="gap:16px">
      <div class="card">
        <div class="card-hd">
          <h3>${icon('clipboard', 16)} Consultation notes <span class="sub">${notes.length} signed</span></h3>
          <button class="btn btn-sm btn-primary" data-act="new-note">${icon('wand', 13)} New AI note</button>
        </div>
        <div class="card-bd" style="display:grid;gap:16px">
          ${notes.map((n) => {
            const p = state.patients.find((x) => x.id === n.patientId);
            return `<div class="card card-pad" style="box-shadow:none;background:#fbfdfe">
              <div class="row between" style="margin-bottom:12px">
                <div class="row gap-sm">
                  <span class="avatar sm sky">${esc(initials(p?.name || ''))}</span>
                  <div><div class="strong small">${esc(p?.name || '')}</div>
                  <div class="tiny muted">${esc(fmtDate(n.createdAt, { day: '2-digit', month: 'short' }))} · ${esc(fmtTime(n.createdAt))}</div></div>
                </div>
                ${n.aiGenerated ? '<span class="badge badge-violet"><span class="dot"></span>AI drafted</span>' : '<span class="badge badge-neutral"><span class="dot"></span>manual</span>'}
              </div>
              <div class="kv" style="grid-template-columns:86px minmax(0,1fr);gap:9px 12px">
                <div class="k">Complaint</div><div class="v" style="font-weight:500">${esc(n.chiefComplaint)}</div>
                <div class="k">Subjective</div><div class="v" style="font-weight:500">${esc(n.subjective)}</div>
                <div class="k">Objective</div><div class="v" style="font-weight:500">${esc(n.objective)}</div>
                <div class="k">Assessment</div><div class="v" style="font-weight:500">${esc(n.assessment)}</div>
                <div class="k">Plan</div><div class="v" style="font-weight:500">${esc(n.plan)}</div>
              </div>
            </div>`;
          }).join('') || empty('clipboard', 'No notes yet', 'Draft one with AI and it will appear here, signed and attributable.')}
        </div>
      </div>
    </div>
    <div class="sticky-col">
      <div class="card ai-panel">
        <div class="card-hd"><h3>${icon('sparkles', 15)} Documentation AI</h3></div>
        <div class="card-bd" style="display:grid;gap:12px">
          <div class="small" style="color:rgba(223,241,244,.78)">
            Records AI pre-fills S/O/A/P from vitals, labs, history and your spoken summary. You stay the author —
            the draft is labelled until you sign it.
          </div>
          <div class="row between small" style="color:rgba(255,255,255,.9)">
            <span>Documentation time saved</span><strong>64%</strong>
          </div>
          <div class="progress" style="background:rgba(255,255,255,.12)"><span style="width:64%"></span></div>
          <button class="btn btn-primary btn-block" data-act="new-note">${icon('wand', 14)} Draft a note now</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------------- mount */

function myPatients(state, me) {
  const seen = new Set();
  const inQueue = state.queue.filter((q) => q.status !== 'completed' && (q.doctorId === me.id || !q.doctorId));
  const out = [];
  for (const q of inQueue.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])) {
    const p = state.patients.find((x) => x.id === q.patientId);
    if (p && !seen.has(p.id)) { out.push(p); seen.add(p.id); }
  }
  for (const p of state.patients) {
    if (!seen.has(p.id) && p.primaryDoctorId === me.id) { out.push(p); seen.add(p.id); }
  }
  if (!out.length) return state.patients.slice(0, 6);
  return out;
}

function triageOf(state, p) {
  const order = { critical: 90, high: 70, medium: 45, low: 20 };
  const q = (state.queue || []).find((x) => x.patientId === p.id && x.status !== 'completed');
  return { score: q?.triageScore ?? order[p.riskLevel] ?? 20, level: p.riskLevel || 'low' };
}

export function mount(root, ctx) {
  const refresh = async () => { await store.refresh({ silent: true }); ctx.rerender(); };

  const handlers = {
    'select-patient': (el) => {
      selectedId = el.dataset.id;
      ctx.rerender();
      // lazily fetch a fresh summary so the copilot feels alive
      if (!el.dataset.id) return;
      setTimeout(() => generateSummary(el.dataset.id, root), 120);
    },

    'gen-summary': async (el, e) => {
      e.stopPropagation();
      const id = el.dataset.id || selectedId;
      if (!id) return;
      await generateSummary(id, root, true);
    },

    'new-note': (el) => openNoteComposer(ctx, el?.dataset?.id || selectedId),
    prescribe: (el) => openPrescribeModal(ctx, el?.dataset?.id || selectedId),
    'release-lab': async (el) => {
      el.disabled = true;
      try {
        const { lab } = await api.releaseLab(el.dataset.id);
        toast({ title: `${lab.test} released`, desc: 'Comm. AI notified the patient with the result summary.', type: 'success' });
        await refresh();
      } catch (err) {
        toast({ title: 'Release failed', desc: err.message, type: 'error' });
        el.disabled = false;
      }
    },
    'call-next': async (el) => {
      el.disabled = true;
      try {
        const me = store.user;
        const { queueEntry } = await api.callNext(me.department);
        const p = store.patient(queueEntry.patientId);
        selectedId = p?.id || selectedId;
        toast({ title: `${queueEntry.token} ready — ${p?.name}`, desc: `Priority ${queueEntry.priority}. Chart loaded into the copilot.`, type: 'success' });
        await refresh();
      } catch (err) {
        toast({ title: 'Nothing waiting', desc: err.message, type: 'warn' });
        el.disabled = false;
      }
    },
    complete: async (el) => {
      const q = store.data.queue.find((x) => x.patientId === el.dataset.id && x.status !== 'completed');
      if (!q) { toast({ title: 'No open encounter for this patient', type: 'warn' }); return; }
      try {
        await api.advanceQueue(q.id);
        const p = store.patient(el.dataset.id);
        toast({ title: `Encounter closed — ${p?.name}`, desc: 'Discharge summary queued, tasks auto-closed.', type: 'success' });
        await refresh();
      } catch (err) {
        toast({ title: 'Could not close the encounter', desc: err.message, type: 'error' });
      }
    },
  };

  requestAnimationFrame(() => {
    const s = store.data || {};
    if (!store.data || !store.user) return;
    const mine = myPatients(s, store.user);
    const myQueue = (s.queue || []).filter((q) => q.doctorId === store.user.id && q.status !== 'completed');
    import('../ui.js').then(({ animateCount }) => {
      animateCount(root.querySelector('[data-stat="mine"]'), mine.length);
      animateCount(root.querySelector('[data-stat="waiting"]'), myQueue.length);
      animateCount(root.querySelector('[data-stat="notes"]'), (s.notes || []).length);
      animateCount(root.querySelector('[data-stat="flagged"]'), (s.labs || []).filter((l) => l.flag === 'critical' || l.flag === 'high').length);
    });
  });

  return handlers;
}

/* --------------------------------------------------------------- copilot */

async function generateSummary(patientId, root, announce = false) {
  const box = root.querySelector('#copilot-output');
  if (!box) return;
  const p = store.patient(patientId);
  box.innerHTML = `<div class="row gap"><span class="skeleton" style="width:15px;height:15px;border-radius:50%"></span>
    <span class="small" style="color:rgba(223,241,244,.7)">Records AI is reading ${esc(p?.name || 'the chart')}’s history…</span></div>`;
  try {
    const { summary } = await api.summary(patientId);
    box.innerHTML = `
      <div class="card card-pad" style="box-shadow:none;background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1)">
        <div class="row between" style="margin-bottom:10px">
          <span class="tiny upper" style="color:rgba(223,241,244,.5)">AI summary · ${summary.riskFlags.length} flags</span>
          <button class="btn btn-sm btn-outline-light" data-act="gen-summary" data-id="${patientId}">${icon('refresh', 12)} Regenerate</button>
        </div>
        <div class="small" id="copilot-text" style="color:rgba(255,255,255,.9);line-height:1.6">${esc(summary.headline)}</div>
        <div class="col" style="gap:6px;margin-top:12px">
          ${summary.suggestedFocus.map((s) => `<div class="reason"><span class="b" style="background:#5eead4"></span><span style="color:rgba(255,255,255,.82)">${esc(s)}</span></div>`).join('')}
        </div>
        ${summary.riskFlags.length ? `<div class="tag-list" style="margin-top:12px">
          ${summary.riskFlags.slice(0, 4).map((f) => `<span class="chip" style="background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.14);color:#dff1f4">${esc(f.text.slice(0, 42))}${f.text.length > 42 ? '…' : ''}</span>`).join('')}
        </div>` : ''}
      </div>`;
    if (announce) toast({ title: 'Summary ready', desc: `${summary.riskFlags.length} risk flags highlighted for ${p?.name}.`, type: 'info' });
  } catch (err) {
    box.innerHTML = `<div class="small" style="color:#fda4af">${esc(err.message)}</div>`;
  }
}

/* ----------------------------------------------------------- note composer */

function openNoteComposer(ctx, patientId) {
  const s = store.data || {};
  const patients = s.patients || [];
  const pid = patientId || patients[0]?.id;

  const modal = openModal({
    title: 'AI consultation note',
    subtitle: 'Records AI drafts S/O/A/P from the chart — you review and sign.',
    wide: true,
    body: `
      <div class="form-grid">
        <div class="field span-2"><label for="nt-patient">Patient</label>
          <select class="select" id="nt-patient">
            ${patients.map((p) => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${esc(p.name)} — ${esc(p.mrn)}</option>`).join('')}
          </select></div>
        <div class="field span-2"><label for="nt-transcript">Your spoken summary (optional)</label>
          <textarea class="textarea" id="nt-transcript" style="min-height:70px" placeholder="e.g. Started on IV furosemide, repeat SpO2 in 10 minutes, cardiology review requested"></textarea></div>
      </div>
      <div class="row between">
        <span class="section-title" style="margin:0">Draft</span>
        <button class="btn btn-sm btn-primary" id="nt-draft">${icon('wand', 13)} Draft with AI</button>
      </div>
      <div id="nt-fields" style="display:grid;gap:12px">
        ${['chiefComplaint', 'subjective', 'objective', 'assessment', 'plan'].map((k) => `
          <div class="field">
            <label for="nt-${k}">${k === 'chiefComplaint' ? 'Chief complaint' : k[0].toUpperCase() + k.slice(1)}</label>
            <textarea class="textarea" id="nt-${k}" style="min-height:${k === 'plan' ? 76 : 62}px" placeholder="Not drafted yet"></textarea>
          </div>`).join('')}
      </div>
      <div class="alert info"><div class="ic">${icon('shield', 15)}</div>
        <div><div class="ttl">Audit trail</div><div class="dsc">Saved notes are attributed to you and marked as AI-assisted. Docs time saved so far: 64%.</div></div>
      </div>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn" id="nt-save-manual">${icon('file', 14)} Save as manual</button>
      <button class="btn btn-primary" id="nt-sign" disabled>${icon('check', 14)} Sign note</button>`,
  });

  let aiGenerated = false;

  modal.querySelector('#nt-draft').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = '<span class="skeleton" style="width:14px;height:14px;border-radius:50%"></span> Drafting…';
    try {
      const { draft } = await api.soap(modal.querySelector('#nt-patient').value, modal.querySelector('#nt-transcript').value);
      for (const k of ['chiefComplaint', 'subjective', 'objective', 'assessment', 'plan']) {
        const field = modal.querySelector(`#nt-${k}`);
        field.value = draft[k];
      }
      aiGenerated = true;
      modal.querySelector('#nt-sign').disabled = false;
      modal.querySelector('#nt-sign').innerHTML = `${icon('check', 14)} Sign AI-drafted note`;
      toast({ title: 'Draft ready', desc: `Triage score ${draft.triage.score}/100 — review each section before signing.`, type: 'info' });
    } catch (err) {
      toast({ title: 'Drafting failed', desc: err.message, type: 'error' });
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon('wand', 13)} Draft with AI`;
    }
  });

  const save = async (ai) => {
    const btn = modal.querySelector(ai ? '#nt-sign' : '#nt-save-manual');
    btn.disabled = true;
    try {
      const payload = {
        patientId: modal.querySelector('#nt-patient').value,
        doctorId: store.user.id,
        aiGenerated: ai,
        chiefComplaint: modal.querySelector('#nt-chiefComplaint').value,
        subjective: modal.querySelector('#nt-subjective').value,
        objective: modal.querySelector('#nt-objective').value,
        assessment: modal.querySelector('#nt-assessment').value,
        plan: modal.querySelector('#nt-plan').value,
      };
      if (!payload.chiefComplaint && !payload.assessment) {
        toast({ title: 'Nothing to sign', desc: 'Draft the note or fill in at least the complaint and assessment.', type: 'warn' });
        btn.disabled = false;
        return;
      }
      await api.saveNote(payload);
      const p = store.patient(payload.patientId);
      toast({ title: `Note saved for ${p?.name}`, desc: ai ? 'AI-drafted note signed and attributed to you.' : 'Manual note saved.', type: 'success' });
      closeOverlay();
      await store.refresh({ silent: true });
      ctx.rerender();
    } catch (err) {
      toast({ title: 'Could not save the note', desc: err.message, type: 'error' });
      btn.disabled = false;
    }
  };

  modal.querySelector('#nt-sign').addEventListener('click', () => save(true));
  modal.querySelector('#nt-save-manual').addEventListener('click', () => save(false));
}

/* ---------------------------------------------------------- prescribing */

function openPrescribeModal(ctx, patientId) {
  const s = store.data || {};
  const p = s.patients.find((x) => x.id === patientId) || s.patients[0];
  if (!p) { toast({ title: 'Select a patient first', type: 'warn' }); return; }

  const modal = openModal({
    title: `Prescribe for ${p.name}`,
    subtitle: 'Records AI checks every line against documented allergies.',
    body: `
      ${(p.allergies || []).length ? `<div class="alert critical">
        <div class="ic">${icon('alert', 15)}</div>
        <div><div class="ttl">Allergy on file</div><div class="dsc">${esc(p.allergies.join(', '))} — the prescriber will be blocked if a conflict is detected.</div></div>
      </div>` : ''}
      <div id="rx-rows" class="col" style="gap:12px"></div>
      <button class="btn btn-sm" id="rx-add">${icon('plus', 13)} Add medication</button>
      <div id="rx-warnings"></div>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="rx-issue">${icon('pill', 14)} Issue prescription</button>`,
  });

  const rows = modal.querySelector('#rx-rows');
  const addRow = (drug = '', dose = '', freq = '') => {
    const row = document.createElement('div');
    row.className = 'form-grid';
    row.style.gridTemplateColumns = '1.4fr .8fr 1.4fr auto';
    row.innerHTML = `
      <input class="input" placeholder="Drug (e.g. Amoxicillin 500mg)" value="${esc(drug)}" data-k="drug" />
      <input class="input" placeholder="Dose" value="${esc(dose)}" data-k="dose" />
      <input class="input" placeholder="Frequency · duration" value="${esc(freq)}" data-k="freq" />
      <button class="btn btn-icon btn-danger" data-remove>${icon('x', 14)}</button>`;
    row.querySelector('[data-remove]').addEventListener('click', () => row.remove());
    rows.appendChild(row);
  };
  setTimeout(() => addRow('', '1 tablet', 'Twice daily · 5 days'), 40);

  modal.querySelector('#rx-add').addEventListener('click', () => addRow());

  modal.querySelector('#rx-issue').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const items = [...rows.children].map((r) => ({
      drug: r.querySelector('[data-k="drug"]').value.trim(),
      dose: r.querySelector('[data-k="dose"]').value.trim(),
      freq: r.querySelector('[data-k="freq"]').value.trim(),
      duration: '',
    })).filter((i) => i.drug);
    if (!items.length) { toast({ title: 'Add at least one medication', type: 'warn' }); return; }

    btn.disabled = true;
    try {
      const res = await api.prescribe({ patientId: p.id, doctorId: store.user.id, items });
      if (res.allergyWarnings?.length) {
        modal.querySelector('#rx-warnings').innerHTML = `<div class="alert critical">
          <div class="ic">${icon('octagon', 15)}</div>
          <div><div class="ttl">Allergy conflict detected and flagged</div>
          <div class="dsc">${res.allergyWarnings.map(esc).join('<br/>')}</div></div></div>`;
        toast({ title: 'Allergy alert', desc: 'Prescription recorded but flagged for the pharmacist.', type: 'error', ms: 7000 });
      } else {
        toast({ title: `Prescription issued for ${p.name}`, desc: `${items.length} item(s) sent to pharmacy, patient notified.`, type: 'success' });
        closeOverlay();
      }
      await store.refresh({ silent: true });
      ctx.rerender();
    } catch (err) {
      toast({ title: 'Could not issue the prescription', desc: err.message, type: 'error' });
      btn.disabled = false;
    }
  });
}
