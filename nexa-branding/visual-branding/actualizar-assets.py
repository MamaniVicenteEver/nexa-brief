#!/usr/bin/env python3
"""Genera el manifest de imágenes que consume el editor de marca."""

import json
from pathlib import Path


ROOT = Path(__file__).parent
ASSETS = ROOT / "assets"
OUTPUT = ASSETS / "manifest.json"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}


def asset_type(path: Path) -> str:
    return "logo" if path.name.lower().startswith("logo") else "image"


def asset_alt(channel: str, path: Path) -> str:
    return f"{channel.upper()} — {path.stem.replace('-', ' ')}"


manifest = {}
for folder in sorted(ASSETS.iterdir()):
    if not folder.is_dir() or not folder.name.startswith("node"):
        continue

    files = []
    for path in sorted(folder.iterdir()):
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
            files.append(
                {
                    "type": asset_type(path),
                    "asset": path.relative_to(ROOT).as_posix(),
                    "alt": asset_alt(folder.name, path),
                }
            )

    if files:
        files.sort(key=lambda item: (item["type"] != "logo", item["asset"]))
        manifest[folder.name] = files

OUTPUT.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Manifest actualizado: {OUTPUT}")
