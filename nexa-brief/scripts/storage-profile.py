#!/usr/bin/env python3
"""Create an empty dataset or select an existing one; never imports credentials."""
import argparse
import json
import os
import re
import shutil
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("action", choices=["init", "show", "activate"])
parser.add_argument("profile")
parser.add_argument("--label")
parser.add_argument("--home", type=Path, default=Path(os.environ.get("NEXA_DATA_HOME", str(Path.home()/".local/share/nexa-brief"))))
parser.add_argument("--tiktok-port", type=int, default=8100)
args = parser.parse_args()
if not re.fullmatch(r"[a-z][a-z0-9_-]{0,47}", args.profile) or not 1024 <= args.tiktok_port <= 65535:
    raise SystemExit("Invalid profile or service port")
root = args.home.expanduser().resolve()/"profiles"/args.profile
manifest = root/"profile.json"
if args.action == "init":
    if manifest.exists():
        raise SystemExit("Profile already exists; existing data was not changed")
    root.mkdir(parents=True, mode=0o700)
    root.chmod(0o700)
    for name in ["data", "output", "connections", "web-data", "tiktok", "config"]:
        (root/name).mkdir(mode=0o700)
    (root/"web-data").chmod(0o2770)
    project = Path(__file__).resolve().parent.parent
    server = project/"nexa-brief-server"
    shutil.copy2(server/"niches.json", root/"config/niches.json")
    shutil.copytree(server/"src/skills/image_posts/styles",root/"config/image-styles")
    value = {"schema_version":1,"id":args.profile,"label":args.label or args.profile,
             "providers":{"records":"json","publications":"json","credentials":"encrypted_json","users":"json","media":"filesystem"},
             "services":{"tiktok":{"port":args.tiktok_port}}}
    manifest.write_text(json.dumps(value,indent=2)+"\n")
    manifest.chmod(0o644)
if not manifest.exists():
    raise SystemExit("Profile does not exist; initialize it explicitly")
if args.action == "activate":
    selector=Path(os.environ.get("XDG_CONFIG_HOME",str(Path.home()/".config")))/"nexa-brief/storage-profile.json"
    selector.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    selector.write_text(json.dumps({"profile_dir":str(root)})+"\n")
    selector.chmod(0o600)
print(json.dumps({"profile_dir":str(root),"profile":args.profile,"action":args.action}))
