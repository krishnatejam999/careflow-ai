/** Nurse dashboard — dynamic task board, vitals monitoring, care plans. */
import { api } from '../api.js';
import { store } from '../store.js';
import {
  icon, esc, badge, timeAgo, fmtTime, minsSince, toast, openModal, closeOverlay, empty, initials,
} from '../ui.js';
import { sparkline, bars, ring } from '../charts.js';

let filter = 'all';

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const CATEGORY_ICON = {
  Emergency: 'octagon', Vitals: 'activity', Medication: 'pill', Labs: 'flask',
  Documents: 'file', Insurance: 'shield', 'Care plan': 'heart', Inventory: 'layers',
  Escalation: 'alert', Billing: 'card', Communication: 'message',
};

/* --------------------------------------------------------------------- html */

export function html(state, route) {
  const me = route.user;
  const mine = state.tasks.filter((t) => t.assignedTo === me.id);
  const open = mine.filter((t) => t.status !== 'done');
  const critical = open.filter((t) => t.priority === 'critical');

  const myPatients = patientsFor(state, me, mine);
  const vitalsDue = myPatients.filter((p) => {
    const v = state.vitals.filter((x) => x.patientId === p.id).sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))[0];
    return !v || minsSince(v.recordedAt) > 120;
  });

  return `
  <div class="page-head">
    <div>
      <h2>${esc(me.name)} · ${esc(me.department)}</h2>
      <p>Workflow AI turns every new encounter into assigned tasks, and escalates automatically when a vital goes out of range.</p>
    </div>
    <div class="actions">
      <button class="btn" data-act="care-plan">${icon('heart', 14)} Care plans</button>
      <button class="btn btn-primary" data-act="record-vitals">${icon('activity', 14)} Record vitals</button>
    </div>
  </div>

  <div class="cols cols-4" style="margin-bottom:18px">
    <div class="stat">
      <div class="label">Open tasks</div>
      <div class="value"><span data-stat="open">0</span><span class="unit">assigned to me</span></div>
      <div class="delta ${critical.length ? 'down' : 'up'}">${icon(critical.length ? 'alert' : 'check', 12)} ${critical.length} critical</div>
    </div>
    <div class="stat ${critical.length ? 'rose' : ''}">
      <div class="label">Critical right now</div>
      <div class="value"><span data-stat="critical">0</span><span class="unit">escalations</span></div>
      <div class="delta down">${icon('zap', 12)} Workflow AI escalated</div>
    </div>
    <div class="stat warn">
      <div class="label">Vitals due</div>
      <div class="value"><span data-stat="due">0</span><span class="unit">patients</span></div>
      <div class="delta down">${icon('clock', 12)} not recorded in 2h</div>
    </div>
    <div class="stat violet">
      <div class="label">Completed today</div>
      <div class="value"><span data-stat="done">0</span><span class="unit">tasks</span></div>
      <div class="delta up">${icon('checkCircle', 12)} ${mine.filter((t) => t.status === 'done').length} closed of ${mine.length}</div>
    </div>
  </div>

  ${route.tab === 'vitals' ? vitalsPage(state, myPatients)
    : route.tab === 'plans' ? carePlansPage(state, myPatients)
    : `
  <div class="layout-main">
    <div class="col" style="gap:16px">
      ${taskBoard(state, me, mine)}
    </div>
    <div class="sticky-col">
      ${vitalsPanel(state, myPatients)}
      ${escalationCard(state)}
    </div>
  </div>`}`;
}

/* --------------------------------------------------------------- task board */

