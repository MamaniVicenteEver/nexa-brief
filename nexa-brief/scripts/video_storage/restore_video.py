#!/usr/bin/env python3
"""Restore a verified video package to a new directory, without touching live data."""

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil


def restore(bundle: Path, destination: Path):
    bundle = bundle.resolve(strict=True)
    if destination.exists() or destination.is_symlink():
        raise ValueError("Use a new destination directory")
    manifest = json.loads((bundle / "manifest.json").read_text())
    entries = manifest["files"]
    for entry in entries:
        relative = PurePosixPath(entry["target"])
        if relative.is_absolute() or any(
            x in {"", ".", ".."} for x in entry["target"].split("/")
        ):
            raise ValueError("Invalid archive path")
        source = (bundle / relative).resolve(strict=True)
        if not source.is_relative_to(bundle) or not source.is_file():
            raise ValueError("Archive path escapes bundle")
    destination.mkdir(parents=True, mode=0o700)
    try:
        for entry in entries:
            source = bundle / entry["target"]
            target = destination / entry["target"]
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            digest = hashlib.sha256()
            with source.open("rb") as src, target.open("xb") as dst:
                for block in iter(lambda: src.read(1024 * 1024), b""):
                    digest.update(block)
                    dst.write(block)
            if (
                digest.hexdigest() != entry["sha256"]
                or target.stat().st_size != entry["bytes"]
            ):
                raise ValueError("Archive checksum mismatch")
            os.chmod(target, entry.get("original_mode", 0o600))
            if entry.get("original_mtime_ns") is not None:
                stamp = entry["original_mtime_ns"]
                os.utime(target, ns=(stamp, stamp))
        (destination / "backup-metadata.json").write_text(
            json.dumps(manifest["metadata"], ensure_ascii=False, indent=2)
        )
    except BaseException:
        shutil.rmtree(destination)
        raise
    return len(entries)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    print("Verified restored files:", restore(args.bundle, args.destination))
