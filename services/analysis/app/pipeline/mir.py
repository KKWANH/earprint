"""MIR phase — Essentia + Discogs-EffNet feature extraction.

This module is feature-complete but only loads its heavyweight deps when
the optional `[mir]` extras are installed AND the model weights are
present on disk. Without those, every import here is wrapped in a try
and `mir_enabled()` returns False, so the worker silently skips the MIR
phase rather than crashing. That lets us deploy this code to the
existing 256 MB Fly machine without breaking anything, and turn MIR on
later by:
  1. `flyctl scale memory 1024`
  2. Rebuilding the image with `pip install -e .[mir]`
  3. Mounting the model weights at `/app/models/`

Pipeline per track (from a Deezer 30 s preview URL):
  1. Download MP3 (~600 KB)
  2. Decode to mono 16 kHz via librosa (needs ffmpeg in the container)
  3. RhythmExtractor2013 → bpm
  4. KeyExtractor → key, scale
  5. Danceability → 0..1
  6. Discogs-EffNet penultimate → 1280-d embedding (mean-pooled over time)
  7. (Future) mood + voice heads on top of the same embedding
  8. Persist via save_mir_analysis SQL function
  9. Discard audio (no storage — Deezer ToS + cost)

The model weights live in `${MIR_MODEL_DIR}` (default `/app/models/`).
Recommended source: Essentia Models zoo
  https://essentia.upf.edu/models/feature-extractors/discogs-effnet/
Plan: drop the .pb into Cloudflare R2 at build time and COPY in the
Dockerfile so cold starts don't re-download.
"""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from pathlib import Path
from typing import Any

import httpx

# Model loading is global mutable state. Without a lock, two coroutines
# entering `_load_discogs()` for the first time both see _discogs_model=None
# and both initialize the ~80 MB TF graph — wastes memory + ~3 s. The lock
# is module-scoped so a worker tick with 10 users in gather() serialises
# the first-call init across all of them. Subsequent calls hit the fast
# `is not None` path without grabbing the lock.
_load_lock = asyncio.Lock()

log = logging.getLogger(__name__)

# Lazy-import the heavy deps so importing this module on a stock machine
# (without the [mir] extras) just sets a flag instead of raising a chain
# of missing-module errors. The worker checks `mir_enabled()` before
# calling in.
try:
    import numpy as np  # type: ignore
    import librosa  # type: ignore
    from essentia.standard import (  # type: ignore
        RhythmExtractor2013,
        KeyExtractor,
        Danceability,
        TensorflowPredict2D,
        TensorflowPredictEffnetDiscogs,
    )
    _MIR_DEPS_AVAILABLE = True
except ImportError as e:
    log.info("MIR deps not present (install with `pip install -e .[mir]`): %s", e)
    _MIR_DEPS_AVAILABLE = False


def _model_dir() -> Path:
    return Path(os.environ.get("MIR_MODEL_DIR", "/app/models"))


def mir_enabled() -> bool:
    """True when both the deps and the model weights are present."""
    if not _MIR_DEPS_AVAILABLE:
        return False
    return (_model_dir() / "discogs-effnet-bs64-1.pb").exists()


# Lazy model cache — loaded on first call, kept for the process lifetime.
# TF model init takes ~3 s for the EffNet trunk; head models are tiny
# (~50 KB each) and add negligible overhead per file.
_discogs_model: Any = None
_head_models: dict[str, Any] = {}

# Head models — every file under `_model_dir()/heads/` is a TF SavedModel
# trained on top of the EffNet embedding. Skipped silently if missing,
# so the rig works whether you've downloaded one head or all of them.
_HEAD_MODEL_OUTPUT = "model/Softmax"