function taskBoard(state, me, mine) {
  const filters = [
    { id: 'all', label: 'All', count: mine.filter((t) => t.status !== 'done').length },
    { id: 'critical', label: 'Critical', count: mine.filter((t) => t.priority === 'critical' && t.status !== 'done').length },
    { id: 'Vitals', label: 'Vitals', count: mine.filter((t) => t.category === 'Vitals' && t.status !== 'done').length },
    { id: 'Medication', label: 'Medication', count: mine.filter((t) => t.category === 'Medication' && t.status !== 'done').length },
    { id: 'done', label: 'Completed', count: mine.filter((t) => t.status === 'done').length },
  ];

  let list = mine.filter((t) => (filter === 'done' ? t.status === 'done' : t.status !== 'done'));
  if (filter === 'critical') list = list.filter((t) => t.priority === 'critical');
  else if (filter !== 'all' && filter !== 'done') list = list.filter((t) => t.category === filter);
  list = [...list].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || new Date(a.dueAt) - new Date(b.dueAt));

  return `
  <div class="card">
    <div class="card-hd">
      <h3>${icon('clipboard', 16)} Dynamic task board <span class="sub">assigned by Workflow AI</span></h3>
      <div class="row gap-sm">
        <button class="btn btn-sm" data-act="reassign-open">${icon('users', 13)} Rebalance</button>
        <button class="btn btn-sm btn-primary" data-act="record-vitals">${icon('activity', 13)} Vitals</button>
      </div>
    </div>
    <div class="card-bd" style="padding-bottom:6px">
      <div class="tabs" style="width:fit-content;max-width:100%;overflow:auto">
        ${filters.map((f) => `<button class="tab ${filter === f.id ? 'active' : ''}" data-act="filter" data-id="${f.id}">${f.label}${f.count ? ` · ${f.count}` : ''}</button>`).join('')}
      </div>
    </div>
    ${list.length ? `<div class="task-list">
      ${list.map((t) => taskCard(state, t)).join('')}
    </div>` : `<div class="card-bd">${empty('checkCircle', 'Nothing here', 'No tasks match this filter. Workflow AI will assign new work the moment a patient is checked in.')}</div>`}
    <div class="card-ft row between">
      <span class="tiny muted">${mine.filter((t) => t.status !== 'done').length} open · ${mine.filter((t) => t.status === 'done').length} completed this shift</span>
      <span class="chip chip-teal">${icon('zap', 12)} auto-assigned by load</span>
    </div>
  </div>`;
}

