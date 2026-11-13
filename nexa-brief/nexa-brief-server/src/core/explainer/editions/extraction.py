"""Expose editorial text only; keep technical pointers and timing on the host."""
from __future__ import annotations

from dataclasses import dataclass
import re

from src.core.editions.strings import extract_strings
from src.core.localization.texts import TextEntry, TextMemory, TextTable, names
from .alignment import source_cues
from .io import read, safe
from .text_defaults import materialize
from .research_context import documents, publication_sources, public_text
from .publishing import platform_publish


@dataclass
class Extracted:
    table: TextTable
    pointers: dict[str, str]
    script: dict
    storyboard: dict
    story: dict
    cues: dict


def editorial_excerpt(text: str, max_words=3500) -> str:
    # Select editorial sections rather than truncating a technical production plan.
    selected, active, in_code = [], True, False
    for line in text.splitlines():
        if line.lstrip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        if line.startswith("#"):
            active = not bool(re.search(r"visual|componente|storyboard|render|pipeline|inventario|archivo|herramienta|reporte|revisi[oó]n", line, re.I))
        if active and not re.search(r"(?:/home/|assets/|src/|\.system/|\.venv|(?:\.\.?/)+|"
                                    r"(?<![\w:/])/(?:[\w.-]+/)+[\w.-]+|\b[\w.-]+\.(?:py|js|json|md)\b)", line, re.I):
            selected.append(line)
    return " ".join("\n".join(selected).split()[:max_words])


def extract(production, edition, *, source_identity: dict | None = None) -> Extracted:
    script = read(safe(production, "assets/script.json"))
    storyboard, materialized = materialize(read(safe(production, "assets/storyboard.json")), edition.localizable, production=production)
    lyrics = read(safe(production, "assets/lyrics.json"))
    raw = extract_strings(script, storyboard, edition.localizable)
    table = TextTable(source_locale=edition.source_locale, source_revision=edition.source_revision, entries={})
    pointers = {}
    segments = script["segments"]
    if not segments or len({s["id"] for s in segments}) != len(segments):
        raise ValueError("IDs de segmento vacíos o duplicados")
    protected = set(names(" ".join(s["text"] for s in segments)))
    memory = TextMemory()
    source_texts = (source_identity or {}).get("texts", {}).get("outro", {})
    for key, source in source_texts.items():
        if key in type(edition.outro).model_fields:
            memory.remember(edition.persona_id, edition.locale, source, getattr(edition.outro, key))
    for pointer, entry in raw.items():
        parts = pointer.strip("/").split("/")
        metadata = {}
        if parts[:2] == ["script", "segments"]:
            segment = segments[int(parts[2])]
            field = parts[3]
            if field == "delivery_note":
                continue
            key = f"seg.{segment['id']}" if field == "text" else f"{field}.{segment['id']}"
            if field == "text":
                metadata = {k: segment[k] for k in ("act", "tone", "intensity", "delivery_note", "chapter") if k in segment}
        elif parts[0] == "script":
            if parts[1] == "voice_direction":
                continue
            key = ".".join(parts)
        elif parts[:2] == ["storyboard", "beats"]:
            field = ".".join(parts[4:]).replace("~1", "/").replace("~0", "~")
            key = f"scene.{parts[2]}.{field}"
            beat_index = int(parts[2])
            if (storyboard["beats"][beat_index].get("use") in {"rough.outro", "rough.outrov1"}
                    and (beat_index, field) in materialized and field in {"thanks", "cta", "support"}):
                metadata["fixed_target"] = getattr(edition.outro, field)
        else:
            key = "story." + ".".join(parts[1:])
        substring = None
        if entry["type"].startswith("substring:"):
            substring = f"scene.{parts[2]}." + entry["type"].split(":", 1)[1]
            if not any(p.startswith(f"/storyboard/beats/{parts[2]}/params/{entry['type'].split(':', 1)[1]}") for p in raw):
                substring = None  # Lyrics-backed highlights are checked against narration below.
        fixed = memory.lookup(edition.persona_id, edition.locale, entry["text"])
        if fixed and "fixed_target" not in metadata:
            metadata["fixed_target"] = fixed
        table.entries[key] = TextEntry(**entry, metadata=metadata, substring_of=substring,
                                      preserve_names=[n for n in sorted(protected) if n in entry["text"]],
                                      check_facts=entry["type"] != "substring:text")
        pointers[key] = pointer
    cues, _ = source_cues(script, storyboard, lyrics)
    for key, entry in table.entries.items():
        if entry.type.startswith("substring:") and entry.substring_of is None and key.startswith("scene."):
            scene = ".".join(key.split(".")[:2])
            segment_id = cues[scene]["segment_id"] if scene in cues else segments[0]["id"]
            entry.substring_of = "seg." + segment_id
    briefs = {}
    for name in ("PLAN.md", "BRIEF.md"):
        path = safe(production, name)
        if path.is_file():
            briefs[name] = public_text(editorial_excerpt(path.read_text(encoding="utf-8"), 2500), limit=12000)
    publication = platform_publish(read(safe(production, "publish.json")))
    # Only editorial publication text belongs in the agent workspace. A source
    # package may also contain paths, layout options, timestamps and metadata.
    publication = {
        platform: {key: value for key, value in publication.get(platform, {}).items()
                   if key in fields}
        for platform, fields in {
            "youtube": {"title", "description", "tags", "pinned", "chapters"},
            "instagram": {"title", "description"}, "facebook": {"title", "description"},
            "tiktok": {"caption", "hashtags"},
        }.items()
    }
    publication["youtube"]["chapters"] = [
        {"title": chapter.get("title", "")} for chapter in publication["youtube"].get("chapters", [])
        if isinstance(chapter, dict)
    ]
    story = {"editorial": briefs, "format": {"id": edition.format_id, "chapters": edition.format.structure.chapters},
             "segments": [dict(id=s["id"], **{k: s[k] for k in ("act", "tone", "intensity", "chapter") if k in s}) for s in segments],
             "scenes": {key: {k: c[k] for k in ("segment_id", "source_phrase", "anchored")} for key, c in cues.items()},
             "publish_source": publication}
    raw_package = read(safe(production, "publish.json"))
    research, _ = documents(production)
    sources = publication_sources(raw_package)
    if research or sources:
        story["research"] = {"documents": research, "sources": sources}
    thumb = raw_package.get("thumbnail", {})
    if isinstance(thumb, dict):
        story["packaging_source"] = {
            "titles": raw_package.get("titles", {}).get("youtube", []),
            "text_only": thumb.get("text_only", {}),
            "with_image": {k: thumb.get("with_image", {}).get(k, "") for k in ("text", "pair_title")},
            "tabloid": {k: (thumb.get("tabloid") or {}).get(k, "") for k in
                        ("text", "accent", "bullet", "strap", "seal", "tape_text", "before_label", "after_label", "pair_title")},
            "kicker": thumb.get("kicker", "")}
    return Extracted(table, pointers, script, storyboard, story, cues)
