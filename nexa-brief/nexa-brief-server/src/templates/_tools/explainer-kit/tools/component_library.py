"""Índice consultable de componentes propios aprobados en otras producciones."""

from __future__ import annotations

import difflib
import hashlib
import json
import pathlib
import re
import shutil
import unicodedata

KIT = pathlib.Path(__file__).resolve().parents[1]
TEMPLATES = KIT.parent.parent
INDEX = KIT / "component-library.json"


def _read(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def _entries(video):
    catalog = _read(video / "assets/components/catalog.json", {}).get("comps", [])
    report = _read(video / "work/components/report.json", {})
    files = list((video / "assets/components").glob("*.js"))
    entries = []
    for component in catalog:
        name = component.get("name", "")
        if not name:
            continue
        reported = (report.get(name) or {}).get("file")
        source = video / reported if reported else next((p for p in files if re.search(r"\bname\s*:\s*['\"]" + re.escape(name) + r"['\"]", p.read_text(encoding="utf-8"))), None)
        original_sheet = video / "work/components" / (name.replace(".", "-") + ".png")
        slug = "--".join(video.relative_to(TEMPLATES).parts) + "--" + name.replace(".", "-")
        sheet = KIT / "component-library/sheets" / (slug + ".png")
        if original_sheet.is_file():
            sheet.parent.mkdir(parents=True, exist_ok=True)
            if not sheet.is_file() or hashlib.sha256(sheet.read_bytes()).digest() != hashlib.sha256(original_sheet.read_bytes()).digest():
                shutil.copyfile(original_sheet, sheet)
        entries.append({
            "name": name, "summary": component.get("summary", ""), "params": component.get("params", {}),
            "video": str(video.relative_to(TEMPLATES)), "source": str(source.relative_to(TEMPLATES)) if source and source.exists() else None,
            "sheet": str(sheet.relative_to(TEMPLATES)), "sheet_exists": sheet.is_file(),
            "source_sheet": str(original_sheet.relative_to(TEMPLATES)),
            "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest() if source and source.is_file() else None,
        })
    return entries


def refresh(video=None):
    """Primera ejecución descubre catálogos; después solo actualiza el video revisado."""
    old = _read(INDEX, {})
    if old.get("version") != 3:
        catalogs = sorted(TEMPLATES.glob("*/**/assets/components/catalog.json"))
        videos = [p.parent.parent.parent for p in catalogs if "_tools" not in p.parts and "sandbox" not in p.parts]
        entries = [entry for item in videos for entry in _entries(item)]
    else:
        entries = [{**entry, "sheet_exists": (TEMPLATES / entry["sheet"]).is_file()} for entry in old["components"]]
    if video is not None:
        video = pathlib.Path(video).resolve()
        if video.is_relative_to(TEMPLATES.resolve()) and "sandbox" not in video.relative_to(TEMPLATES.resolve()).parts:
            rel = str(video.relative_to(TEMPLATES.resolve()))
            entries = [entry for entry in entries if entry["video"] != rel] + _entries(video)
    data = {"version": 3, "components": sorted(entries, key=lambda x: (x["name"], x["video"]))}
    if data != old:
        temp = INDEX.with_suffix(".json.tmp")
        temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temp.replace(INDEX)
    return data["components"]


def _norm(value):
    text = unicodedata.normalize("NFD", value.lower())
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return " ".join(re.findall(r"[a-z0-9]+", text))


def similar(video, threshold=0.82):
    """Avisos editoriales de posibles duplicados; una copia byte a byte es reuso válido."""
    video = pathlib.Path(video).resolve()
    if not video.is_relative_to(TEMPLATES.resolve()):
        return []
    if "sandbox" in video.relative_to(TEMPLATES.resolve()).parts:
        return []
    current = str(video.relative_to(TEMPLATES.resolve()))
    entries = refresh(video)
    warnings = []
    for item in (x for x in entries if x["video"] == current):
        for other in (x for x in entries if x["video"] != current):
            if item["source_sha256"] and item["source_sha256"] == other["source_sha256"]:
                continue
            name_score = difflib.SequenceMatcher(None, _norm(item["name"]), _norm(other["name"])).ratio()
            summary_score = difflib.SequenceMatcher(None, _norm(item["summary"]), _norm(other["summary"])).ratio()
            if max(name_score, summary_score) >= threshold:
                warnings.append(f"componente {item['name']} se parece a {other['name']} de {other['video']}; revisá la biblioteca y reusá si sirve")
                break
    return warnings
