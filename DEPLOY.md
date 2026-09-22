# Deploying CareFlow AI

The app is a **long-running Node process** (not static, not serverless), so it needs a host
that runs a container or a web service. Three things make it deploy anywhere:

| Concern | How it's handled |
| --- | --- |
| Port binding | `PORT` env var, defaults to `4000`, binds `0.0.0.0` |
| Writable state | `DATA_DIR` env var — point it at a mounted disk/volume |
| Health checks | `GET /api/health` returns status, uptime and live counts |
| Read-only filesystem | falls back to in-memory state instead of crashing |
| Shutdown | handles `SIGTERM` / `SIGINT` so platforms can roll out cleanly |

Already included in this folder: `Dockerfile`, `.dockerignore`, `render.yaml`, `fly.toml`.

---

## Option 0 — GitHub Pages (no server, no account beyond GitHub)

Already configured. `.github/workflows/deploy-pages.yml` runs the end-to-end smoke test,
assembles `dist/`, and publishes it. Result: **https://krishnatejam999.github.io/careflow-ai/**

How it works: `lib/db.js`, `lib/api.js` and `lib/ai.js` are isomorphic, so when no server
answers `public/js/local-backend.js` imports them directly and the whole backend — data layer,
five AI agents, every route — runs in the browser with `localStorage` persistence.

```bash
# enable Pages once, from the CLI
gh api -X POST repos/<owner>/careflow-ai/pages -f build_type=workflow
```

Trade-off: state lives in each visitor's browser, so two people do not share one hospital.
Use Option 1 or 2 when you need a shared, server-backed dataset.

---

## Option 1 — Render (shared server + free permanent HTTPS URL)

`render.yaml` is a Render **Blueprint**, so the whole service is defined in code.

1. Push this folder to a GitHub repo.
2. Open the one-click deploy link:
   `https://render.com/deploy?repo=https://github.com/<your-user>/careflow-ai`
3. Authorize Render with GitHub → **Apply**. Render reads `render.yaml`, builds the
   Dockerfile and gives you a permanent URL like `https://careflow-ai-xxxx.onrender.com`.

**Free tier notes**
- The service sleeps after ~15 minutes idle; the first request afterwards takes ~30s to wake.
- The filesystem is ephemeral, so the data layer reseeds from `data/db.json`'s seed on cold
  start. Registering a patient, then waiting for a sleep cycle, loses that patient. For a demo
  that's fine; to keep state, uncomment the `disk:` block in `render.yaml` and use a paid instance.

---

## Option 2 — Fly.io (persistent volume, deploy from this folder, no Git needed)

```bash
# from sujat/careflow-ai
flyctl launch --no-deploy --copy-config --name <your-unique-app-name>
flyctl volumes create careflow_data --size 1
flyctl deploy
```

`fly.toml` mounts the volume at `/data` and sets `DATA_DIR=/data`, so the JSON data layer
**survives restarts and deploys** — the demo keeps every record it creates. HTTPS and a
`https://<app>.fly.dev` URL are provided automatically.

---

## Option 3 — Any container host (Cloud Run, Koyeb, Azure Container Apps, Northflank, Zeabur, a VPS)

```bash
docker build -t careflow-ai .
docker run -p 4000:4000 -e DATA_DIR=/data -v careflow_data:/data careflow-ai
```

Or push the image to any registry and point the platform at it. Required settings:

- **Port**: `4000` (or set `PORT`)
- **Health check path**: `/api/health`
- **Volume / disk**: mount at `/data` and set `DATA_DIR=/data` for persistence
- **Memory**: 256 MB is plenty

---

## Option 4 — Local network demo

```bash
npm start        # http://localhost:4000
PORT=8080 npm start
```

The server binds `0.0.0.0`, so other devices on the same Wi-Fi can open
`http://<your-laptop-ip>:4000` — handy if you're presenting from a laptop and judging
happens on a phone.

---

## Verifying a deployment

Server-backed hosts expose the API, so you can run the full suite against production:

```bash
curl https://<your-url>/api/health
# {"ok":true,"status":"healthy","agents":5,"patients":8,...}

BASE=https://<your-url> node scripts/smoke-test.js
```

The smoke test works against any host, so you can run the same 46 end-to-end checks
against production before you present.

A **static** deployment has no `/api/health` (that is how the app detects static mode), so
verify it in a browser instead: open the URL, sign in as Reception, run the AI check-in, and
confirm the patient appears in the queue and on the Nurse task board.
