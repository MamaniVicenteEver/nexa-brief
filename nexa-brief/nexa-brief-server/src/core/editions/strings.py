"""Lossless extraction/application using audited paths, with no key-name heuristics."""
from __future__ import annotations
from copy import deepcopy
from typing import Iterator
from .schemas import Localizable


def values_at(data, pattern: str) -> Iterator[tuple[tuple, object]]:
    def walk(value, parts, path):
        if not parts:
            yield path, value
            return
        key, *tail = parts
        if key == "*" and isinstance(value, list):
            for index, item in enumerate(value):
                yield from walk(item, tail, (*path, index))
        elif isinstance(value, dict) and key in value:
            yield from walk(value[key], tail, (*path, key))
    yield from walk(data, pattern.split("."), ())


def _pointer(path):
    return "/" + "/".join(str(p).replace("~", "~0").replace("/", "~1") for p in path)


def _collect(doc, rules, prefix=()):
    for pattern, rule in rules.items():
        if not rule.translate or rule.type in ("enum", "media"):
            continue
        for path, value in values_at(doc, pattern):
            # A union field like marks.* can also hold {text, at}; only its text leaf is exposed.
            if isinstance(value, str):
                yield _pointer((*prefix, *path)), {"text": value, "type": rule.type, "max_chars": rule.max_chars}


def extract_strings(script: dict, storyboard: dict, localizable: Localizable | dict) -> dict[str, dict]:
    spec = Localizable.model_validate(localizable) if isinstance(localizable, dict) else localizable
    out = dict(_collect(script, spec.script, ("script",)))
    out.update(_collect(storyboard, spec.storyboard, ("storyboard",)))
    for index, beat in enumerate(storyboard.get("beats", [])):
        name = beat.get("use", "")
        if name not in spec.components:
            raise ValueError(f"No localizable contract for component: {name}")
        out.update(_collect(beat.get("params") or {}, spec.components[name].fields, ("storyboard", "beats", index, "params")))
    return out


def apply_strings(script: dict, storyboard: dict, strings: dict, localizable: Localizable | dict, *, external_target_components=()) -> tuple[dict, dict]:
    allowed = extract_strings(script, storyboard, localizable)
    extra = strings.keys() - allowed.keys()
    if extra:
        raise ValueError(f"Unknown or protected string keys: {sorted(extra)}")
    docs = {"script": deepcopy(script), "storyboard": deepcopy(storyboard)}
    for key, entry in strings.items():
        text = entry["text"] if isinstance(entry, dict) else entry
        if not isinstance(text, str):
            raise ValueError(f"Expected text for {key}")
        rule = allowed[key]
        if text != rule["text"] and len(text) > rule["max_chars"]:
            raise ValueError(f"{key} exceeds {rule['max_chars']} characters")
        parts = [p.replace("~1", "/").replace("~0", "~") for p in key.lstrip("/").split("/")]
        node = docs
        for part in parts[:-1]:
            node = node[int(part)] if isinstance(node, list) else node[part]
        leaf = int(parts[-1]) if isinstance(node, list) else parts[-1]
        node[leaf] = text
    # Validate changed highlights together with their target, after all strings have been applied.
    spec = Localizable.model_validate(localizable) if isinstance(localizable, dict) else localizable
    for i, beat in enumerate(docs["storyboard"].get("beats", [])):
        params = beat.get("params") or {}
        for pattern, rule in spec.components[beat["use"]].fields.items():
            if not rule.type.startswith("substring:"):
                continue
            field = rule.type.split(":", 1)[1]
            target = params.get(field, "")
            # A missing target may be resolved against external text by the caller.
            if not target and beat["use"] in external_target_components:
                continue
            for path, value in values_at(params, pattern):
                pointer = _pointer(("storyboard", "beats", i, "params", *path))
                changed = any(
                    key in strings and (strings[key]["text"] if isinstance(strings[key], dict) else strings[key]) != allowed[key]["text"]
                    for key in allowed if key.startswith(f"/storyboard/beats/{i}/params/")
                )
                if changed and value and str(value).casefold() not in target.casefold():
                    raise ValueError(f"{pointer} must be a substring of {field}")
    return docs["script"], docs["storyboard"]
