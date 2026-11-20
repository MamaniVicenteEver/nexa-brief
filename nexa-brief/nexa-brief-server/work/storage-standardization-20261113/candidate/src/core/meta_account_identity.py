"""Stable Meta identities. A Page's position in /me/accounts is never an alias."""

from __future__ import annotations


def assign_facebook_aliases(pages: list[dict], existing: list[dict], preferred: str) -> list[tuple[str, dict]]:
    used = {row["alias"] for row in existing}
    by_id: dict[str, str] = {}
    for row in existing:
        if row.get("target_id"):
            by_id.setdefault(str(row["target_id"]), row["alias"])
    selected = []
    seen = set()
    for page in pages:
        page_id = str(page.get("id") or "")
        if not page_id or not page.get("access_token") or page_id in seen:
            continue
        seen.add(page_id)
        alias = by_id.get(page_id)
        if not alias:
            if preferred not in used:
                alias = preferred
            else:
                n = 1
                while f"pagina_{n}" in used:
                    n += 1
                alias = f"pagina_{n}"
        used.add(alias)
        selected.append((alias, page))
    return selected
