/** Login / role picker. */
import { icon, esc, initials, toast } from '../ui.js';

const ROLE_ICON = { reception: 'door', doctor: 'stethoscope', nurse: 'heart', admin: 'barChart', lab: 'flask', pharmacy: 'pill' };
const ROLE_LABEL = { reception: 'Reception', doctor: 'Doctor', nurse: 'Nurse', admin: 'Admin', lab: 'Laboratory', pharmacy: 'Pharmacy' };

export function loginPage(boot) {
  const accounts = (boot?.demoAccounts || []).slice(0, 4);
  return `
  <div class="login-wrap">
    <div class="login-art">
      <a class="logo" href="#/" style="color:#fff;position:relative;z-index:1">
        <span class="logo-mark">${icon('plus', 18)}</span>
        <span><span class="name" style="color:#fff">CareFlow AI</span><span class="tag" style="color:rgba(255,255,255,.55)">AI Workforce for Hospital Operations</span></span>
      </a>
      <div>
        <div class="quote">"Clinicians are losing the war on <span class="grad">paperwork.</span>"</div>
        <div class="pts">
          ${[
            'AI check-in turns a paper intake form into a routed, triaged patient in under 30 seconds.',
            'Five agents act on your data: Reception, Records, Workflow, Comm. and Coordinator.',
            'Four dashboards, one shared source of truth — nothing re-entered twice.',
          ].map((t) => `<div class="pt">${icon('check', 14)}<span>${t}</span></div>`).join('')}
        </div>
      </div>
      <div class="tiny" style="color:rgba(255,255,255,.5);position:relative;z-index:1">
        Prototype build · data persists in <span class="mono">data/db.json</span>
      </div>
    </div>

    <div class="login-form">
      <div class="inner">
        <a href="#/" class="row gap-sm tiny muted" style="margin-bottom:26px">${icon('chevronLeft', 13)} Back to home</a>
        <h2 style="font-size:1.6rem">Sign in to the demo</h2>
        <p class="muted" style="margin-top:8px">Pick a role to open its dashboard. Any password works — this is a prototype.</p>

        <div class="quick-logins">
          ${accounts.map((a) => `
            <button class="quick" data-quick="${esc(a.email)}">
              <span class="avatar ${a.role === 'doctor' ? 'sky' : a.role === 'nurse' ? 'violet' : a.role === 'admin' ? 'ink' : ''}">${esc(a.initials || initials(a.name))}</span>
              <span style="min-width:0">
                <span class="nm truncate" style="display:block">${esc(a.name)}</span>
                <span class="rl">${ROLE_LABEL[a.role] || a.role}</span>
              </span>
              ${icon(ROLE_ICON[a.role] || 'user', 15, 'muted')}
            </button>`).join('')}
        </div>

        <div class="divider">or use credentials</div>

        <form id="login-form" style="display:grid;gap:14px">
          <div class="field">
            <label for="email">Work email</label>
            <input class="input" id="email" name="email" type="email" value="reception@careflow.ai" autocomplete="username" required />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input class="input" id="password" name="password" type="password" value="careflow" autocomplete="current-password" required />
            <span class="hint">Demo mode: any password is accepted.</span>
          </div>
          <button class="btn btn-primary btn-lg btn-block" type="submit">
            ${icon('arrowRight', 15)} Sign in
          </button>
        </form>

        <div class="card card-pad" style="margin-top:22px;background:#f8fbfd;box-shadow:none">
          <div class="row gap">
            ${icon('shield', 16, 'muted')}
            <div class="tiny muted">Role-based access. In production this is ABDM-compliant consent and audit logging.</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

export function mountLogin(root, { onLogin }) {
  const form = root.querySelector('#login-form');
  const submit = async (email) => {
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<span class="skeleton" style="width:16px;height:16px;border-radius:50%"></span> Signing in…';
    try {
      await onLogin({ email, password: 'careflow' });
    } catch (err) {
      toast({ title: 'Sign in failed', desc: err.message, type: 'error' });
      btn.disabled = false;
      btn.innerHTML = `${icon('arrowRight', 15)} Sign in`;
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(form.querySelector('#email').value);
  });

  root.querySelectorAll('[data-quick]').forEach((b) => {
    b.addEventListener('click', () => {
      root.querySelector('#email').value = b.dataset.quick;
      submit(b.dataset.quick);
    });
  });
}
