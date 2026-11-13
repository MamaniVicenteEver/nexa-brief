"""Apply the audited text fields and host-calculated scene timing."""
from __future__ import annotations

from copy import deepcopy
from difflib import SequenceMatcher
import math
from pathlib import Path
import re

from src.core.editions.strings import apply_strings
from src.core.localization.texts import tokens, validate_table
from .alignment import target_time, words_of
from .retiming import fit_main_scenes


def source_chapters(script) -> list[str]:
    """Segmentos donde empieza un capítulo (cambia el valor de `chapter`)."""
    out, previous = [], None
    for segment in script["segments"]:
        if segment.get("chapter") and segment.get("chapter") != previous:
            out.append(segment["id"])
        previous = segment.get("chapter") or previous
    return out


CUE_SEGMENT_WINDOW = 2


def duplicate_closing_warning(segments, edition):
    """Flag a repeated farewell for editorial review, without changing narration."""
    if not segments:
        return None
    last = tokens(segments[-1].text)
    visual = tokens(edition.outro.thanks)
    spoken = tokens(edition.outro_spoken.text) if edition.outro_spoken else []
    visual_match = len(visual) >= 3 and any(last[i:i + len(visual)] == visual for i in range(len(last) - len(visual) + 1))
    spoken_match = SequenceMatcher(a=last, b=spoken, autojunk=False).find_longest_match().size >= 5
    if visual_match or spoken_match:
        return {"kind": "possible_duplicate_closing", "segment_id": segments[-1].id,
                "message": "La última frase de la narración puede repetir el cierre hablado del canal; revisa el audio."}
    return None


def normalize_output(raw: dict, extracted) -> dict:
    """Correcciones estructurales deterministas antes de validar (no cambian ningún texto):
    · capítulos: siempre los segmentos del original, con los títulos del agente (por id; si falta,
      el título no usado más cercano en orden);
    · cue cuya frase quedó en un segmento vecino (±2) al adaptar: pasa al segmento donde aparece."""
    order = [s["id"] for s in extracted.script["segments"]]
    texts = {s.get("id"): s.get("text", "") for s in raw.get("segments", []) if isinstance(s, dict)}
    for key, cue in (raw.get("cues") or {}).items():
        expected = (extracted.cues.get(key) or {}).get("segment_id")
        phrase = cue.get("target_phrase") if isinstance(cue, dict) else None
        if not expected or not phrase or expected not in order or phrase in texts.get(expected, ""):
            continue
        base = order.index(expected)
        for distance in range(CUE_SEGMENT_WINDOW + 1):
            hits = [order[i] for i in (base - distance, base + distance) if 0 <= i < len(order) and phrase in texts.get(order[i], "")]
            if hits:
                cue["segment_id"] = hits[0]
                break
    youtube = ((raw.get("publish") or {}).get("youtube") or {})
    chapters = youtube.get("chapters")
    wanted = source_chapters(extracted.script)
    if isinstance(chapters, list) and wanted and all(isinstance(c, dict) for c in chapters):
        by_id = {c.get("segment_id"): c for c in chapters}
        used, result = set(), []
        for sid in wanted:
            chosen = by_id.get(sid)
            if chosen is None or id(chosen) in used:
                pos = order.index(sid)
                free = [c for c in chapters if id(c) not in used and c.get("segment_id") in order and c.get("segment_id") not in wanted]
                chosen = min(free, key=lambda c: abs(order.index(c["segment_id"]) - pos), default=None)
            if chosen is None:
                result = None
                break
            used.add(id(chosen))
            result.append({**chosen, "segment_id": sid})
        if result is not None:
            youtube["chapters"] = result
    return raw