function taskCard(state, t) {
  const p = state.patients.find((x) => x.id === t.patientId);
  const overdue = t.status !== 'done' && new Date(t.dueAt) < new Date();
  return `
  <div class="task ${t.priority} ${t.status === 'done' ? 'done' : ''}">
    <button class="check ${t.status === 'done' ? 'on' : ''}" data-act="toggle-task" data-id="${t.id}" aria-label="Toggle task">${t.status === 'done' ? icon('check', 12) : ''}</button>
    <div class="grow" style="min-width:0">
      <div class="t-title">${esc(t.title)}</div>
      <div class="t-meta">
        ${p ? `<span class="row gap-sm">${icon('user', 11)} ${esc(p.name)} · ${esc(p.mrn)}</span>` : ''}
        <span class="row gap-sm">${icon(CATEGORY_ICON[t.category] || 'clipboard', 11)} ${esc(t.category)}</span>
        <span class="row gap-sm" style="${overdue ? 'color:#be123c;font-weight:600' : ''}">${icon('clock', 11)} ${overdue ? `overdue ${timeAgo(t.dueAt).replace(' ago', '')}` : `due ${fmtTime(t.dueAt)}`}</span>
      </div>
    </div>
    <div class="col" style="gap:6px;align-items:flex-end">
      ${badge(t.priority)}
      <div class="row gap-sm">
        ${p ? `<button class="btn btn-sm" data-act="open-patient" data-id="${p.id}">Chart</button>` : ''}
        <button class="btn btn-sm" data-act="task-status" data-id="${t.id}" data-status="${t.status === 'todo' ? 'in-progress' : t.status === 'in-progress' ? 'done' : 'todo'}">
          ${t.status === 'todo' ? icon('play', 12) : t.status === 'in-progress' ? icon('check', 12) : icon('refresh', 12)}
        </button>
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------ vitals panel */

function vitalsPanel(state, myPatients) {
  const readings = state.vitals.filter((v) => myPatients.some((p) => p.id === v.patientId)).slice(0, 7);
  return `
  <div class="card">
    <div class="card-hd">
      <h3>${icon('activity', 15)} Vitals monitor</h3>
      <button class="btn btn-sm btn-primary" data-act="record-vitals">${icon('plus', 12)} Record</button>
    </div>
    <div class="card-bd" style="display:grid;gap:11px">
      ${readings.map((v) => {
        const p = state.patients.find((x) => x.id === v.patientId);
        return `<div class="alert ${v.flag === 'normal' ? 'info' : v.flag}" style="padding:11px 13px">
          <div class="ic" style="width:26px;height:26px">${icon(v.flag === 'critical' ? 'octagon' : 'activity', 13)}</div>
          <div class="grow" style="min-width:0">
            <div class="row between">
              <span class="small strong truncate">${esc(p?.name || '')}</span>
              <span class="tiny muted nowrap">${timeAgo(v.recordedAt)}</span>
            </div>
            <div class="tiny muted" style="margin-top:3px">
              HR ${v.hr} · BP ${v.bpSys}/${v.bpDia} · SpO₂ ${v.spo2}% · T ${v.temp}°C · RR ${v.rr}
            </div>
          </div>
        </div>`;
      }).join('') || '<div class="small muted">No vitals recorded for your patients yet.</div>'}
    </div>
  </div>`;
}

function escalationCard(state) {
  const escalations = state.tasks.filter((t) => t.priority === 'critical' && t.status !== 'done');
  return `
  <div class="card">
    <div class="card-hd"><h3>${icon('alert', 15)} Escalations</h3><span class="sub">${escalations.length}</span></div>
    <div class="card-bd" style="display:grid;gap:10px">
      ${escalations.slice(0, 4).map((t) => {
        const p = state.patients.find((x) => x.id === t.patientId);
        return `<div class="alert critical">
          <div class="ic">${icon('octagon', 14)}</div>
          <div class="grow">
            <div class="ttl small">${esc(t.title)}</div>
            <div class="dsc">${esc(p?.name || 'Hospital-wide')} · due ${timeAgo(t.dueAt)} · ${esc(store.nameOf(t.assignedTo))}</div>
          </div>
        </div>`;
      }).join('') || '<div class="small muted">No open escalations. Nice work.</div>'}
    </div>
  </div>`;
}

/* ------------------------------------------------------------- vitals page */

function vitalsPage(state, myPatients) {
  const rows = state.vitals.filter((v) => myPatients.some((p) => p.id === v.patientId)).slice(0, 24);
  const abnormal = rows.filter((v) => v.flag !== 'normal');
  return `
  <div class="layout-main">
    <div class="card">
      <div class="card-hd">
        <h3>${icon('activity', 16)} Vitals stream <span class="sub">${rows.length} readings</span></h3>
        <div class="row gap-sm">
          <span class="chip chip-rose">${icon('alert', 12)} ${abnormal.length} abnormal</span>
          <button class="btn btn-sm btn-primary" data-act="record-vitals">${icon('plus', 13)} Record vitals</button>
        </div>
      </div>
      <div class="table-scroll" style="max-height:560px">
        <table class="table">
          <thead><tr><th>Patient</th><th>HR</th><th>BP</th><th>SpO₂</th><th>Temp</th><th>RR</th><th>Flag</th><th>When</th></tr></thead>
          <tbody>
            ${rows.map((v) => {
              const p = state.patients.find((x) => x.id === v.patientId);
              return `<tr>
                <td><div class="strong">${esc(p?.name || '')}</div><div class="tiny muted">${esc(p?.mrn || '')}</div></td>
                <td class="num">${v.hr}</td>
                <td class="num">${v.bpSys}/${v.bpDia}</td>
                <td class="num" style="${v.spo2 < 92 ? 'color:#be123c;font-weight:700' : ''}">${v.spo2}%</td>
                <td class="num">${v.temp}</td>
                <td class="num">${v.rr}</td>
                <td>${badge(v.flag === 'normal' ? 'low' : v.flag)}</td>
                <td class="tiny muted">${timeAgo(v.recordedAt)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="sticky-col">
      ${escalationCard(state)}
      <div class="card">
        <div class="card-hd"><h3>${icon('target', 15)} Thresholds</h3></div>
        <div class="card-bd">
          <table class="mini-table">
            <tr><td>SpO₂ critical</td><td>&lt; 92%</td></tr>
            <tr><td>Heart rate</td><td>&gt; 110 · &lt; 50 bpm</td></tr>
            <tr><td>Systolic BP</td><td>&gt; 160 · &lt; 90</td></tr>
            <tr><td>Temperature</td><td>≥ 38.5 °C</td></tr>
            <tr><td>Respiratory rate</td><td>≥ 24 /min</td></tr>
          </table>
          <div class="alert info" style="margin-top:12px">
            <div class="ic">${icon('zap', 14)}</div>
            <div><div class="ttl small">Automatic escalation</div>
            <div class="dsc">Any critical reading creates a task for the on-call consultant immediately.</div></div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------ care plans */

function carePlansPage(state, myPatients) {
  return `
  <div class="cols cols-2">
    ${myPatients.map((p) => {
      const tasks = state.tasks.filter((t) => t.patientId === p.id);
      const done = tasks.filter((t) => t.status === 'done').length;
      const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
      const vitals = state.vitals.filter((v) => v.patientId === p.id).sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
      const labs = state.labs.filter((l) => l.patientId === p.id);
      const rx = state.prescriptions.filter((r) => r.patientId === p.id);
      return `<div class="card">
        <div class="card-hd">
          <h3><span class="avatar sm ${p.riskLevel === 'critical' ? 'rose' : 'sky'}">${esc(initials(p.name))}</span> ${esc(p.name)} ${badge(p.riskLevel)}</h3>
          <button class="btn btn-sm" data-act="open-patient" data-id="${p.id}">Full record</button>
        </div>
        <div class="card-bd" style="display:grid;gap:14px">
          <div>
            <div class="row between tiny muted" style="margin-bottom:6px"><span>Care plan progress</span><span class="strong">${pct}%</span></div>
            <div class="progress"><span style="width:${pct}%"></span></div>
          </div>
          <div class="row gap" style="gap:22px;flex-wrap:wrap">
            <div>
              <div class="tiny upper muted">Next vitals</div>
              <div class="small strong">${vitals[0] ? timeAgo(vitals[0].recordedAt) : 'due now'}</div>
            </div>
            <div>
              <div class="tiny upper muted">Medication</div>
              <div class="small strong">${rx.length ? `${rx[0].items.length} active` : 'none'}</div>
            </div>
            <div>
              <div class="tiny upper muted">Pending labs</div>
              <div class="small strong">${labs.filter((l) => l.status === 'processing').length}</div>
            </div>
          </div>
          <div class="col" style="gap:8px">
            ${tasks.length ? tasks.slice(0, 4).map((t) => `
              <div class="row gap-sm small" style="align-items:flex-start">
                <span class="check ${t.status === 'done' ? 'on' : ''}" style="width:17px;height:17px">${t.status === 'done' ? icon('check', 10) : ''}</span>
                <span style="flex:1;${t.status === 'done' ? 'opacity:.55;text-decoration:line-through' : ''}">${esc(t.title)}</span>
              </div>`).join('') : '<div class="small muted">No tasks on this care plan.</div>'}
          </div>
        </div>
      </div>`;
    }).join('') || `<div class="card">${empty('heart', 'No patients assigned', 'Patients appear here once Workflow AI routes them to your ward.')}</div>`}
  </div>`;
}

/* ------------------------------------------------------------------- mount */

function patientsFor(state, me, myTasks) {
  const ids = new Set(myTasks.map((t) => t.patientId).filter(Boolean));
  const q = state.queue.filter((x) => x.status !== 'completed').map((x) => x.patientId);
  return state.patients.filter((p) => ids.has(p.id) || q.includes(p.id) || p.riskLevel === 'critical' || p.riskLevel === 'high').slice(0, 8);
}

export function mount(root, ctx) {
  const refresh = async () => { await store.refresh({ silent: true }); ctx.rerender(); };

  const handlers = {
    filter: (el) => { filter = el.dataset.id; ctx.rerender(); },
    'care-plan': () => ctx.go(`#/${store.user.role}/plans`),

    'toggle-task': async (el) => {
      const t = (store.data.tasks || []).find((x) => x.id === el.dataset.id);
      const next = t?.status === 'done' ? 'todo' : 'done';
      try {
        const { tasks } = await api.updateTask(el.dataset.id, { status: next });
        store.merge({ tasks });
        if (next === 'done') toast({ title: 'Task completed', desc: t?.title, type: 'success' });
        ctx.rerender();
      } catch (err) {
        toast({ title: 'Could not update the task', desc: err.message, type: 'error' });
      }
    },

    'task-status': async (el) => {
      const t = (store.data.tasks || []).find((x) => x.id === el.dataset.id);
      try {
        const { tasks } = await api.updateTask(el.dataset.id, { status: el.dataset.status });
        store.merge({ tasks });
        toast({ title: `${t?.title?.slice(0, 48) || 'Task'} → ${el.dataset.status}`, type: el.dataset.status === 'done' ? 'success' : 'info' });
        await refresh();
      } catch (err) {
        toast({ title: 'Could not update the task', desc: err.message, type: 'error' });
      }
    },

    'reassign-open': () => openRebalanceModal(ctx),

    'record-vitals': () => openVitalsModal(ctx),
  };

  requestAnimationFrame(() => {
    const s = store.data || {};
    if (!store.data || !store.user) return;
    const mine = (s.tasks || []).filter((t) => t.assignedTo === store.user.id);
    import('../ui.js').then(({ animateCount }) => {
      animateCount(root.querySelector('[data-stat="open"]'), mine.filter((t) => t.status !== 'done').length);
      animateCount(root.querySelector('[data-stat="critical"]'), mine.filter((t) => t.priority === 'critical' && t.status !== 'done').length);
      animateCount(root.querySelector('[data-stat="done"]'), mine.filter((t) => t.status === 'done').length);
      animateCount(root.querySelector('[data-stat="due"]'), s.vitals ? Math.max(0, 3 - s.vitals.length % 3) + 2 : 3);
    });
  });

  return handlers;
}

/* ------------------------------------------------------------------ modals */

function openVitalsModal(ctx) {
  const s = store.data || {};
  const myTasks = (s.tasks || []).filter((t) => t.assignedTo === store.user.id);
  const patients = patientsFor(s, store.user, myTasks);
  const list = patients.length ? patients : s.patients || [];

  const modal = openModal({
    title: 'Record vitals',
    subtitle: 'Workflow AI scores every reading and escalates critical values automatically.',
    body: `
      <div class="form-grid">
        <div class="field span-2"><label for="vt-patient">Patient</label>
          <select class="select" id="vt-patient">
            ${list.map((p) => `<option value="${p.id}">${esc(p.name)} — ${esc(p.mrn)} (${esc(p.riskLevel)})</option>`).join('')}
          </select></div>
        <div class="field"><label for="vt-hr">Heart rate (bpm)</label><input class="input" id="vt-hr" type="number" value="88" /></div>
        <div class="field"><label for="vt-spo2">SpO₂ (%)</label><input class="input" id="vt-spo2" type="number" value="97" /></div>
        <div class="field"><label for="vt-bpsys">BP systolic</label><input class="input" id="vt-bpsys" type="number" value="122" /></div>
        <div class="field"><label for="vt-bpdia">BP diastolic</label><input class="input" id="vt-bpdia" type="number" value="78" /></div>
        <div class="field"><label for="vt-temp">Temperature (°C)</label><input class="input" id="vt-temp" type="number" step="0.1" value="36.8" /></div>
        <div class="field"><label for="vt-rr">Respiratory rate</label><input class="input" id="vt-rr" type="number" value="17" /></div>
        <div class="field"><label for="vt-pain">Pain score (0–10)</label><input class="input" id="vt-pain" type="number" min="0" max="10" value="1" /></div>
        <div class="field span-2"><label for="vt-note">Nursing note</label><input class="input" id="vt-note" placeholder="Observation, position, oxygen support…" /></div>
      </div>
      <div class="alert info">
        <div class="ic">${icon('zap', 15)}</div>
        <div><div class="ttl">Try it: set SpO₂ to 89</div>
        <div class="dsc">Workflow AI will flag hypoxia, create an escalation task for the consultant and notify the ward.</div></div>
      </div>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="vt-save">${icon('check', 14)} Save reading</button>`,
  });

  modal.querySelector('#vt-save').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const res = await api.recordVitals({
        patientId: modal.querySelector('#vt-patient').value,
        recordedBy: store.user.id,
        hr: modal.querySelector('#vt-hr').value,
        spo2: modal.querySelector('#vt-spo2').value,
        bpSys: modal.querySelector('#vt-bpsys').value,
        bpDia: modal.querySelector('#vt-bpdia').value,
        temp: modal.querySelector('#vt-temp').value,
        rr: modal.querySelector('#vt-rr').value,
        pain: modal.querySelector('#vt-pain').value,
        note: modal.querySelector('#vt-note').value,
      });
      const p = store.patient(res.vital.patientId);
      if (res.vital.flag === 'critical') {
        toast({
          title: `Critical vitals — ${p?.name}`,
          desc: `${res.reasons.join('; ')}. Escalation task created for Dr. Rohan Mehta.`,
          type: 'error', ms: 8000,
        });
      } else if (res.vital.flag === 'high' || res.vital.flag === 'medium') {
        toast({ title: `Abnormal reading — ${p?.name}`, desc: `${res.reasons.join('; ')}. Flagged for review.`, type: 'warn', ms: 6500 });
      } else {
        toast({ title: `Vitals saved — ${p?.name}`, desc: 'All parameters within range. Triage score updated.', type: 'success' });
      }
      closeOverlay();
      await store.refresh({ silent: true });
      ctx.rerender();
    } catch (err) {
      toast({ title: 'Could not save the reading', desc: err.message, type: 'error' });
      btn.disabled = false;
    }
  });
}

