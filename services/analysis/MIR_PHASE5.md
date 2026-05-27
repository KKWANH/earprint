# MIR Phase 5 — Audio Feature Extraction

> Status: **code shipped, awaiting deployment**. The TS / Python /
> SQL pieces are all in (gated behind `mir_enabled()` so they no-op
> on machines without the deps). Remaining work is operational:
> bump the Fly machine, install the heavy deps, mount model weights.
> See "Activation checklist" below.

## Why

`tracks.bpm`, `tracks.music_key`, `analysis.audio_feel`, and the
`embeddings` table all exist already (see `db/schema.sql:113–146`) — but
Phase 1–2 only fills the Gemini-inferred fields. The schema is waiting
for *measured* features. With Spotify's Audio Features API retired
(2024-11-27, no new apps) and Deezer's `bpm` field being unreliable past
the western pop catalogue, the only path to trustworthy MIR is running
the models ourselves on Deezer's 30-second preview clips.

Owning this pipeline is the only real moat the project has against the
"every previous taste tool died" failure mode flagged in
`ARCHITECTURE.md:124–135`.

## Output targets (per track)

| Field | Source | Notes |
|---|---|---|
| `tracks.bpm` | Essentia `RhythmExtractor2013` | replaces Deezer's bpm |
| `tracks.music_key` / `music_scale` | Essentia `KeyExtractor` | "C", "F#" + "major"/"minor" |
| `analysis.danceability` | Essentia `Danceability` | 0..1 |
| `analysis.valence` / `arousal` | Discogs-EffNet mood head | 0..1 each |
| `analysis.voice_instrumental` | Essentia `VoiceInstrumental` | enum |
| `embeddings.vector` | Discogs-EffNet penultimate (1280-d) | for similarity / pgvector HNSW |

`audio_feel` (energy/tempo/acousticness/instruments) stays Gemini-side
for now — model output competes with measured features in some, but the
gentle subjective ones (energy, atmospheric instruments) aren't worth
the audio-download cost when the AI estimate is "good enough".

## Pipeline

```
poll background_jobs (mir phase)
  → SELECT tracks WHERE embeddings.track_id IS NULL
                    AND preview_url IS NOT NULL
                    LIMIT N
  → for each track in parallel (asyncio.Semaphore, ~4 concurrent):
      download preview MP3 (~600 KB, 30 s @ 192 kbps)
      decode to 16 kHz mono via librosa
      run Essentia `RhythmExtractor2013` → bpm
      run Essentia `KeyExtractor` → key/scale
      run Essentia `Danceability` → danceability
      run Discogs-EffNet inference → embedding (1280-d) + mood/voice heads
      → UPDATE tracks SET bpm = ?, music_key = ?, music_scale = ?
      → UPDATE analysis SET danceability = ?, valence = ?, arousal = ?, voice_instrumental = ?
      → INSERT embeddings (track_id, model, vector)
      → discard audio file
```

Audio is **never persisted** — pure compute-and-throw, same compliance
posture as Phase 2 enrichment (see `apps/web/.../privacy/page.tsx`).

## Dependencies

```toml
mir = [
    "numpy>=1.26",
    "librosa>=0.10",           # MP3 decode + resample
    "essentia-tensorflow>=2.1b6.dev1110",  # rhythm/key/danceability + Discogs models
    "essentia-models",          # pretrained-model weights (~200 MB download)
    "tensorflow-cpu>=2.16",     # Discogs-EffNet runtime
]
```

Already in `pyproject.toml` under `[project.optional-dependencies].mir`.
Install with `pip install -e ".[mir]"`.

## Infrastructure changes

Fly machine size has to grow:

| Now | After Phase 5 |
|---|---|
| `shared-cpu-1x` · 256 MB | `shared-cpu-2x` · **1 GB** (~$1.94/mo) |
| 1 always-on machine | 1 always-on + autoscale on queue depth |

Reason: TensorFlow runtime alone needs ~400 MB resident; Essentia models
add ~200 MB. 256 MB OOMs before the first inference.

R2 bucket needed for **pretrained model weights** so each new Fly machine
doesn't re-download from upstream Discogs on boot (~10 s saved per cold
start, polite to upstream).

## Cost & timing

| Stage | Per-track | 1,000 tracks | Notes |
|---|---|---|---|
| Preview download | 200 ms | 3 min | parallel × 4 |
| Decode + resample | 100 ms | 1.5 min | |
| Essentia rhythm/key/dance | 800 ms | 13 min | CPU-bound |
| Discogs-EffNet embedding | 600 ms | 10 min | CPU TF |
| DB writes | 50 ms | < 1 min | |
| **Total (4× parallel)** | — | **~30 min** | first full run |

After the first pass, only newly-synced tracks need processing —
incremental load is trivial.

## Migration path

1. **Branch**: stand the Phase 5 work up on `feat/mir` so prod stays Phase 2.
2. **`pipeline/mir.py`** — replace the current stub with the inference
   functions (Essentia model lifecycle, librosa decode, embedding extract).
3. **`worker.py`** — third phase after `enrich` and `ai`. Schema's
   `phaseOf()` logic in `apps/web/src/lib/jobs.ts:81` extends from
   2-phase to 3-phase. The Workers cron `isComplete` adjusts to require
   embeddings populated too.