def validate_output(extracted, output, edition) -> dict[str, list[str]]:
    values = {**output.strings, **{f"seg.{s.id}": s.text for s in output.segments}}
    errors = validate_table(extracted.table, values, edition.locale)
    def fail(key, message):
        errors.setdefault(key, []).append(message)
    if extracted.story.get("packaging_required") and output.packaging is None:
        fail("packaging", "return native A/B/C titles and thumbnail text; reuse approved research and media")
    if output.packaging:
        maximum = edition.resolved_strategies.get("title", {}).get("effective", {}).get("max_chars", 100)
        if any(len(t.text) > maximum for t in output.packaging.titles):
            fail("packaging.titles", f"respect active title limit: {maximum}")
        chosen = next(t for t in output.packaging.titles if t.option == output.packaging.chosen_title)
        if chosen.text != output.publish.youtube.title:
            fail("publish.youtube.title", "must equal the selected native packaging title")
    if output.locale != edition.locale:
        fail("locale", "incorrect market")
    if [s.id for s in output.segments] != [s["id"] for s in extracted.script["segments"]]:
        fail("segments", "segment IDs and order must match source")
    if set(output.strings) != {k for k in extracted.table.entries if not k.startswith("seg.")}:
        fail("strings", "keys must match all non-narration source keys")
    if set(output.cues) != set(extracted.cues):
        fail("cues", "scene keys must match source")
    for key, cue in output.cues.items():
        expected = extracted.cues.get(key)
        if expected is None:
            fail(f"cues.{key}", "unknown scene")
            continue
        segment = next((s for s in output.segments if s.id == cue.segment_id), None)
        order_ids = [s["id"] for s in extracted.script["segments"]]
        if (cue.segment_id not in order_ids or expected["segment_id"] not in order_ids
                or abs(order_ids.index(cue.segment_id) - order_ids.index(expected["segment_id"])) > CUE_SEGMENT_WINDOW):
            fail(f"cues.{key}", "wrong source segment")
        elif segment is not None and cue.target_phrase not in segment.text:
            fail(f"cues.{key}", "target_phrase must be an exact quote of its segment")
    seen, previous = set(), -1
    order = [s["id"] for s in extracted.script["segments"]]
    expected_chapters = source_chapters(extracted.script)
    if (edition.format.structure.chapters and expected_chapters
            and [c.segment_id for c in output.publish.youtube.chapters] != expected_chapters):
        fail("publish.youtube.chapters", "preserve source chapter segment IDs and order")
    for chapter in output.publish.youtube.chapters:
        if chapter.segment_id not in order or chapter.segment_id in seen:
            fail("publish.youtube.chapters", "invalid or repeated segment")
        else:
            index = order.index(chapter.segment_id)
            if index <= previous:
                fail("publish.youtube.chapters", "chapters must follow segment order")
            previous = index
        seen.add(chapter.segment_id)
    source_links = set(re.findall(r"https?://[^\s)<>]+", extracted.story["publish_source"]["youtube"]["description"]))
    if source_links - set(re.findall(r"https?://[^\s)<>]+", output.publish.youtube.description)):
        fail("publish.youtube.description", "preserve source and credit URLs")
    for key, entry in extracted.table.entries.items():
        if entry.metadata.get("fixed_target") and values.get(key) != entry.metadata["fixed_target"]:
            fail(key, "use fixed channel text")
    return errors


def localized_script(extracted, output, edition) -> dict:
    script = deepcopy(extracted.script)
    values = {**output.strings, **{f"seg.{s.id}": s.text for s in output.segments}}
    translated = {pointer: values[key] for key, pointer in extracted.pointers.items() if pointer.startswith("/script/")}
    script, _ = apply_strings(script, extracted.storyboard, translated, edition.localizable, external_target_components={"common.lyric"})
    for source, target in zip(script["segments"], output.segments):
        source["delivery_note"] = target.delivery_note
    script.update(language=edition.locale, voice=edition.voice.voice, voice_direction=edition.voice.direction)
    return script


def normalize_media(value, production: Path):
    """Keep media shared with this episode; normalize historical root URLs."""
    if isinstance(value, dict):
        return {k: normalize_media(v, production) for k, v in value.items()}
    if isinstance(value, list):
        return [normalize_media(v, production) for v in value]
    if not isinstance(value, str):
        return value
    legacy = f"/{production.parent.name}/{production.name}/assets/"
    if value.startswith(legacy):
        value = f"/productions/{production.parent.name}/{production.name}/assets/" + value[len(legacy):]
    if value.startswith("assets/"):
        path = (production / value).resolve()
        if not path.is_relative_to(production.resolve()):
            raise ValueError("Medio fuera de la producción")
    return value


