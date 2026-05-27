"""Gemini daily-cap counter + whitelist — mirrors apps/web/src/lib/usage.ts.

Reads/writes the same `api_usage` and `app_whitelist` tables the TS code
already uses, so both runners can be live during the cutover window.
"""

from __future__ import annotations

import asyncpg

GEMINI_DAILY_CAP = 3000
GEMINI_CAP_ERROR = "GEMINI_DAILY_CAP"


class GeminiCapped(Exception):
    """Raised when today's global Gemini budget is exhausted.

    String includes the magic token so callers (and the legacy TS
    `batchOrCap`) can match on `str(e).contains("GEMINI_DAILY_CAP")`."""

    def __init__(self) -> None:
        super().__init__(GEMINI_CAP_ERROR)


async def over_cap(conn: asyncpg.Connection) -> bool:
    """True once today's paid-Gemini budget is gone. Never blocks on errors."""
    try:
        row = await conn.fetchrow(
            "SELECT count FROM api_usage WHERE day = current_date AND kind = 'gemini'",
        )
        return row is not None and row["count"] >= GEMINI_DAILY_CAP
    except Exception:
        return False  # counter outage shouldn't take the worker down


async def record_gemini(conn: asyncpg.Connection) -> None:
    """Increment today's Gemini call counter. Best-effort."""
    try:
        await conn.execute(
            """
            INSERT INTO api_usage (day, kind, count) VALUES (current_date, 'gemini', 1)
            ON CONFLICT (day, kind) DO UPDATE SET count = api_usage.count + 1
            """,
        )
    except Exception:
        pass


async def is_whitelisted(conn: asyncpg.Connection, user_id: str) -> bool:
    """Whitelisted users bypass the daily cap entirely."""
    try:
        row = await conn.fetchrow(
            """
            SELECT 1 FROM app_whitelist w
            JOIN users u ON lower(u.email) = w.email
            WHERE u.id = $1
            """,
            user_id,
        )
        return row is not None
    except Exception:
        return False
