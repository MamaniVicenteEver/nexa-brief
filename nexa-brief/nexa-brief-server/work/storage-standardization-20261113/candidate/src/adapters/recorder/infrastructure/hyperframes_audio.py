"""Precálculo de magnitudes de audio por frame, para el ecualizador de
composiciones HyperFrames — reemplazo determinista/seekable del
`AnalyserNode.getByteFrequencyData()` en vivo que usa el template Playwright
original (ver image/01-image-bg/index.html). HyperFrames (como Remotion)
captura frames fuera de orden, así que no puede depender de audio sonando en
tiempo real; Remotion resolvió el mismo problema con `@remotion/media-utils`
(análisis offline, ver nexa-brief-remotion/src/components/ImageBg.js:26-30) —
acá no hay un paquete JS equivalente instalado, así que el análisis se hace
en Python antes de invocar el CLI y el resultado viaja como una variable más
en _hyperframes_variables.json (ver hyperframes_adapter.py).

Aproxima (no reproduce bit a bit) el algoritmo de AnalyserNode con sus
defaults de la Web Audio API: fftSize=256 (-> 128 bins), smoothingTimeConstant
=0.82, minDecibels=-100, maxDecibels=-30. La reducción final a 64 barras toma
cada bin par (0,2,4,...,126) de los 128 — mismo downsampling que hacía el JS
original (`freq[Math.floor(i * freq.length / BARS)]` con freq.length=128,
BARS=64).
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np

from src.config.exceptions import RecordingError

_SAMPLE_RATE = 22_050
_FFT_SIZE = 256
_BINS = _FFT_SIZE // 2  # 128, igual a AnalyserNode.frequencyBinCount
_BARS = 64
_SMOOTHING = 0.82
_MIN_DB = -100.0
_MAX_DB = -30.0
_EPS = 1e-9


def _decode_mono_pcm(audio_path: Path) -> np.ndarray:
    if not shutil.which("ffmpeg"):
        raise RecordingError("hyperframes_audio: ffmpeg no está instalado (requerido para el ecualizador).")
    cmd = [
        "ffmpeg", "-v", "error", "-i", str(audio_path),
        "-f", "f32le", "-ac", "1", "-ar", str(_SAMPLE_RATE), "-",
    ]
    result = subprocess.run(cmd, capture_output=True, check=False)
    if result.returncode != 0:
        raise RecordingError(f"hyperframes_audio: ffmpeg falló decodificando {audio_path}: {result.stderr.decode(errors='replace')[-300:]}")
    return np.frombuffer(result.stdout, dtype=np.float32)


def compute_equalizer_magnitudes(audio_path: Path, duration_seconds: float, fps: int) -> list[list[float]]:
    """Devuelve una lista de `ceil(duration_seconds * fps)` frames, cada uno
    con _BARS valores en [0, 1] — mismo shape que consumía el canvas #eq del
    template original, uno por frame de video en vez de en tiempo real."""
    samples = _decode_mono_pcm(audio_path)
    total_frames = int(np.ceil(duration_seconds * fps))
    hop = _SAMPLE_RATE / fps
    window = np.hanning(_FFT_SIZE).astype(np.float32)

    magnitudes: list[list[float]] = []
    smoothed = np.zeros(_BINS, dtype=np.float64)
    for i in range(total_frames):
        center = int(round(i * hop))
        start = center - _FFT_SIZE // 2
        end = start + _FFT_SIZE
        chunk = np.zeros(_FFT_SIZE, dtype=np.float32)
        src_start = max(0, start)
        src_end = min(len(samples), end)
        if src_start < src_end:
            dst_start = src_start - start
            chunk[dst_start:dst_start + (src_end - src_start)] = samples[src_start:src_end]

        spectrum = np.fft.rfft(chunk * window)
        raw_magnitude = np.abs(spectrum)[:_BINS]
        smoothed = _SMOOTHING * smoothed + (1 - _SMOOTHING) * raw_magnitude
        db = 20 * np.log10(smoothed + _EPS)
        normalized = np.clip((db - _MIN_DB) / (_MAX_DB - _MIN_DB), 0.0, 1.0)

        bars = normalized[::2][:_BARS]
        magnitudes.append([round(float(v), 3) for v in bars])

    return magnitudes
