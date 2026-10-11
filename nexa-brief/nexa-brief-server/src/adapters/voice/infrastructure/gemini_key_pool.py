"""Pool de claves de Gemini con rotación por cuota diaria.

Lee GEMINI_API_KEY, GEMINI_API_KEY1…N del .env del servidor y de las
variables de entorno (sin repetir valores). Cada clave se identifica con una
etiqueta `NOMBRE#hash4` que nunca expone la clave.

El estado de cuota (qué clave agotó qué modelo y hasta cuándo) se guarda en
el MISMO archivo que usa el explainer-kit (`explainer-kit/.state/gemini-quota.json`,
ver tools/tts.py): así el backend y el kit no gastan pedidos en claves que el
otro ya sabe agotadas. En el plan gratuito cada intento cuenta para la cuota.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path

from src.config.settings import BASE_DIR, settings

_KEY_NAME = re.compile(r"GEMINI_API_KEY\d*")
# Una clave agotada vuelve a probarse pasadas ~23,5 h (igual que el kit).
EXHAUSTED_SECONDS = 23.5 * 3600


@dataclass(frozen=True)
class GeminiKey:
    label: str
    value: str


def _env_file_pairs(env_file: Path) -> list[tuple[str, str]]:
    if not env_file.exists():
        return []
    pairs = []
    for line in env_file.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
        if m:
            value = re.sub(r"\s+#.*$", "", m.group(2)).strip().strip('"').strip("'")
            pairs.append((m.group(1), value))
    return pairs


def load_keys(env_file: Path | None = None, environ: dict[str, str] | None = None) -> list[GeminiKey]:
    """Claves en orden: GEMINI_API_KEY primero, después KEY1, KEY2…"""
    env_file = env_file or BASE_DIR / ".env"
    environ = dict(os.environ) if environ is None else environ
    pairs = _env_file_pairs(env_file) + list(environ.items())

    def order(kv: tuple[str, str]) -> tuple[int, int]:
        suffix = kv[0].removeprefix("GEMINI_API_KEY")
        return (0 if not suffix else 1, int(suffix) if suffix.isdigit() else 0)

    seen: set[str] = set()
    keys: list[GeminiKey] = []
    for name, value in sorted((kv for kv in pairs if _KEY_NAME.fullmatch(kv[0])), key=order):
        if value and value not in seen:
            seen.add(value)
            digest = hashlib.sha1(value.encode()).hexdigest()[:4]
            keys.append(GeminiKey(label=f"{name}#{digest}", value=value))
    return keys


class KeyPool:
    def __init__(
        self,
        keys: list[GeminiKey] | None = None,
        state_path: Path | None = None,
        clock=time.time,
    ) -> None:
        self._keys = keys if keys is not None else load_keys()
        self._state_path = state_path or settings.gemini_quota_state_path
        self._clock = clock

    @property
    def keys(self) -> list[GeminiKey]:
        return list(self._keys)

    def _state(self) -> dict:
        try:
            return json.loads(self._state_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}

    def available(self, model: str) -> list[GeminiKey]:
        exhausted = self._state().get(model, {})
        now = self._clock()
        return [k for k in self._keys if exhausted.get(k.label, 0) < now]

    def mark_exhausted(self, key: GeminiKey, model: str) -> None:
        state = self._state()
        state.setdefault(model, {})[key.label] = self._clock() + EXHAUSTED_SECONDS
        self._state_path.parent.mkdir(parents=True, exist_ok=True)
        self._state_path.write_text(json.dumps(state, indent=1), encoding="utf-8")

    def status(self, models: list[str]) -> list[dict]:
        """[{label, exhausted: {modelo: epoch_hasta}}] — para la API, sin claves."""
        state = self._state()
        now = self._clock()
        return [
            {
                "label": k.label,
                "exhausted": {
                    m: state[m][k.label]
                    for m in models
                    if state.get(m, {}).get(k.label, 0) > now
                },
            }
            for k in self._keys
        ]
