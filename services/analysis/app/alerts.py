"""Slack/Discord-compatible webhook alerts, with tag-based routing.

Sentry has its own alert rules (configured in the project UI), but those
fire from Sentry's side and need their own integration setup. This module
ships short messages directly from the worker so we can wire Discord
channels without touching Sentry — and so we get alerts even when Sentry
itself is down.

Routing config lives in env var `ALERT_WEBHOOK_ROUTES` as JSON:
    {"analyzer.": "https://discord.com/.../engineering",
     "payments":  "https://discord.com/.../ops",
     "*":         "https://discord.com/.../general"}

Keys are tag prefixes matched left-anchored; "*" is the catch-all.
Legacy `ALERT_WEBHOOK_URL` (single URL) is still honoured when
`ALERT_WEBHOOK_ROUTES` isn't set. Both Slack and Discord accept a JSON
POST with a `content` (Discord) and `text` (Slack) field; we send both
and let the receiver pick.

Empty env → no-op, safe to leave in everywhere.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Iterable

import httpx

log = logging.getLogger(__name__)


def _parse_routes() -> list[tuple[str, str]] | None:
    raw = os.environ.get("ALERT_WEBHOOK_ROUTES", "").strip()
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            return None
        # Longest prefix first so "analyzer.upload" beats "analyzer." when
        # both are configured.
        return sorted(
            ((str(k), str(v)) for k, v in parsed.items()),
            key=lambda kv: -len(kv[0]),
        )
    except Exception:
        return None


_ROUTES: list[tuple[str, str]] | None = _parse_routes()
_DEFAULT_URL = os.environ.get("ALERT_WEBHOOK_URL", "").strip()


def _resolve(tag: str | None) -> str:
    if _ROUTES:
        t = tag or ""
        for prefix, url in _ROUTES:
            if prefix == "*":
                continue
            if t.startswith(prefix):
                return url
        for prefix, url in _ROUTES:
            if prefix == "*":
                return url
    return _DEFAULT_URL


async def send_alert(message: str, tag: str | None = None) -> None:
    """Fire a short message to the matching alert webhook. Best-effort,
    swallows every failure so a Discord outage can't take the worker down."""
    url = _resolve(tag)
    if not url:
        return
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                url,
                json={"content": message, "text": message},
            )
    except Exception as e:
        log.warning("alert webhook failed: %s", e)


def send_alert_sync(message: str, tag: str | None = None) -> None:
    """Sync wrapper that schedules `send_alert` on the running loop.

    Use from sync callbacks where awaiting isn't an option (Sentry
    `before_send` hooks, for example). When called outside an asyncio
    context the message is dropped — that's deliberate: alerts in tests
    or scripts aren't useful."""
    if not _resolve(tag):
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(send_alert(message, tag))


# Suppress unused-import warning for typing-only consumers.
_ = Iterable
