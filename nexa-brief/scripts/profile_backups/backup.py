#!/usr/bin/env python3
"""Host-only incremental backups. Refuse an absent or replaced backup volume."""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.video_storage.storage_worker import mount_guard

EXCLUDED_DIRS = {"node_modules", ".venv", ".next", "__pycache__", ".pytest_cache",
                 ".ruff_cache", ".mypy_cache", ".cache", "Cache", "Code Cache", "GPUCache"}
EXCLUDED_TAILS = {(".system", "runtime"), (".system", "cache"), ("logs", "runtime")}


class BackupFailure(RuntimeError):
    pass


def atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temporary = tempfile.mkstemp(prefix=".backup-state-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            json.dump(value, stream, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def excluded(path: Path, key: Path) -> bool:
    parts = path.parts
    return (path == key or any(p in EXCLUDED_DIRS for p in parts)
            or any(tuple(parts[i:i+2]) in EXCLUDED_TAILS for i in range(len(parts)-1)))


def source_fingerprint(sources: list[Path], key: Path) -> str:
    """Metadata only: never open credentials. Reject a changing source tree."""
    digest = hashlib.sha256()
    for source in sorted(sources):
        if not source.exists() or source.is_symlink():
            raise BackupFailure("A configured source is absent or symbolic")
        paths = [source]
        if source.is_dir():
            for folder, dirs, names in os.walk(source, followlinks=False):
                dirs[:] = sorted(d for d in dirs if not excluded(Path(folder)/d, key))
                paths.extend(Path(folder)/name for name in dirs)
                paths.extend(Path(folder)/name for name in sorted(names)
                             if not excluded(Path(folder)/name, key))
        for path in paths:
            st = path.lstat()
            if not (stat.S_ISREG(st.st_mode) or stat.S_ISDIR(st.st_mode) or stat.S_ISLNK(st.st_mode)):
                continue
            # Directory mtimes include excluded runtime/cache activity; hash file metadata.
            if stat.S_ISDIR(st.st_mode):
                digest.update(json.dumps([str(path), st.st_mode]).encode())
                continue
            digest.update(json.dumps([str(path), st.st_dev, st.st_ino, st.st_size,
                                      st.st_mtime_ns, st.st_ctime_ns, st.st_mode]).encode())
    return digest.hexdigest()


def validate(config: dict) -> tuple[Path, list[Path], Path]:
    home = Path(config["home"])
    key = Path(config["password_file"])
    sources = [Path(p) for p in config["sources"]]
    mount = Path(config["mount"])
    relative = Path(config["repository"])
    if (not home.is_absolute() or not mount.is_absolute() or mount.resolve() != mount
            or relative.is_absolute() or not relative.parts or ".." in relative.parts):
        raise BackupFailure("Invalid backup paths")
    if not sources or any(not p.is_relative_to(home) or p == home for p in sources):
        raise BackupFailure("Sources must be explicitly selected below the user home")
    if any(mount == p or mount.is_relative_to(p) for p in sources):
        raise BackupFailure("Backup destination must be outside every source")
    if (not key.is_absolute() or not key.is_file() or key.is_symlink()
            or stat.S_IMODE(key.stat().st_mode) != 0o600 or key.stat().st_uid != os.getuid()):
        raise BackupFailure("Backup password file must be private, regular and owned by this user")
    return home, sources, key


def run(config: dict) -> dict:
    home, sources, key = validate(config)
    mount = Path(config["mount"])
    mount_guard(mount, config["uuid"])
    fd = os.open(mount, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        mount_guard(mount, config["uuid"], fd)
        anchor = Path(f"/proc/self/fd/{fd}")
        repository = anchor / config["repository"]
        cache = anchor / "nexa-brief" / ".restic-cache"
        # Never let an existing symlink redirect writes back to the system SSD.
        for target in (repository, cache):
            current = anchor
            for part in target.relative_to(anchor).parts:
                current = current / part
                if current.is_symlink():
                    raise BackupFailure("Backup/cache paths cannot contain symlinks")
        binary = Path(config["restic"])
        if not binary.is_file():
            raise BackupFailure("Restic is not installed")

        def restic(args: list[str]) -> str:
            mount_guard(mount, config["uuid"], fd)
            command = [str(binary), "--repo", str(repository), "--password-file", str(key),
                       "--cache-dir", str(cache), *args]
            result = subprocess.run(command, cwd=home, pass_fds=(fd,), capture_output=True, text=True)
            mount_guard(mount, config["uuid"], fd)
            if result.returncode:
                # Source names may be private. Raw process output is not put in status/logs.
                raise BackupFailure(f"Restic {args[0]} failed (exit {result.returncode})")
            return result.stdout

        if not (repository / "config").is_file():
            if repository.exists() and any(repository.iterdir()):
                raise BackupFailure("Refusing to initialize an unrelated nonempty directory")
            restic(["init"])
        if os.statvfs(anchor).f_bavail * os.statvfs(anchor).f_frsize < config.get("minimum_free_bytes", 2 * 1024**3):
            raise BackupFailure("Insufficient free space on backup volume")

        snapshots = json.loads(restic(["snapshots", "--json", "--host", config["host"],
                                      "--tag", "nexa-full,verified"]))
        parent = max(snapshots or [], key=lambda row: row["time"], default=None)
        before = source_fingerprint(sources, key)
        args = ["backup", "--json", "--host", config["host"],
                "--tag", "nexa-full", "--tag", "pending"]
        if parent:
            args += ["--skip-if-unchanged", "--parent", parent["id"]]
        for name in sorted(EXCLUDED_DIRS):
            args += ["--exclude", f"**/{name}"]
        for a, b in sorted(EXCLUDED_TAILS):
            args += ["--exclude", f"**/{a}/{b}"]
        args += ["--exclude", key.relative_to(home).as_posix()]
        args += ["--", *(p.relative_to(home).as_posix() for p in sources)]
        output = restic(args)
        summaries = [json.loads(line) for line in output.splitlines() if line.startswith("{")]
        summary = next((r for r in reversed(summaries) if r.get("message_type") == "summary"), {})
        snapshot = summary.get("snapshot_id")
        if before != source_fingerprint(sources, key):
            # It remains pending, never marked as a verified recovery point.
            raise BackupFailure("Sources changed during backup; recovery point not verified")
        if not snapshot:
            return {"status": "unchanged", "snapshot_id": parent["id"] if parent else None}
        restic(["check", "--read-data"])
        # The captured tree was stable before/after copying. Later source edits
        # belong to the next backup; they cannot alter this immutable snapshot.
        restic(["tag", "--remove", "pending", "--add", "verified", snapshot])
        # Tag updates change the snapshot ID. Resolve the published ID explicitly.
        verified = json.loads(restic(["snapshots", "--json", "--host", config["host"],
                                     "--tag", "nexa-full,verified"]))
        latest = max(verified, key=lambda row: row["time"])
        return {"status": "verified", "snapshot_id": latest["id"],
                "data_added": summary.get("data_added", 0), "files_processed": summary.get("total_files_processed", 0)}
    finally:
        os.close(fd)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    args = parser.parse_args()
    config = json.loads(args.config.read_text())
    state = Path(config["state_dir"])
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (state / "backup.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 0
        atomic_json(state / "status.json", {
            "status": "running", "started_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            result = run(config)
            code = 0
        except Exception as exc:
            message = str(exc) if isinstance(exc, (BackupFailure, RuntimeError)) else type(exc).__name__
            result = {"status": "blocked" if "mount" in message.lower() or "HDD" in message else "failed",
                      "error": message}
            code = 75
        result["checked_at"] = datetime.now(timezone.utc).isoformat()
        atomic_json(state / "status.json", result)
        print(json.dumps(result))
        return code


if __name__ == "__main__":
    raise SystemExit(main())
