"""Dependencias y firmas de seguridad para la API pública."""

from __future__ import annotations

import base64
import hashlib
import hmac
import time

import structlog
from fastapi import Header, HTTPException, status

from src.config.settings import settings

logger = structlog.get_logger(__name__)
_dev_warning_logged = False


def _is_development_environment() -> bool:
    """Indica si la app corre en desarrollo o dentro de las pruebas."""
    return settings.app_env in {"development", "test"}


def require_internal(
    x_nexa_internal: str | None = Header(default=None, alias="X-Nexa-Internal"),
) -> None:
    """Exige el token compartido entre Next y FastAPI.

    En desarrollo local permite continuar sin token y registra un warning una sola vez.
    En producción, un token sin configurar es un error cerrado.
    """
    global _dev_warning_logged

    configured_token = settings.nexa_internal_token
    if not configured_token:
        if _is_development_environment():
            if not _dev_warning_logged:
                logger.warning("nexa_internal_token_missing_in_development")
                _dev_warning_logged = True
            return
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La autenticación interna de la API no está configurada.",
        )

    if not x_nexa_internal or not hmac.compare_digest(x_nexa_internal, configured_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso interno requerido.",
        )


def sign_link(path: str, ttl: int) -> str:
    """Firma una ruta y su vencimiento; devuelve el valor que se envía como `k`."""
    if not path.startswith("/") or "\n" in path:
        raise ValueError("path debe ser una ruta absoluta sin saltos de línea")
    if ttl <= 0:
        raise ValueError("ttl debe ser positivo")
    secret = settings.nexa_link_secret
    if not secret:
        raise RuntimeError("NEXA_LINK_SECRET no está configurado")

    expires_at = int(time.time()) + ttl
    message = f"{path}\n{expires_at}".encode("utf-8")
    digest = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).digest()
    encoded_digest = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return f"{expires_at}.{encoded_digest}"


def verify_link(path: str, k: str) -> bool:
    """Valida la firma `k` para la ruta exacta y comprueba que no haya vencido."""
    if not path.startswith("/") or "\n" in path:
        return False
    secret = settings.nexa_link_secret
    if not secret:
        return False
    try:
        expires_raw, received_digest = k.split(".", 1)
        expires_at = int(expires_raw)
    except (AttributeError, TypeError, ValueError):
        return False
    if expires_at <= int(time.time()):
        return False

    message = f"{path}\n{expires_at}".encode("utf-8")
    expected_digest = base64.urlsafe_b64encode(
        hmac.new(secret.encode("utf-8"), message, hashlib.sha256).digest()
    ).rstrip(b"=").decode("ascii")
    return hmac.compare_digest(received_digest, expected_digest)
