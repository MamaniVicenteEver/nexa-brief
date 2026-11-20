"""How long each pipeline step usually takes — learned from real runs.

Every finished step updates an exponential moving average persisted to
the "progress" document store (step_durations), so ETAs get better the more videos the
server renders. Recording scales with the video's length, so its average is
stored per second of video (and per engine: Playwright records in real time,
Remotion/HyperFrames don't).
"""

from __future__ import annotations


import structlog

from src.core.data import documents
from src.core.ports.data_port import DocumentStore

logger = structlog.get_logger(__name__)

_ALPHA = 0.3  # weight of the newest sample

# Starting guesses in seconds, used until a step has real samples.
_DEFAULT_SECONDS: dict[str, float] = {
    "input_analyzer": 8,
    "resource_fetcher": 20,
    "lyrics_transcriber": 150,
    "visual_designer": 40,
    "prompt_architect": 2,
    "html_generator": 45,
    "result_summarizer": 12,
    "packager": 6,
    "social_publisher": 60,
}
# Seconds of work per second of video, per recorder engine.
_DEFAULT_RECORDING_RATIO: dict[str, float] = {"playwright": 1.25, "remotion": 1.5, "hyperframes": 1.0}
_RECORDING_OVERHEAD_SECONDS = 20
_FALLBACK_SECONDS = 15

RECORDER_STEP = "video_recorder"


def recorder_key(engine: str) -> str:
    return f"{RECORDER_STEP}:{engine}"


_DOCUMENT_KEY = "step_durations"


class StepDurationEstimator:
    """Promedios móviles por paso, persistidos como un documento del DataStore."""

    def __init__(self, store: DocumentStore) -> None:
        self._store = store
        self._averages: dict[str, float] = self._load()

    def _load(self) -> dict[str, float]:
        try:
            return {k: float(v) for k, v in (self._store.get(_DOCUMENT_KEY) or {}).items()}
        except Exception as exc:
            logger.warning("progress_estimator_load_failed", error=str(exc))
            return {}

    def _save(self) -> None:
        try:
            self._store.put(_DOCUMENT_KEY, self._averages)
        except Exception as exc:
            logger.warning("progress_estimator_save_failed", error=str(exc))

    def estimate(self, step_key: str, video_seconds: float | None) -> float:
        if step_key.startswith(f"{RECORDER_STEP}:"):
            engine = step_key.split(":", 1)[1]
            ratio = self._averages.get(step_key, _DEFAULT_RECORDING_RATIO.get(engine, 1.25))
            return ratio * (video_seconds or 60) + _RECORDING_OVERHEAD_SECONDS
        return self._averages.get(step_key, _DEFAULT_SECONDS.get(step_key, _FALLBACK_SECONDS))

    def record(self, step_key: str, seconds: float, video_seconds: float | None) -> None:
        if seconds <= 0:
            return
        if step_key.startswith(f"{RECORDER_STEP}:"):
            if not video_seconds:
                return
            seconds = max(0.0, seconds - _RECORDING_OVERHEAD_SECONDS) / video_seconds
        previous = self._averages.get(step_key)
        self._averages[step_key] = seconds if previous is None else previous + _ALPHA * (seconds - previous)
        self._save()


_estimator: StepDurationEstimator | None = None


def get_estimator() -> StepDurationEstimator:
    global _estimator
    if _estimator is None:
        _estimator = StepDurationEstimator(documents("progress"))
    return _estimator