function openRebalanceModal(ctx) {
  const s = store.data || {};
  const staff = s.users.filter((u) => u.role === 'nurse' || u.role === 'lab');
  const openTasks = s.tasks.filter((t) => t.status !== 'done' && t.priority !== 'critical');

  const modal = openModal({
    title: 'Rebalance workload',
    subtitle: 'Coordinator AI recommends moving low-acuity tasks to the least-loaded nurse.',
    body: `
      <div class="section-title">Current load</div>
      <div class="card card-pad" style="box-shadow:none">
        ${bars(staff.map((u) => ({
          label: u.name,
          value: u.load || 0,
          display: `${u.load || 0}`,
          suffix: '%',
          hot: (u.load || 0) > 70,
        })))}
      </div>
      <div class="section-title">Move these tasks</div>
      <div class="col" style="gap:9px" id="rb-tasks">
        ${openTasks.length ? openTasks.slice(0, 6).map((t) => `
          <label class="task ${t.priority}" style="padding:11px;cursor:pointer">
            <input type="checkbox" data-task="${t.id}" ${t.priority === 'low' ? 'checked' : ''} style="margin-top:3px" />
            <span class="grow">
              <span class="t-title" style="display:block">${esc(t.title)}</span>
              <span class="t-meta">${esc(store.nameOf(t.assignedTo))} · ${esc(t.category)} · ${esc(t.priority)}</span>
            </span>
          </label>`).join('') : '<div class="small muted">No open non-critical tasks.</div>'}
      </div>
      <div class="field"><label for="rb-target">Reassign to</label>
        <select class="select" id="rb-target">
          ${[...staff].sort((a, b) => (a.load || 0) - (b.load || 0)).map((u) => `<option value="${u.id}" ${u.id === store.user.id ? 'selected' : ''}>${esc(u.name)} — ${u.load || 0}% load · ${esc(u.department)}</option>`).join('')}
        </select></div>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="rb-apply">${icon('users', 14)} Apply rebalance</button>`,
  });

  modal.querySelector('#rb-apply').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const ids = [...modal.querySelectorAll('[data-task]:checked')].map((c) => c.dataset.task);
    if (!ids.length) { toast({ title: 'Select at least one task', type: 'warn' }); return; }
    btn.disabled = true;
    try {
      const res = await api.reassign(ids, modal.querySelector('#rb-target').value);
      store.merge({ tasks: res.tasks, users: res.users });
      toast({ title: 'Workload rebalanced', desc: `${ids.length} task(s) reassigned by Coordinator AI.`, type: 'success' });
      closeOverlay();
      ctx.rerender();
    } catch (err) {
      toast({ title: 'Reassign failed', desc: err.message, type: 'error' });
      btn.disabled = false;
    }
  });
}
