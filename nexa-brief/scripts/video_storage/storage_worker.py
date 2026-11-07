#!/usr/bin/env python3
"""Independent, durable per-video backup worker. No API or Docker dependency."""

from __future__ import annotations
import argparse
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import shutil
import sqlite3
import stat
import subprocess
import time
import uuid

FORBIDDEN = {
    "work",
    "results",
    "frames",
    "cache",
    ".cache",
    "__pycache__",
    "node_modules",
    ".venv",
    "venv",
    "accounts",
    "connections",
    ".git",
}
SECRET = re.compile(
    r"(password|passwd|secret|token|credential|api[_-]?key|private[_-]?key)", re.I
)
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,128}$")


def safe_components(path):
    for part in path.parts:
        low = part.lower()
        if (
            low in FORBIDDEN
            or low in {"accounts.json", "users.json"}
            or low.startswith("client_secret")
            or low == ".env"
            or low.startswith(".env.")
            or low.endswith((".pem", ".key", ".p12", ".pfx"))
        ):
            raise ValueError(f"Forbidden path component: {part}")


def validate_spec(spec):
    if (
        not isinstance(spec, dict)
        or not isinstance(spec.get("job_id"), str)
        or not spec["job_id"]
        or len(spec["job_id"]) > 512
        or "\x00" in spec["job_id"]
    ):
        raise ValueError("Invalid job_id")
    if (
        not isinstance(spec.get("metadata"), dict)
        or not isinstance(spec.get("files"), list)
        or not spec["files"]
    ):
        raise ValueError("metadata and nonempty files required")

    def validate_metadata(value):
        if isinstance(value, dict):
            for key, val in value.items():
                if SECRET.search(str(key)):
                    raise ValueError("Secret metadata key rejected")
                validate_metadata(val)
        elif isinstance(value, list):
            for val in value:
                validate_metadata(val)

    validate_metadata(spec["metadata"])
    targets = set()
    for entry in spec["files"]:
        if not isinstance(entry, dict) or set(entry) not in (
            {"source", "target"},
            {"source", "target", "expected_size", "expected_mtime_ns"},
        ):
            raise ValueError("Invalid file entry")
        if "expected_size" in entry and any(
            type(entry[k]) is not int or entry[k] < 0
            for k in ("expected_size", "expected_mtime_ns")
        ):
            raise ValueError("Invalid file signature")
        source, raw = entry["source"], entry["target"]
        if (
            not isinstance(source, str)
            or not os.path.isabs(source)
            or not isinstance(raw, str)
        ):
            raise ValueError("Invalid path")
        target = PurePosixPath(raw)
        if (
            not raw
            or raw.startswith("/")
            or any(p in ("", ".", "..") for p in raw.split("/"))
        ):
            raise ValueError("Invalid target")
        safe_components(Path(source))
        safe_components(target)
        if raw in targets or raw == "manifest.json":
            raise ValueError("Duplicate or reserved target")
        targets.add(raw)
    json.dumps(spec, ensure_ascii=False, allow_nan=False)
    return spec


def init_db(db_path):
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    db = sqlite3.connect(db_path, timeout=30)
    os.chmod(db_path, 0o600)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute(
        "CREATE TABLE IF NOT EXISTS backups (job_id TEXT PRIMARY KEY, spec TEXT NOT NULL, spec_hash TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, error TEXT, updated REAL NOT NULL)"
    )
    db.commit()
    return db


def enqueue(db_path, spec):
    validate_spec(spec)
    payload = json.dumps(
        spec, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
    )
    digest = hashlib.sha256(payload.encode()).hexdigest()
    with contextlib.closing(init_db(db_path)) as db, db:
        before = db.execute(
            "SELECT spec_hash FROM backups WHERE job_id=?", (spec["job_id"],)
        ).fetchone()
        if before and before[0] == digest:
            return False
        db.execute(
            "INSERT INTO backups(job_id,spec,spec_hash,status,attempts,error,updated) VALUES(?,?,?,'queued',0,NULL,?) ON CONFLICT(job_id) DO UPDATE SET spec=excluded.spec,spec_hash=excluded.spec_hash,status='queued',attempts=0,error=NULL,updated=excluded.updated",
            (spec["job_id"], payload, digest, time.time()),
        )
    return True


