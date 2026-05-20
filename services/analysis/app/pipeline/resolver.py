"""트랙 정규화 — '아티스트 - 제목'을 canonical 트랙으로 매칭.

Phase 2 구현 예정:
 - Deezer / MusicBrainz 검색 + 퍼지 매칭
 - MBID 부여, match_confidence 산출
 - 리믹스/라이브 버전 처리
"""

from app.schemas import TrackResolution


async def resolve(artist: str, title: str) -> TrackResolution:
    """원본 아티스트/제목을 canonical 트랙으로 해석한다."""
    raise NotImplementedError("Phase 2: resolver")
