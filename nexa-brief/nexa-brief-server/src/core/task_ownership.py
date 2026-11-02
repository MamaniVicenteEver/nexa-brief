"""Kernel-backed task ownership across host/container processes on one dataset."""

from __future__ import annotations
import asyncio
import fcntl
import hashlib
import os
from src.config.settings import settings


class TaskLease:
    def __init__(self, kind: str, task_id: str):
        digest = hashlib.sha256(f"{kind}:{task_id}".encode()).hexdigest()
        self.path = settings.data_dir / "runtime/task-leases" / (digest + ".lock")
        self.fd: int | None = None

    def acquire(self) -> bool:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR, 0o600)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            os.close(fd)
            return False
        self.fd = fd
        return True

    def release(self):
        if self.fd is not None:
            fcntl.flock(self.fd, fcntl.LOCK_UN)
            os.close(self.fd)
            self.fd = None


def task_is_owned(kind: str, task_id: str) -> bool:
    lease = TaskLease(kind, task_id)
    if not lease.acquire():
        return True
    lease.release()
    return False


def start_owned_task(kind: str, task_id: str, factory):
    lease = TaskLease(kind, task_id)
    if not lease.acquire():
        return None

    async def run():
        try:
            return await factory()
        finally:
            lease.release()

    try:
        task = asyncio.create_task(run())
        # Cancellation before the coroutine starts never enters its finally block.
        task.add_done_callback(lambda _: lease.release())
        return task
    except BaseException:
        lease.release()
        raise


def task_can_recover(kind: str, task_id: str, *, queued: bool = False, updated_at=None) -> bool:
    if task_is_owned(kind, task_id):
        return False
    if queued and updated_at:
        from datetime import datetime, timezone

        try:
            stamp = datetime.fromisoformat(str(updated_at).replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - stamp).total_seconds() < 30:
                return False
        except (ValueError, TypeError):
            pass
    return True
