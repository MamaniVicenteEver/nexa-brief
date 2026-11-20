"""All queryable edition state goes through DataPort."""
import hashlib
from datetime import datetime, timezone

from src.core.data import get_data_store

ACTIVE = {"queued", "running"}


def now():
    return datetime.now(timezone.utc).isoformat()


class EditionRepository:
    def __init__(self, store=None):
        self._store = store

    @property
    def store(self):
        return self._store or get_data_store()

    def collection(self, name):
        return self.store.collection(name)

    def key(self, video_id, locale):
        return hashlib.sha256(f"{video_id}:{locale}".encode()).hexdigest()[:32]

    def jobs(self, video_id=None, locale=None):
        where = {"kind": "localization"}
        if video_id:
            where["video_id"] = video_id
        if locale:
            where["locale"] = locale
        return self.collection("jobs").list(where)

    def job(self, job_id):
        row = self.collection("jobs").get(job_id)
        return row if row and row.get("kind") == "localization" else None

    async def update(self, job_id, **patch):
        return await self.collection("jobs").update(job_id, {**patch, "updated_at": now()})

    async def locale(self, video_id, locale, **patch):
        key = self.key(video_id, locale)
        row = self.collection("video_localizations").get(key) or {}
        return await self.collection("video_localizations").upsert(
            {**row, "localization_id": key, "video_id": video_id, "locale": locale, **patch, "updated_at": now()},
            match=["localization_id"])
