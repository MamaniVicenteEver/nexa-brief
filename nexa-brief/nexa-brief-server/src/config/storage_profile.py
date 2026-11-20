"""Resolve a dataset without coupling it to development/production or a provider."""

from __future__ import annotations
import json
import os
import re
from pathlib import Path

from src.config.profile_layout import resolve_profile_layout

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
    if type(value.get("schema_version")) is not int or value["schema_version"] not in (1, 2, 3) or not PROFILE_ID.fullmatch(str(value.get("id", ""))):
        raise ValueError("Invalid storage profile manifest")
    providers = {**DEFAULT_PROVIDERS, **value.get("providers", {})}
    if set(providers) != set(DEFAULT_PROVIDERS) or any(not PROFILE_ID.fullmatch(str(v)) for v in providers.values()):
        raise ValueError("Invalid storage provider selection")
    if providers["users"] != "json":
        raise ValueError(f"User storage provider {providers['users']} is not installed")
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
        # Path("") becomes "." in Pydantic; an explicit empty selection disables profiles.
        if "NEXA_PROFILE_DIR" in values:
            values["NEXA_PROFILE_DIR"] = None
        return values
    root = Path(root).expanduser()
    profile = load_profile(root)
    layout = resolve_profile_layout(root, profile["schema_version"])
    service_port = int(profile.get("services", {}).get("tiktok", {}).get("port", 8100))
    from urllib.parse import urlsplit

    service_url = urlsplit(values.get("TIKTOK_SERVICE_URL", "http://127.0.0.1:8100"))
    values["TIKTOK_SERVICE_URL"] = f"{service_url.scheme}://{service_url.hostname}:{service_port}"
    values.update(
        {
            "NEXA_PROFILE_DIR": root,
            "storage_profile_id": profile["id"],
            "storage_profile_label": profile.get("label", profile["id"]),
            "storage_layout_version": layout.schema_version,
            "logs_dir": layout.logs_dir,
            "productions_dir": layout.productions_dir,
            "renders_dir": layout.renders_dir,
            "resources_dir": layout.resources_dir,
            "sandbox_dir": layout.sandbox_dir,
            "system_dir": layout.system_dir,
            "runtime_dir": layout.runtime_dir,
            "cache_dir": layout.cache_dir,
            "tiktok_dir": layout.tiktok_dir,
            "web_data_dir": layout.web_data_dir,
            "DATA_DIR": layout.data_dir,
            "output_dir": layout.renders_dir,
            "ACCOUNTS_JSON_PATH": layout.connections_dir / "accounts.json",
            "SHARED_CONNECTIONS_DIR": layout.connections_dir,
            "DATA_BACKEND": profile["providers"]["records"],
            "PUBLICATION_BACKEND": profile["providers"]["publications"],
            "CREDENTIALS_BACKEND": profile["providers"]["credentials"],
            "MEDIA_BACKEND": profile["providers"]["media"],
            "TIKTOK_IDEMPOTENCY_NAMESPACE": profile["id"][:32],
            "niches_path": layout.config_dir / "niches.json",
            "image_styles_dir": layout.config_dir / "image-styles",
        }
    )
    return values
