#!/usr/bin/env python3
"""Refresh derived component catalogs from existing authoritative metadata."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[5]))
from src.templates._tools.nodemotion.shared import assemble, discovery


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("design_ids", nargs="*")
    args = parser.parse_args()
    ids = args.design_ids or assemble.design_ids()
    for design_id in ids:
        discovery.refresh(design_id)
        print(json.dumps({"design_id": design_id, "entries": len(discovery.catalog(design_id)["entries"])}))


if __name__ == "__main__":
    main()
