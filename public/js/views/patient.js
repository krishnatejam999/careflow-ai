/** Patient record drawer — shared by every role. */
import { api } from '../api.js';
import { store } from '../store.js';
import {
  icon, esc, badge, timeAgo, fmtDate, fmtTime, openDrawer, openModal, closeOverlay, toast, skeleton,
} from '../ui.js';
import { sparkline } from '../charts.js';

const flagTone = { critical: 'critical', high: 'high', medium: 'medium', normal: 'low' };
const bg = (p) => (p.riskLevel === 'critical' ? 'rose' : p.riskLevel === 'high' ? 'amber' : 'sky');

export async function openPatientDrawer(id) {
  const drawer = openDrawer({ title: 'Loading record…', body: skeleton(6) });
  try {
    const d = await api.patient(id);
    paint(drawer, d);
  } catch (err) {
    toast({ title: 'Could not load the record', desc: err.message, type: 'error' });
  }
}

function paint(drawer, d) {
  const { patient: p, summary, labs, vitals, prescriptions, notes, tasks } = d;
  const hrTrend = vitals.slice(0, 8).reverse().map((v) => v.hr);
  const v = summary.history.lastVitals;

  drawer.innerHTML = `
    <header class="drawer-hd">
      <div class="row gap" style="min-width:0">
        <span class="avatar lg ${bg(p)}">${esc(p.name.split(' ').map((w) => w[0]).slice(0, 2).join(''))}</span>
        <div style="min-width:0">
          <h3 class="truncate">${esc(p.name)}</h3>
          <div class="small muted">${esc(p.mrn)} · ${p.age}${p.gender === 'Female' ? 'F' : 'M'} · ${esc(p.bloodGroup)} · ${esc(p.phone)}</div>
          <div class="row gap-sm" style="margin-top:7px">
            ${badge(p.riskLevel)}
            <span class="badge badge-neutral">${esc(p.insurance?.scheme || 'Self pay')}</span>
          </div>
        </div>
      </div>
      <button class="btn btn-ghost btn-icon" data-close aria-label="Close">${icon('x', 16)}</button>
    </header>

    <div class="drawer-bd">
      <div class="card card-pad" style="box-shadow:none;background:#f8fbfd;border-color:var(--line)">
        <div class="row between">
          <div class="section-title" style="margin:0">${icon('sparkles', 13)} Records AI summary</div>
          <span class="badge badge-info"><span class="dot"></span>${summary.riskFlags.length} flag${summary.riskFlags.length === 1 ? '' : 's'}</span>
        </div>
        <p class="small" style="margin-top:10px;font-weight:600">${esc(summary.headline)}</p>
        <div class="col" style="gap:7px;margin-top:12px">
          ${summary.bullets.map((b) => `<div class="reason"><span class="b" style="background:var(--sky-500)"></span><span>${esc(b)}</span></div>`).join('')}
        </div>
        ${summary.riskFlags.length ? `
          <div class="section-title" style="margin:18px 0 10px">Risk flags</div>
          <div class="col" style="gap:8px">
            ${summary.riskFlags.map((f) => `<div class="row gap-sm" style="align-items:flex-start">
              <span class="badge badge-${flagTone[f.level] || 'neutral'}"><span class="dot"></span>${esc(f.level)}</span>
              <span class="small" style="flex:1">${esc(f.text)}</span>
            </div>`).join('')}
          </div>` : ''}
        <div class="section-title" style="margin:18px 0 10px">Suggested focus</div>
        <div class="col" style="gap:7px">
          ${summary.suggestedFocus.map((s) => `<div class="reason"><span class="b"></span><span>${esc(s)}</span></div>`).join('')}
        </div>
      </div>

      <div class="layout-2" style="gap:14px">
        <div class="card card-pad" style="box-shadow:none">
          <div class="section-title" style="margin-bottom:10px">Latest vitals</div>
          ${v ? `
            <table class="mini-table">
              <tr><td>Heart rate</td><td>${v.hr} bpm</td></tr>
              <tr><td>Blood pressure</td><td>${v.bpSys}/${v.bpDia} mmHg</td></tr>
              <tr><td>SpO₂</td><td>${v.spo2}%</td></tr>
              <tr><td>Temperature</td><td>${v.temp}°C</td></tr>
              <tr><td>Recorded</td><td>${timeAgo(v.recordedAt)}</td></tr>
            </table>
            <div class="row between" style="margin-top:12px">
              ${sparkline(hrTrend, { w: 148, h: 34, color: '#e11d48' })}
              <span class="tiny muted row gap-sm">${icon('activity', 12)} HR trend</span>
            </div>`
            : '<div class="small muted">No vitals recorded yet.</div>'}
        </div>
        <div class="card card-pad" style="box-shadow:none">
          <div class="section-title" style="margin-bottom:10px">Coverage & identity</div>
          <table class="mini-table">
            <tr><td>Blood group</td><td>${esc(p.bloodGroup)}</td></tr>
            <tr><td>Insurer</td><td>${esc(p.insurance?.provider || '—')}</td></tr>
            <tr><td>Policy</td><td class="mono">${esc(p.insurance?.policyNo || '—')}</td></tr>
            <tr><td>Scheme</td><td>${esc(p.insurance?.scheme || '—')}</td></tr>
            <tr><td>Last visit</td><td>${p.lastVisit ? esc(fmtDate(p.lastVisit, { day: '2-digit', month: 'short', year: 'numeric' })) : 'First visit'}</td></tr>
          </table>
        </div>
      </div>

      <div class="card" style="box-shadow:none">
        <div class="card-hd"><h3>${icon('flask', 15)} Lab results</h3><span class="sub">${labs.length} record${labs.length === 1 ? '' : 's'}</span></div>
        <div class="table-scroll" style="max-height:230px">
          <table class="table">
            <thead><tr><th>Test</th><th>Result</th><th>Reference</th><th>Flag</th></tr></thead>
            <tbody>
              ${labs.length ? labs.map((l) => `<tr>
                <td>${esc(l.test)}</td>
                <td class="num">${esc(l.result)} <span class="tiny muted">${esc(l.unit)}</span></td>
                <td class="tiny muted">${esc(l.range)}</td>
                <td>${badge(l.flag === 'normal' ? 'low' : l.flag)}</td>
              </tr>`).join('') : `<tr><td colspan="4" class="muted small" style="padding:18px 20px">No lab orders for this patient.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="box-shadow:none">
        <div class="card-hd"><h3>${icon('pill', 15)} Active prescriptions</h3></div>
        <div class="card-bd" style="display:grid;gap:14px">
          ${prescriptions.length ? prescriptions.map((rx) => `
            <div>
              <div class="row between tiny muted" style="margin-bottom:8px">
                <span>${fmtDate(rx.createdAt, { day: '2-digit', month: 'short' })} · ${esc(store.nameOf(rx.doctorId))}</span>
                <span class="badge badge-low"><span class="dot"></span>${esc(rx.status)}</span>
              </div>
              ${rx.items.map((i) => `<div class="row between small" style="padding:6px 0;border-bottom:1px solid var(--line-2);gap:14px">
                <span class="strong">${esc(i.drug)}</span><span class="muted right">${esc(i.dose)} · ${esc(i.freq)}${i.duration ? ` · ${esc(i.duration)}` : ''}</span>
              </div>`).join('')}
            </div>`).join('') : '<div class="small muted">No active prescriptions.</div>'}
        </div>
      </div>

      ${notes.length ? `
      <div class="card" style="box-shadow:none">
        <div class="card-hd"><h3>${icon('clipboard', 15)} Consultation notes</h3>${notes[0].aiGenerated ? '<span class="badge badge-violet"><span class="dot"></span>AI drafted</span>' : ''}</div>
        <div class="card-bd" style="display:grid;gap:16px">
          ${notes.map((n) => `
            <div>
              <div class="tiny muted" style="margin-bottom:9px">${fmtDate(n.createdAt, { day: '2-digit', month: 'short' })} · ${fmtTime(n.createdAt)} · ${esc(store.nameOf(n.doctorId))}</div>
              <div class="kv" style="grid-template-columns:86px minmax(0,1fr);gap:8px 12px">
                <div class="k">Complaint</div><div class="v" style="font-weight:500">${esc(n.chiefComplaint)}</div>
                <div class="k">Subjective</div><div class="v" style="font-weight:500">${esc(n.subjective)}</div>
                <div class="k">Objective</div><div class="v" style="font-weight:500">${esc(n.objective)}</div>
                <div class="k">Assessment</div><div class="v" style="font-weight:500">${esc(n.assessment)}</div>
                <div class="k">Plan</div><div class="v" style="font-weight:500">${esc(n.plan)}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="card" style="box-shadow:none">
        <div class="card-hd"><h3>${icon('clipboard', 15)} Open tasks</h3><span class="sub">from Workflow AI</span></div>
        <div class="card-bd" style="display:grid;gap:9px">
          ${tasks.filter((t) => t.status !== 'done').length
            ? tasks.filter((t) => t.status !== 'done').map((t) => `
              <div class="task ${t.priority}" style="padding:11px">
                <div class="grow">
                  <div class="t-title">${esc(t.title)}</div>
                  <div class="t-meta">${esc(store.nameOf(t.assignedTo))} · due ${timeAgo(t.dueAt)} · ${esc(t.category)}</div>
                </div>
                ${badge(t.priority)}
              </div>`).join('')
            : '<div class="small muted">No open tasks.</div>'}
        </div>
      </div>
    </div>

    <footer class="modal-ft" style="border-radius:0">
      <button class="btn" data-close>Close</button>
      <button class="btn btn-primary" id="patient-notify">${icon('send', 14)} Notify patient</button>
    </footer>`;

  drawer.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeOverlay));
  drawer.querySelector('#patient-notify').addEventListener('click', () => messageComposer(p));
}

function messageComposer(p) {
  const modal = openModal({
    title: `Message ${p.name}`,
    subtitle: `Comm. AI delivers over WhatsApp to ${p.phone}`,
    body: `
      <div class="field"><label for="msg-template">Template</label>
        <select class="select" id="msg-template">
          <option>Care plan update</option>
          <option>Appointment reminder</option>
          <option>Lab report ready</option>
          <option>Discharge follow-up</option>
        </select>
      </div>
      <div class="field"><label for="msg-body">Message</label>
        <textarea class="textarea" id="msg-body">Your care plan has been updated by the nursing team. Please continue prescribed medication and book a review in 7 days.</textarea>
      </div>
      <div class="alert info">
        <div class="ic">${icon('zap', 15)}</div>
        <div><div class="ttl">Comm. AI logs every message</div>
        <div class="dsc">Delivery status and the message body are attached to the patient record for audit.</div></div>
      </div>`,
    footer: `<button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="msg-send">${icon('send', 14)} Send now</button>`,
  });

  modal.querySelector('#msg-send').addEventListener('click', async () => {
    const btn = modal.querySelector('#msg-send');
    btn.disabled = true;
    try {
      await api.sendNotification({
        patientId: p.id,
        body: modal.querySelector('#msg-body').value,
        template: modal.querySelector('#msg-template').value,
        channel: 'WhatsApp',
      });
      toast({ title: 'Message sent', desc: `Comm. AI delivered to ${p.name}.`, type: 'success' });
      await store.refresh({ silent: true });
      closeOverlay();
    } catch (err) {
      toast({ title: 'Send failed', desc: err.message, type: 'error' });
      btn.disabled = false;
    }
  });
}
