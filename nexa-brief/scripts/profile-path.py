#!/usr/bin/env python3
"""Print a non-secret path for Make, shell scripts and Docker Compose."""
import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "nexa-brief-server"))
from src.config.profile_layout import resolve_profile_layout
from src.config.storage_profile import load_profile

parser = argparse.ArgumentParser()
parser.add_argument("profile", type=Path)
parser.add_argument("kind", choices=("web_data", "connections", "renders", "tiktok"))
args = parser.parse_args()
root = args.profile.expanduser()
if not root.is_absolute():
    parser.error("profile path must be absolute")
manifest = root / "profile.json"
version = load_profile(root)["schema_version"] if manifest.exists() else 1
layout = resolve_profile_layout(root, version)
if version >= 2:
    for name, kind in (("NEXA_WEB_DATA_DIR", "web_data"), ("NEXA_CONNECTIONS_DIR", "connections"),
                       ("NEXA_RENDERS_DIR", "renders"), ("NEXA_TIKTOK_DATA_DIR", "tiktok")):
        override = os.environ.get(name)
        if override:
            path = Path(override).expanduser()
            expected = getattr(layout, kind + "_dir")
            if not path.is_absolute() or path.resolve() != expected.resolve():
                parser.error(f"{name} does not match the selected v2 profile")
print(getattr(layout, args.kind + "_dir"))
