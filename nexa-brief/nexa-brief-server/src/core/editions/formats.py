"""Global format selection, duration-derived counts and media capabilities."""
import json
import math
import re
from pathlib import Path
from .schemas import Format, DesignFormats, Localizable

SRC = Path(__file__).resolve().parents[2]
FORMATS_DIR = SRC / "skills/formats"
DEFINITIONS_DIR = SRC / "templates/_tools/design-definitions"


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_format(format_id: str) -> Format:
    if not isinstance(format_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", format_id):
        raise ValueError("Invalid format id")
    return Format.model_validate(read_json(FORMATS_DIR / f"{format_id}.json"))


def select_format(duration_seconds: float) -> str:
    rule = load_format("documental-largo").selection
    return rule.below_format if duration_seconds < rule.default_below_seconds else rule.otherwise_format


def validate_duration(seconds: float | None, spec: Format) -> float:
    d = spec.duration_seconds
    seconds = d.default if seconds is None else float(seconds)
    if not math.isfinite(seconds) or not d.min <= seconds <= d.max:
        raise ValueError(f"{spec.format_id} requires {d.min}–{d.max} seconds; got {seconds}")
    return seconds


def targets(seconds: float | None, format_id: str, wpm=(120, 130)) -> dict:
    spec = load_format(format_id)
    seconds = validate_duration(seconds, spec)
    minutes = seconds / 60
    out = {"minutes": minutes, "legacy": False, "format_id": format_id,
           "words": [math.floor(minutes * wpm[0] * spec.words_margin[0]),
                     math.ceil(minutes * wpm[1] * spec.words_margin[1])]}
    for key, (lo, hi) in spec.density.items():
        name = key.removesuffix("_per_minute")
        out[name] = [math.floor(minutes * lo), math.ceil(minutes * hi)]
    out["beats"] = out["scenes"]
    lo, hi = spec.chapter_seconds
    out["chapters"] = [max(2, math.floor(seconds / hi)), max(2, math.ceil(seconds / lo))] if spec.structure.chapters else [0, 0]
    out["domain_components"] = max((d["min"] for d in spec.domain_components if minutes >= d["from_minutes"]), default=0)
    return out


def validate_storyboard(storyboard: dict, format_id: str, design_id, *, localizable=None, design_formats=None) -> list[str]:
    """Closed component allowlist plus explicit media declarations, including nested fields."""
    spec = load_format(format_id)
    if not spec.media.only_components:
        return []
    if not isinstance(design_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", design_id):
        raise ValueError("Invalid design id")
    definitions = DEFINITIONS_DIR / design_id
    df = design_formats or DesignFormats.model_validate(read_json(definitions / "formats.json"))
    support = df.supports.get(format_id)
    if support is None:
        return [f"{design_id} does not support {format_id}"]
    loc = localizable or Localizable.model_validate(read_json(definitions / "localizable.json"))
    errors = []
    for i, beat in enumerate(storyboard.get("beats", [])):
        name = beat.get("use", "")
        if name not in support.components or name in support.excluded:
            errors.append(f"Scene {i}: {name} is not allowed in {format_id} (no photo, clip or image)")
            continue
        comp = loc.components.get(name)
        if comp is None:
            errors.append(f"Scene {i}: component has no audited media contract: {name}")
            continue
        from .strings import values_at
        params = beat.get("params") or {}
        for field, rule in comp.fields.items():
            if rule.type == "media" and any(value for _, value in values_at(params, field)):
                errors.append(f"Scene {i}: media field {name}.{field} is forbidden in {format_id}")
    return errors
