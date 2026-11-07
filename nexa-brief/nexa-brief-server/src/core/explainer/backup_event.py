"""Durable completion markers referencing existing files for asynchronous backup."""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def write_render_event(video_dir: Path, templates_root: Path, data_dir: Path,
                       video_id: str, formats: list[str], *, output_dir: Path | None = None,
                       format_paths: dict[str, Path] | None = None) -> Path | None:
    if os.environ.get("NEXA_RENDER_MANAGED") == "1":
        return None
    # CLI v1 and tests explicitly use the supplied templates directory. Profile v2
    # resolves both source and output by keys, without copying the master render.
    from src.config.profile_layout import layout_for_settings
    from src.config.settings import settings
    layout = layout_for_settings(settings)
    is_v2 = layout.schema_version >= 2
    video = video_dir.resolve()
    if is_v2:
        if Path(data_dir).resolve() != layout.data_dir.resolve():
            raise ValueError("Backup data directory does not belong to selected profile")
        source_root = layout.productions_dir.resolve()
        try:
            relative = video.relative_to(source_root)
        except ValueError:
            if video.is_relative_to(layout.sandbox_dir.resolve()):
                return None
            raise ValueError("Backup source is outside profile productions") from None
        if len(relative.parts) != 2 or relative.name != video_id:
            raise ValueError("Invalid production source")
        source_key = "productions/" + relative.as_posix()
        if output_dir is None and format_paths is None:
            raise ValueError("Backup output directory is required for v2")
        render_root = layout.renders_dir.resolve()
        render_dir = Path(output_dir).resolve() if output_dir is not None else render_root
        if layout.schema_version < 3 and (render_dir == render_root or not render_dir.is_relative_to(render_root)):
            raise ValueError("Backup output directory is outside selected profile")
        if layout.schema_version >= 3 and format_paths is None:
            raise ValueError("Backup format paths are required for v3")
        identity = hashlib.sha256(source_key.encode()).hexdigest()[:32]
    else:
        relative = video.relative_to(templates_root.resolve())
        if any(part in {"sandbox", "_tools"} for part in relative.parts):
            return None
        render_dir = video / "render"
        identity = hashlib.sha256(relative.as_posix().encode()).hexdigest()[:32]

    outputs = {}
    for fmt in formats:
        if fmt not in {"16x9", "9x16"}:
            raise ValueError("Invalid backup format")
        path = Path(format_paths[fmt]) if format_paths is not None and fmt in format_paths else render_dir / f"{video_id}-{fmt}.mp4"
        if path.is_symlink() or not path.is_file() or path.stat().st_size == 0:
            raise ValueError("Missing complete render")
        if is_v2 and not path.resolve().is_relative_to(render_root):
            raise ValueError("Render path is outside selected profile")
        if layout.schema_version >= 3:
            from src.adapters.data.runtime_paths import assert_profile_path
            assert_profile_path(path)
            expected = render_root / "videos" / relative.parts[0] / video_id
            if path.name != "video.mp4" or not path.resolve().is_relative_to(expected):
                raise ValueError("Render does not belong to this video")
        st = path.stat()
        signature = {"size": st.st_size, "mtime_ns": st.st_mtime_ns}
        if is_v2:
            signature["storage_key"] = "renders/" + path.resolve().relative_to(render_root).as_posix()
        outputs[fmt] = signature
    if not outputs:
        raise ValueError("No complete formats")
    event = {"event_id": identity, "video_id": video_id, "formats": sorted(outputs),
             "outputs": outputs, "finished_at": datetime.now(timezone.utc).isoformat()}
    if is_v2:
        event.update(schema_version=layout.schema_version, source_key=source_key)
    else:
        event["template_relative"] = relative.as_posix()
    folder = ((layout.runtime_dir if layout.schema_version >= 3 else data_dir) / "video_backups" / "events")
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    destination = folder / f"{identity}.json"
    if is_v2:
        from src.adapters.data.runtime_paths import temporary_dir
        temp_dir = temporary_dir(destination)
    else:
        temp_dir = folder
    fd, name = tempfile.mkstemp(prefix=".event-", dir=temp_dir)
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(event, f, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(name, destination)
        return destination
    finally:
        Path(name).unlink(missing_ok=True)
