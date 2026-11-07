"""User-managed groups of connected accounts, stored in the active data profile.

These groups organize Canales. Publication routing and template categories keep
their existing configuration. Membership uses platform IDs, never display names.
"""
from __future__ import annotations

import hashlib
import time
import unicodedata

from src.core.categories import list_categories
from src.core.data import collection


class CategoryConflict(ValueError):
    pass


def _name_key(name: str) -> str:
    return unicodedata.normalize("NFKC", " ".join(name.split())).casefold()


def list_settings() -> list[dict]:
    return collection("channel_categories").list()


def _members(members: list[dict], accounts: list[dict], existing: list[dict] | None = None) -> list[dict]:
    # Disconnected members already saved in this group can remain assigned, so
    # reconnecting the same ID restores membership without assigning a new ID.
    allowed = {
        (a["platform"], str(a["target_id"]))
        for a in [*accounts, *(existing or [])]
        if a.get("target_id")
    }
    result = []
    seen = set()
    for member in members:
        key = (member["platform"], member["target_id"])
        if key not in allowed:
            raise ValueError("Una cuenta seleccionada ya no está conectada. Actualiza la lista y vuelve a intentarlo.")
        if key not in seen:
            result.append({"platform": key[0], "target_id": key[1]})
            seen.add(key)
    return result


async def create_category(name: str, members: list[dict], accounts: list[dict]) -> dict:
    name = " ".join(name.split())
    if not name or len(name) > 80:
        raise ValueError("El nombre debe tener entre 1 y 80 caracteres.")
    key = _name_key(name)
    if any(_name_key(node.display_name) == key for node in list_categories().values()) or any(
        _name_key(row["display_name"]) == key for row in list_settings()
    ):
        raise CategoryConflict("Ya existe una categoría con ese nombre.")
    # A deterministic ID also prevents duplicate rows if both environments
    # create the same normalized name at the same instant.
    category_id = "custom_" + hashlib.sha256(key.encode()).hexdigest()[:24]
    now = time.time()
    return await collection("channel_categories").upsert(
        {"category_id": category_id, "display_name": name, "members": _members(members, accounts),
         "created_at": now, "updated_at": now},
        match=("category_id",),
    )


async def set_members(category_id: str, members: list[dict], accounts: list[dict]) -> dict:
    existing = collection("channel_categories").get(category_id)
    base = list_categories().get(category_id)
    if existing is None and base is None:
        raise KeyError(category_id)
    return await collection("channel_categories").upsert(
        {"category_id": category_id,
         "display_name": base.display_name if base else existing["display_name"],
         "members": _members(members, accounts, (existing or {}).get("members")),
         "updated_at": time.time()},
        match=("category_id",),
    )