async def _load_discogs_async() -> Any:
    """Async wrapper around the (synchronous) TF graph load. The lock
    prevents the first-call thunder of N concurrent users all init-ing
    the same 80 MB model — only the first holder pays the ~3 s cost,
    the rest find _discogs_model already populated."""
    global _discogs_model
    if _discogs_model is not None:
        return _discogs_model
    async with _load_lock:
        # Re-check after grabbing the lock — another waiter may have
        # finished loading while we were queued.
        if _discogs_model is not None:
            return _discogs_model
        if not _MIR_DEPS_AVAILABLE:
            raise RuntimeError("MIR deps not installed")
        path = _model_dir() / "discogs-effnet-bs64-1.pb"
        if not path.exists():
            raise RuntimeError(f"missing Discogs-EffNet weights at {path}")
        # Run model construction in a thread so it doesn't block the
        # event loop for the full 3 s init — other coroutines can keep
        # running (cache reads etc.) during that window.
        _discogs_model = await asyncio.to_thread(
            TensorflowPredictEffnetDiscogs,
            graphFilename=str(path),
            output="PartitionedCall:1",
        )
        log.info("loaded Discogs-EffNet (%.1f MB)", path.stat().st_size / 1e6)
        return _discogs_model


async def _load_head_async(name: str) -> Any | None:
    """Async + locked head loader. Same rationale as _load_discogs_async
    — head models are tiny (~50 KB each) but there are 5+ of them and
    we don't want every concurrent user re-loading the set."""
    if name in _head_models:
        return _head_models[name]
    if not _MIR_DEPS_AVAILABLE:
        return None
    async with _load_lock:
        if name in _head_models:
            return _head_models[name]
        path = _model_dir() / "heads" / name
        if not path.exists():
            _head_models[name] = None
            return None
        model = await asyncio.to_thread(
            TensorflowPredict2D,
            graphFilename=str(path),
            output=_HEAD_MODEL_OUTPUT,
        )
        _head_models[name] = model
        log.info("loaded head model %s", name)
        return model


async def analyze_track(preview_url: str, track_id: str) -> dict[str, Any] | None:
    """Run the full MIR pipeline on one Deezer preview.

    Returns a dict shaped for save_mir_analysis (JSONB-serialisable), or
    None if anything in the chain fails — bad URL, decode error, model
    error. Failures are logged but never raised, so a single bad preview
    can't kill the batch.
    """
    if not mir_enabled():
        return None

    audio_bytes = await _download_preview(preview_url)
    if audio_bytes is None:
        return None

    try:
        audio = _decode(audio_bytes)
    except Exception as e:
        log.warning("decode failed for %s: %s", track_id, e)
        return None
    if audio.size == 0:
        return None

    try:
        bpm = _bpm(audio)
        key, scale = _key(audio)
        dance = _danceability(audio)
        activations = await _activations(audio)
        embedding = _pool_embedding(activations)
        valence, arousal, voice_inst = await _mood_voice(activations)
    except Exception as e:
        log.warning("MIR analysis failed for %s: %s", track_id, e)
        return None

    return {
        "trackId": track_id,
        "bpm": bpm,
        "musicKey": key,
        "musicScale": scale,
        "danceability": dance,
        "valence": valence,
        "arousal": arousal,
        "voiceInstrumental": voice_inst,
        "embedding": embedding,  # list[float], 1280-d
        "embeddingModel": "discogs-effnet",
    }


async def _download_preview(url: str) -> bytes | None:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url)
            if r.status_code != 200:
                return None
            return r.content
    except Exception:
        return None


def _decode(data: bytes) -> "np.ndarray":
    """MP3 bytes → mono 16 kHz float32 array.

    librosa can't read MP3 from a BytesIO directly (audioread needs a
    real path), so we round-trip through a temp file. Cost is ~5 ms and
    we delete on context-exit, so no disk leak.
    """
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=True) as f:
        f.write(data)
        f.flush()
        audio, _sr = librosa.load(f.name, sr=16000, mono=True)
    return audio


