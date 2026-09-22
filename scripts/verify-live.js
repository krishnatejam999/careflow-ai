/**
 * Verify a *live* CareFlow AI deployment in a real browser.
 *
 *   node scripts/verify-live.js https://krishnatejam999.github.io/careflow-ai/
 *
 * Drives headless Chrome over the DevTools Protocol (no test files are added
 * to the deployed site) and checks the things a static host can break:
 * subpath asset loading, the server-detection fallback, the in-browser
 * backend, localStorage persistence, and the real dashboards.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const URL_ARG = process.argv[2];
if (!URL_ARG) {
  console.error('Usage: node scripts/verify-live.js <url>');
  process.exit(2);
}
const BASE = URL_ARG.endsWith('/') ? URL_ARG : `${URL_ARG}/`;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const chromePath = CHROME_CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
if (!chromePath) {
  console.error('No Chrome binary found. Set CHROME_PATH.');
  process.exit(2);
}

const PORT = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'careflow-live-'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
let fail = 0;
const check = (label, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? `  → ${extra}` : ''}`);
};

const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

/* ------------------------------------------------------------ CDP plumbing */
let ws;
let nextId = 1;
const pending = new Map();
const events = new Map();

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function waitForEvent(name, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${name}`)), timeout);
    const list = events.get(name) || [];
    list.push((payload) => { clearTimeout(timer); resolve(payload); });
    events.set(name, list);
  });
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text || 'evaluate failed');
  }
  return res.result?.value;
}

/**
 * Full page load. Navigating straight from one URL to another that differs
 * only by hash does not reload the document, so go via about:blank first.
 */
async function goto(url) {
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(200);
  const loaded = waitForEvent('Page.loadEventFired');
  await send('Page.navigate', { url });
  await loaded;
}

/* ------------------------------------------------------------------- run */
async function main() {
  console.log(`\nVerifying live deployment → ${BASE}\n`);

  // Wait for the debugger endpoint.
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch { /* not up yet */ }
    if (!target) await sleep(250);
  }
  if (!target) throw new Error('Chrome debugger did not start');

  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP socket failed')); });
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      const list = events.get(msg.method) || [];
      list.splice(0).forEach((fn) => fn(msg.params));
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

  const consoleErrors = [];
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') consoleErrors.push(msg.params.entry.text);
    if (msg.method === 'Runtime.exceptionThrown') consoleErrors.push(msg.params.exceptionDetails.exception?.description || 'exception');
  });

  // 1. Landing page
  console.log('Landing page');
  const t0 = Date.now();
  await goto(BASE);
  await sleep(2500);
  const landing = await evaluate('document.body.innerText');
  check('page loads', true, `${Date.now() - t0}ms`);
  check('hero rendered', /Every hospital role/i.test(landing));
  check('AI workforce section rendered', /AI Workforce/i.test(landing));
  check('four dashboards section rendered', /Four role-based dashboards/i.test(landing));
  check('landing detects static hosting', /runs in your browser/i.test(await evaluate('document.body.innerHTML')));
  check('no console errors on load', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));

  // 2. In-browser backend actually answers
  console.log('\nIn-browser backend');
  const probe = await evaluate(`(async () => {
    const st = await fetch(new URL('api/health', document.baseURI).href).then(r => r.status).catch(() => 'ERR');
    const mod = await import(new URL('js/local-backend.js', document.baseURI).href);
    const b = await mod.createLocalBackend();
    const state = await b.request('GET', '/api/state');
    const before = state.patients.length;
    const ci = await b.request('POST', '/api/checkin', { rawForm: 'Name: Live Verify Patient\\nAge: 66\\nGender: Male\\nChief Complaint: Breathlessness and chest tightness\\nKnown Allergies: Sulfa drugs\\nPast History: Hypertension' });
    const after = await b.request('GET', '/api/state');
    return {
      healthStatus: st,
      before,
      after: after.patients.length,
      mrn: ci.patient && ci.patient.mrn,
      token: ci.queueEntry && ci.queueEntry.token,
      triage: ci.triage && ci.triage.level,
      score: ci.triage && ci.triage.score,
      dept: ci.route && ci.route.department,
      tasks: ci.tasks && ci.tasks.length,
      notified: Boolean(ci.notification),
      stored: Boolean(localStorage.getItem(b.info.storageKey)),
    };
  })()`);
  check('server probe is absent (static host)', probe.healthStatus === 404, `HTTP ${probe.healthStatus}`);
  check('state served from the browser', probe.before >= 5, `${probe.before} seeded patients`);
  check('AI check-in works live', probe.after === probe.before + 1, `${probe.mrn} · ${probe.token}`);
  check('triage + routing work live', probe.triage === 'critical' && probe.dept === 'Cardiology', `score ${probe.score} → ${probe.dept}`);
  check('tasks + patient notification created', probe.tasks >= 2 && probe.notified, `${probe.tasks} tasks`);
  check('state persisted to localStorage', probe.stored === true);

  // 3. Real dashboards, in local mode
  console.log('\nDashboards (local mode)');
  await evaluate(`localStorage.setItem('careflow.session.v1', JSON.stringify(${JSON.stringify(
    { id: 'u_reception', name: 'Ananya Sharma', role: 'reception', title: 'Front Desk Executive', department: 'OPD Front Desk', initials: 'AS' },
  )}))`);
  await goto(`${BASE}#/reception`);
  await sleep(3000);
  const reception = await evaluate('document.getElementById("app").innerHTML');
  check('reception dashboard renders', /Front Desk/.test(reception) && /Live queue/.test(reception));
  check('shows static-mode indicator', /runs in browser/.test(reception));
  check('sees the patient checked in from this browser', /Live Verify Patient/.test(reception));
  check('queue rows rendered', (reception.match(/queue-row/g) || []).length > 0, `${(reception.match(/queue-row/g) || []).length} rows`);

  await evaluate(`location.hash = '#/nurse'`);
  await sleep(2500);
  const nurse = await evaluate('document.getElementById("app").innerHTML');
  check('nurse dashboard renders', /Nursing Station/.test(nurse), `${(nurse.match(/class="task /g) || []).length} tasks on the board`);

  await evaluate(`location.hash = '#/admin'`);
  await sleep(2500);
  const admin = await evaluate('document.getElementById("app").innerHTML');
  check('admin dashboard renders', /Operations Command/.test(admin) && /Coordinator AI/.test(admin));

  check('no console errors overall', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  ${pass} passed, ${fail} failed`);
  console.log(`${'─'.repeat(50)}\n`);
}

main()
  .catch((err) => { console.error('\nVerification failed:', err.message); fail++; })
  .finally(() => {
    try { ws?.close(); } catch { /* noop */ }
    chrome.kill();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* noop */ }
    process.exit(fail ? 1 : 0);
  });
