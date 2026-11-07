#!/usr/bin/env python3
"""Host service: discover completed videos, retry HDD backup, reap owned scratch."""

from __future__ import annotations
import argparse
import contextlib
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
import time

from storage_discovery import discover
from storage_worker import enqueue_spec, init_db, process_pending

PREFIXES = {
    "hyperframes": "_hyperframes_job_",
    "playwright": "_playwright_job_",
    "promo": "_promo_job_",
    "remotion": "_remotion_job_",
}


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, name = tempfile.mkstemp(prefix=".state-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(value, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def reap_workspaces(roots, min_age=600):
    removed = 0
    for root in roots:
        root = Path(root).resolve()
        for base, dirs, _ in os.walk(root, followlinks=False):
            dirs[:] = [
                d
                for d in dirs
                if not (Path(base) / d).is_symlink()
                and d
                not in {"node_modules", ".venv", ".git", "assets", "_tools", "data"}
            ]
            for name in dirs[:]:
                namespace = next(
                    (ns for ns, prefix in PREFIXES.items() if name.startswith(prefix)),
                    None,
                )
                if namespace is None:
                    continue
                dirs.remove(name)
                path = Path(base) / name
                try:
                    marker_path = path / ".owner.json"
                    lock_path = path / ".owner.lock"
                    if marker_path.is_symlink() or lock_path.is_symlink():
                        continue
                    marker = json.loads(marker_path.read_text())
                    if (
                        marker.get("version") != 1
                        or marker.get("namespace") != namespace
                        or not isinstance(marker.get("id"), str)
                        or not re.fullmatch(r"[0-9a-f-]{36}", marker["id"])
                        or time.time() - float(marker["created_at"]) < min_age
                    ):
                        continue
                    with lock_path.open("r+") as lock:
                        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                        if path.is_symlink() or not path.resolve().is_relative_to(root):
                            continue
                        # A marker is sufficient only if no process still uses this scratch tree.
                        # Inspect readable process metadata; skip inaccessible cwd to stay conservative.
                        active = False
                        for proc in Path("/proc").iterdir():
                            if not proc.name.isdigit():
                                continue
                            try:
                                cwd = (proc / "cwd").resolve(strict=True)
                                if cwd == path or path in cwd.parents:
                                    active = True
                                    break
                            except (
                                PermissionError,
                                FileNotFoundError,
                                ProcessLookupError,
                            ):
                                continue
                        if active:
                            continue
                        shutil.rmtree(path)
                        removed += 1
                except (OSError, ValueError, TypeError, KeyError):
                    continue
    return removed


def cycle(config):
    profile = Path(config["profile"])
    legacy_queue = profile / "data/video_backups"
    queue = legacy_queue
    manifest = profile / "profile.json"
    version = json.loads(manifest.read_text()).get("schema_version") if manifest.exists() else 1
    if type(version) is not int or version not in (1, 2, 3):
        raise ValueError("unsupported profile schema")
    output_root = profile / ("renders" if version >= 2 else "output")
    db_queue = profile / ".system/runtime/video_backups" if version >= 2 else queue
    if version >= 3:
        queue = db_queue
    queue.mkdir(parents=True, exist_ok=True, mode=0o700)
    activation_path = queue / "activation.json"
    if not activation_path.exists():
        atomic_json(
            activation_path, {"started_at": datetime.now(timezone.utc).isoformat()}
        )
    activation = json.loads(activation_path.read_text())["started_at"]
    errors = []
    if version >= 2 and (legacy_queue / "queue.sqlite3").exists():
        errors.append({"kind": "legacy_queue", "error": "requires explicit migration"})
    enqueued = 0
    try:
        specs, discovery_errors = discover(
            profile / ("data/json/jobs.json" if version >= 3 else "data/jobs/jobs.json"),
            output_root,
            Path(config["templates"]),
            activation,
            queue / "events",
            profile_root=profile if version >= 2 else None,
        )
        errors.extend(discovery_errors)
        for spec in specs:
            try:
                enqueued += bool(enqueue_spec(db_queue / "queue.sqlite3", spec))
            except Exception as exc:
                errors.append(
                    {
                        "kind": "enqueue",
                        "id": spec.get("job_id"),
                        "error": type(exc).__name__,
                    }
                )
    except Exception as exc:
        errors.append({"kind": "discovery", "error": type(exc).__name__})
    worker_error = None
    try:
        process_pending(
            db_queue,
            Path(config["mount"]),
            config["uuid"],
            [output_root, profile / "data", Path(config["templates"])] +
            ([profile / "productions", profile / "resources"] if version >= 2 else []),
        )
    except BlockingIOError:
        pass
    except Exception as exc:
        worker_error = type(exc).__name__
    removed = reap_workspaces([output_root, Path(config["templates"])] +
                              ([profile / ".system/runtime"] if version >= 2 else []))
    with contextlib.closing(init_db(db_queue / "queue.sqlite3")) as db:
        counts = dict(db.execute("SELECT status,count(*) FROM backups GROUP BY status"))
        failures = [
            {"job_id": r[0], "attempts": r[1], "error": r[2]}
            for r in db.execute(
                "SELECT job_id,attempts,error FROM backups WHERE status='error' ORDER BY updated DESC LIMIT 20"
            )
        ]
    status = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "active_since": activation,
        "counts": counts,
        "errors": errors[:20],
        "backup_failures": failures,
        "worker_error": worker_error,
        "enqueued": enqueued,
        "scratch_removed": removed,
        "backup_root": str(Path(config["mount"]) / "nexa-brief/producciones"),
    }
    atomic_json(queue / "status.json", status)
    return status


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    config = json.loads(args.config.read_text())
    queue = Path(config["profile"]) / "data/video_backups"
    manifest = Path(config["profile"]) / "profile.json"
    if manifest.exists() and json.loads(manifest.read_text()).get("schema_version", 1) >= 3:
        queue = Path(config["profile"]) / ".system/runtime/video_backups"
    queue.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (queue / "supervisor.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        previous = None
        while True:
            status = cycle(config)
            signal = {
                k: status[k]
                for k in ["counts", "errors", "backup_failures", "worker_error"]
            }
            signal["backup_failures"] = [
                {k: v for k, v in r.items() if k != "attempts"}
                for r in signal["backup_failures"]
            ]
            if signal != previous or status["enqueued"] or status["scratch_removed"]:
                print(json.dumps(signal, ensure_ascii=False), flush=True)
                previous = signal
            if args.once:
                break
            time.sleep(max(5, config.get("interval_seconds", 15)))


if __name__ == "__main__":
    main()
