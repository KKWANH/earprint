"""Phase-1 (Deezer) + Phase-2 (Gemini) batch orchestrators.

Direct port of apps/web/src/lib/jobs.ts's `runEnrichBatch` and
`runAiAnalysisBatch`. Calls the same `save_enrichments` / `save_ai_analysis`
Postgres functions that the TS code uses — no schema drift possible.

Batch sizes are intentionally larger than the TS version. Workers' 50-
subrequest cap forced ENRICH_BATCH=8; running outside Workers we can
parallel 30+ Deezer calls per tick. Gemini still gets 80 tracks per call
(one outbound request regardless of size — the cap never applied here).
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import asyncpg
from pydantic import BaseModel, Field, ValidationError

from app.pipeline import mir as mir_module
from app.pipeline.deezer import Deezer
from app.pipeline.gemini import Gemini, GeminiCapped, GeminiError, GeminiSchemaError

log = logging.getLogger(__name__)

ENRICH_BATCH = 30  # ~30 parallel Deezer searches per tick (no Workers cap here)
AI_BATCH = 80     # one Gemini call covers the whole batch
MIR_BATCH = 4     # sequential — Essentia inference is CPU-bound and ~600ms/track


# ─────────────────────────────────────────────────────────────────────────
# Phase 1 — Deezer enrichment
# ─────────────────────────────────────────────────────────────────────────


async def enrich_batch(
    pool: asyncpg.Pool,
    deezer: Deezer,
    user_id: str,
) -> int:
    """One Deezer batch for the given user. Returns tracks processed (0 = done)."""
    async with pool.acquire() as conn:
        batch = await conn.fetch(
            """
            SELECT t.id::text AS id, t.title, t.artist
            FROM user_tracks ut
            JOIN tracks t ON t.id = ut.track_id
            LEFT JOIN analysis a ON a.track_id = t.id AND a.analysis_version = 1
            WHERE ut.user_id = $1::uuid AND a.id IS NULL
            LIMIT $2
            """,
            user_id,
            ENRICH_BATCH,
        )

    if not batch:
        return 0

    # Parallel Deezer lookups — `gather` runs them concurrently. The cache
    # writes inside Deezer.search serialise on the pool but that's fine.
    enrichments = await asyncio.gather(
        *[
            _enrich_one(deezer, row["id"], row["artist"], row["title"])
            for row in batch
        ],
        return_exceptions=False,
    )

    async with pool.acquire() as conn:
        await conn.execute(
            "SELECT save_enrichments($1::jsonb)",
            json.dumps(enrichments),
        )
    return len(batch)


async def _enrich_one(
    deezer: Deezer, track_id: str, artist: str, title: str,
) -> dict[str, Any]:
    """One track → one save_enrichments input row. Matches the TS shape exactly."""
    d = await deezer.search(artist, title)
    return {
        "trackId": track_id,
        "deezerId": d.get("deezerId"),
        "deezerArtistId": d.get("artistId"),
        "deezerArtistName": d.get("artistName"),
        "album": d.get("album"),
        "previewUrl": d.get("previewUrl"),
        "releaseYear": d.get("releaseYear"),
        "rank": d.get("rank"),
        # bpm / genres / moods stay null at this stage — Gemini fills them.
        "bpm": None,
        "genres": None,
        "moods": None,
        "matchConfidence": d.get("matchConfidence"),
    }


# ─────────────────────────────────────────────────────────────────────────
# Phase 2 — Gemini analysis
# ─────────────────────────────────────────────────────────────────────────


_GEMINI_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "results": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "id": {"type": "STRING"},
                    "genres": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "moods": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "energy": {"type": "NUMBER"},
                    "tempo": {"type": "NUMBER"},
                    "acousticness": {"type": "NUMBER"},
                    "instruments": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "realArtist": {"type": "STRING"},
                    "realTitle": {"type": "STRING"},
                },
                "required": [
                    "id", "genres", "moods", "energy", "tempo", "acousticness",
                    "instruments", "realArtist", "realTitle",
                ],
            },
        },
    },
    "required": ["results"],
}


# Korean prompt — identical to apps/web/src/lib/aiAnalyze.ts so the model
# output distribution stays the same.
_PROMPT_TEMPLATE = """다음 곡들을 너의 음악 지식으로 분석해라. 각 곡마다:
- genres: 이 곡·앨범의 실제 특성을 반영한 구체적 장르 2~5개. 아티스트의 일반 장르로 뭉뚱그리지 말고 해당 곡/앨범 단위로, 하위장르까지 (예: shoegaze, dream pop, city pop, bedroom pop, post-rock, neo-soul). 영문 소문자.
- moods: 정서 1~3개 (영문 소문자: melancholic, dreamy, energetic 등).
- energy: 0(차분·조용) ~ 1(격렬·시끄러움)
- tempo: 0(느림) ~ 1(빠름)
- acousticness: 0(전자음 중심) ~ 1(어쿠스틱·생악기 중심)
- instruments: 두드러진 악기·음색 2~4개 (영문 소문자)
- artist 가 실제 가수·밴드가 아니라 유튜브 채널·모음·커버 계정으로 보이면 title 에서
  realArtist 와 realTitle 을 추출. 올바른 아티스트면 둘 다 빈 문자열("").
