#!/usr/bin/env python3
"""Install a guarded daily server backup; never mounts or repairs a disk."""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--at", default="03:00", help="Daily time in America/La_Paz")
    args = parser.parse_args()
    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", args.at):
        parser.error("Use HH:MM")
    home = Path.home()
    project = Path(__file__).resolve().parents[2]
    config_dir = home / ".config/nexa-brief"
    config_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    key = config_dir / "full-backup-password"
    if not key.exists():
        fd = os.open(key, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "w") as stream:
            stream.write(secrets.token_urlsafe(48) + "\n")
    config_path = config_dir / "full-backup.json"
    config = {
        "home": str(home), "mount": str(home / ".local/mnt/nexa-backups"),
        "uuid": "6E2621FB2621C4C5", "repository": "nexa-brief/full-profile-backups",
        "restic": str(home / ".local/bin/restic"), "password_file": str(key),
        "host": "alfred-server", "state_dir": str(home / ".local/state/nexa-brief/full-backup"),
        "sources": [str(project.parent), str(home / ".local/share/nexa-brief/profiles"), str(config_dir)],
        "minimum_free_bytes": 2 * 1024**3,
    }
    if config_path.exists() and json.loads(config_path.read_text()) != config:
        raise SystemExit("Existing full-backup config differs; refusing to overwrite it")
    if not config_path.exists():
        fd = os.open(config_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "w") as stream:
            json.dump(config, stream, indent=2)
    units = home / ".config/systemd/user"
    units.mkdir(parents=True, exist_ok=True)
    (units / "nexa-full-backup.service").write_text(f"""[Unit]
Description=Nexa Brief - verified encrypted full backup to HDD

[Service]
Type=oneshot
ExecStart=/usr/bin/python3 {project}/scripts/profile_backups/backup.py --config {config_path}
UMask=0077
Nice=15
IOSchedulingClass=idle
MemoryMax=768M
TimeoutStartSec=12h
NoNewPrivileges=true
""")
    (units / "nexa-full-backup.timer").write_text(f"""[Unit]
Description=Nexa Brief - daily backup at {args.at} Bolivia

[Timer]
OnCalendar=*-*-* {args.at}:00 America/La_Paz
Persistent=true
AccuracySec=1min
Unit=nexa-full-backup.service

[Install]
WantedBy=timers.target
""")
    subprocess.run(["systemd-analyze", "calendar", f"*-*-* {args.at}:00 America/La_Paz"], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
    subprocess.run(["systemctl", "--user", "enable", "--now", "nexa-full-backup.timer"], check=True)
    print(f"Daily backup scheduled at {args.at} America/La_Paz; password file created privately, never displayed")


if __name__ == "__main__":
    main()
