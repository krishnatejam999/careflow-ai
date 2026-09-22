/** Admin dashboard — staff, occupancy, revenue, analytics and agent log. */
import { api } from '../api.js';
import { store } from '../store.js';
import {
  icon, esc, badge, avatar, timeAgo, fmtTime, fmtDate, minsSince, toast, openModal, closeOverlay, empty, initials,
} from '../ui.js';
import { areaChart, donut, bars, sparkline, ring } from '../charts.js';

const ROLE_TONE = { doctor: 'sky', nurse: 'violet', admin: 'ink', lab: 'amber', pharmacy: 'amber', reception: '' };
const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

/* --------------------------------------------------------------------- html */

export function html(state, route) {
  const live = state.queue.filter((q) => q.status !== 'completed');
  const avgWait = live.length ? Math.round(live.reduce((a, q) => a + (q.waitMinutes || 0), 0) / live.length) : 0;
  const bedsTotal = state.beds.reduce((a, b) => a + b.total, 0);
  const bedsUsed = state.beds.reduce((a, b) => a + b.occupied, 0);
  const occ = Math.round((bedsUsed / bedsTotal) * 100);
  const rev = state.revenue[state.revenue.length - 1];
  const revTotal = (rev.opd + rev.ipd + rev.pharmacy + rev.insurance);
  const openTasks = state.tasks.filter((t) => t.status !== 'done').length;
  const insights = state.insights || [];

  return `
  <div class="page-head">
    <div>
      <h2>Hospital operations command</h2>
      <p>Coordinator AI watches throughput, occupancy, staffing and revenue — and recommends the next operational move.</p>
    </div>
    <div class="actions">
      <button class="btn" data-act="run-agents">${icon('cpu', 14)} Run agents</button>
      <button class="btn btn-primary" data-act="export">${icon('download', 14)} Export snapshot</button>
    </div>
  </div>

  <div class="cols cols-4" style="margin-bottom:18px">
    <div class="stat ${avgWait > 40 ? 'warn' : ''}">
      <div class="label">Average wait</div>
      <div class="value"><span data-stat="wait">0</span><span class="unit">min</span></div>
      <div class="delta ${avgWait > 35 ? 'down' : 'up'}">${icon(avgWait > 35 ? 'arrowUp' : 'arrowDown', 12)} target 35 min</div>
      <div class="spark">${sparkline(state.throughput.map((t) => t.waiting * 4), { w: 74, h: 26, color: '#f59e0b' })}</div>
    </div>
    <div class="stat ${occ > 85 ? 'rose' : ''}">
      <div class="label">Bed occupancy</div>
      <div class="value"><span data-stat="occ">0</span><span class="unit">%</span></div>
      <div class="delta ${occ > 85 ? 'down' : 'up'}">${icon('bed', 12)} ${bedsUsed}/${bedsTotal} beds</div>
      <div class="spark">${sparkline(state.beds.map((b) => Math.round((b.occupied / b.total) * 100)), { w: 74, h: 26, color: '#e11d48' })}</div>
    </div>
    <div class="stat violet">
      <div class="label">Revenue MTD</div>
      <div class="value"><span>₹</span><span data-stat="rev">0</span><span class="unit">lakh</span></div>
      <div class="delta up">${icon('trending', 12)} ${state.revenue.length > 1 ? `${(((revTotal / (state.revenue[state.revenue.length - 2].opd + state.revenue[state.revenue.length - 2].ipd + state.revenue[state.revenue.length - 2].pharmacy + state.revenue[state.revenue.length - 2].insurance)) - 1) * 100).toFixed(1)}% vs last month` : 'current month'}</div>
      <div class="spark">${sparkline(state.revenue.map((r) => r.opd + r.ipd + r.pharmacy + r.insurance), { w: 74, h: 26, color: '#8b5cf6' })}</div>
    </div>
    <div class="stat">
      <div class="label">Open tasks</div>
      <div class="value"><span data-stat="tasks">0</span><span class="unit">hospital-wide</span></div>
      <div class="delta ${state.tasks.filter((t) => t.priority === 'critical' && t.status !== 'done').length ? 'down' : 'up'}">
        ${icon('zap', 12)} ${state.tasks.filter((t) => t.priority === 'critical' && t.status !== 'done').length} critical
      </div>
      <div class="spark">${sparkline(state.throughput.map((t) => t.seen), { w: 74, h: 26, color: '#0ea5e9' })}</div>
    </div>
  </div>

  ${route.tab === 'staff' ? staffPage(state)
    : route.tab === 'analytics' ? analyticsPage(state)
    : route.tab === 'agents' ? agentsPage(state)
    : overviewPage(state, insights)}`;
}

