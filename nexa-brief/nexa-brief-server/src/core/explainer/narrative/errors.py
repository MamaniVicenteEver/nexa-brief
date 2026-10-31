"""Errores del módulo de narrativas: siempre dicen qué narrativa, qué archivo y qué campo.

Heredan de ValueError para que la API los convierta en 400 con el mismo `except ValueError` que
ya usa para los demás errores de creación.
"""

from __future__ import annotations

from pathlib import Path


class NarrativeError(ValueError):
    def __init__(
        self,
        message: str,
        *,
        narrative_id: str | None = None,
        path: Path | str | None = None,
        field: str | None = None,
    ) -> None:
        self.message = message
        self.narrative_id = narrative_id
        self.path = str(path) if path else None
        self.field = field
        super().__init__(str(self))

    def __str__(self) -> str:
        where = [f"archivo {self.path}"] if self.path else []
        if self.field:
            where.append(f"campo {self.field}")
        prefix = f"[narrativa {self.narrative_id}] " if self.narrative_id else "[narrativa] "
        return prefix + self.message + (f" ({', '.join(where)})" if where else "")

    def context(self) -> dict[str, str | None]:
        """Para los logs: `logger.warning("...", **exc.context())`."""
        return {"narrative_id": self.narrative_id, "path": self.path, "field": self.field, "error": self.message}


class NarrativeNotFound(NarrativeError):
    """El id pedido no existe."""


class NarrativeInvalid(NarrativeError):
    """El JSON existe pero está mal formado o no cumple el esquema."""
