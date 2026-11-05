"""A cached MP4 is reusable only with the same project and renderer inputs."""
from __future__ import annotations

import hashlib
from pathlib import Path

from src.core.explainer.catalog import KIT_DIR, TEMPLATES_DIR, ExplainerVideo


def render_signature(video: ExplainerVideo) -> str:
    digest = hashlib.sha256(b"explainer-render-v1")
    roots = [KIT_DIR / "engine", KIT_DIR / "vendor", KIT_DIR / "designs/common",
             KIT_DIR / "designs" / video.design, video.path / "assets"]
    files = {p for root in roots if root.is_dir() for p in root.rglob("*") if p.is_file()}
    files.update({video.path / "index.html", KIT_DIR / "tools/kit.py",
                  TEMPLATES_DIR / "_tools/commercial/render_promo.py", TEMPLATES_DIR / "_tools/http_media.py"})
    for path in sorted(files):
        if path.is_file():
            stat = path.stat()
            relative = path.relative_to(TEMPLATES_DIR) if path.is_relative_to(TEMPLATES_DIR) else path.relative_to(video.path)
            digest.update(f"{relative}:{stat.st_mtime_ns}:{stat.st_size}".encode())
    return digest.hexdigest()


def render_current(path: Path, signature: str) -> bool:
    stamp = path.with_suffix(path.suffix + ".sha256")
    return path.is_file() and stamp.is_file() and stamp.read_text().strip() == signature


def stamp_render(path: Path, signature: str) -> None:
    if path.is_file():
        path.with_suffix(path.suffix + ".sha256").write_text(signature + "\n")
