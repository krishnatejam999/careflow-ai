/** Landing page — problem, AI workforce, role dashboards, roadmap. */
import { icon, esc, animateCount } from '../ui.js';

export const AGENT_META = {
  'Reception AI': { icon: 'door', desc: 'Automates booking, check-in and smart queue creation. OCR turns a paper intake form into structured data in seconds.', stat: '0 manual re-entries' },
  'Records AI': { icon: 'file', desc: 'Instant OCR extraction, record assembly and intelligent search across every prior encounter — with critical values flagged.', stat: '3 prior records per patient' },
  'Workflow AI': { icon: 'route', desc: 'Real-time patient routing, triage scoring and automatic staff task assignment the moment an encounter opens.', stat: '2–3 tasks auto-created' },
  'Comm. AI': { icon: 'message', desc: 'Automated patient notifications and internal alerts over WhatsApp, SMS and email — no front-desk phone calls.', stat: '100% auto-notified' },
  'Coordinator AI': { icon: 'activity', desc: 'Holistic monitoring, bottleneck detection and predictive resource allocation across wards, staff and queues.', stat: 'Live, every 15s' },
};

const PROBLEMS = [
  {
    tone: 'rose', icon: 'clock', big: '13.5 hrs',
    title: 'Documentation eats the clinical week',
    body: 'Clinicians spend 13.5 hours a week on paperwork — over a third of the working week — leaving less time for the patient in front of them. [1]',
  },
  {
    tone: 'amber', icon: 'layers',
    title: 'Siloed data and delayed care',
    body: 'Records, queues, labs and insurance live in disconnected systems. Fragmented information means life-threatening delays during the critical "Golden Hour".',
  },
  {
    tone: 'sky', icon: 'refresh',
    title: 'Reactive, not proactive',
    body: 'Without early risk detection, healthcare stays in a costly reactive cycle. Staff coordinate manually — the very burden the software was meant to remove.',
  },
];

