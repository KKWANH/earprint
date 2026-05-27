"""Background polling worker — Phase 2: runs real batches.

One asyncio task started by main.py's lifespan. Every
`POLL_INTERVAL_SECONDS` it scans `background_jobs` for analyze rows the
web app marked `status='running'`, picks one tick of work for each, and
writes results through the same Postgres SQL functions the TS code uses
(no schema drift possible).

We intentionally do NOT mark jobs `done` here — the Workers cron in
`apps/web/src/app/api/cron/tick/route.ts` still owns the
`isComplete → finishJob → send completion email` path because the Resend
integration lives there. Splitting just the heavy batch work is enough
to escape the Workers 50-subrequest cap, which is the whole point of
Phase 2. Workers can be told to stop running batches once we've watched
this service handle a real load (Phase 4).
"""

from __future__ import annotations

import asyncio
import logging

import httpx

from app.alerts import send_alert
from app.config import settings
from app.db import pool
from app.pipeline import mir as mir_module
from app.pipeline.deezer import Deezer
from app.pipeline.enricher import ai_analyze_batch, enrich_batch, mir_batch
from app.pipeline.gemini import Gemini
from app.pipeline.usage import GeminiCapped, is_whitelisted

log = logging.getLogger(__name__)


async def poll_loop() -> None:
    """Forever loop — runs as a background asyncio task off FastAPI startup."""
    log.info(
        "analyzer worker starting (interval=%ss, dry_run=%s)",
        settings.poll_interval_seconds,
        settings.dry_run,
    )
    # Reusable httpx client — connection pooling matters at Deezer's
    # rate-limit boundary, and lets us share the HTTP/2 channel.
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(60.0, connect=10.0),
        limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
    ) as http:
        deezer = Deezer(http, pool())
        gemini = Gemini(http, pool(), api_key=settings.gemini_api_key)

        while True:
            try:
                await tick(deezer, gemini)
            except asyncio.CancelledError:
                log.info("analyzer worker stopping")
                raise
            except Exception:
                log.exception("tick failed; retrying after interval")
            await asyncio.sleep(settings.poll_interval_seconds)


async def tick(deezer: Deezer, gemini: Gemini) -> None:
    """One polling pass — find running jobs and advance each by one batch.

    Users are processed in parallel with `asyncio.gather`. The Postgres
    pool and Deezer concurrency semaphore are sized so 10 simultaneous
    users stay within Neon's connection budget and Deezer's rate limits.
    """
    async with pool().acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT user_id::text AS user_id FROM background_jobs
            WHERE kind = 'analyze' AND status = 'running'
            ORDER BY updated_at ASC
            LIMIT 10
            """,
        )

    if not rows:
        log.debug("no running jobs")
        return

    await asyncio.gather(
        *[_process_user_safe(deezer, gemini, r["user_id"]) for r in rows],
        return_exceptions=False,
    )


async def _process_user_safe(
    deezer: Deezer, gemini: Gemini, user_id: str,
) -> None:
    """`_process_user` wrapper that contains exceptions per user so one
    user's failure doesn't take the whole gather() down."""
    try:
        await _process_user(deezer, gemini, user_id)
    except GeminiCapped:
        log.warning("user=%s parked on Gemini daily cap", user_id)
        # Leave status='running' — Workers cron will resume tomorrow.
    except Exception as e:
        log.exception("user=%s tick failed", user_id)
        # Mirror the Workers-side Sentry capture so persistent failures
        # surface even though we swallow them per-user. Wrapped in try
        # so an unreachable Sentry can't kill the worker itself.
        try:
            import sentry_sdk
            sentry_sdk.set_tag("source", "analyzer.tick")
            sentry_sdk.set_user({"id": user_id})
            sentry_sdk.capture_exception(e)
        except Exception:
            pass
        # Also fire a direct webhook alert for the same reason — Sentry
        # alert routing isn't always set up, and Discord/Slack is
        # immediate feedback while iterating on the worker.
        await send_alert(
            f"🚨 analyzer.tick — user={user_id[:8]} {type(e).__name__}: {str(e)[:160]}",
            tag="analyzer.tick",
        )


async def _process_user(deezer: Deezer, gemini: Gemini, user_id: str) -> None:
    """One batch of work for one user — whichever phase still has work.

    Phase priority is enrich → ai → mir → done. MIR is only considered
    when mir_enabled() is True; on machines without the [mir] extras or
    model weights, that branch is short-circuited and the user is
    treated as done after AI completes.
    """
    mir_on = mir_module.mir_enabled()
    async with pool().acquire() as conn:
        phase = await conn.fetchval(
            f"""
            SELECT CASE
              WHEN sum(CASE WHEN a.id IS NULL THEN 1 ELSE 0 END) > 0 THEN 'enrich'
              WHEN sum(CASE WHEN a.id IS NOT NULL AND a.audio_feel IS NULL THEN 1 ELSE 0 END) > 0 THEN 'ai'
              {"WHEN sum(CASE WHEN t.preview_url IS NOT NULL AND e.track_id IS NULL THEN 1 ELSE 0 END) > 0 THEN 'mir'" if mir_on else ""}
              ELSE 'done'
            END AS phase
            FROM user_tracks ut
            LEFT JOIN tracks t ON t.id = ut.track_id
            LEFT JOIN analysis a ON a.track_id = ut.track_id AND a.analysis_version = 1
            LEFT JOIN embeddings e ON e.track_id = ut.track_id
            WHERE ut.user_id = $1::uuid
            """,
            user_id,
        )

    if phase == "done":
        # Workers cron handles the email + status transition. Touch
        # updated_at so it's clear this loop saw the job.
        await _touch_job(user_id)
        return

    if settings.dry_run:
        log.info("user=%s phase=%s (dry_run — would process)", user_id, phase)
        return

    if phase == "enrich":
        n = await enrich_batch(pool(), deezer, user_id)
        log.info("user=%s enrich → %d tracks", user_id, n)
    elif phase == "ai":
        async with pool().acquire() as conn:
            wl = await is_whitelisted(conn, user_id)
        n = await ai_analyze_batch(
            pool(), gemini, user_id,
            bypass_cap=wl, model=settings.gemini_model_analyze,
        )
        log.info("user=%s ai → %d tracks", user_id, n)
    elif phase == "mir":
        n = await mir_batch(pool(), user_id)
        log.info("user=%s mir → %d tracks", user_id, n)

    await _touch_job(user_id)


async def _touch_job(user_id: str) -> None:
    """Bump updated_at so the Workers cron and we don't race on the same
    job back-to-back. ORDER BY updated_at ASC in the SELECT above means a
    just-touched user goes to the bottom of the queue next pass."""
    async with pool().acquire() as conn:
        try:
            await conn.execute(
                "UPDATE background_jobs SET updated_at = now() WHERE user_id = $1::uuid AND kind = 'analyze'",
                user_id,
            )
        except Exception:
            pass
