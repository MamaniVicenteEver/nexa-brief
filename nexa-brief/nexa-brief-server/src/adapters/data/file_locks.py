"""Locks for the connection files shared by independent API processes."""
from __future__ import annotations

import asyncio
import fcntl
import os
import time
from contextlib import contextmanager
from pathlib import Path


@contextmanager
def file_lock(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


class AsyncFileLock:
    def __init__(self, path: Path, timeout: float = 150):
        self.path, self.timeout, self.fd = path, timeout, None

    async def __aenter__(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.fd = os.open(self.path, os.O_CREAT | os.O_RDWR, 0o600)
        deadline = time.monotonic() + self.timeout
        try:
            while True:
                try:
                    fcntl.flock(self.fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    return self
                except BlockingIOError:
                    if time.monotonic() >= deadline:
                        raise TimeoutError("Connection is busy in another API process") from None
                    await asyncio.sleep(0.05)
        except BaseException:
            os.close(self.fd)
            self.fd = None
            raise

    async def __aexit__(self, *args):
        if self.fd is not None:
            fcntl.flock(self.fd, fcntl.LOCK_UN)
            os.close(self.fd)
            self.fd = None
