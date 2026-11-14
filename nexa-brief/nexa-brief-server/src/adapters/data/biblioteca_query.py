"""Biblioteca read adapter over the existing record/publication storage ports.

JSON requires a scan for search and exact facets. It stays here, never in the
browser/domain; a DB provider can implement LibraryQueryPort with indexed queries.
No persistent duplicate index, media reads, per-card probes or unbounded cache.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from collections.abc import Callable, Iterable
from datetime import datetime
from typing import Any

from src.core.library.biblioteca import (
    CategoryFacet, LibraryItem, LibraryPage, LibraryQuery, PAGE_SIZE,
)
from src.core.ports.data_port import DataStore

_TERMINAL = {"packaged", "published", "failed"}
_ACTIVE_RECORDINGS = {"queued", "rendering", "publishing"}
_QUEUE_FIELDS = ("entry_id", "job_id", "platform", "account_alias", "format", "slot_id",
                 "scheduled_at", "source", "status", "post_id", "url", "error", "created_at",
                 "updated_at", "processed_at")


class CategoryResolver:
    def __init__(self, tree):
        self.aliases: dict[str, tuple[str, str]] = {}
        def walk(nodes, root=None, prefix=""):
            for key, node in nodes.items():
                path = f"{prefix}/{key}" if prefix else key
                owner = root or (key, node.display_name)
                for alias in (key, path, node.folder, node.display_name, *node.niches, *node.designs):
                    if alias:
                        self.aliases[str(alias).casefold()] = owner
                walk(node.children, owner, path)
        walk(tree)

    def resolve(self, value: str) -> tuple[str, str]:
        value = str(value or "")
        return self.aliases.get(value.casefold(), self.aliases.get(value.split("/", 1)[0].casefold(), ("uncategorized", "Sin categoría")))


def _timestamp(value: str) -> float:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except (ValueError, AttributeError):
        return 0


def _video_status(stage, published, scheduled):
    if stage == "failed":
        return "failed"
    if stage == "published" or published:
        return "published"
    if stage not in _TERMINAL:
        return "processing"
    return "scheduled" if scheduled else "ready"


class StoredLibraryQueries:
    def __init__(self, store: DataStore, categories, *,
                 publication_records: Callable[[], Iterable[dict[str, Any]]],
                 image_visible: Callable[[dict[str, Any]], bool],
                 recordings: Callable[[], list[dict[str, Any]]]):
        self.store = store
        self.categories = CategoryResolver(categories)
        self.publication_records = publication_records
        self.image_visible = image_visible
        self.recordings = recordings

    def _videos(self):
        queue = defaultdict(list)
        for row in self.store.collection("queue_entries").list():
            if row.get("job_id") and row.get("content_kind", "video") == "video":
                queue[row["job_id"]].append(row)
        result = []
        for row in self.store.collection("jobs").list():
            if row.get("kind") == "localization":
                continue
            published = [r for r in queue[row["job_id"]] if r.get("status") == "published"]
            scheduled = [r for r in queue[row["job_id"]] if r.get("status") in {"queued", "publishing"}]
            stage = row.get("stage", "pending")
            category, label = self.categories.resolve(row.get("category", ""))
            job = {k: row.get(k) for k in ("job_id", "category", "title", "created_at", "updated_at", "duration_seconds")}
            job.update(stage=stage, is_terminal=stage in _TERMINAL,
                       title=row.get("title") or row.get("category") or row["job_id"],
                       created_at=row.get("created_at") or "", updated_at=row.get("updated_at") or "",
                       generation_seconds=row.get("generation_seconds"))
            result.append(LibraryItem(kind="video", id=row["job_id"], category_id=category,
                category_label=label, title=job["title"], status=_video_status(stage, published, scheduled),
                updated_at=job["updated_at"], duration_seconds=row.get("duration_seconds"),
                payload={"job": job, "published": [{k: r.get(k) for k in _QUEUE_FIELDS} for r in published],
                         "scheduled": [{k: r.get(k) for k in _QUEUE_FIELDS} for r in scheduled]}))
        for job in self.recordings():
            if job["state"] == "done":
                continue
            category, label = self.categories.resolve(job.get("category_path", ""))
            result.append(LibraryItem(kind="recording", id=job["job_id"], category_id=category,
                category_label=label, title=job.get("title") or job["video_id"],
                status="processing" if job["state"] in _ACTIVE_RECORDINGS else "failed",
                updated_at=job.get("started_at") or "", payload=job))
        return result

    def _images(self):
        # Pick the latest revision BEFORE authorization: never reveal an old revision
        # when the latest one is no longer visible to this account.
        latest = {}
        for record in self.publication_records():
            key = record["post_id"]
            before = latest.get(key)
            if before is None or (record["revision"], record["created_at"], record["publication_id"]) > (
                before["revision"], before["created_at"], before["publication_id"]):
                latest[key] = record
        result = []
        for row in latest.values():
            if not self.image_visible(row):
                continue
            editorial, technical = row["editorial"], row["technical"]
            category, label = self.categories.resolve(editorial["category_id"])
            state = row["status"]
            delivery_states = {r.get("status") for r in row.get("deliveries", [])}
            status = ("published" if "published" in delivery_states or state == "published" else
                      "processing" if state == "rendering" or "publishing" in delivery_states else
                      "scheduled" if "queued" in delivery_states else
                      "failed" if state == "failed" else "ready")
            slides = sorted(technical.get("slides", []), key=lambda s: s.get("order", 0))
            plan = technical.get("composition_plan") or {}
            payload = {"post_id": row["post_id"], "publication_id": row["publication_id"],
                "category_id": editorial["category_id"], "title": editorial.get("title") or editorial.get("topic") or row["post_id"],
                "status": state, "kind": technical["kind"], "format": plan.get("format", ""),
                "slide_count": len(slides) or len(plan.get("slides", [])),
                "cover_asset_id": slides[0]["asset_id"] if slides else None,
                "updated_at": row["updated_at"]}
            result.append(LibraryItem(kind="image", id=row["publication_id"], category_id=category,
                category_label=label, title=payload["title"], status=status,
                updated_at=row["updated_at"], payload=payload))
        return result

    def query(self, query: LibraryQuery) -> LibraryPage:
        items = self._images() if query.media == "images" else self._videos()
        active = any(i.status == "processing" for i in items)
        q = query.q.strip().casefold()
        searched = [i for i in items if not q or q in " ".join((i.title, i.category_id, i.category_label, i.id)).casefold()]
        counts = Counter(i.category_id for i in searched)
        labels = {i.category_id: i.category_label for i in searched}
        categories = [CategoryFacet(id=key, label=labels[key], count=count) for key, count in counts.items()]
        categories.sort(key=lambda c: c.label.casefold())
        selected = [i for i in searched if not query.category or i.category_id == query.category]
        statuses = Counter(i.status for i in selected)
        status_counts = {"all": len(selected), "pending": statuses["ready"] + statuses["scheduled"],
            "published": statuses["published"], "processing": statuses["processing"], "failed": statuses["failed"]}
        accepted = {"pending": {"ready", "scheduled"}}.get(query.status, {query.status})
        selected = [i for i in selected if query.status == "all" or i.status in accepted]
        # Stable tie-breaker avoids arbitrary order across pages with equal timestamps.
        selected.sort(key=lambda i: i.id)
        if query.sort == "title":
            selected.sort(key=lambda i: i.title.casefold())
        elif query.sort == "longest":
            selected.sort(key=lambda i: i.duration_seconds if i.duration_seconds is not None else -1, reverse=True)
        else:
            selected.sort(key=lambda i: _timestamp(i.updated_at), reverse=query.sort == "newest")
        total = len(selected)
        page = min(query.page, max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE))
        page_items = selected[(page - 1) * PAGE_SIZE:page * PAGE_SIZE]
        # Enrich only this page. Legacy generation times require ONE history scan,
        # not one full read per card/job as the old listing did.
        missing = {i.id: i for i in page_items if i.kind == "video" and
                   i.payload["job"]["is_terminal"] and i.payload["job"]["generation_seconds"] is None}
        if missing:
            ends = {}
            for event in self.store.collection("history_events").list():
                key = event.get("job_id")
                if key in missing and event.get("stage") in {"packaged", "failed"}:
                    value = event.get("created_at") or ""
                    if key not in ends or _timestamp(value) < _timestamp(ends[key]):
                        ends[key] = value
            for key, item in missing.items():
                if key not in ends:
                    continue
                try:
                    start = datetime.fromisoformat(item.payload["job"]["created_at"].replace("Z", "+00:00"))
                    end = datetime.fromisoformat(ends[key].replace("Z", "+00:00"))
                    item.payload["job"]["generation_seconds"] = round(max(0, (end - start).total_seconds()), 1)
                except (TypeError, ValueError):
                    pass
        return LibraryPage(items=page_items, total=total,
            page=page, unfiltered_total=len(items), categories=categories,
            status_counts=status_counts, has_active_jobs=active)
