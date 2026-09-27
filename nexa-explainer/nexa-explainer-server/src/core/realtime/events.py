"""Realtime event envelope — the wire format pushed over the WebSocket.

`type` stays a plain `str` (not a Literal/union) on purpose: adding a new
event elsewhere in the codebase never requires touching this file, only the
publish call site and whatever frontend hook chooses to listen for it.
"""

from __future__ import annotations

import time
from typing import Any

from pydantic import BaseModel, Field


class RealtimeEvent(BaseModel):
    type: str
    data: dict[str, Any]
    ts: float = Field(default_factory=time.time)
