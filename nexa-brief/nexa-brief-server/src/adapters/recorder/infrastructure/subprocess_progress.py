"""Run a render CLI while reading its output live, so progress can be reported mid-render.

`proc.communicate()` only returns at exit; here stdout and stderr are drained
concurrently line by line (draining both avoids the pipe-buffer deadlock),
each line goes to `parse_progress`, and any fraction it returns is reported
to the job's progress tracker.
"""

from __future__ import annotations

import asyncio
import json
import re
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from src.core.progress import report_step_progress

ProgressParser = Callable[[str], float | None]

_TAIL_LINES = 40
_PERCENT = re.compile(r"(\d{1,3}(?:\.\d+)?)\s?%")


@dataclass
class ProcessOutput:
    returncode: int
    stdout_tail: str
    stderr_tail: str


def parse_percent(line: str) -> float | None:
    """Generic: the last 'NN%' / 'NN.N %' on the line (CLI progress bars)."""
    matches = _PERCENT.findall(line)
    if not matches:
        return None
    value = float(matches[-1])
    return value / 100 if 0 <= value <= 100 else None


def parse_remotion_event(line: str) -> float | None:
    """render-node.mjs emits {"type": "progress", "renderedFrames", "encodedFrames", "totalFrames"}.
    Rendering and encoding run in parallel, so progress is the average of both."""
    try:
        event = json.loads(line)
    except ValueError:
        return None
    if not isinstance(event, dict) or event.get("type") != "progress" or not event.get("totalFrames"):
        return None
    total = event["totalFrames"]
    rendered = event.get("renderedFrames") or 0
    encoded = event.get("encodedFrames") or 0
    return (rendered + encoded) / (2 * total)


async def run_with_progress(
    cmd: list[str],
    *,
    cwd: Path,
    timeout: float,
    parse_progress: ProgressParser,
) -> ProcessOutput:
    """Raises asyncio.TimeoutError (after killing the process) if it exceeds `timeout`."""
    proc = await asyncio.create_subprocess_exec(
        *cmd, cwd=str(cwd), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    tails: dict[str, deque[str]] = {"stdout": deque(maxlen=_TAIL_LINES), "stderr": deque(maxlen=_TAIL_LINES)}

    async def pump(stream: asyncio.StreamReader, name: str) -> None:
        # Progress bars redraw with '\r' instead of newlines — split on both.
        buffer = b""
        while chunk := await stream.read(4096):
            buffer += chunk
            *lines, buffer = re.split(rb"[\r\n]", buffer)
            for raw in lines:
                line = raw.decode(errors="replace").strip()
                if not line:
                    continue
                tails[name].append(line)
                fraction = parse_progress(line)
                if fraction is not None:
                    report_step_progress(fraction)
        if buffer.strip():
            tails[name].append(buffer.decode(errors="replace").strip())

    assert proc.stdout is not None and proc.stderr is not None
    try:
        await asyncio.wait_for(
            asyncio.gather(pump(proc.stdout, "stdout"), pump(proc.stderr, "stderr"), proc.wait()),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise

    return ProcessOutput(
        returncode=proc.returncode if proc.returncode is not None else -1,
        stdout_tail="\n".join(tails["stdout"]),
        stderr_tail="\n".join(tails["stderr"]),
    )
