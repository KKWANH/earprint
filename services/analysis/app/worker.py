"""RQ 작업 함수 — 트랙 분석 파이프라인 실행.

실행: rq worker analysis --url $REDIS_URL
Phase 3 에서 resolver → enricher → mir 를 연결한다.
"""

from app.schemas import AnalysisResult


def analyze_track_job(track_id: str, artist: str, title: str) -> AnalysisResult:
    """큐에서 꺼낸 트랙 하나를 끝까지 분석한다."""
    raise NotImplementedError("Phase 3: analyze_track_job")