- 정말 모르는 곡은 genres·moods 를 빈 배열, 수치는 0.5 근처로.
- id 는 입력 대괄호 안 값을 그대로 사용.

{list}"""


class _Row(BaseModel):
    """Per-track Gemini output. Defaults absorb missing fields gracefully."""

    id: str
    genres: list[Any] = Field(default_factory=list)
    moods: list[Any] = Field(default_factory=list)
    energy: float = 0.5
    tempo: float = 0.5
    acousticness: float = 0.5
    instruments: list[Any] = Field(default_factory=list)
    realArtist: str = ""
    realTitle: str = ""


class _Batch(BaseModel):
    results: list[_Row] = Field(default_factory=list)


def _to_obj(arr: list[Any], max_len: int) -> dict[str, int]:
    out: dict[str, int] = {}
    for x in arr or []:
        k = str(x or "").lower().strip()
        if k and len(k) <= max_len:
            out[k] = 1
    return out


def _clamp01(n: Any) -> float:
    try:
        v = float(n)
    except (TypeError, ValueError):
        return 0.5
    if v != v:  # NaN
        return 0.5
    return max(0.0, min(1.0, v))


async def ai_analyze_batch(
    pool: asyncpg.Pool,
    gemini: Gemini,
    user_id: str,
    *,
    bypass_cap: bool,
    model: str,
) -> int:
    """One Gemini batch for the user. Returns tracks processed (0 = done)."""
    async with pool.acquire() as conn:
        batch = await conn.fetch(
            """
            SELECT t.id::text AS id, t.title, t.artist
            FROM analysis a
            JOIN user_tracks ut ON ut.track_id = a.track_id
            JOIN tracks t ON t.id = a.track_id
            WHERE ut.user_id = $1::uuid
              AND a.analysis_version = 1
              AND a.audio_feel IS NULL
            LIMIT $2
            """,
            user_id,
            AI_BATCH,
        )

    if not batch:
        return 0

    track_list = "\n".join(
        f"[{r['id']}] {r['artist']} — {r['title']}" for r in batch
    )
    prompt = _PROMPT_TEMPLATE.format(list=track_list)

    rows = await _call_gemini(
        gemini, prompt, [(r["id"], r["artist"], r["title"]) for r in batch],
        bypass_cap=bypass_cap, model=model,
    )

    async with pool.acquire() as conn:
        await conn.execute(
            "SELECT save_ai_analysis($1::jsonb)",
            json.dumps(rows),
        )
    return len(batch)


async def _call_gemini(
    gemini: Gemini,
    prompt: str,
    tracks: list[tuple[str, str, str]],
    *,
    bypass_cap: bool,
    model: str,
) -> list[dict[str, Any]]:
    """Run Gemini + map outputs back to track IDs, with defaults on failure.

    Matches the TS aiAnalyzeBatch resilience policy (post the 98%-stuck
    fix): any unrecoverable Gemini failure other than the daily-cap
    becomes a default-filled row so save_ai_analysis stamps audio_feel
    and the track exits the analyse queue."""
    try:
        raw = await gemini.generate_json(
            prompt, _GEMINI_SCHEMA, model=model, bypass_cap=bypass_cap,
        )
    except GeminiCapped:
        raise  # propagate — the worker parks the user until tomorrow
    except (GeminiError, GeminiSchemaError) as e:
        log.warning("gemini call failed; using defaults: %s", e)
        return [_empty_row(t_id) for t_id, _, _ in tracks]

    try:
        validated = _Batch.model_validate(raw)
    except ValidationError as e:
        log.warning("gemini schema mismatch; using defaults: %s", e)
        return [_empty_row(t_id, schema_failed=True) for t_id, _, _ in tracks]

    by_id = {r.id: r for r in validated.results}
    return [_row_to_save(t_id, by_id.get(t_id)) for t_id, _, _ in tracks]


def _row_to_save(track_id: str, r: _Row | None) -> dict[str, Any]:
    if r is None:
        return _empty_row(track_id)
    instruments = [
        str(x or "").lower().strip()
        for x in (r.instruments or [])
    ]
    instruments = [x for x in instruments if x and len(x) <= 24][:4]
    return {
        "trackId": track_id,
        "genres": _to_obj(r.genres, 28),
        "moods": _to_obj(r.moods, 20),
        "audioFeel": {
            "energy": _clamp01(r.energy),
            "tempo": _clamp01(r.tempo),
            "acousticness": _clamp01(r.acousticness),
            "instruments": instruments,
        },
        "realArtist": r.realArtist.strip() if isinstance(r.realArtist, str) else "",
        "realTitle": r.realTitle.strip() if isinstance(r.realTitle, str) else "",
    }


# ─────────────────────────────────────────────────────────────────────────
# Phase 3 — MIR (Essentia + Discogs-EffNet)
# ─────────────────────────────────────────────────────────────────────────


async def mir_batch(pool: asyncpg.Pool, user_id: str) -> int:
    """One MIR batch for the user — downloads previews, runs Essentia +
    Discogs-EffNet, writes via save_mir_analysis. Returns rows processed.

    No-op (returns 0) when mir.mir_enabled() is False, which lets the
    same image run on Fly machines that don't have the [mir] extras or
    model weights yet. The worker dispatcher reads this 0 and skips the
    user's MIR phase, falling through to whichever phase is next."""
    if not mir_module.mir_enabled():
        return 0

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT t.id::text AS id, t.preview_url
            FROM user_tracks ut
            JOIN tracks t ON t.id = ut.track_id
            LEFT JOIN embeddings e ON e.track_id = t.id
            WHERE ut.user_id = $1::uuid
              AND t.preview_url IS NOT NULL
              AND e.track_id IS NULL
            LIMIT $2
            """,
            user_id,
            MIR_BATCH,
        )
    if not rows:
        return 0

    # Sequential — Essentia / TF is CPU-bound and a single track already
    # pegs one core for ~1.5 s. Running them in parallel just thrashes.
    results: list[dict[str, Any]] = []
    for r in rows:
        out = await mir_module.analyze_track(r["preview_url"], r["id"])
        if out is not None:
            results.append(out)

    if not results:
        # Every track in this batch failed (network blip / bad preview).
        # Return the row count so the worker still bumps updated_at and
        # the same batch doesn't dominate the next tick.
        return len(rows)

    async with pool.acquire() as conn:
        await conn.execute(
            "SELECT save_mir_analysis($1::jsonb)",
            json.dumps(results),
        )
    # Recompute the taste centroid so the recommendation embedding pool
    # picks up this user's preferences right away. Weighted version (this
    # function) replaces the older SQL `update_taste_centroid` — pgvector
    # scalar multiplication semantics vary by version, but NumPy gets it
    # right consistently and we already have numpy in the MIR extras.
    await _refresh_weighted_centroid(pool, user_id)
    return len(rows)


async def _refresh_weighted_centroid(
    pool: asyncpg.Pool, user_id: str,
) -> None:
    """Recompute taste_profiles.centroid as a recency-weighted mean of
    the user's track embeddings.

    Recent likes (low list_position) get higher weight per the
    `recency_weight()` SQL function — same curve used by topArtists and
    recommend seeds, so "current taste" is consistent across surfaces.
    Falls back to a plain mean when numpy isn't installed (worker is
    running without the [mir] extras yet)."""
    try:
        import numpy as np
    except ImportError:
        # No numpy → defer to the SQL function (unweighted). It's still
        # better than no centroid at all.
        async with pool.acquire() as conn:
            await conn.execute(
                "SELECT update_taste_centroid($1::uuid)", user_id,
            )
        return

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            WITH lib_size AS (
              SELECT count(*)::int AS n FROM user_tracks WHERE user_id = $1::uuid
            )
            SELECT e.vector::text AS vec,
                   recency_weight(ut.list_position, lib_size.n)::real AS w
            FROM embeddings e
            JOIN user_tracks ut ON ut.track_id = e.track_id
            CROSS JOIN lib_size
            WHERE ut.user_id = $1::uuid
            """,
            user_id,
        )
    if not rows:
        return

    vecs = np.array([_parse_pgvector(r["vec"]) for r in rows], dtype=np.float32)
    weights = np.array([r["w"] for r in rows], dtype=np.float32)
    total = float(weights.sum())
    if total <= 0:
        return
    # Weighted column-wise mean: (N×D)^T @ (N,) / scalar → (D,)
    centroid = (vecs.T @ weights) / total

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO taste_profiles (user_id, centroid, track_count, updated_at)
            VALUES ($1::uuid, $2::text::vector, $3, now())
            ON CONFLICT (user_id) DO UPDATE SET
              centroid    = EXCLUDED.centroid,
              track_count = EXCLUDED.track_count,
              updated_at  = now()
            """,
            user_id,
            _format_pgvector(centroid),
            len(rows),
        )


def _parse_pgvector(s: str | None) -> list[float]:
    """pgvector text form: '[1.0, 2.5, …]' → list[float].

    Defensive against:
      - None input (FK guarantees non-null, but a join miss could yield it)
      - extra whitespace inside / around brackets
      - empty vector `[]`
      - scientific notation (`1e-05`) — float() handles it
    """
    if not s:
        return []
    s = s.strip()
    if s.startswith("[") and s.endswith("]"):
        # Slice instead of strip("[]") — strip treats its arg as a char
        # set, not a substring, so "[[1,2,3]]" would silently parse wrong.
        s = s[1:-1]
    inner = s.strip()
    if not inner:
        return []
    return [float(x.strip()) for x in inner.split(",") if x.strip()]


def _format_pgvector(arr: "Any") -> str:
    """numpy array → pgvector text form '[…]'."""
    return "[" + ",".join(f"{float(x):.6g}" for x in arr) + "]"


def _empty_row(track_id: str, *, schema_failed: bool = False) -> dict[str, Any]:
    """Default row used when Gemini fails — stamps audio_feel so the
    track exits the analyse queue instead of being retried forever.

    NB: we deliberately return `{}` (not `{"unknown": 1}`) for genres so
    we don't pollute any Last.fm-derived tags the enrich phase already
    wrote. The earlier version merged "unknown" in via save_ai_analysis's
    JSONB `||` operator and dominated displays for tracks that had real
    genres. `schema_failed` is kept as a parameter for future use (e.g.
    re-analyzing the marked tracks once the model improves) but, for now,
    we accept that the marker is implicit (audio_feel filled, genres
    empty == AI saw the track but couldn't extract structure).
    """
    return {
        "trackId": track_id,
        "genres": {},
        "moods": {},
        "audioFeel": {
            "energy": 0.5, "tempo": 0.5, "acousticness": 0.5, "instruments": [],
        },
        "realArtist": "",
        "realTitle": "",
    }