export function landingPage(state = {}) {
  const agents = state.agents?.length ? state.agents : Object.keys(AGENT_META).map((n, i) => ({ id: n, name: n, tag: '', accent: ['#0ea5e9', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444'][i] }));

  return `
  <div class="landing">
    <nav class="nav">
      <div class="nav-inner">
        <a class="logo" href="#/">
          <span class="logo-mark">${icon('plus', 18)}</span>
          <span>CareFlow AI<span class="tag">AI Workforce for Hospital Operations</span></span>
        </a>
        <div class="nav-links">
          <a href="#problem">Problem</a>
          <a href="#agents">AI Workforce</a>
          <a href="#dashboards">Dashboards</a>
          <a href="#roadmap">Roadmap</a>
        </div>
        <div class="row gap">
          <a class="btn btn-ghost" href="#/login">Sign in</a>
          <a class="btn btn-primary" href="#/login">${icon('play', 13)} Start demo</a>
        </div>
      </div>
    </nav>

    <header class="hero">
      <div class="hero-inner">
        <div>
          <span class="eyebrow appear"><span class="pill">Live demo</span> Hackathon Round 1 · working prototype</span>
          <h1 class="appear appear-1">Every hospital role, with its own <span class="grad">AI teammate.</span></h1>
          <p class="lede appear appear-2">
            Clinicians are losing the war on paperwork. CareFlow AI is a proactive workforce of
            agents that acts on hospital data instead of just storing it — automating check-in,
            routing, records, communication and operations end to end.
          </p>
          <div class="hero-cta appear appear-3">
            <a class="btn btn-primary btn-lg" href="#/login">${icon('play', 14)} Start demo preview</a>
            <a class="btn btn-lg" href="#dashboards">${icon('grid', 14)} See the four dashboards</a>
          </div>
          <div class="hero-meta appear appear-4">
            <div class="m"><div class="n" data-count-to="5" data-suffix="">0</div><div class="l">AI agents orchestrating</div></div>
            <div class="m"><div class="n" data-count-to="13.5" data-decimals="1" data-suffix=" hrs">0</div><div class="l">→ est. 4.8 hrs documentation</div></div>
            <div class="m"><div class="n" data-count-to="30" data-suffix="s">0</div><div class="l">AI check-in, form to token</div></div>
            <div class="m"><div class="n" data-count-to="4" data-suffix="">0</div><div class="l">Role-based dashboards</div></div>
          </div>
        </div>

        <div class="hero-visual appear appear-2">
          <div class="orb" style="width:280px;height:280px;background:#14b8a6;top:-40px;right:20px"></div>
          <div class="orb" style="width:220px;height:220px;background:#0ea5e9;bottom:-30px;left:-30px"></div>

          <div class="glass preview float-card float-a">
            <span class="badge badge-brand"><span class="dot"></span>Reception AI</span>
            <span>OCR · 11 fields</span>
          </div>
          <div class="glass preview float-card float-b">
            <span class="badge badge-critical"><span class="dot"></span>Critical</span>
            <span>Triage 92 · Cardiology</span>
          </div>

          <div class="glass preview">
            <div class="preview-top">
              <span class="preview-dot"></span><span class="preview-dot"></span><span class="preview-dot"></span>
              <span class="preview-url">careflow.ai/reception/check-in</span>
            </div>
            <div class="preview-body">
              <div class="preview-row">
                <div class="mini"><div class="k">In queue</div><div class="v">7</div></div>
                <div class="mini"><div class="k">Avg wait</div><div class="v">31<span style="font-size:.75rem;font-weight:600;color:var(--muted)"> min</span></div></div>
                <div class="mini"><div class="k">AI actions</div><div class="v">24</div></div>
              </div>
              <div class="mini scan-line">
                <div class="k" style="margin-bottom:8px">AI intake extraction</div>
                <div style="display:grid;gap:7px">
                  <div class="row gap" style="font-size:.78rem"><span class="badge badge-low"><span class="dot"></span>Name</span><span class="strong">Rakesh Pawar</span></div>
                  <div class="row gap" style="font-size:.78rem"><span class="badge badge-low"><span class="dot"></span>Age / Sex</span><span class="strong">71 · Male</span></div>
                  <div class="row gap" style="font-size:.78rem"><span class="badge badge-medium"><span class="dot"></span>Allergies</span><span class="strong" style="color:#b45309">Iodine</span></div>
                  <div class="row gap" style="font-size:.78rem"><span class="badge badge-critical"><span class="dot"></span>Complaint</span><span class="strong" style="color:#be123c">Breathlessness, SpO₂ 89%</span></div>
                </div>
              </div>
              <div class="row between" style="font-size:.76rem;color:var(--muted)">
                <span class="row gap-sm">${icon('zap', 12)} Workflow AI routing…</span>
                <span class="strong" style="color:var(--teal-600)">Token OPD-101 → Cardiology</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <section class="section" id="problem">
      <div class="wrap-lg">
        <div class="sec-head">
          <div class="kicker">The problem</div>
          <h2>Workforce health is compromised by disconnected systems</h2>
          <p>In today's OPD: manual coordination, paper forms, long queues and systems that never talk to each other.
             Priya, an OPD patient, waits 40 minutes because her intake form gets manually re-entered three times.</p>
        </div>
        <div class="problem-grid">
          ${PROBLEMS.map((p) => `
            <article class="problem card-hover">
              <div class="ic" style="background:${p.tone === 'rose' ? '#fff1f4' : p.tone === 'amber' ? '#fffaeb' : '#e0f2fe'};color:${p.tone === 'rose' ? '#be123c' : p.tone === 'amber' ? '#b45309' : '#0284c7'}">
                ${icon(p.icon, 20)}
              </div>
              ${p.big ? `<div class="big">${p.big}</div>` : ''}
              <h4>${p.title}</h4>
              <p>${p.body}</p>
            </article>`).join('')}
        </div>
      </div>
    </section>

    <section class="section tint" id="agents">
      <div class="wrap-lg">
        <div class="sec-head">
          <div class="kicker">The AI workforce</div>
          <h2>CareFlow AI gives every hospital role its own AI teammate</h2>
          <p>Unlike generic hospital software, we provide a <strong>proactive AI workforce that acts on data</strong>,
             rather than just storing it. Each agent owns a workflow and hands off to the next.</p>
        </div>
        <div class="agent-grid">
          ${agents.map((a) => {
            const meta = AGENT_META[a.name] || { icon: 'cpu', desc: '', stat: '' };
            return `<article class="agent-card">
              <div class="glow" style="background:${a.accent}"></div>
              <div class="ic" style="background:linear-gradient(140deg,${a.accent},${a.accent}bb);box-shadow:0 10px 24px ${a.accent}44">${icon(meta.icon, 20)}</div>
              <h4>${esc(a.name)}</h4>
              <div class="role" style="color:${a.accent}">${esc(a.tag || '')}</div>
              <p>${meta.desc}</p>
              <div class="live"><span class="pulse"></span>online · ${esc(meta.stat)}</div>
            </article>`;
          }).join('')}
        </div>
      </div>
    </section>

    <section class="section" id="dashboards">
      <div class="wrap-lg">
        <div class="sec-head">
          <div class="kicker">One platform</div>
          <h2>Four role-based dashboards, one shared truth</h2>
          <p>One application intelligently adapts to every hospital role. Register a patient at reception and the
             doctor's list, the nurse's task board and the admin's analytics all update instantly.</p>
        </div>
        <div class="role-grid">
          ${[
            { role: 'Reception', icon: 'door', tone: 'sky', items: ['Patient registration & AI check-in', 'Live queue management', 'Appointment scheduling', 'Insurance & scheme verification'] },
            { role: 'Doctor', icon: 'stethoscope', tone: 'violet', items: ['AI-generated patient summaries', 'Automated consultation notes', 'Real-time lab report access', 'Allergy-safe prescribing'] },
            { role: 'Nurse', icon: 'heart', tone: 'rose', items: ['Dynamic task assignment', 'Patient care-plan tracking', 'Medication & vitals monitoring', 'Automatic critical-vital escalation'] },
            { role: 'Admin', icon: 'barChart', tone: 'amber', items: ['Hospital-wide staff management', 'Real-time operational analytics', 'Revenue & resource tracking', 'Coordinator AI recommendations'] },
          ].map((r) => `
            <article class="role-card card-hover">
              <div class="top">
                <span class="avatar ${r.tone}" style="width:38px;height:38px;border-radius:11px;display:grid;place-items:center">${icon(r.icon, 18)}</span>
                <div><h4>${r.role}</h4><div class="tiny muted">Dashboard</div></div>
              </div>
              <ul>${r.items.map((i) => `<li>${icon('check', 13)}<span>${i}</span></li>`).join('')}</ul>
            </article>`).join('')}
        </div>
      </div>
    </section>

    <section class="section tint" id="roadmap">
      <div class="wrap-lg">
        <div class="sec-head">
          <div class="kicker">Build plan</div>
          <h2>How we said we'd build it — and what already runs</h2>
          <p>The pitch promised four phases. This prototype ships phases one through three: polished role-based
             frontend, a real data layer, and working AI agent flows.</p>
        </div>
        <div class="roadmap">
          ${[
            { n: '01', t: 'Frontend & UI', d: 'Full interactive frontend, polished and role-based.', done: true, note: 'Shot: 4 dashboards + landing' },
            { n: '02', t: 'Data Layer', d: 'Real database persisting patients, queue state and staff assignments.', done: true, note: 'Task: REST API + persisted store' },
            { n: '03', t: 'AI Features', d: 'OCR on intake forms and the auto-routing check-in agent flow.', done: true, note: 'OK: 5 agents, 9 AI endpoints' },
            { n: '04', t: 'Polish & Handoff', d: 'Edge cases, empty states and final testing across every role.', done: false, note: 'Next' },
          ].map((p) => `
            <article class="phase ${p.done ? 'done-phase' : ''}">
              <div class="num">PHASE ${p.n}</div>
              <h4>${p.t}</h4>
              <p>${p.d}</p>
              <div class="done">${icon(p.done ? 'checkCircle' : 'clock', 13)} ${p.done ? 'Shipped in this prototype' : 'In progress'}</div>
            </article>`).join('')}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap-lg">
        <div class="cta-band">
          <h2>"One Intelligent System.<br/>Every Hospital Workflow."</h2>
          <p>Open the live dashboard and run an AI check-in end to end — extract a form, score triage, route the
             patient, generate the task board and notify them. Everything is real and persists.</p>
          <div class="row">
            <a class="btn btn-light btn-lg" href="#/login">${icon('zap', 14)} Start demo preview</a>
            <a class="btn btn-outline-light btn-lg" href="#/login">${icon('code', 14)} Pick a role</a>
          </div>
        </div>
      </div>
    </section>

    <footer class="footer">
      <div class="inner">
        <div class="row gap">
          <span class="logo-mark">${icon('plus', 16)}</span>
          <div>
            <div class="strong">CareFlow AI</div>
            <div class="tiny muted">AI Workforce for Hospital Operations · Prototype build</div>
          </div>
        </div>
        <div class="tiny muted">Hackathon Round 1 demo · interactive concept preview running on live code</div>
      </div>
    </footer>
  </div>`;
}

export function mountLanding(root) {
  const els = root.querySelectorAll('[data-count-to]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const node = e.target;
      io.unobserve(node);
      const to = parseFloat(node.dataset.countTo);
      animateCount(node, to, {
        decimals: Number(node.dataset.decimals || 0),
        suffix: node.dataset.suffix || '',
        duration: 1100,
      });
    });
  }, { threshold: .4 });
  els.forEach((el) => io.observe(el));
}
