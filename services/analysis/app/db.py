"""Neon Postgres connection pool — asyncpg, long-lived.

Unlike the Next.js app (which uses @neondatabase/serverless over WebSockets to
work inside Cloudflare Workers), this is a regular long-running Python service
so we just open a normal TCP pool. Neon accepts both.

Pool size is small on purpose — the polling loop only runs one transaction at
a time today. We'll size it up when we add concurrent user processing.
"""

from __future__ import annotations

import asyncpg

from app.config import settings

_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    """Open the connection pool. Called once at app startup."""
    global _pool
    if _pool is not None:
        return
    _pool = await asyncpg.create_pool(
        settings.database_url,
        min_size=1,
        # Sized for ~10 concurrent users (worker tick LIMIT) plus a couple
        # of slots for the FastAPI HTTP surface. Neon free tier allows
        # 100 conns total so this leaves headroom for the Workers cron.
        max_size=10,
        # Neon scales to zero — let asyncpg open conns lazily without
        # blocking startup if the project is cold.
        timeout=10.0,
        command_timeout=30.0,
    )


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def pool() -> asyncpg.Pool:
    """Return the live pool. Raises if init_pool() wasn't awaited yet."""
    if _pool is None:
        raise RuntimeError("DB pool not initialised — call init_pool() first")
    return _pool
