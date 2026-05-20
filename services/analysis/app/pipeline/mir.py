"""MIR — 30초 미리듣기 클립에서 오디오 특성 추론.

Phase 3 구현 예정 (Essentia + librosa, CPU):
 - BPM/tempo, Key/Scale, time signature
 - Mood / Genre / Instrument 멀티라벨 분류
 - danceability, valence, arousal, voice/instrumental
 - 임베딩 벡터(Discogs-EffNet) — music-map / 유사도용
오디오는 추론 후 즉시 폐기, 특성·임베딩만 반환한다.
"""

from app.schemas import AnalysisResult


async def analyze(track_id: str, audio_path: str) -> AnalysisResult:
    """미리듣기 오디오 파일을 분석해 특성 결과를 반환한다."""
    raise NotImplementedError("Phase 3: MIR")
