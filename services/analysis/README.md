# Analysis Service

> Status: scaffold only. Phase 3 (Essentia MIR — BPM, key, embeddings) is not
> implemented yet. API-based enrichment currently runs inside the web app on
> Cloudflare Workers; this Python service exists for the future MIR pipeline.

Planned pipeline: track resolution → external-API metadata enrichment →
MIR (audio feature inference).

## Run

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e .            # core only
pip install -e ".[mir]"     # incl. MIR (Essentia/librosa) — Phase 3

uvicorn app.main:app --reload       # API server (:8000)
rq worker analysis --url $REDIS_URL # analysis worker (Phase 3)
```

## Layout

```
app/
  main.py            FastAPI entry point (health, etc.)
  config.py          settings (pydantic-settings)
  schemas.py         API schemas (mirror packages/shared types)
  pipeline/
    resolver.py      track normalization / matching   (Phase 2)
    enricher.py      Deezer/Last.fm/MB enrichment      (Phase 2)
    mir.py           Essentia/librosa inference        (Phase 3)
  worker.py          RQ job functions                  (Phase 3)
```