4. **`save_mir_analysis()` SQL function** — analogous to
   `save_enrichments` / `save_ai_analysis`. Takes JSONB rows, writes
   tracks + analysis + embeddings in one tx.
5. **R2 model cache** — Cloudflare R2 bucket + signed-URL helper.
6. **Fly machine bump** — `flyctl scale memory 1024` + Dockerfile add
   for the heavyweight deps.
7. **Recommendation engine v2** — switch from text-tag matching to
   pgvector cosine similarity using the new embeddings. This is where
   MIR pays off; without it, Phase 5 is overkill for current features.

## Risks

- **Discogs-EffNet weights licence** — verify it allows commercial use
  (likely CC-BY-NC). If not, fall back to MTG-Jamendo MUSAN-style models.
- **Decode failures on weird previews** — Deezer sometimes serves stems
  that librosa can't open. Wrap in try/skip and log.
- **TF cold-start** — first request after machine boot waits 2–3 s on
  model load. Acceptable for a background worker; we don't serve this
  inline to user requests.

## Out of scope (Phase 6+)

- Full-track analysis (would need full-length files, not 30s previews —
  legal and storage problems)
- Audio fingerprinting / duplicate detection
- Streaming-style "live" inference for real-time UI

## Activation runbook

End-to-end deployment, ~1–2 hours of focused work. Every step is
idempotent or reversible — the worker falls back to the existing
2-phase pipeline if any of this gets ripped out.

### Step 1 — R2 bucket for model weights

```bash
# Cloudflare Dashboard → R2 → Create bucket "earprint-models"
# R2 → Manage R2 API Tokens → Create with R/W on that bucket
# Configure aws CLI:
cat >> ~/.aws/credentials <<EOF
[r2]
aws_access_key_id     = <token id>
aws_secret_access_key = <token secret>
EOF

# One-time upload (downloads from Essentia + mirrors to R2):
cd services/analysis
R2_ACCOUNT_ID=<your-cf-account-id> ./scripts/upload-models.sh

# Make the bucket publicly readable so the Dockerfile can curl without auth:
# Cloudflare Dashboard → R2 → earprint-models → Settings → Public Access → Allow
# (alternative: use signed URLs and pass them as Docker secrets — bigger lift)
```

### Step 2 — Enable the MIR layer in the Dockerfile

```bash
# Open services/analysis/Dockerfile and uncomment the MIR block
# (it's already there, just commented out). Set MIR_MODEL_BUCKET to your
# R2 public URL — looks like https://pub-<hash>.r2.dev once you enable
# Public Access in step 1.
```

### Step 3 — Scale the Fly machine

```bash
# 256 MB → 1 GB. ~$1.94/mo extra. TF + Essentia models need at least
# 800 MB resident; 1 GB leaves headroom.
flyctl scale memory 1024 --app earprint-analyzer
```

### Step 4 — Deploy + verify

```bash
cd services/analysis
flyctl deploy   # ~5 min — builds the larger image, pulls models into layer

# Smoke test:
FLY_APP=earprint-analyzer DATABASE_URL=$NEON_URL ./scripts/mir-smoke-test.sh

# Manual log tail:
flyctl logs --app earprint-analyzer
#   → "loaded Discogs-EffNet (200.0 MB)" on first MIR batch
#   → "loaded head model mood_happy-discogs-effnet-1.pb"
#   → "user=<uuid> mir → 4 tracks" every ~6 s
```

### Step 5 — Drive a real run

Pick a test user whose Analyze has finished phases 1+2. Their MIR
backlog is `tracks with preview_url AND no embedding row` — the worker
picks it up automatically on the next tick. ~30 min for the first
~1,500 tracks at batch-4 sequential.

```sql
-- Check progress mid-run:
SELECT count(*) FROM embeddings;                            -- grows
SELECT centroid IS NOT NULL FROM taste_profiles WHERE user_id = ...;
-- Once true, recommend v2 (embeddingPool in lib/recommend.ts) is live
-- for that user; the "mix" mode auto-prefers it.
```

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `mir_enabled = False` in logs | `[mir]` extras not installed | uncomment the `uv pip install` line in Dockerfile, redeploy |
| `missing Discogs-EffNet weights at /app/models/...` | R2 curl failed at build time | check `MIR_MODEL_BUCKET` env, verify Public Access on bucket |
| `decode failed for ...: ffmpeg not found` | ffmpeg not in image | uncomment the apt-get line in Dockerfile, redeploy |
| OOM / machine restarting in loop | Still on 256 MB | `flyctl scale memory 1024` |
| `user=... mir → 0 tracks` forever | All preview_url null | tracks need Phase 1 (Deezer) done first — check `enrich` phase completed |
| Embeddings table growing but no recommend change | centroid not updating | check `update_taste_centroid` ran — log shows "save_mir_analysis" but no errors after |

### Rolling back

Switch the MIR layer off without touching code:

```bash
# Option A — re-comment the MIR block in Dockerfile, redeploy
# Option B — scale memory back down (the deps still install but
#            the worker OOMs before doing harm)
flyctl scale memory 256 --app earprint-analyzer
flyctl deploy
```

The TS / Python code is unchanged whether MIR is on or off — the
`mir_enabled()` gate handles both states cleanly, and the recommend v2
embedding pool returns [] when centroids are absent.
