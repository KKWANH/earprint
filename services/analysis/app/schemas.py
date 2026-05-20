"""API 스키마 — packages/shared/src/types.ts 와 대응."""

from __future__ import annotations

from pydantic import BaseModel


class CapturedTrack(BaseModel):
    """확장이 수집한 원본 트랙."""

    video_id: str
    title: str
    artist: str
    album: str | None = None
    duration_ms: int | None = None
    liked_at: str | None = None


class TrackResolution(BaseModel):
    """resolver 출력 — canonical 트랙 매칭 결과."""

    mbid: str | None = None
    deezer_id: int | None = None
    isrc: str | None = None
    title: str
    artist: str
    album: str | None = None
    duration_ms: int | None = None
    match_confidence: float = 0.0


class AnalysisResult(BaseModel):
    """트랙별 특성 분석 결과 — analysis 테이블과 대응."""

    track_id: str
    analysis_version: int = 1
    bpm: float | None = None
    music_key: str | None = None
    music_scale: str | None = None
    time_signature: str | None = None
    genres: dict[str, float] | None = None
    moods: dict[str, float] | None = None
    instruments: dict[str, float] | None = None
    danceability: float | None = None
    valence: float | None = None
    arousal: float | None = None
    voice_instrumental: str | None = None
    confidence: dict[str, float] | None = None
    source_flags: dict[str, str] | None = None
