"""Pequeñas funciones para tolerar respuestas con listas y campos opcionales."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any


def first(value: Any, default: str = "") -> str:
    if isinstance(value, (list, tuple)):
        return first(value[0], default) if value else default
    if value is None:
        return default
    return str(value)


def join_values(value: Any, separator: str = ", ") -> str:
    if isinstance(value, (list, tuple, set)):
        return separator.join(first(item) for item in value if item is not None)
    return first(value)


def nested(obj: dict[str, Any], *path: str, default: Any = "") -> Any:
    current: Any = obj
    for key in path:
        if not isinstance(current, dict):
            return default
        current = current.get(key, default)
    return current


def as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, Iterable) and not isinstance(value, (str, bytes, dict)):
        return list(value)
    return [value]