def storyboard(extracted, output, edition, alignment: dict, lyrics: dict, duration: float, min_dur: dict,
               layers: dict | None = None) -> tuple[dict, list[dict]]:
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("Duración de audio inválida")
    texts = {extracted.pointers[key]: text for key, text in output.strings.items() if key in extracted.pointers and extracted.pointers[key].startswith("/storyboard/")}
    _, result = apply_strings(extracted.script, extracted.storyboard, texts, edition.localizable, external_target_components={"common.lyric"})
    warnings = []
    closing_warning = duplicate_closing_warning(getattr(output, "segments", []), edition)
    if closing_warning:
        warnings.append(closing_warning)
    words = words_of(lyrics)
    for i, beat in enumerate(result["beats"]):
        key = f"scene.{i}"
        # The localized config appends the channel outro after all narration.
        # An original-language outro beat has obsolete timings and blocks it.
        if re.search(r"\.outro(?:v\d+)?$", beat.get("use", "")):
            warnings.append({"kind": "source_outro_replaced", "scene": key})
            continue
        if beat.get("t") != 0:
            cue = {**extracted.cues[key], "segment_id": output.cues[key].segment_id}
            row = alignment["segments"][cue["segment_id"]]
            time = row["start"] + cue["fraction"] * (row["end"] - row["start"])
            if cue["anchored"]:
                time, warning = target_time(cue, output.cues[key].target_phrase, alignment, words)
                if warning:
                    warnings.append({**warning, "scene": key})
            beat["t"] = round(time, 3)
            # Keep semantic provenance, but explicit t takes precedence in the player.
            if "at" in beat:
                beat["at"] = output.cues[key].target_phrase
        # Source-language end anchors must not leak into the translated player.
        if "until" in beat:
            source_until = beat.pop("until")
            warnings.append({"kind": "end_anchor_replaced", "scene": key, "source_phrase": source_until})
        beat["offset"] = 0
    result["beats"] = [beat for beat in result["beats"]
                       if not re.search(r"\.outro(?:v\d+)?$", beat.get("use", ""))]
    layers = layers or {}
    warnings.extend(fit_main_scenes(result["beats"], duration, min_dur, layers))
    def layer(beat):
        return beat.get("layer") or layers.get(beat["use"], "main")
    previous = {}
    main_end = 0.0
    beats = result["beats"]
    for i, beat in enumerate(beats):
        beat_layer = layer(beat)
        start = float(beat.get("t", 0))
        if not math.isfinite(start) or start < previous.get(beat_layer, 0) or start < 0 or start >= duration:
            raise ValueError(f"Orden o tiempo inválido: escena {i}")
        previous[beat_layer] = start
        next_start = next((b["t"] for b in beats[i + 1:] if layer(b) == beat_layer), duration)
        # Main scenes follow narration boundaries. Overlay durations remain technical
        # durations (tags, transitions); copying an ES main duration creates gaps/overlaps.
        if beat_layer == "main" and "dur" in beat:
            beat["dur"] = round(next_start - start, 3)
        length = float(beat.get("dur", next_start - start))
        if not math.isfinite(length) or length <= 0 or start + length > duration + .01:
            raise ValueError(f"Escena {i} fuera del audio o sin cobertura")
        if beat_layer == "main":
            if start > main_end + .01:
                raise ValueError(f"Escena {i} deja un hueco sin cobertura")
            main_end = max(main_end, start + length)
        minimum = float(beat.get("minDur", min_dur.get(beat["use"], .2)))
        if length + .001 < minimum:
            raise ValueError(f"Escena {i} no cumple minDur={minimum}")
        if beat["use"] == "common.clip":
            params = beat.get("params", {})
            rate = float(params.get("rate", 1))
            if rate <= 0 or not math.isfinite(rate):
                raise ValueError(f"Velocidad inválida en clip {i}")
    if not beats or beats[0].get("t") != 0 or main_end < duration - .01:
        raise ValueError("La edición debe cubrir el audio desde t=0")
    return result, warnings
