"""외부 API 메타데이터 보강.

Phase 2 구현 예정:
 - Deezer: 장르 · bpm · gain · 30초 미리듣기 URL
 - Last.fm: 무드/장르 태그 · 유사곡
 - MusicBrainz: 악기/연주자 크레딧
 - rate-limit 은 Redis 토큰버킷으로 전역 관리
"""

from app.schemas import TrackResolution


async def enrich(track: TrackResolution) -> dict[str, object]:
    """canonical 트랙에 외부 API 메타데이터를 덧붙인다."""
    raise NotImplementedError("Phase 2: enricher")
