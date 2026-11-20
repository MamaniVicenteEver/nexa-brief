"""Explicit extension points. An uninstalled provider fails closed, never falls back."""

from __future__ import annotations
from collections.abc import Callable

_builders: dict[tuple[str, str], Callable] = {}


def register_provider(kind: str, name: str, builder: Callable) -> None:
    _builders[(kind, name)] = builder


def build_provider(kind: str, name: str, **kwargs):
    builder = _builders.get((kind, name))
    if builder is None:
        raise ValueError(f"Storage provider {kind}:{name} is not installed")
    return builder(**kwargs)
