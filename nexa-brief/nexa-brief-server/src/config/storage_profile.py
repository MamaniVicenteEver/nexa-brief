"""Resolve a dataset without coupling it to development/production or a provider."""

from __future__ import annotations
import json
import os
import re
from pathlib import Path

PROFILE_ID = re.compile(r"^[a-z][a-z0-9_-]{0,47}$")
DEFAULT_PROVIDERS = {
    "records": "json",
    "publications": "json",
    "credentials": "encrypted_json",
    "users": "json",
    "media": "filesystem",
}


def load_profile(root: Path) -> dict:
    if not root.is_absolute():
        raise ValueError("NEXA_PROFILE_DIR must be an absolute path")
    value = json.loads((root / "profile.json").read_text(encoding="utf-8"))
    if value.get("schema_version") != 1 or not PROFILE_ID.fullmatch(str(value.get("id", ""))):
        raise ValueError("Invalid storage profile manifest")
    providers = {**DEFAULT_PROVIDERS, **value.get("providers", {})}
    if set(providers) != set(DEFAULT_PROVIDERS) or any(not PROFILE_ID.fullmatch(str(v)) for v in providers.values()):
        raise ValueError("Invalid storage provider selection")
    return {**value, "providers": providers}


def apply_profile(values: dict) -> dict:
    values = dict(values)
    root = values.get("NEXA_PROFILE_DIR")
    if "NEXA_PROFILE_DIR" not in values:
        selector = (
            Path(os.environ.get("XDG_CONFIG_HOME", str(Path.home() / ".config"))) / "nexa-brief/storage-profile.json"
        )
        if selector.exists():
            root = json.loads(selector.read_text()).get("profile_dir")
    if not root:
        return values
    root = Path(root).expanduser()
    profile = load_profile(root)
    service_port = int(profile.get("services", {}).get("tiktok", {}).get("port", 8100))
    from urllib.parse import urlsplit

    service_url = urlsplit(values.get("TIKTOK_SERVICE_URL", "http://127.0.0.1:8100"))
    values["TIKTOK_SERVICE_URL"] = f"{service_url.scheme}://{service_url.hostname}:{service_port}"
    values.update(
        {
            "NEXA_PROFILE_DIR": root,
            "storage_profile_id": profile["id"],
            "storage_profile_label": profile.get("label", profile["id"]),
            "DATA_DIR": root / "data",
            "output_dir": root / "output",
            "ACCOUNTS_JSON_PATH": root / "connections/accounts.json",
            "SHARED_CONNECTIONS_DIR": root / "connections",
            "DATA_BACKEND": profile["providers"]["records"],
            "PUBLICATION_BACKEND": profile["providers"]["publications"],
            "CREDENTIALS_BACKEND": profile["providers"]["credentials"],
            "MEDIA_BACKEND": profile["providers"]["media"],
            "TIKTOK_IDEMPOTENCY_NAMESPACE": profile["id"][:32],
            "niches_path": root / "config/niches.json",
            "image_styles_dir": root / "config/image-styles",
        }
    )
    return values
