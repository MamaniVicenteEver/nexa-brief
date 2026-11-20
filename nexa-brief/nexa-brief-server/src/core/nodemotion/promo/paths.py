"""Canonical NodeMotion promo workspace paths."""
from pathlib import Path


def work_script_path(target: Path) -> Path:
    """Prefer the English campaign filename; read legacy guion.json when needed."""
    target = Path(target)
    canonical = target / "work/script.json"
    legacy = target / "work/guion.json"
    if canonical.is_file() or not legacy.is_file():
        return canonical
    return legacy