def _bpm(audio: "np.ndarray") -> float:
    extractor = RhythmExtractor2013(method="multifeature")
    bpm, _beats, _conf, _, _ = extractor(audio)
    return float(bpm)


def _key(audio: "np.ndarray") -> tuple[str, str]:
    # KeyExtractor returns key (e.g. "C", "F#"), scale ("major"/"minor"),
    # and a strength score we discard.
    key, scale, _strength = KeyExtractor()(audio)
    return key, scale


def _danceability(audio: "np.ndarray") -> float:
    dance, _details = Danceability()(audio)
    # Essentia's Danceability output is 0..3-ish; clip + normalise to the
    # 0..1 range our analysis.danceability column uses.
    return float(min(1.0, max(0.0, dance / 3.0)))


async def _activations(audio: "np.ndarray") -> "np.ndarray":
    """Run the EffNet trunk; returns (T, 1280) frame-wise activations.

    Pulled out as its own helper because the head models (mood, voice)
    consume the same array — running it once saves a second forward pass.
    The model load is async (locked); the inference itself is sync."""
    model = await _load_discogs_async()
    return model(audio)


def _pool_embedding(activations: "np.ndarray") -> list[float]:
    # Mean-pool across the temporal axis for a track-level vector —
    # Essentia's recommended pooling for similarity tasks.
    pooled = activations.mean(axis=0)
    return pooled.astype("float32").tolist()


async def _mood_voice(
    activations: "np.ndarray",
) -> tuple[float | None, float | None, str | None]:
    """Aggregate mood and voice-instrumental head outputs into the three
    columns the schema expects.

    Mapping rationale:
      - valence ≈ how positive the track feels: happy minus sad,
        re-centred onto 0..1
      - arousal ≈ how energetic the track feels: aggressive + party
        weighted against relaxed
      - voice_instrumental: direct argmax of the binary classifier

    Each head is independently optional — `_load_head_async` returns None
    when the file isn't on disk, and the corresponding output stays None
    rather than guessing. `save_mir_analysis` skips nulls via COALESCE."""
    valence = await _mood_dimension("happy", "sad", activations)
    arousal = await _mood_dimension("aggressive", "relaxed", activations)
    voice_inst = await _voice_instrumental(activations)
    return valence, arousal, voice_inst


async def _mood_dimension(
    positive: str, negative: str, activations: "np.ndarray",
) -> float | None:
    """Compute one bipolar dimension as `(P(positive) - P(negative) + 1)/2`.
    Returns None when neither head model is available — we don't want to
    publish a guess as a 0.5."""
    pos = await _binary_head_prob(f"mood_{positive}-discogs-effnet-1.pb", activations)
    neg = await _binary_head_prob(f"mood_{negative}-discogs-effnet-1.pb", activations)
    if pos is None and neg is None:
        return None
    p = pos if pos is not None else 1.0 - (neg if neg is not None else 0.5)
    n = neg if neg is not None else 1.0 - (pos if pos is not None else 0.5)
    # Centre on 0.5; clip into the 0..1 range the analysis column uses.
    return float(max(0.0, min(1.0, (p - n + 1.0) / 2.0)))


async def _voice_instrumental(activations: "np.ndarray") -> str | None:
    model = await _load_head_async("voice_instrumental-discogs-effnet-1.pb")
    if model is None:
        return None
    preds = model(activations).mean(axis=0)
    # The Essentia voice_instrumental head outputs [voice, instrumental]
    # per the canonical class ordering. We return whichever is higher.
    return "voice" if preds[0] >= preds[1] else "instrumental"


async def _binary_head_prob(filename: str, activations: "np.ndarray") -> float | None:
    """Mean probability of the positive class for a binary head.
    Returns None when the model file isn't on disk."""
    model = await _load_head_async(filename)
    if model is None:
        return None
    preds = model(activations)  # (T, 2): [negative, positive]
    return float(preds[:, 1].mean())
