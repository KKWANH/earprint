# Analysis Service

트랙 정규화 → 외부 API 메타데이터 보강 → MIR(오디오 특성 추론) 파이프라인.

## 실행

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e .            # 코어만
pip install -e ".[mir]"     # MIR(Essentia/librosa)까지 — Phase 3

uvicorn app.main:app --reload      # API 서버 (:8000)
rq worker analysis --url $REDIS_URL # 분석 워커 (Phase 3)
```

## 구조

```
app/
  main.py            FastAPI 진입점 (health 등)
  config.py          환경설정 (pydantic-settings)
  schemas.py         API 스키마 (packages/shared 타입과 대응)
  pipeline/
    resolver.py      트랙 정규화/매칭        (Phase 2)
    enricher.py      Deezer/Last.fm/MB 보강  (Phase 2)
    mir.py           Essentia/librosa 추론   (Phase 3)
  worker.py          RQ 작업 함수             (Phase 3)
```
