"""Locate completed explainer recordings without mixing short previews."""

from pathlib import Path

from src.config.profile_layout import layout_for_settings
from src.config.settings import settings


def full_render_files(video_dir: Path) -> list[Path]:
    layout = layout_for_settings(settings)
    if layout.schema_version >= 3 and video_dir.resolve().is_relative_to(layout.productions_dir.resolve()):
        relative = video_dir.resolve().relative_to(layout.productions_dir.resolve())
        if len(relative.parts) < 2:
            return []
        root = layout.renders_dir / "videos" / relative.parts[0] / video_dir.name
        return sorted(path for path in root.glob("*/video.mp4")
                      if not path.parent.name.startswith("preview-")
                      and path.parent.name.endswith(("-9x16", "-16x9"))
                      and not path.is_symlink()
                      and path.resolve().is_relative_to(layout.renders_dir.resolve()))
    if layout.schema_version >= 2 and video_dir.resolve().is_relative_to(layout.productions_dir.resolve()):
        return sorted(
            path for path in (layout.renders_dir / video_dir.name).glob("*/*.mp4")
            if path.name in {f"{video_dir.name}-9x16.mp4", f"{video_dir.name}-16x9.mp4"}
            and not path.parent.name.startswith("preview-")
            and path.resolve().is_relative_to(layout.renders_dir.resolve())
        )
    return sorted((video_dir / "render").glob("*.mp4"))


def latest_render(video_dir: Path, orientation: str) -> Path | None:
    if orientation not in {"9x16", "16x9"}:
        return None
    candidates = [p for p in full_render_files(video_dir)
                  if p.name == f"{video_dir.name}-{orientation}.mp4"
                  or p.name == "video.mp4" and p.parent.name.endswith(f"-{orientation}")]
    return max(candidates, key=lambda path: path.stat().st_mtime_ns, default=None)


def render_label(video_dir: Path, path: Path) -> str:
    """Keep the public list of format names stable despite v3's video.mp4."""
    if path.name == "video.mp4":
        for orientation in ("9x16", "16x9"):
            if path.parent.name.endswith(f"-{orientation}"):
                return f"{video_dir.name}-{orientation}.mp4"
    return path.name
