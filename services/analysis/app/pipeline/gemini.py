"""Gemini structured-output client — Python port of apps/web/src/lib/gemini.ts.

The two changes worth noting vs the TS version:
 1. We use the same daily-cap counter (api_usage table) so both TS Worker
    and Fly worker debit one global budget — no double-spend at cutover.
 2. Unparseable / schema-failing responses bubble back as a special
    exception class so the caller can decide policy. The current policy
    (see enricher.ai_analyze_batch) is "return defaults, mark tracks done"
    — same behaviour as the recent TS fix for the 98%-stuck loop.
"""

from __future__ import annotations

import asyncpg
import httpx

from app.pipeline.usage import GeminiCapped, over_cap, record_gemini

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiSchemaError(Exception):
    """Gemini returned 200 but the JSON didn't fit `responseSchema`."""


class GeminiError(Exception):
    """Any other failure — non-2xx, network blip, empty body."""


class Gemini:
    def __init__(
        self,
        http: httpx.AsyncClient,
        pool: asyncpg.Pool,
        *,
        api_key: str,
    ) -> None:
        self.http = http
        self.pool = pool
        self.api_key = api_key

    async def generate_json(
        self,
        prompt: str,
        schema: dict,
        *,
        model: str,
        bypass_cap: bool = False,
        temperature: float = 0.85,
    ) -> dict:
        if not self.api_key:
            raise GeminiError("GEMINI_API_KEY not set")

        if not bypass_cap:
            async with self.pool.acquire() as conn:
                if await over_cap(conn):
                    raise GeminiCapped()

        async with self.pool.acquire() as conn:
            await record_gemini(conn)

        try:
            r = await self.http.post(
                f"{ENDPOINT}/{model}:generateContent?key={self.api_key}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "responseSchema": schema,
                        "temperature": temperature,
                    },
                },
                timeout=60.0,
            )
        except Exception as e:
            raise GeminiError(f"network: {e}") from e

        if r.status_code >= 400:
            raise GeminiError(f"Gemini {r.status_code}: {r.text[:300]}")

        data = r.json()
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError) as e:
            raise GeminiSchemaError(f"missing candidates.parts.text: {e}") from e

        try:
            import json as _json
            return _json.loads(text)
        except Exception as e:
            raise GeminiSchemaError(f"non-JSON response: {e}") from e