def mount_guard(mount, expected_uuid, fd=None):
    mount = str(Path(mount).resolve())
    try:
        result = subprocess.run(
            ["findmnt", "-n", "-P", "-o", "TARGET,UUID,ID", "--mountpoint", mount],
            capture_output=True,
            text=True,
            check=True,
        )
        pairs = dict(item.split("=", 1) for item in shlex.split(result.stdout.strip()))
        if (
            pairs.get("TARGET") != mount
            or pairs.get("UUID", "").upper() != expected_uuid.upper()
        ):
            raise RuntimeError("HDD mount/UUID mismatch")
        if fd is not None:
            fields = dict(
                line.split(":", 1)
                for line in Path(f"/proc/self/fdinfo/{fd}").read_text().splitlines()
                if ":" in line
            )
            if fields.get("mnt_id", "").strip() != pairs.get("ID"):
                raise RuntimeError("HDD mount changed")
    except (subprocess.SubprocessError, OSError, ValueError) as exc:
        raise RuntimeError("HDD mount unavailable") from exc


def under(path, roots):
    return any(path == root or root in path.parents for root in roots)


def opened_source(source, roots):
    path = Path(source).resolve(strict=True)
    safe_components(path)
    if not under(path, roots):
        raise ValueError("Source escapes allowlisted roots")
    f = path.open("rb")
    try:
        actual = Path(os.readlink(f"/proc/self/fd/{f.fileno()}")).resolve(strict=True)
        if not under(actual, roots) or not actual.is_file():
            raise ValueError("Invalid source file")
        safe_components(actual)
        return f
    except BaseException:
        f.close()
        raise


