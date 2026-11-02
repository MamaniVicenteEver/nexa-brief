"""Control editorial de pertinencia para producciones con política v4."""

from __future__ import annotations

from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import unicodedata

KIT = Path(__file__).resolve().parents[1]


def _plain(value: str) -> str:
    return unicodedata.normalize("NFKD", value.casefold()).encode("ascii", "ignore").decode()


def visible_media(beat: dict, catalog: dict) -> list[str]:
    params = beat["b"].get("params") or {}
    spec = catalog.get(beat["use"], {}).get("params", {})
    has_video = any(params.get(key) and rule.get("type") == "video" for key, rule in spec.items())
    return list(dict.fromkeys(
        str(params[key]) for key, rule in spec.items()
        if rule.get("type") in ("image", "video") and params.get(key)
        and key != "logo" and (key != "poster" or (not has_video and beat["use"] == "common.tabloid"))
    ))


def _digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def _credit_urls(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if " — " not in line:
            continue
        url = re.search(r"https?://[^\s]+", line)
        if url:
            out[line.split(" — ", 1)[0]] = url.group().rstrip(".,)")
    return out


def reused_elsewhere(proto: Path, sources: set[str]) -> dict[str, list[str]]:
    """Compara tamaño antes de calcular hashes; nunca abre medios ajenos sin coincidencia."""
    local = {source: proto / source for source in sources if (proto / source).is_file()}
    sizes = {path.stat().st_size for path in local.values()}
    if not sizes:
        return {}
    candidates: dict[int, list[Path]] = {}
    templates = KIT.parents[1]
    paths = (*templates.glob("*/*/assets/media/**/*"), *templates.glob("sandbox/*/*/assets/media/**/*"))
    for path in paths:
        if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".mp4"}:
            if proto not in path.parents and path.stat().st_size in sizes:
                candidates.setdefault(path.stat().st_size, []).append(path)
    own_urls = _credit_urls(proto / "assets/media/CREDITS.md")
    credit_paths = (*templates.glob("*/*/assets/media/CREDITS.md"),
                    *templates.glob("sandbox/*/*/assets/media/CREDITS.md"))
    other_urls: dict[str, set[str]] = {}
    for credit_path in credit_paths:
        if proto in credit_path.parents:
            continue
        production = str(credit_path.parent.parent.parent.relative_to(templates))
        for url in _credit_urls(credit_path).values():
            other_urls.setdefault(url, set()).add(production)
    matches: dict[str, list[str]] = {}
    for source, path in local.items():
        peers = candidates.get(path.stat().st_size, [])
        found = set(other_urls.get(own_urls.get(path.name, ""), set()))
        if peers:
            digest = _digest(path)
            found.update(str(peer.parent.parent.parent.relative_to(templates))
                         for peer in peers if _digest(peer) == digest)
        if found:
            matches[source] = sorted(found)
    return matches


def check(proto: Path, config: dict, beats: list[dict], catalog: dict,
          errs: list[str], warns: list[str]) -> tuple[list[dict], dict]:
    policy = json.loads((KIT / "media-relevance.json").read_text(encoding="utf-8"))
    required = config.get("quality_policy_version", 1) >= policy["policy_version"]
    patterns = [re.compile(expr, re.I) for expr in policy["generic_patterns"]]
    credits_path = proto / "assets/media/CREDITS.md"
    credits = credits_path.read_text(encoding="utf-8") if credits_path.is_file() else ""
    credit_lines = {line.split(" — ", 1)[0]: line for line in credits.splitlines() if " — " in line}
    entries: list[dict] = []
    generic_beats: set[int] = set()
    for beat in beats:
        sources = visible_media(beat, catalog)
        if not sources:
            continue
        raw = beat["b"]
        shows = str(raw.get("shows") or "").strip()
        query = str(raw.get("query") or "").strip()
        reviews = raw.get("media_review") or ""
        anchor = str(raw.get("at") or raw.get("t") or "").strip()
        if required:
            for key, value in (("shows", shows), ("query", query)):
                if not value:
                    errs.append(f"beat #{beat['i']}: falta {key}; describí el sujeto concreto, la búsqueda y confirmá qué muestra el medio según la frase narrada")
        for source in sources:
            review = str((reviews.get(source) or reviews.get(Path(source).name) or "") if isinstance(reviews, dict)
                         else reviews if len(sources) == 1 else "").strip()
            if required and len(review) < 12:
                errs.append(f"beat #{beat['i']}: falta media_review para {source}; confirmá por escrito qué muestra este medio según la frase narrada")
            entry = {"beat": beat["i"], "anchor": anchor, "source": source,
                     "shows": shows, "query": query, "review": review}
            entries.append(entry)
            label = _plain(Path(source).stem + " " + credit_lines.get(Path(source).name, ""))
            if any(pattern.search(label) for pattern in patterns):
                generic_beats.add(beat["i"])
    reuse = reused_elsewhere(proto, {entry["source"] for entry in entries}) if required else {}
    for entry in entries:
        if entry["source"] in reuse:
            entry["reused_from"] = reuse[entry["source"]]
            warns.append(f"beat #{entry['beat']}: {entry['source']} también se usa en {', '.join(reuse[entry['source']])}; justificá en shows por qué representa esta frase")
    if required and len(generic_beats) > policy["generic_max_beats"]:
        errs.append(f"storyboard: {len(generic_beats)} beats con medios genéricos de relleno (máximo {policy['generic_max_beats']}); buscá el sujeto concreto de cada frase y usá foto relevante con movimiento si no hay clip")
    return entries, {"policy_version": policy["policy_version"], "required": required,
                     "media_beats": len({entry["beat"] for entry in entries}),
                     "reviewed": sum(len(entry["review"]) >= 12 for entry in entries),
                     "generic_beats": len(generic_beats), "reused_sources": len(reuse),
                     "status": "reviewed" if required and entries and all(len(entry["review"]) >= 12 for entry in entries) else ("pending" if required else "legacy")}
