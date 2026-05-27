# Earprint analyzer — Python 3.12 + uv for fast installs.
# Built once per deploy, runs forever as a Fly.io machine.

FROM python:3.12-slim AS runtime

# uv is dramatically faster than pip for resolution+install (~10× on cold
# layer rebuilds) and writes a tighter site-packages tree. Pin a known
# version so deploys are reproducible.
ENV UV_VERSION=0.5.11
RUN pip install --no-cache-dir "uv==${UV_VERSION}"

WORKDIR /app

# Copy only the manifest first so the layer cache can short-circuit when
# only source files change.
COPY pyproject.toml ./
RUN uv pip install --system --no-cache .

COPY app/ ./app/

# ─────────────────────────────────────────────────────────────────────
# MIR Phase 5 — opt-in layer.
# Activate with `flyctl deploy --build-arg ENABLE_MIR=true`. Adds ~1.3 GB
# to the image (ffmpeg + tensorflow + essentia + 6 model files) so the
# default off path keeps Fly cold-starts fast for the 95% of deploys
# that don't need MIR. The `mir_enabled()` Python gate also short-
# circuits at runtime even when the layer IS built — it checks for the
# model file's presence — so a build-without-models still boots cleanly.
# ─────────────────────────────────────────────────────────────────────
ARG ENABLE_MIR=false
ARG MIR_MODEL_BUCKET=https://earprint-models.example.r2.dev

RUN if [ "$ENABLE_MIR" = "true" ]; then \
      apt-get update && apt-get install -y --no-install-recommends ffmpeg \
        && rm -rf /var/lib/apt/lists/* && \
      uv pip install --system --no-cache ".[mir]" && \
      mkdir -p /app/models/heads && \
      for f in \
          discogs-effnet-bs64-1.pb \
          heads/mood_happy-discogs-effnet-1.pb \
          heads/mood_sad-discogs-effnet-1.pb \
          heads/mood_aggressive-discogs-effnet-1.pb \
          heads/mood_relaxed-discogs-effnet-1.pb \
          heads/voice_instrumental-discogs-effnet-1.pb ; do \
        echo "↓ $f" && \
        curl -fsSL "$MIR_MODEL_BUCKET/$(basename $f)" -o "/app/models/$f" ; \
      done ; \
    else \
      echo "MIR layer skipped (set --build-arg ENABLE_MIR=true to enable)" ; \
    fi

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

EXPOSE 8080

# Single uvicorn process — the polling loop runs as an asyncio task inside
# the same process via FastAPI's lifespan, so we don't need a separate
# worker container. One process keeps the Neon pool small and shared.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--log-level", "info"]
