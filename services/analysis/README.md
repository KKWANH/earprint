# Analysis Service

Python background worker that runs Earprint's analyze pipeline outside
Cloudflare Workers' 50-subrequest cap. Polls Neon for jobs the web app
flagged as `running`, processes them, writes results back through the
same SQL functions (`save_enrichments`, `save_ai_analysis`) the TS code
already calls — no schema duplication.

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | FastAPI app + Postgres pool + polling skeleton (dry-run) | done |
| **2** | Deezer + Gemini batch ports — ENRICH_BATCH=30, AI_BATCH=80 | **current** (dry-run default) |
| 3 | Verified parity → flip `DRY_RUN=false` | flip when ready |
| 4 | Switch off `/api/cron/tick` analyze path in Workers | after 3 stable |
| 5 | MIR (Essentia, Discogs-EffNet) — BPM, key, audio embeddings | later |

## Local dev

```bash
cd services/analysis
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e .

# Use Neon's pooled URL for local. dotenv-style works:
echo 'DATABASE_URL=postgresql://...' > .env

uvicorn app.main:app --reload --port 8000
# In another shell:
curl http://localhost:8000/health
# → {"status":"ok"}
# Logs should print "no running jobs" every 5s.
```

## Deploy to Fly.io (first time)

```bash
# One-off: install + auth
brew install flyctl
flyctl auth login

# From this directory:
cd services/analysis
flyctl launch --no-deploy --copy-config --name earprint-analyzer
# → accept defaults; fly.toml is already committed.

# Set secrets — both required for Phase 2:
flyctl secrets set \
  DATABASE_URL='postgresql://...neon...sslmode=require' \
  GEMINI_API_KEY='...'

flyctl deploy

# Verify:
flyctl status
curl https://earprint-analyzer.fly.dev/health
flyctl logs    # should show the poll loop ticking + "found N running jobs"
```

Subsequent deploys: `flyctl deploy` (re-uses the existing app + secrets).

## Cutover (Phase 2 → Phase 3 → Phase 4)

The service ships with `DRY_RUN=true` so it only *observes* running jobs
on the first deploy — handy for confirming it can reach Neon. Cutover
is then four flips:

```bash
# 1. Watch the dry-run logs. You should see lines like
#    user=<uuid> phase=enrich (dry_run — would process)
flyctl logs

# 2. Flip dry-run off. From here, Fly does the batches in parallel with
#    the Workers cron — both write through the same idempotent SQL
#    functions, so the race is wasteful but not destructive.
flyctl secrets set DRY_RUN=false

# 3. Press "Analyze" in the web app on a fresh user. Watch:
#    - Fly logs: user=<uuid> enrich → N tracks  (every poll)
#    - Web library page: progress moves visibly faster
#    Confirm one full run completes without errors.

# 4. (Phase 4 — separate session) remove the runAnalyzeBatch call from
#    apps/web/src/app/api/cron/tick/route.ts so Workers only does the
#    isComplete+finishJob+email path. Deploy Workers, then rely on Fly
#    for batches entirely.
```

## Layout

```
app/
  main.py        FastAPI entry — lifespan hooks worker, exposes /health
  worker.py      asyncio polling loop — Phase 2 puts the batch work here
  db.py          asyncpg pool against Neon
  config.py      env-driven settings (pydantic-settings)
  schemas.py     pydantic models that mirror analysis table columns
  pipeline/      empty stubs reserved for Phase 5 MIR work
Dockerfile       slim Python 3.12 + uv install
fly.toml         Fly app config (Tokyo region, always-on, /health probe)
```

## Why polling, not a webhook trigger

The web app's `/api/jobs POST {action:"start"}` writes `status='running'`
into the shared `background_jobs` table. This service notices the row on
its next tick (default: 5s) and starts working. No service-to-service
auth, no shared secret, no retry logic — the row IS the queue.

We'll add an explicit trigger endpoint when poll latency starts mattering
(probably not soon — 5s feels like nothing next to a multi-minute job).
