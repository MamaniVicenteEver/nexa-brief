"""Identidad de sesión y permisos mínimos para el editor de imágenes."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import Header, HTTPException

from src.config.settings import settings


@dataclass(frozen=True)
class ImageSession:
    email: str
    role: str

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


def require_image_session(
    x_nexa_session_user: str | None = Header(default=None, alias="X-Nexa-Session-User"),
    x_nexa_session_role: str | None = Header(default=None, alias="X-Nexa-Session-Role"),
) -> ImageSession:
    """Recibe identidad de Auth.js, reenviada por el proxy de sesión del frontend."""
    email = (x_nexa_session_user or "").strip().casefold()
    if len(email) > 320 or "@" not in email:
        raise HTTPException(status_code=401, detail="Se requiere una sesión de usuario válida.")
    role = (x_nexa_session_role or "editor").strip().casefold()
    return ImageSession(email=email, role="admin" if role == "admin" else "editor")


def _policy_path(data_dir: Path | None = None) -> Path:
    return (data_dir or settings.data_dir) / "image_posts" / "access.json"


def _load_policy(data_dir: Path | None = None) -> dict[str, Any]:
    try:
        value = json.loads(_policy_path(data_dir).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"schema_version": 1, "users": []}
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=503, detail="No se pudo leer el ACL de publicaciones de imagen.") from exc
    if not isinstance(value, dict) or value.get("schema_version") != 1 or not isinstance(value.get("users"), list):
        raise HTTPException(status_code=503, detail="El ACL de publicaciones de imagen no es válido.")
    return value


def _user_grant(identity: ImageSession, data_dir: Path | None = None) -> dict[str, Any] | None:
    for grant in _load_policy(data_dir)["users"]:
        if isinstance(grant, dict) and str(grant.get("email") or "").strip().casefold() == identity.email:
            if "accounts" in grant and not isinstance(grant["accounts"], dict):
                raise HTTPException(status_code=503, detail="El ACL de cuentas de imagen no es válido.")
            return grant
    return None


def allowed_categories(identity: ImageSession, data_dir: Path | None = None) -> set[str] | None:
    """`None` significa todas las categorías para una sesión administradora."""
    if identity.is_admin:
        return None
    grant = _user_grant(identity, data_dir)
    categories = grant.get("categories") if grant else None
    if not isinstance(categories, list) or any(not isinstance(item, str) for item in categories):
        return set()
    return set(categories)


def require_category_access(
    identity: ImageSession, category_id: str, data_dir: Path | None = None
) -> None:
    if identity.is_admin:
        return
    if category_id not in (allowed_categories(identity, data_dir) or set()):
        raise HTTPException(status_code=403, detail="No tienes permiso sobre esta categoría.")


def has_account_restrictions(identity: ImageSession, category_id: str) -> bool:
    if identity.is_admin:
        return False
    grant = _user_grant(identity) or {}
    accounts = grant.get("accounts", {})
    return isinstance(accounts, dict) and category_id in accounts


def require_account_access(
    identity: ImageSession,
    category_id: str,
    platform: str,
    account_alias: str,
    data_dir: Path | None = None,
) -> None:
    """Una categoría concede sus cuentas; una lista `accounts` puede reducir ese acceso."""
    require_category_access(identity, category_id, data_dir)
    if identity.is_admin:
        return
    grant = _user_grant(identity, data_dir) or {}
    accounts = grant.get("accounts", {})
    if not isinstance(accounts, dict) or category_id not in accounts:
        return
    allowed = accounts[category_id]
    if not isinstance(allowed, list) or f"{platform}:{account_alias}" not in allowed:
        raise HTTPException(status_code=403, detail="No tienes permiso sobre esta cuenta.")
