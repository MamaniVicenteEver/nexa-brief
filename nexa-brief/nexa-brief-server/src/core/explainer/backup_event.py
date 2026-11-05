"""Small durable completion marker; the host worker copies media asynchronously."""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def write_render_event(video_dir: Path, templates_root: Path, data_dir: Path,
                       video_id: str, formats: list[str]) -> Path | None:
    if os.environ.get("NEXA_RENDER_MANAGED") == "1":
        return None
    relative = video_dir.resolve().relative_to(templates_root.resolve())
    if any(part in {"sandbox", "_tools"} for part in relative.parts):
        return None
    identity = hashlib.sha256(relative.as_posix().encode()).hexdigest()[:32]
    outputs = {}
    for fmt in formats:
        if fmt not in {"16x9", "9x16"}:
            raise ValueError("Invalid backup format")
        path = video_dir / "render" / f"{video_id}-{fmt}.mp4"
        if path.is_symlink() or not path.is_file() or path.stat().st_size == 0:
            raise ValueError("Missing complete render")
        st = path.stat()
        outputs[fmt] = {"size": st.st_size, "mtime_ns": st.st_mtime_ns}
    if not outputs:
        raise ValueError("No complete formats")
    event = {"event_id": identity, "video_id": video_id,
             "template_relative": relative.as_posix(), "formats": sorted(outputs),
             "outputs": outputs, "finished_at": datetime.now(timezone.utc).isoformat()}
    folder = data_dir / "video_backups" / "events"
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, name = tempfile.mkstemp(prefix=".event-", dir=folder)
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(event, f, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        destination = folder / f"{identity}.json"
        os.replace(name, destination)
        return destination
    finally:
        Path(name).unlink(missing_ok=True)
