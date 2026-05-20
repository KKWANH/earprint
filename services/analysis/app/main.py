"""FastAPI 진입점.

Phase 0: health check 만. 트랙 분석 엔드포인트는 Phase 2~3 에서 추가.
"""

from fastapi import FastAPI

app = FastAPI(title="Playlist Analyzer — Analysis Service", version="0.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