/* ------------------------------------------------------------------ overview */

function overviewPage(state, insights) {
  const bedsTotal = state.beds.reduce((a, b) => a + b.total, 0);
  const bedsUsed = state.beds.reduce((a, b) => a + b.occupied, 0);
  const sev = { critical: 'critical', warning: 'high', info: 'info' };

  return `
  <div class="layout-main">
    <div class="col" style="gap:18px">
      <div class="card">
        <div class="card-hd">
          <h3>${icon('activity', 16)} Patient throughput <span class="sub">today, hourly</span></h3>
          <div class="row gap-sm">
            <span class="chip chip-teal">${icon('trending', 12)} peak 11:00</span>
            <span class="chip">${icon('users', 12)} ${state.throughput.reduce((a, t) => a + t.seen, 0)} seen</span>
          </div>
        </div>
        <div class="card-bd chart-wrap">
          ${areaChart(state.throughput.map((t) => t.seen), {
            labels: state.throughput.map((t) => t.hour.slice(0, 2)),
            w: 660, h: 200,
          })}
        </div>
        <div class="card-ft row between">
          <span class="tiny muted">Wait time overlay shows the queue backing up between 10:00 and 11:00.</span>
          <span class="chip chip-amber">${icon('alert', 12)} bottleneck detected</span>
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <h3>${icon('bed', 16)} Ward occupancy</h3>
          <span class="sub">${bedsUsed}/${bedsTotal} beds</span>
        </div>
        <div class="card-bd">
          ${bars(state.beds.map((b) => ({
            label: b.ward,
            value: Math.round((b.occupied / b.total) * 100),
            display: `${b.occupied}/${b.total}`,
            suffix: '',
            hot: b.occupied / b.total >= 0.8,
          })))}
          <div class="tiny muted" style="margin-top:12px">Bars turn red above 80% occupancy — Coordinator AI raises a surge alert at that point.</div>
        </div>
      </div>

      <div class="layout-2">
        <div class="card">
          <div class="card-hd"><h3>${icon('card', 15)} Revenue mix</h3><span class="sub">current month</span></div>
          <div class="card-bd">
            ${donut([
              { label: 'Insurance / schemes', value: state.revenue[state.revenue.length - 1].insurance, color: '#0d9488', display: `₹${state.revenue[state.revenue.length - 1].insurance}L` },
              { label: 'Inpatient (IPD)', value: state.revenue[state.revenue.length - 1].ipd, color: '#0ea5e9', display: `₹${state.revenue[state.revenue.length - 1].ipd}L` },
              { label: 'Outpatient (OPD)', value: state.revenue[state.revenue.length - 1].opd, color: '#8b5cf6', display: `₹${state.revenue[state.revenue.length - 1].opd}L` },
              { label: 'Pharmacy', value: state.revenue[state.revenue.length - 1].pharmacy, color: '#f59e0b', display: `₹${state.revenue[state.revenue.length - 1].pharmacy}L` },
            ], { center: `${(state.revenue[state.revenue.length - 1].opd + state.revenue[state.revenue.length - 1].ipd + state.revenue[state.revenue.length - 1].pharmacy + state.revenue[state.revenue.length - 1].insurance).toFixed(1)}L|MTD total` })}
          </div>
        </div>
        <div class="card">
          <div class="card-hd"><h3>${icon('flask', 15)} Pending settlements</h3><span class="sub">${state.payments.filter((p) => p.status !== 'settled').length} open</span></div>
          <div class="table-scroll" style="max-height:250px">
            <table class="table">
              <thead><tr><th>Patient</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                ${state.payments.map((p) => {
                  const pat = state.patients.find((x) => x.id === p.patientId);
                  return `<tr>
                    <td><div class="strong">${esc(pat?.name || '')}</div><div class="tiny muted">${esc(p.method)}</div></td>
                    <td class="num">₹${p.amount.toLocaleString('en-IN')}</td>
                    <td><span class="badge badge-${p.status === 'settled' ? 'low' : p.status === 'pending' ? 'medium' : 'info'}"><span class="dot"></span>${esc(p.status)}</span></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="sticky-col">
      <div class="card ai-panel">
        <div class="card-hd">
          <h3>${icon('cpu', 15)} Coordinator AI</h3>
          <span class="badge" style="background:rgba(20,184,166,.2);color:#5eead4;border-color:rgba(20,184,166,.3)"><span class="dot"></span>${insights.length} insights</span>
        </div>
        <div class="card-bd" style="display:grid;gap:14px">
          <div class="small" style="color:rgba(223,241,244,.78)">
            Recomputes every 15 seconds from live queue, ward, staffing and task data.
          </div>
          ${insights.map((i) => `
            <div class="card card-pad" style="box-shadow:none;background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1);padding:14px">
              <div class="row between" style="margin-bottom:6px">
                <span class="badge badge-${i.severity === 'critical' ? 'critical' : i.severity === 'warning' ? 'high' : 'info'}"><span class="dot"></span>${esc(i.severity)}</span>
                <span class="tiny" style="color:rgba(223,241,244,.5)">${esc(i.agent)}</span>
              </div>
              <div class="small strong" style="color:#fff">${esc(i.title)}</div>
              <div class="tiny" style="color:rgba(223,241,244,.72);margin-top:5px;line-height:1.55">${esc(i.detail)}</div>
              <div class="tiny" style="color:#5eead4;margin-top:8px;line-height:1.55">${icon('arrowRight', 11)} ${esc(i.action)}</div>
              <div class="row gap-sm" style="margin-top:11px">
                <button class="btn btn-sm btn-primary" data-act="apply-insight" data-id="${i.id}">${icon('zap', 12)} Apply</button>
                <button class="btn btn-sm btn-outline-light" data-act="dismiss-insight" data-id="${i.id}">Dismiss</button>
              </div>
            </div>`).join('') || '<div class="small" style="color:rgba(223,241,244,.6)">All operations within target ranges.</div>'}
        </div>
      </div>

      <div class="card">
        <div class="card-hd"><h3>${icon('alert', 15)} Live alerts</h3><span class="sub">${state.alerts.length}</span></div>
        <div class="card-bd" style="display:grid;gap:10px">
          ${state.alerts.slice(0, 5).map((a) => `
            <div class="alert ${a.severity}" style="padding:11px 13px">
              <div class="ic" style="width:26px;height:26px">${icon(a.severity === 'critical' ? 'octagon' : 'alert', 13)}</div>
              <div class="grow" style="min-width:0">
                <div class="ttl small truncate">${esc(a.title)}</div>
                <div class="dsc">${esc(a.detail)}</div>
              </div>
            </div>`).join('') || '<div class="small muted">No alerts.</div>'}
        </div>
      </div>
    </div>
  </div>`;
}

/* --------------------------------------------------------------------- staff */

function staffPage(state) {
  return `
  <div class="layout-main">
    <div class="card">
      <div class="card-hd">
        <h3>${icon('users', 16)} Hospital staff <span class="sub">${state.users.length} on the roster</span></h3>
        <div class="row gap-sm">
          <span class="chip chip-teal">${icon('check', 12)} ${state.users.filter((u) => u.status === 'on-shift').length} on shift</span>
          <span class="chip">${state.users.filter((u) => u.status === 'off-shift').length} off shift</span>
        </div>
      </div>
      <div class="table-scroll" style="max-height:640px">
        <table class="table">
          <thead><tr><th>Member</th><th>Role</th><th>Shift</th><th>Load</th><th>Open tasks</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${state.users.map((u) => {
              const openTasks = state.tasks.filter((t) => t.assignedTo === u.id && t.status !== 'done').length;
              return `<tr>
                <td>
                  <div class="row gap-sm">
                    <span class="avatar sm ${ROLE_TONE[u.role] || ''}">${esc(u.initials || initials(u.name))}</span>
                    <div><div class="strong">${esc(u.name)}</div><div class="tiny muted">${esc(u.department)}</div></div>
                  </div>
                </td>
                <td><span class="chip">${esc(u.title)}</span></td>
                <td class="small">${esc(u.shift)}</td>
                <td style="min-width:150px">
                  <div class="row gap-sm">
                    <span class="bar-track" style="flex:1"><span class="bar-fill" style="width:${u.load || 0}%;background:${(u.load || 0) > 75 ? 'var(--grad-warm)' : 'var(--grad-brand)'}"></span></span>
                    <span class="tiny strong nowrap">${u.load || 0}%</span>
                  </div>
                </td>
                <td class="num">${openTasks}</td>
                <td><span class="badge badge-${u.status === 'on-shift' ? 'low' : u.status === 'in-consult' ? 'info' : 'neutral'}"><span class="dot"></span>${esc(u.status)}</span></td>
                <td class="right">
                  <div class="row gap-sm" style="justify-content:flex-end">
                    <button class="btn btn-sm" data-act="toggle-staff" data-id="${u.id}">${icon('refresh', 12)} ${u.status === 'off-shift' ? 'On shift' : 'Off shift'}</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="sticky-col">
      <div class="card">
        <div class="card-hd"><h3>${icon('barChart', 15)} Workload spread</h3></div>
        <div class="card-bd">
          ${bars(state.users.map((u) => ({
            label: u.name,
            value: u.load || 0,
            display: `${u.load || 0}`,
            suffix: '%',
            hot: (u.load || 0) > 75,
          })))}
        </div>
        <div class="card-ft">
          <button class="btn btn-sm btn-primary btn-block" data-act="rebalance">${icon('users', 13)} Auto-rebalance with Coordinator AI</button>
        </div>
      </div>
      <div class="card">
        <div class="card-hd"><h3>${icon('shield', 15)} Compliance</h3></div>
        <div class="card-bd">
          <table class="mini-table">
            <tr><td>Hand hygiene audits</td><td>96%</td></tr>
            <tr><td>Consent capture</td><td>100%</td></tr>
            <tr><td>ABDM record sync</td><td>Healthy</td></tr>
            <tr><td>Pending credential renewals</td><td>2</td></tr>
          </table>
        </div>
      </div>
    </div>
  </div>`;
}

/* ----------------------------------------------------------------- analytics */

function analyticsPage(state) {
  const rev = state.revenue;
  const totals = rev.map((r) => r.opd + r.ipd + r.pharmacy + r.insurance);
  const latest = rev[rev.length - 1];
  const prev = rev[rev.length - 2];
  const growth = (((latest.opd + latest.ipd + latest.pharmacy + latest.insurance) / (prev.opd + prev.ipd + prev.pharmacy + prev.insurance)) - 1) * 100;

  return `
  <div class="cols cols-4" style="margin-bottom:18px">
    <div class="stat"><div class="label">OPD revenue</div><div class="value">₹<span>${latest.opd}</span><span class="unit">lakh</span></div><div class="delta up">${icon('arrowUp', 12)} outpatient consults</div></div>
    <div class="stat"><div class="label">IPD revenue</div><div class="value">₹<span>${latest.ipd}</span><span class="unit">lakh</span></div><div class="delta up">${icon('bed', 12)} inpatient stays</div></div>
    <div class="stat"><div class="label">Pharmacy</div><div class="value">₹<span>${latest.pharmacy}</span><span class="unit">lakh</span></div><div class="delta up">${icon('pill', 12)} +${(latest.pharmacy - prev.pharmacy).toFixed(1)}L MoM</div></div>
    <div class="stat violet"><div class="label">Month-on-month growth</div><div class="value"><span>${growth.toFixed(1)}</span><span class="unit">%</span></div><div class="delta up">${icon('trending', 12)} insurance-led</div></div>
  </div>

  <div class="layout-main">
    <div class="col" style="gap:18px">
      <div class="card">
        <div class="card-hd"><h3>${icon('barChart', 16)} Revenue trend <span class="sub">last 6 months, ₹ lakh</span></h3></div>
        <div class="card-bd chart-wrap">
          ${areaChart(totals, { labels: rev.map((r) => r.month), w: 660, h: 210, color: '#8b5cf6', color2: '#0d9488' })}
        </div>
      </div>
      <div class="card">
        <div class="card-hd"><h3>${icon('layers', 16)} Revenue by stream</h3></div>
        <div class="table-scroll">
          <table class="table">
            <thead><tr><th>Month</th><th>OPD</th><th>IPD</th><th>Pharmacy</th><th>Insurance</th><th>Total</th></tr></thead>
            <tbody>
              ${rev.map((r) => `<tr>
                <td class="strong">${esc(r.month)}</td>
                <td class="num">₹${r.opd}L</td>
                <td class="num">₹${r.ipd}L</td>
                <td class="num">₹${r.pharmacy}L</td>
                <td class="num">₹${r.insurance}L</td>
                <td class="num strong">₹${(r.opd + r.ipd + r.pharmacy + r.insurance).toFixed(1)}L</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="sticky-col">
      <div class="card">
        <div class="card-hd"><h3>${icon('target', 15)} Operational KPIs</h3></div>
        <div class="card-bd" style="display:grid;gap:16px">
          <div class="row gap-lg" style="align-items:center">
            ${ring(Math.max(0, 100 - Math.round(((state.queue.filter((q) => q.status !== 'completed').reduce((a, q) => a + q.waitMinutes, 0) / Math.max(1, state.queue.filter((q) => q.status !== 'completed').length)) / 90) * 100)), 'high', { size: 82, label: 'Flow' })}
            <div class="small muted">Composite flow score from wait times, queue depth and task completion. Above 70 is healthy.</div>
          </div>
          <table class="mini-table">
            <tr><td>AI check-ins</td><td>${state.queue.filter((q) => q.source === 'Reception AI').length}</td></tr>
            <tr><td>Manual registrations</td><td>${state.queue.filter((q) => q.source !== 'Reception AI').length}</td></tr>
            <tr><td>Tasks auto-created</td><td>${state.tasks.filter((t) => t.source === 'Workflow AI').length}</td></tr>
            <tr><td>Patient messages</td><td>${state.notifications.length}</td></tr>
            <tr><td>Documentation time saved</td><td>64%</td></tr>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-hd"><h3>${icon('wifi', 15)} Agent throughput</h3></div>
        <div class="card-bd">
          ${bars(state.agents.map((a) => ({
            label: a.name,
            value: state.activity.filter((x) => x.agent === a.name).length || 1,
            display: `${state.activity.filter((x) => x.agent === a.name).length}`,
            suffix: ' actions',
            color: a.accent,
          })), { hot: 999 })}
        </div>
      </div>
    </div>
  </div>`;
}

/* -------------------------------------------------------------------- agents */

function agentsPage(state) {
  const tone = { critical: 'critical', warning: 'high', info: 'info' };
  return `
  <div class="cols cols-3" style="margin-bottom:18px">
    ${state.agents.map((a) => {
      const actions = state.activity.filter((x) => x.agent === a.name);
      return `<div class="card card-pad" style="position:relative;overflow:hidden">
        <div class="glow" style="position:absolute;inset:-60% -60% auto auto;width:180px;height:180px;border-radius:50%;filter:blur(40px);opacity:.16;background:${a.accent}"></div>
        <div class="row between" style="position:relative">
          <div class="row gap">
            <span class="avatar" style="background:${a.accent}22;color:${a.accent}">${icon('cpu', 16)}</span>
            <div><div class="strong">${esc(a.name)}</div><div class="tiny muted">${esc(a.tag)}</div></div>
          </div>
          <span class="badge badge-low"><span class="dot"></span>active</span>
        </div>
        <div class="row between" style="margin-top:14px">
          <span class="tiny upper muted">actions today</span>
          <span class="strong">${actions.length}</span>
        </div>
        <div class="col" style="gap:8px;margin-top:12px">
          ${actions.slice(0, 2).map((x) => `<div class="tiny muted" style="line-height:1.5">${esc(x.message.slice(0, 96))}${x.message.length > 96 ? '…' : ''}</div>`).join('') || '<div class="tiny muted">No actions recorded yet.</div>'}
        </div>
      </div>`;
    }).join('')}
  </div>

  <div class="layout-main">
    <div class="card">
      <div class="card-hd">
        <h3>${icon('inbox', 16)} Agent activity stream</h3>
        <span class="sub">${state.activity.length} events</span>
      </div>
      <div class="feed">
        ${state.activity.map((a) => `
          <div class="feed-item ${a.level}">
            <div class="rail"><span class="node"></span></div>
            <div class="body">
              <div class="who">
                <span class="badge badge-brand">${esc(a.agent)}</span>
                ${a.level === 'critical' ? '<span class="badge badge-critical"><span class="dot"></span>critical</span>' : a.level === 'warning' ? '<span class="badge badge-medium"><span class="dot"></span>warning</span>' : ''}
              </div>
              <div class="msg">${esc(a.message)}</div>
              <div class="ts">${timeAgo(a.ts)}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <div class="sticky-col">
      <div class="card">
        <div class="card-hd"><h3>${icon('shield', 15)} Audit trail</h3><span class="sub">immutable</span></div>
        <div class="card-bd">
          <div class="timeline">
            ${state.audit.map((a) => `
              <div class="tl-item">
                <div class="small strong">${esc(a.action)}</div>
                <div class="tiny muted">${esc(a.actor)} · ${esc(a.entity)} · ${timeAgo(a.ts)}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-hd"><h3>${icon('cpu', 15)} Run agents now</h3></div>
        <div class="card-bd" style="display:grid;gap:10px">
          <div class="small muted">Force a full orchestration pass across all five agents and refresh every dashboard.</div>
          <button class="btn btn-primary btn-block" data-act="run-agents">${icon('refresh', 14)} Orchestrate</button>
          <button class="btn btn-block" data-act="reset">${icon('rotate', 14)} Reset demo data</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* -------------------------------------------------------------------- mount */

export function mount(root, ctx) {
  const refresh = async () => { await store.refresh({ silent: true }); ctx.rerender(); };

  const handlers = {
    'apply-insight': async (el) => {
      el.disabled = true;
      const map = { 'Cardiology': 'express-slots', 'ICU': 'stepdown', 'load': 'rebalance' };
      const insight = (store.data.insights || []).find((i) => i.id === el.dataset.id) || {};
      const action = map[Object.keys(map).find((k) => insight.title?.includes(k))] || 'rebalance';
      try {
        const res = await api.action(action);
        toast({ title: 'Recommendation applied', desc: res.message, type: 'success' });
        await refresh();
      } catch (err) {
        toast({ title: 'Action failed', desc: err.message, type: 'error' });
        el.disabled = false;
      }
    },

    'dismiss-insight': (el) => {
      const card = el.closest('.card');
      card.style.transition = 'opacity .3s, transform .3s';
      card.style.opacity = '0';
      card.style.transform = 'translateX(16px)';
      setTimeout(() => { card.style.display = 'none'; }, 300);
    },

    rebalance: async (el) => {
      el.disabled = true;
      try {
        const res = await api.action('rebalance');
        toast({ title: 'Workload rebalanced', desc: res.message, type: 'success' });
        await refresh();
      } catch (err) {
        toast({ title: 'Rebalance failed', desc: err.message, type: 'error' });
        el.disabled = false;
      }
    },

    'toggle-staff': async (el) => {
      const u = store.userById(el.dataset.id);
      el.disabled = true;
      try {
        const next = u.status === 'off-shift' ? 'on-shift' : 'off-shift';
        const res = await api.updateStaff(el.dataset.id, { status: next });
        store.merge({ users: res.users });
        toast({ title: `${u.name} → ${next}`, desc: 'Roster updated and the shift board refreshed.', type: 'info' });
        ctx.rerender();
      } catch (err) {
        toast({ title: 'Update failed', desc: err.message, type: 'error' });
        el.disabled = false;
      }
    },

    'run-agents': async (el) => {
      el.disabled = true;
      const original = el.innerHTML;
      el.innerHTML = '<span class="skeleton" style="width:14px;height:14px;border-radius:50%"></span> Orchestrating…';
      try {
        await api.action('rebalance');
        const { insights } = await api.insights();
        await store.refresh({ silent: true });
        toast({
          title: 'Orchestration complete',
          desc: `5 agents swept the hospital — ${insights.length} live insight${insights.length === 1 ? '' : 's'} on the board.`,
          type: 'success',
          ms: 6000,
        });
        ctx.rerender();
      } catch (err) {
        toast({ title: 'Orchestration failed', desc: err.message, type: 'error' });
        el.disabled = false;
        el.innerHTML = original;
      }
    },

    export: () => {
      const s = store.data || {};
      const rows = [
        ['CareFlow AI snapshot', new Date().toISOString()],
        [],
        ['Patients', s.patients.length],
        ['Live queue', s.queue.filter((q) => q.status !== 'completed').length],
        ['Open tasks', s.tasks.filter((t) => t.status !== 'done').length],
        ['Bed occupancy', `${s.beds.reduce((a, b) => a + b.occupied, 0)}/${s.beds.reduce((a, b) => a + b.total, 0)}`],
        [],
        ['Name', 'MRN', 'Age', 'Risk', 'Complaint'],
        ...s.patients.map((p) => [p.name, p.mrn, p.age, p.riskLevel, (p.symptoms || []).join('; ')]),
      ];
      const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `careflow-snapshot-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: 'Snapshot exported', desc: 'careflow-snapshot.csv downloaded.', type: 'success' });
    },

    reset: () => {
      const modal = openModal({
        title: 'Reset demo data?',
        subtitle: 'Every change you made will be replaced by the seeded hospital state.',
        body: `<div class="alert medium"><div class="ic">${icon('alert', 15)}</div>
          <div><div class="ttl">This cannot be undone</div>
          <div class="dsc">Patients you registered, notes you signed and tasks you closed will be cleared.</div></div></div>`,
        footer: `<button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-danger" id="reset-go">${icon('refresh', 14)} Reset everything</button>`,
      });
      modal.querySelector('#reset-go').addEventListener('click', async () => {
        try {
          await api.reset();
          closeOverlay();
          toast({ title: 'Demo data reset', desc: 'The hospital is back to its seeded state.', type: 'info' });
          await refresh();
        } catch (err) {
          toast({ title: 'Reset failed', desc: err.message, type: 'error' });
        }
      });
    },
  };

  requestAnimationFrame(() => {
    const s = store.data || {};
    if (!store.data || !s.queue || !s.beds || !s.revenue) return;
    const live = s.queue.filter((q) => q.status !== 'completed');
    const avg = live.length ? Math.round(live.reduce((a, q) => a + q.waitMinutes, 0) / live.length) : 0;
    const bedsUsed = s.beds.reduce((a, b) => a + b.occupied, 0);
    const bedsTotal = s.beds.reduce((a, b) => a + b.total, 0);
    const r = s.revenue[s.revenue.length - 1];
    import('../ui.js').then(({ animateCount }) => {
      animateCount(root.querySelector('[data-stat="wait"]'), avg);
      animateCount(root.querySelector('[data-stat="occ"]'), Math.round((bedsUsed / bedsTotal) * 100));
      animateCount(root.querySelector('[data-stat="rev"]'), Number((r.opd + r.ipd + r.pharmacy + r.insurance).toFixed(1)), { decimals: 1 });
      animateCount(root.querySelector('[data-stat="tasks"]'), (s.tasks || []).filter((t) => t.status !== 'done').length);
    });
  });

  return handlers;
}
