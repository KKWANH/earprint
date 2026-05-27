"""Deezer search — Python port of apps/web/src/lib/deezer.ts.

Behaviour is intentionally identical: same cache key, same scoring, same
fallback chain. The `deezer_match` table is shared between this service
and the TS code, so a hit written by either runner serves both.

The single semantic addition over the TS version is that misses (artists
Deezer can't find) are also cached — without that, the same dead-end
tracks were getting re-searched on every batch.
"""

from __future__ import annotations

import asyncio
import json
import re
import urllib.parse
from typing import Any

import asyncpg
import httpx

API = "https://api.deezer.com"

# Global cap on simultaneous outbound Deezer requests across all users.
# With multi-user parallel worker ticks (asyncio.gather) and 30 parallel
# enrichTrack calls per user, unbounded concurrency would burst into 300+
# requests and trip Deezer's rate limits. ~25 keeps us comfortably under
# their unwritten ceiling while still finishing a batch in seconds.
_HTTP_SEMA = asyncio.Semaphore(25)

# Strip CJK-friendly: lowercase, drop bracketed bits, drop "feat. ...",
# collapse non-alphanumeric (keeping Hangul / Hiragana / Katakana / Han).
_norm_strip = re.compile(r"\([^)]*\)|\[[^\]]*\]")
_norm_feat = re.compile(r"\bfeat\.?.*$", re.IGNORECASE)
_norm_punct = re.compile(r"[^a-z0-9가-힣ぁ-んァ-ヶ一-龯]+", re.IGNORECASE)


def _norm(s: str) -> str:
    s = s.lower()
    s = _norm_strip.sub(" ", s)
    s = _norm_feat.sub(" ", s)
    s = _norm_punct.sub(" ", s)
    return s.strip()


def _score(a: str, b: str) -> float:
    x, y = _norm(a), _norm(b)
    if not x or not y:
        return 0.4
    if x == y:
        return 0.95
    if x in y or y in x:
        return 0.75
    return 0.5


def _year_of(date: Any) -> int | None:
    if not isinstance(date, str):
        return None
    m = re.match(r"^(\d{4})", date)
    if not m:
        return None
    y = int(m.group(1))
    # Same sanity window the TS uses — pre-1900 / far-future are garbage.
    import datetime as _dt
    if 1900 <= y <= _dt.date.today().year + 1:
        return y
    return None


EMPTY: dict[str, Any] = {
    "deezerId": None,
    "artistId": None,
    "artistName": None,
    "album": None,
    "coverUrl": None,
    "previewUrl": None,
    "releaseYear": None,
    "rank": None,
    "matchConfidence": 0,
}


class Deezer:
    """Async Deezer client with Neon-backed caching + the same scoring as TS."""

    def __init__(self, http: httpx.AsyncClient, pool: asyncpg.Pool) -> None:
        self.http = http
        self.pool = pool

    async def search(
        self, artist: str, title: str, *, with_year: bool = True,
    ) -> dict[str, Any]:
        cache_key = f"{artist.lower().strip()}|{title.lower().strip()}"

        # 1. Cache lookup — both hits and misses are cached now, so this is
        #    the fast path for ~95% of tracks once the service has been
        #    running for a while.
        async with self.pool.acquire() as conn:
            try:
                row = await conn.fetchrow(
                    "SELECT payload FROM deezer_match WHERE cache_key = $1",
                    cache_key,
                )
                if row is not None:
                    payload = row["payload"]
                    if isinstance(payload, str):
                        payload = json.loads(payload)
                    return payload
            except Exception:
                pass  # cache outage → live lookup

        # 2. Advanced query first (artist + track field separators give
        #    Deezer the best chance to disambiguate).
        clean_title = _norm(title) or title
        advanced = f'artist:"{artist.replace(chr(34), "")}" track:"{clean_title}"'
        data = await self._search_raw(advanced)
        hit = (data.get("data") or [None])[0] if data else None

        if not hit:
            data = await self._search_raw(f"{artist} {title}")
            hit = (data.get("data") or [None])[0] if data else None

        if not hit:
            await self._cache(cache_key, EMPTY)
            return EMPTY

        release_year: int | None = None
        if with_year and hit.get("id"):
            try:
                track = await self._get_json(f"{API}/track/{hit['id']}")
                release_year = _year_of((track or {}).get("release_date")) or _year_of(
                    ((track or {}).get("album") or {}).get("release_date"),
                )
            except Exception:
                pass  # year stays None

        artist_obj = hit.get("artist") or {}
        album_obj = hit.get("album") or {}
        result = {
            "deezerId": hit.get("id"),
            "artistId": artist_obj.get("id") if isinstance(artist_obj.get("id"), int) else None,
            "artistName": artist_obj.get("name") if isinstance(artist_obj.get("name"), str) else None,
            "album": album_obj.get("title"),
            "coverUrl": album_obj.get("cover_big") or album_obj.get("cover_medium"),
            "previewUrl": hit.get("preview") or None,
            "releaseYear": release_year,
            "rank": hit["rank"] if isinstance(hit.get("rank"), int) else None,
            "matchConfidence": _score(title, hit.get("title") or ""),
        }
        await self._cache(cache_key, result)
        return result

    async def _search_raw(self, q: str) -> dict[str, Any] | None:
        return await self._get_json(
            f"{API}/search?q={urllib.parse.quote(q)}&limit=1",
        )

    async def _get_json(self, url: str, timeout: float = 6.0) -> dict[str, Any] | None:
        """Fetch JSON, returning None on any failure or top-level `error`.

        Guarded by the module-level `_HTTP_SEMA` so the global Deezer call
        rate stays bounded even under high user concurrency."""
        try:
            async with _HTTP_SEMA:
                r = await self.http.get(url, timeout=timeout)
            if r.status_code >= 400:
                return None
            data = r.json()
            if isinstance(data, dict) and data.get("error"):
                return None
            return data
        except Exception:
            return None

    async def _cache(self, key: str, payload: dict[str, Any]) -> None:
        async with self.pool.acquire() as conn:
            try:
                await conn.execute(
                    """
                    INSERT INTO deezer_match (cache_key, payload)
                    VALUES ($1, $2::jsonb)
                    ON CONFLICT (cache_key) DO NOTHING
                    """,
                    key,
                    json.dumps(payload),
                )
            except Exception:
                pass  # caching is best-effort
