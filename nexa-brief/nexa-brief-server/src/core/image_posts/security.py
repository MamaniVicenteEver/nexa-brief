"""Saneamiento común de valores archivados en el dominio de publicaciones."""

from __future__ import annotations

import re
from typing import Any


_ASSIGNED_SECRET = re.compile(
    r"(?i)(\b(?:[a-z0-9_-]*token|appsecret_proof|client[_-]?secret|api[_-]?key|password|"
    r"authorization|cookie|signature|sig|x-amz-credential|x-amz-signature|x-amz-security-token)=)"
    r"[^&#\s]+"
)
_BEARER = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+")
_SIGNED_MEDIA = re.compile(r"(/api/v1/publish/instagram/media/)[^/?#\s]+")
_ABSOLUTE_PATH = re.compile(r"(?<![\w:/])/(?!/)(?:[\w.-]+/)+[\w.-]+")
_WINDOWS_PATH = re.compile(r"(?i)\b[A-Z]:\\(?:[^\\\s]+\\)*[^\\\s]+")


def redact_persisted_text(value: str) -> str:
    """Oculta credenciales, firmas temporales y rutas locales antes de guardar."""
    value = _ASSIGNED_SECRET.sub(r"\1[redactado]", value)
    value = _BEARER.sub("Bearer [redactado]", value)
    value = _SIGNED_MEDIA.sub(r"\1[redactado]", value)
    value = _ABSOLUTE_PATH.sub("[ruta local omitida]", value)
    return _WINDOWS_PATH.sub("[ruta local omitida]", value)


def redact_persisted_value(value: Any) -> Any:
    """Recorre un DTO ya proyectado a datos JSON y sanea cada texto."""
    if isinstance(value, str):
        return redact_persisted_text(value)
    if isinstance(value, dict):
        return {
            redact_persisted_text(str(key)): redact_persisted_value(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact_persisted_value(item) for item in value]
    if isinstance(value, tuple):
        return [redact_persisted_value(item) for item in value]
    return value
