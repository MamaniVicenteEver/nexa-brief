"""Private per-render scratch directories with a crash-recovery ownership marker."""
from __future__ import annotations

import fcntl
import json
import os
import tempfile
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

_PREFIXES = {
    "hyperframes": "_hyperframes_job_",
    "playwright": "_playwright_job_",
    "promo": "_promo_job_",
    "remotion": "_remotion_job_",
}


@contextmanager
def render_workspace(parent: Path, namespace: str) -> Iterator[Path]:
    """Hold an exclusive lock until the owned scratch tree is removed.

    An external reaper may inspect the marker and acquire the lock nonblocking
    before removing an old orphan. Children must not inherit the lock.
    """
    prefix = _PREFIXES[namespace]
    temp = tempfile.TemporaryDirectory(prefix=prefix, dir=parent)
    workspace = Path(temp.name).resolve()
    lock_fd = None
    try:
        lock_fd = os.open(workspace / ".owner.lock", os.O_CREAT | os.O_EXCL | os.O_RDWR, 0o600)
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        marker = {"version": 1, "namespace": namespace, "id": str(uuid.uuid4()), "created_at": time.time()}
        marker_fd = os.open(workspace / ".owner.json", os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(marker_fd, "w", encoding="utf-8") as f:
            json.dump(marker, f)
        yield workspace
    finally:
        try:
            temp.cleanup()
        finally:
            if lock_fd is not None:
                os.close(lock_fd)
