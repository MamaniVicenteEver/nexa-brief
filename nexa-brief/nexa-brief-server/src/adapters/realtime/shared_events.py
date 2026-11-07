"""Bounded local-filesystem event relay for APIs using the same profile."""

from __future__ import annotations
import asyncio
import json
import uuid
from pathlib import Path
from src.adapters.data.file_locks import AsyncFileLock
from src.adapters.data.json_store import _write_json
from src.core.realtime.events import RealtimeEvent


class SharedEventRelay:
    def __init__(self, root: Path, bus):
        self.path = root / "runtime/events.json"
        self.bus = bus
        self.source = uuid.uuid4().hex
        self.cursor = self._read().get("sequence", 0)
        self.task = None

    def _read(self):
        try:
            return json.loads(self.path.read_text())
        except FileNotFoundError:
            return {"sequence": 0, "events": []}

    async def publish(self, event: RealtimeEvent):
        async with AsyncFileLock(self.path.with_suffix(".lock")):
            value = self._read()
            sequence = value["sequence"] + 1
            events = [
                *value["events"],
                {"sequence": sequence, "source": self.source, "event": event.model_dump(mode="json")},
            ][-128:]
            _write_json(self.path, {"sequence": sequence, "events": events})

    async def poll_once(self):
        value = self._read()
        for item in value["events"]:
            if item["sequence"] > self.cursor and item["source"] != self.source:
                await self.bus.dispatch(RealtimeEvent.model_validate(item["event"]))
        self.cursor = value["sequence"]

    async def _run(self):
        while True:
            await asyncio.sleep(1)
            try:
                await self.poll_once()
            except (OSError, ValueError, KeyError):
                # An unavailable relay must not stop either API.
                await asyncio.sleep(1)

    def start(self):
        self.bus.bridge = self.publish
        self.task = asyncio.create_task(self._run())

    async def stop(self):
        self.bus.bridge = None
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
