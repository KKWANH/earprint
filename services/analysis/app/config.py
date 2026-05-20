"""환경설정 — 루트 .env 에서 로드."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://postgres:postgres@localhost:5432/playlist_analyzer"
    redis_url: str = "redis://localhost:6379/0"

    # 외부 음악 API (Deezer/MusicBrainz/iTunes 는 무인증)
    lastfm_api_key: str = ""
    musicbrainz_user_agent: str = "playlist-analyzer/0.1 (contact@example.com)"


settings = Settings()
