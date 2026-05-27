"""FastAPI entry point + worker lifecycle.

The HTTP surface is intentionally tiny — Fly.io and we use it only for
liveness probes. The real work is the background polling task started in
the lifespan handler.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from app.config import settings
from app.db import close_pool, init_pool
from app.worker import poll_loop

# Structured-ish logs that Fly captures cleanly. INFO is the default; bump
# to DEBUG via LOG_LEVEL=debug for verbose troubleshooting.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
log = logging.getLogger("analyzer")

# Sentry — initialised at module load (before the FastAPI app is built) so
# the SDK can hook into asyncio + httpx + asyncpg via its default auto-
# instrumentation. The DSN being empty makes init() a no-op, so this is
# safe to leave in regardless of whether Sentry is configured.
if settings.sentry_dsn:
    import os
    import sentry_sdk
    from sentry_sdk.integrations.asyncio import AsyncioIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        environment=os.environ.get("FLY_APP_NAME", "local"),
        release=os.environ.get("FLY_IMAGE_REF") or os.environ.get("FLY_RELEASE_VERSION"),
        integrations=[AsyncioIntegration()],
        # Don't capture PII from request payloads — we're running on user
        # library data and the GDPR consent doesn't extend to Sentry.
        send_default_pii=False,
    )
    log.info("sentry initialised (env=%s)", os.environ.get("FLY_APP_NAME", "local"))


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Open the DB pool, kick the background worker, wait for shutdown."""
    await init_pool()
    log.info("DB pool ready")
    task = asyncio.create_task(poll_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        await close_pool()
        log.info("shutdown complete")


app = FastAPI(
    title="Earprint Analysis Service",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Used by Fly's healthcheck and for quick smoke tests."""
    return {"status": "ok"}
