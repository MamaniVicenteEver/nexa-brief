"""Pure path resolution for profile layouts; no filesystem or credential access."""

from dataclasses import dataclass, replace
from pathlib import Path


@dataclass(frozen=True)
class ProfileLayout:
    root: Path
    schema_version: int
    data_dir: Path
    logs_dir: Path
    productions_dir: Path
    renders_dir: Path
    resources_dir: Path
    sandbox_dir: Path
    system_dir: Path
    runtime_dir: Path
    cache_dir: Path
    connections_dir: Path
    tiktok_dir: Path
    web_data_dir: Path
    config_dir: Path

    @property
    def designs_dir(self) -> Path:
        """Reusable profile designs; episode files remain in productions_dir."""
        return self.root / "designs"


def resolve_profile_layout(root: Path, schema_version: int) -> ProfileLayout:
    """Resolve paths only; never create directories or read the manifest."""
    root = Path(root)
    if not root.is_absolute():
        raise ValueError("Profile root must be absolute")
    if type(schema_version) is not int or schema_version not in (1, 2, 3):
        raise ValueError("Unsupported profile layout version")
    if schema_version == 1:
        return ProfileLayout(
            root, 1, root / "data", root / "logs", root / "productions",
            root / "output", root / "data/library/files", root / "sandbox",
            root, root / "data", root / "data", root / "connections",
            root / "tiktok", root / "web-data", root / "config",
        )
    system = root / ".system"
    return ProfileLayout(
        root, schema_version, root / "data", root / "logs", root / "productions",
        root / "renders", root / "resources", root / "sandbox", system,
        system / "runtime", system / "cache", system / "connections",
        system / "tiktok", system / "web-data", root / "config",
    )


def layout_for_settings(settings) -> ProfileLayout:
    """Resolve a selected profile or the configured legacy paths without one."""
    root = getattr(settings, "storage_profile_dir", None)
    version = getattr(settings, "storage_layout_version", 1)
    if root:
        return resolve_profile_layout(Path(root), version)
    data = Path(settings.data_dir)
    layout = resolve_profile_layout(data.parent, 1)
    return replace(layout, data_dir=data, runtime_dir=data, cache_dir=data,
                   resources_dir=data / "library/files", renders_dir=Path(settings.output_dir))
