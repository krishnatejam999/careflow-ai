# CareFlow AI — AI Workforce for Hospital Operations

**Live demo → https://krishnatejam999.github.io/careflow-ai/**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/krishnatejam999/careflow-ai)

> **One Intelligent System. Every Hospital Workflow.**

An end-to-end, working prototype of the CareFlow AI platform: a proactive **AI workforce**
layered over hospital operations, plus **four role-based dashboards** (Reception, Doctor,
Nurse, Admin) that all read and write to the same live data layer.

Built as Phase 1 + Phase 2 + Phase 3 of the 36-hour roadmap in the pitch deck:
polished role-based frontend → real data layer → AI agent features.

---

## Two ways to run — one codebase

On boot the app probes `/api/health`. If a server answers, it uses it. If not, it runs the
**entire backend in the browser** — the data layer (`lib/db.js`), the route table
(`lib/api.js`) and all five AI agents (`lib/ai.js`) are isomorphic, so the same modules the
Node server imports are imported by the page itself.

| | Server mode | Static mode (GitHub Pages) |
| --- | --- | --- |
| API runs in | the Node process | the browser |
| State stored in | `data/db.json` | `localStorage` |
| Shared between users | yes | no — each browser has its own hospital |
| AI agent output | identical | identical |
| Needs a server | yes | **no** |

## Run it

Zero dependencies. Node 18+ only.

```bash
cd sujat/careflow-ai && npm start
```

Or just open the [live static demo](https://krishnatejam999.github.io/careflow-ai/) — no install,
no server, every flow works.

[DEPLOY.md](DEPLOY.md) covers GitHub Pages, Docker, Render, Fly.io and any other container host.

```bash
cd sujat/careflow-ai
npm start
```

Then open **http://localhost:4000**

To wipe demo data back to the seeded state: `npm run reset` (or delete `data/db.json`).

### Verify it works

With the server running, in a second shell:

```bash
npm test
```

This drives the real HTTP API end to end — page assets, login, OCR extraction, AI
check-in, queue advances, critical-vitals escalation, SOAP drafting, allergy-safe
prescribing, records search, lab release, appointments, Coordinator AI actions,
error handling and persistence — and prints a pass/fail per workflow.

To check a *deployed* site in a real browser instead (headless Chrome over the DevTools
Protocol — it exercises the static-hosting fallback, the in-browser backend, localStorage
and every dashboard):

```bash
npm run verify:live -- https://krishnatejam999.github.io/careflow-ai/
```

### 3-minute demo script

1. Open the landing page and skim the problem → AI workforce → dashboards sections.
2. **Sign in as Reception** → *AI check-in* → it auto-runs OCR on the sample intake
   form: watch field confidence, triage score, routing, task creation and the patient
   message all land in one flow. Confirm the check-in.
3. The new token is in the live queue with a priority badge and a wait bar.
4. **Switch to Nurse** (sidebar → sign out → pick Nurse, or log in directly) → the
   three tasks Workflow AI just created are on the board. *Record vitals* and set
   **SpO₂ to 89** → an escalation task is created for the consultant instantly.
5. **Switch to Doctor** → pick that patient → *Summarise* assembles the chart and
   *Draft note* writes S/O/A/P. Sign it. Try prescribing `Sulfamethoxazole` for a
   sulfa-allergic patient to see the allergy block.
6. **Switch to Admin** → Coordinator AI insights (bottlenecks, ICU occupancy, load
   imbalance) with one-click *Apply*, plus occupancy, revenue and the agent audit log.

Every number on screen comes from the same persisted data layer, so step 4 really
does change what step 5 and 6 can see.

---

## What actually works (not a mockup)

| Area | Working behaviour |
| --- | --- |
| **Data layer** | Real REST API over an HTTP server. State persists to `data/db.json` — reload the browser and everything is still there. |
| **Reception AI** | OCR intake extraction from a raw form blob → structured patient fields → registration → auto-generated queue token. |
| **Records AI** | Instant cross-record search + patient record assembly. |
| **Workflow AI** | Triage scoring, department routing, and automatic nurse task assignment whenever a patient is registered. |
| **Comm. AI** | Automated patient notifications (SMS/WhatsApp previews) on check-in, call, and discharge. |
| **Coordinator AI** | Predictive resource allocation, bottleneck detection, and insights on the Admin dashboard. |
| **Reception** | Register patients, run AI check-in, manage the live queue (call next / start / complete), book appointments. |
| **Doctor** | Live patient list, AI-generated patient summary with risk flags, AI-drafted SOAP notes, lab results, prescriptions. |
| **Nurse** | Dynamic task board from Workflow AI, care-plan tracking, vitals capture with automatic abnormal-value alerts. |
| **Admin** | Staff management with live load, operational analytics, revenue + resource tracking, agent activity log. |
| **Landing page** | Full marketing page: problem, agent workforce, four dashboards, roadmap. |

Everything is server-persisted, so actions in one dashboard show up in the others —
e.g. Reception checks a patient in, and the Doctor's list and the Nurse's task board update.

---

## Demo logins

Any password works (this is a prototype). Quick-login buttons are on the login screen.

| Role | Email |
| --- | --- |
| Reception | `reception@careflow.ai` |
| Doctor | `doctor@careflow.ai` |
| Nurse | `nurse@careflow.ai` |
| Admin | `admin@careflow.ai` |

---

## Structure

```
careflow-ai/
├── server.js          Zero-dependency HTTP server: static files + REST API
├── lib/
│   ├── db.js          JSON-file store, seeded on first boot
│   ├── ai.js          The five AI agents (deterministic, offline, explainable)
│   └── api.js         Route handlers
├── public/
│   ├── index.html     App shell
│   ├── css/styles.css Design system (tokens, components, layout)
│   └── js/            ES-module SPA: router, api client, views, charts
├── scripts/           reset.js, smoke-test.js, verify-live.js
├── Dockerfile         Production image (Render / Fly / Cloud Run / any host)
├── render.yaml        Render Blueprint — one-click deploy
├── fly.toml           Fly.io config with a persistent volume
├── DEPLOY.md          Host-by-host deployment guide
└── data/db.json       Live state (created on first run)
```
