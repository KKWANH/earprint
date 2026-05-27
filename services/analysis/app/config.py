"""Settings — env vars only in production. The .env file is for local dev."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Required — set via `fly secrets set DATABASE_URL=...`
    database_url: str = ""

    # Future: set when Phase 2 ports the Gemini pipeline.
    gemini_api_key: str = ""
    gemini_model_analyze: str = "gemini-2.0-flash-lite"

    # Polling cadence — how often to scan background_jobs for work. A short
    # interval makes the service feel snappy (a Start click → first batch
    # picked up within seconds) without burning Neon connections.
    poll_interval_seconds: float = 5.0

    # Phase 1 dry-run guard. When True the polling loop only logs what it
    # *would* do without actually claiming any job — lets us deploy and
    # verify the service hits Neon before it starts moving real data.
    # Flip to false via env once the parity tests pass.
    dry_run: bool = True

    # Sentry — DSN empty means no-op. Init happens once at startup in
    # main.py. The release tag uses FLY_APP_VERSION so Sentry can group
    # errors by deployed image (Fly sets this automatically).
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.1


settings = Settings()