def sync_dir(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def verify_copy(path, expected_digest, expected_size):
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as f:
        while True:
            block = f.read(1024 * 1024)
            if not block:
                break
            digest.update(block)
            size += len(block)
    if size != expected_size or digest.hexdigest() != expected_digest:
        raise RuntimeError("Backup verification failed")


def process_spec(spec, mount, expected_uuid, allowed_roots):
    validate_spec(spec)
    roots = [Path(p).resolve(strict=True) for p in allowed_roots]
    if not roots:
        raise ValueError("At least one allowlisted root is required")
    mount_guard(mount, expected_uuid)
    fd = os.open(mount, os.O_RDONLY | os.O_DIRECTORY)
    stage = None
    try:
        mount_guard(mount, expected_uuid, fd)
        # Anchoring writes to this fd prevents a disconnected mount from falling back to SSD.
        base = Path(f"/proc/self/fd/{fd}") / "nexa-brief"
        if not base.is_dir() or base.is_symlink():
            raise RuntimeError("Backup root missing")
        dest = base / "producciones"
        dest.mkdir(exist_ok=True)
        if dest.is_symlink():
            raise RuntimeError("Unsafe backup directory")
        generations = dest / ".generations"
        generations.mkdir(exist_ok=True)
        if generations.is_symlink():
            raise RuntimeError("Unsafe generation directory")
        job_id = "job-" + hashlib.sha256(spec["job_id"].encode()).hexdigest()
        target = dest / job_id
        if target.exists() and not target.is_symlink():
            raise RuntimeError("Existing destination is not a managed symlink")
        current = os.readlink(target) if target.is_symlink() else ""
        # Reap only this job's unreferenced generations after an interrupted run.
        mount_guard(mount, expected_uuid, fd)
        for old in generations.glob(job_id + "--" + "[0-9a-f]" * 32):
            if (
                current != ".generations/" + old.name
                and old.is_dir()
                and not old.is_symlink()
            ):
                shutil.rmtree(old)
        name = f"{job_id}--{uuid.uuid4().hex}"
        stage = generations / name
        stage.mkdir(mode=0o700)
        manifest_files, seen = [], {}
        for entry in spec["files"]:
            mount_guard(mount, expected_uuid, fd)
            out = stage / entry["target"]
            out.parent.mkdir(parents=True, exist_ok=True)
            digest = hashlib.sha256()
            with opened_source(entry["source"], roots) as src, out.open("xb") as dst:
                before = os.fstat(src.fileno())
                expected = (
                    entry.get("expected_size", before.st_size),
                    entry.get("expected_mtime_ns", before.st_mtime_ns),
                )
                if (before.st_size, before.st_mtime_ns) != expected:
                    raise RuntimeError("Source differs from discovered signature")
                while True:
                    block = src.read(1024 * 1024)
                    if not block:
                        break
                    digest.update(block)
                    dst.write(block)
                dst.flush()
                os.fsync(dst.fileno())
                after = os.fstat(src.fileno())
                if (before.st_size, before.st_mtime_ns, before.st_ino) != (
                    after.st_size,
                    after.st_mtime_ns,
                    after.st_ino,
                ) or (after.st_size, after.st_mtime_ns) != expected:
                    raise RuntimeError("Source changed during backup")
            key = (digest.hexdigest(), before.st_size)
            if key in seen:
                out.unlink()
                os.link(seen[key], out)
            else:
                seen[key] = out
            mount_guard(mount, expected_uuid, fd)
            verify_copy(out, key[0], key[1])
            manifest_files.append(
                {
                    "target": entry["target"],
                    "sha256": key[0],
                    "bytes": key[1],
                    "original_mode": stat.S_IMODE(before.st_mode),
                    "original_mtime_ns": before.st_mtime_ns,
                }
            )
        manifest = {
            "version": 1,
            "job_id": spec["job_id"],
            "metadata": spec["metadata"],
            "files": manifest_files,
        }
        with (stage / "manifest.json").open("x", encoding="utf-8") as f:
            json.dump(
                manifest,
                f,
                ensure_ascii=False,
                sort_keys=True,
                indent=2,
                allow_nan=False,
            )
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        sync_dir(stage)
        mount_guard(mount, expected_uuid, fd)
        target = dest / job_id
        if target.exists() and not target.is_symlink():
            raise RuntimeError("Existing destination is not a managed symlink")
        temp_link = dest / (".publish-" + uuid.uuid4().hex)
        try:
            os.symlink(".generations/" + name, temp_link)
            mount_guard(mount, expected_uuid, fd)
            os.replace(temp_link, target)
        finally:
            temp_link.unlink(missing_ok=True)
        stage = None
        sync_dir(dest)
        # Only remove prior generations belonging to this exact job after publishing.
        for old in generations.glob(job_id + "--" + "[0-9a-f]" * 32):
            if old.name != name and old.is_dir() and not old.is_symlink():
                shutil.rmtree(old)
        return manifest
    finally:
        if stage is not None and stage.is_dir():
            shutil.rmtree(stage, ignore_errors=True)
        os.close(fd)


def process_queue(db_path, mount, expected_uuid, allowed_roots):
    db_path = Path(db_path)
    db = init_db(db_path)
    lock_path = db_path.with_suffix(".lock")
    try:
        with lock_path.open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            rows = db.execute(
                "SELECT job_id,spec,spec_hash FROM backups WHERE status IN ('queued','error') ORDER BY updated"
            ).fetchall()
            for job_id, payload, digest in rows:
                try:
                    process_spec(
                        json.loads(payload), mount, expected_uuid, allowed_roots
                    )
                except Exception as exc:
                    with db:
                        db.execute(
                            "UPDATE backups SET status='error',attempts=attempts+1,error=?,updated=? WHERE job_id=? AND spec_hash=?",
                            (
                                f"{type(exc).__name__}: {exc}"[:1000],
                                time.time(),
                                job_id,
                                digest,
                            ),
                        )
                else:
                    with db:
                        db.execute(
                            "UPDATE backups SET status='done',attempts=attempts+1,error=NULL,updated=? WHERE job_id=? AND spec_hash=?",
                            (time.time(), job_id, digest),
                        )
            return len(rows)
    finally:
        db.close()


# Public API for the host supervisor and discovery process.
enqueue_spec = enqueue


def process_pending(queue_dir, mount, expected_uuid, allowed_roots):
    return process_queue(
        Path(queue_dir) / "queue.sqlite3", mount, expected_uuid, allowed_roots
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--db",
        type=Path,
        default=Path.home()
        / ".local/share/nexa-brief/profiles/profesional/data/video_backups/queue.sqlite3",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    push = sub.add_parser("enqueue")
    push.add_argument("--spec", type=Path, required=True)
    run = sub.add_parser("run")
    run.add_argument("--mount", type=Path, required=True)
    run.add_argument("--uuid", required=True)
    run.add_argument("--allow-root", action="append", required=True)
    run.add_argument("--once", action="store_true")
    run.add_argument("--interval", type=float, default=60)
    args = parser.parse_args()
    if args.command == "enqueue":
        print(
            "queued"
            if enqueue(args.db, json.loads(args.spec.read_text(encoding="utf-8")))
            else "unchanged"
        )
        return
    if args.interval <= 0:
        parser.error("--interval must be positive")
    while True:
        process_queue(args.db, args.mount, args.uuid, args.allow_root)
        if args.once:
            return
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
