import json
import os
import subprocess
from pathlib import Path

home = Path.home()
project = Path(__file__).resolve().parents[2]
profile = home / ".local/share/nexa-brief/profiles/profesional"
config = home / ".config/nexa-brief/video-storage.json"
config.parent.mkdir(parents=True, exist_ok=True)
value = {
    "profile": str(profile),
    "templates": str(project / "nexa-brief-server/src/templates"),
    "mount": str(home / ".local/mnt/nexa-backups"),
    "uuid": "6E2621FB2621C4C5",
    "interval_seconds": 15,
}
if config.exists():
    assert json.loads(config.read_text()) == value, "Existing backup config differs"
else:
    config.write_text(json.dumps(value, indent=2))
    os.chmod(config, 0o600)
unit = home / ".config/systemd/user/nexa-video-storage.service"
unit.parent.mkdir(parents=True, exist_ok=True)
unit.write_text(f"""[Unit]
Description=Nexa Brief - verified video backup and render scratch cleanup
After=default.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 {project}/scripts/video_storage/storage_supervisor.py --config {config}
Restart=always
RestartSec=15
TimeoutStopSec=20
UMask=0077
Nice=10
IOSchedulingClass=idle
MemoryMax=384M
NoNewPrivileges=true
LogRateLimitIntervalSec=60
LogRateLimitBurst=10

[Install]
WantedBy=default.target
""")
subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
subprocess.run(
    ["systemctl", "--user", "enable", "--now", "nexa-video-storage.service"], check=True
)
print("video storage service enabled; config private; linger already enabled")
