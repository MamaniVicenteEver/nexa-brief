#!/usr/bin/env python3
"""Deterministically compile a verified Atlas episode against real word timestamps."""
from __future__ import annotations

import argparse
import difflib
import fcntl
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import textwrap
import time
import unicodedata

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import atlas_factory as host

VERSION = 2
MIN_COVERAGE = 0.68
MAX_BOUNDARY_GAP = 8
NUMBERS = "cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis diecisiete dieciocho diecinueve veinte veintiuno veintidos veintitres veinticuatro veinticinco veintiseis veintisiete veintiocho veintinueve".split()
TENS = {3: "treinta", 4: "cuarenta", 5: "cincuenta", 6: "sesenta", 7: "setenta", 8: "ochenta", 9: "noventa"}
HUNDREDS = {1: "ciento", 2: "doscientos", 3: "trescientos", 4: "cuatrocientos", 5: "quinientos",
            6: "seiscientos", 7: "setecientos", 8: "ochocientos", 9: "novecientos"}
ALIASES = {("pe", "i", "be"): ["pib"], ("p", "i", "b"): ["pib"],
           ("producto", "interno", "bruto"): ["pib"], ("producto", "interior", "bruto"): ["pib"],
           ("efe", "eme", "i"): ["fmi"], ("f", "m", "i"): ["fmi"],
           ("ee", "uu"): ["estados", "unidos"], ("e", "e", "u", "u"): ["estados", "unidos"]}


def integer_words(number):
    if number < 30:
        return NUMBERS[number]
    if number < 100:
        return TENS[number // 10] + (" y " + NUMBERS[number % 10] if number % 10 else "")
    if number < 1000:
        return "cien" if number == 100 else HUNDREDS[number // 100] + (" " + integer_words(number % 100) if number % 100 else "")
    for scale, singular, plural in ((10**12, "un billon", "billones"), (10**6, "un millon", "millones"), (1000, "mil", "mil")):
        if number >= scale:
            quotient, rest = divmod(number, scale)
            head = singular if quotient == 1 else integer_words(quotient) + " " + plural
            return head + (" " + integer_words(rest) if rest else "")
    raise ValueError("Unsupported number")


def normalized_text(value):
    return "".join(c for c in unicodedata.normalize("NFD", value.lower()) if unicodedata.category(c) != "Mn")


def decimal_words(digits):
    leading = len(digits) - len(digits.lstrip("0"))
    return " ".join(["cero"] * leading + ([integer_words(int(digits[leading:]))] if leading < len(digits) else []))


def lexical_atoms(text):
    text = normalized_text(text).replace("%", " por ciento ")
    out = []
    for value in re.findall(r"\d+(?:[.,]\d+)*|[a-zñ]+", text):
        if value[0].isdigit():
            pieces = re.split(r"[.,]", value)
            if len(pieces) > 1 and pieces[0] != "0" and len(set(re.findall(r"[.,]", value))) == 1 and all(len(p) == 3 for p in pieces[1:]):
                expanded = integer_words(int("".join(pieces)))
            elif len(pieces) == 2:
                expanded = integer_words(int(pieces[0])) + " coma " + decimal_words(pieces[1])
            elif len(pieces) > 2:
                # Mixed punctuation: the final separator is the decimal mark; preceding ones group thousands.
                expanded = integer_words(int("".join(pieces[:-1]))) + " coma " + decimal_words(pieces[-1])
            else:
                expanded = integer_words(int(value))
            out.extend(expanded.split())
        else:
            out.append({"un": "uno", "veintiun": "veintiuno", "eeuu": "estados unidos"}.get(value, value))
    return [atom for value in out for atom in value.split()]


def collapse_aliases(atoms):
    result, index = [], 0
    while index < len(atoms):
        for pattern, replacements in ALIASES.items():
            group = atoms[index:index + len(pattern)]
            if tuple(a["token"] for a in group) == pattern:
                # Do not collapse phrases across script segment boundaries.
                if len({a.get("segment") for a in group}) > 1:
                    continue
                merged = {**group[0], "end": group[-1].get("end"),
                          "last_word_index": group[-1].get("last_word_index", group[-1].get("word_index"))}
                result += [{**merged, "token": token} for token in replacements]
                index += len(pattern)
                break
        else:
            result.append(atoms[index])
            index += 1
    return result


def real_words(lyrics, duration):
    words, previous = [], -1.0
    for segment in lyrics.get("segments", []):
        for source in segment.get("words", []):
            start, end = source.get("start"), source.get("end")
            if (not isinstance(source.get("word"), str) or type(start) not in (int, float)
                    or type(end) not in (int, float) or not math.isfinite(start) or not math.isfinite(end)
                    or start < previous or end < start or start < 0 or end > duration + 0.5):
                raise host.StageError("Transcripción inválida: palabras o tiempos no ordenados/fuera del audio")
            words.append({"word": source["word"], "start": float(start), "end": float(end),
                          "index": len(words), "probability": source.get("probability")})
            previous = start
    if not words:
        raise host.StageError("No hay palabras reales en lyrics.json")
    return words


def align(script, lyrics, duration):
    words = real_words(lyrics, duration)
    reference, hypothesis = [], []
    for index, segment in enumerate(script["segments"]):
        reference += [{"token": atom, "segment": index} for atom in lexical_atoms(segment["text"])]
    for word in words:
        hypothesis += [{"token": atom, "word_index": word["index"], "last_word_index": word["index"],
                        "anchor_eligible": word["end"] - word["start"] >= 0.03,
                        "start": word["start"], "end": word["end"]} for atom in lexical_atoms(word["word"])]
    reference, hypothesis = collapse_aliases(reference), collapse_aliases(hypothesis)
    matcher = difflib.SequenceMatcher(a=[a["token"] for a in reference], b=[a["token"] for a in hypothesis], autojunk=False)
    pairs, differences = {}, []
    for block in matcher.get_matching_blocks():
        for offset in range(block.size):
            pairs[block.a + offset] = (block.b + offset, block.size)
    for op, a0, a1, b0, b1 in matcher.get_opcodes():
        if op != "equal":
            differences.append({"operation": op, "script_atoms": [a0, a1], "transcript_atoms": [b0, b1],
                "expected": " ".join(a["token"] for a in reference[a0:a1]),
                "recognized": " ".join(a["token"] for a in hypothesis[b0:b1]),
                "start": hypothesis[b0]["start"] if b0 < b1 else None,
                "end": hypothesis[b1 - 1]["end"] if b0 < b1 else None})
    results, failures = [], []
    for index, segment in enumerate(script["segments"]):
        positions = [i for i, atom in enumerate(reference) if atom["segment"] == index]
        matches = [{"script_atom": i, "transcript_atom": pairs[i][0], "block_length": pairs[i][1],
                    **hypothesis[pairs[i][0]]} for i in positions if i in pairs]
        strong = [m for m in matches if m["block_length"] >= 3 and m.get("anchor_eligible", True)]
        coverage = len(matches) / max(1, len(positions))
        start, end = (strong[0]["start"], strong[-1]["end"]) if strong else (None, None)
        prefix = strong[0]["script_atom"] - positions[0] if strong and positions else len(positions)
        suffix = positions[-1] - strong[-1]["script_atom"] if strong and positions else len(positions)
        uncertainties = []
        if prefix:
            uncertainties.append(f"{prefix} átomos iniciales sin ancla fuerte; inicio en primera palabra real alineada")
        if suffix:
            uncertainties.append(f"{suffix} átomos finales sin ancla fuerte; fin en última palabra real alineada")
        if coverage < 1:
            uncertainties.append("Hay diferencias léxicas; revisar los opcodes y el audio, sin completar palabras")
        if coverage < 0.90:
            uncertainties.append("Cobertura menor a 90%; revisar diferencias y escuchar")
        accepted = bool(start is not None and end > start and coverage >= MIN_COVERAGE
                        and prefix <= MAX_BOUNDARY_GAP and suffix <= MAX_BOUNDARY_GAP)
        if not accepted:
            failures.append(segment["id"])
        results.append({"id": segment["id"], "plan": segment["plan"], "fact_ids": segment["fact_ids"],
                        "start": start, "end": end, "coverage": round(coverage, 4), "accepted": accepted,
                        "unmatched_prefix_atoms": prefix, "unmatched_suffix_atoms": suffix,
                        "uncertainties": uncertainties, "matches": matches})
    for previous, current in zip(results, results[1:]):
        if (previous["end"] is not None and current["start"] is not None
                and (current["start"] < previous["start"] or current["start"] < previous["end"] - 0.15)):
            current["accepted"] = False
            current["uncertainties"].append("Anclas de segmentos solapadas o invertidas")
            failures.append(current["id"])
    report = {"method": "Global monotone difflib on accent-folded atoms; anchors use equal blocks of at least 3 atoms only",
              "thresholds": {"min_coverage": MIN_COVERAGE, "max_unmatched_boundary_atoms": MAX_BOUNDARY_GAP},
              "normalization": "Spanish integer/decimal expansion, un/uno, PIB/FMI spoken initials, EE.UU. No timeline interpolation or missing-word insertion.",
              "number_punctuation_assumption": "Groups of three digits after separators are thousands; otherwise final separator is decimal. Review ambiguous numeric differences.",
              "duration_seconds": duration, "words": len(words), "reference_atoms": len(reference),
              "transcript_atoms": len(hypothesis), "coverage": round(len(pairs) / max(1, len(reference)), 4),
              "segments": results, "differences": differences, "failed_segments": sorted(set(failures)),
              "short_words": [{"index": w["index"], "word": w["word"], "start": w["start"], "end": w["end"]}
                              for w in words if w["end"] - w["start"] < 0.03],
              "short_word_policy": "All real words retained for lexical comparison. Words shorter than 30ms cannot independently anchor visual boundaries; short duration is not evidence of omission.",
              "factual_or_omission_certification": False}
    return report, words


def point(value, name):
    if (not isinstance(value, list) or len(value) < 2 or any(type(n) not in (float, int)
            or not math.isfinite(n) for n in value[:2]) or abs(value[0]) > 180 or abs(value[1]) > 85.05113):
        raise host.StageError(name + ": centro inválido [lon,lat] o fuera de Mercator")
    return value[:2]


def embedded_regions(data, document):
    source = document.get("regions", document)
    embedded, evidence = {}, []
    for country in data["countries"]:
        for region in country["regions"][:2]:
            ident = region["id"]
            entry = source.get(region.get("geometry_id", ident)) or source.get(ident)
            if not isinstance(entry, dict):
                raise host.StageError("Falta geometría exacta para región " + ident)
            geometry = entry.get("geometry", entry if entry.get("type") in ("Polygon", "MultiPolygon") else None)
            if not geometry or geometry.get("type") not in ("Polygon", "MultiPolygon"):
                raise host.StageError("Se requiere Polygon/MultiPolygon exacto para " + ident)
            polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
            positions = []
            for polygon in polygons:
                if not polygon:
                    raise host.StageError("Polígono vacío: " + ident)
                for ring in polygon:
                    if len(ring) < 4 or ring[0][:2] != ring[-1][:2]:
                        raise host.StageError("Anillo vacío/abierto: " + ident)
                    positions += [point(p, ident) for p in ring]
            if not positions:
                raise host.StageError("Geometría vacía: " + ident)
            bbox = [min(p[0] for p in positions), min(p[1] for p in positions),
                    max(p[0] for p in positions), max(p[1] for p in positions)]
            label = point(region.get("center") or entry.get("label"), ident)
            embedded[ident] = {"geometry": geometry, "bbox": bbox, "label": label}
            if entry.get("source"):
                embedded[ident]["source"] = entry["source"]
            evidence.append({"id": ident, "geometry_id": region.get("geometry_id", ident),
                             "bbox": bbox, "source": entry.get("source"), "vertices": len(positions)})
    return embedded, evidence


def media_path(ctx, value):
    if not isinstance(value, str):
        raise host.StageError("Falta una ruta local de bandera/retrato")
    relative = value.removeprefix("assets/")
    path = Path(relative)
    if (path.is_absolute() or ".." in path.parts or re.search(r"[?#\\:]", relative)
            or path.suffix.lower() not in (".svg", ".png", ".jpg", ".jpeg", ".webp", ".avif")):
        raise host.StageError("La imagen debe ser local y relativa a assets/")
    actual = ctx.file("assets/" + relative)
    if not actual.is_file() or actual.stat().st_size == 0:
        raise host.StageError("Falta imagen local: assets/" + relative)
    return relative


def real_boundary(words, target, before, after, key="start"):
    choices = [(abs(word[key] - target), word[key], word["index"])
               for word in words if before <= word[key] <= after and word["end"] - word["start"] >= 0.03]
    if not choices:
        raise host.StageError("No existe palabra real para la transición visual solicitada")
    _, value, index = min(choices)
    return value, index


def cited_gdp(country, data, research):
    gdp, ranking = country["gdp"], data["ranking"]
    facts = {f["id"]: f for f in research["facts"]}
    sources = {s["id"]: s for s in research["sources"]}
    references = gdp.get("fact_ids", [])
    if not references or any(f not in facts for f in references):
        raise host.StageError("El PIB requiere fact_ids investigados")
    cited = {s for fact in references for s in facts[fact]["sourceIds"]}
    source_id = gdp.get("source") or ranking.get("source")
    if source_id not in cited or source_id not in sources:
        raise host.StageError("La fuente del ranking/PIB debe estar citada por sus hechos")
    value, unit = gdp.get("value"), gdp.get("unit")
    if type(value) not in (int, float) or not math.isfinite(value) or value <= 0 or not unit or not gdp.get("year"):
        raise host.StageError("PIB inválido o sin unidad/año")
    display_value, display_unit = value, unit
    if normalized_text(unit) in ("miles de millones usd", "miles de millones de dolares", "billion usd", "usd billion"):
        display_value, display_unit = round(value / 1000, 2), " billones USD"
    source = sources[source_id]
    source_label = ranking.get("source_label") or source.get("short_title") or source.get("publisher") or source_id
    return {"value": display_value, "unit": display_unit, "label": "PIB NACIONAL NOMINAL · APROX.",
            "source": source_id, "year": gdp["year"], "scope": "Producto interno bruto nominal del país, dólares corrientes; proyección, no desempeño atribuible a una persona",
            "illustrative": False, "fact_ids": references,
            "source_value": value, "source_unit": unit, "conversion": "1 billón USD = 1000 miles de millones USD" if unit != display_unit else "identity",
            "source_label": str(source_label)[:46]}


def fly(start, end, center, span, pitch=42, bearing=0, lift=0):
    if type(span) not in (int, float) or not math.isfinite(span) or span <= 0:
        raise host.StageError("El encuadre requiere span positivo")
    return {"t": start, "focus": center, "span": span, "pitch": pitch, "bearing": bearing,
            "lift": lift, "dur": round(min(3.4, max(0.2, (end - start) * 0.3)), 3), "ease": "inOut", "through": False}


def term_lines(leader):
    display = leader.get("term_display")
    if isinstance(display, list):
        lines = display
    elif isinstance(display, str):
        lines = textwrap.wrap(display, width=36, break_long_words=False)
    else:
        note = leader.get("term_note", "")
        years = re.search(r"(20\d\d)\s*[–—-]\s*(20\d\d)", note)
        since = re.search(r"desde[^.;]*?(20\d\d)", note, re.I)
        if years:
            lines = ["Mandato ordinario", years[1] + "–" + years[2]]
        elif "confianza" in normalized_text(note) or "sin fecha" in normalized_text(note):
            lines = [("Desde " + since[1]) if since else "Confianza parlamentaria", "Sin fecha personal fija"]
        else:
            lines = textwrap.wrap(note, width=36, break_long_words=False)
    if not 1 <= len(lines) <= 2 or any(not isinstance(line, str) or not line or len(line) > 42 for line in lines):
        raise host.StageError("leader.term_display debe resumir el mandato en una o dos líneas de hasta 42 caracteres")
    return lines


def closing_fragment(start, duration, subtitle):
    """Instanciar el cierre del catálogo, separado del CTA genérico de Proto."""
    catalog = host.load(host.ATLAS / "components.json")
    component = next(item for item in catalog["components"] if item["name"] == "atlas.outrov2")
    recipe = component["demo"]
    length = duration - start
    if length < 4:
        raise host.StageError("El outro requiere al menos cuatro segundos dentro del audio final")
    transition = min(3.0, length * .35)
    cameras = [dict(recipe["camera"][0], t=start, dur=transition, ease="inOut", arc=0, bearing=0),
               dict(recipe["camera"][1], t=start + transition, dur=length - transition,
                    ease="inOut", arc=0, bearing=0)]
    title = dict(recipe["layers"][0], text="OCHO ECONOMÍAS, UN MAPA", sub=subtitle,
                 t=start + min(1.2, transition * .5), out=duration, upper=False)
    look = {"t": start, "look": recipe["look"], "dur": 1.0, "overrides": recipe.get("lookOverrides", {})}
    return cameras, [title], look, {"component": component["name"], "start": start, "end": duration,
        "transition_end": start + transition, "entry_checkpoint": start + .7,
        "mid_checkpoint": start + length * .5, "end_checkpoint": duration - .05}


def build_scene(ctx, script, data, research, geometry, alignment, words, duration):
    if alignment["failed_segments"]:
        raise host.StageError("Alineación insuficiente en segmentos: " + ", ".join(alignment["failed_segments"]))
    embedded, geometry_evidence = embedded_regions(data, geometry)
    segments = alignment["segments"]
    intro, outro = segments[0], segments[-1]
    country_start = segments[1]["start"]
    intro_end, intro_end_word = real_boundary(words, min(4.5, country_start), 0, country_start, key="end")
    orchestration = host.load(host.ATLAS / "orchestration.json")
    profile = orchestration["visual_profile"]
    if not profile.get("locked") or profile["camera"].get("zoom_into_regions") is not False:
        raise host.StageError("Atlas Cinemático requiere el perfil oblicuo nacional bloqueado")
    pitch = profile["camera"].get("pitch", 60)
    opacity = profile["flag"]["opacity"]
    visual_plan = []
    def plan(intent, component, time_anchor, location, media=None, ref=None, layout=None, reason=""):
        segment = next(item for item in segments if item["id"] == time_anchor["segment"])
        facts = list(ref or [])
        source_ids = sorted({source for fact in research["facts"] if fact["id"] in facts for source in fact["sourceIds"]})
        place = {"country": None, "region": None, "coordinates": None}
        for country in data["countries"]:
            if location == country["iso2"]:
                place.update({"country": country["iso2"], "coordinates": country.get("center")})
            for region in country["regions"][:2]:
                if location == region["id"]:
                    place.update({"country": country["iso2"], "region": region["id"], "coordinates": embedded[region["id"]]["label"]})
        if isinstance(location, dict):
            place["route"] = location
        visual_plan.append({"intent": intent, "component": component,
            "timeAnchor": {"segment_id": segment["id"], "edge": "start", "quote": None,
                "offset_seconds": round(time_anchor["time"] - segment["start"], 4), "resolved_seconds": time_anchor["time"]},
            "location": place, "media": media,
            "ref": {"fact_ids": facts, "source_ids": source_ids, "data_ref": None},
            "layout": {"target": "hud" if component == "atlas.persistentPortrait" else "layers", "formats": ["16:9", "9:16"],
                "avoid": ["captions", "portrait", "GDP", "mandate"], "placement": layout}, "reason": reason})
    scene = {"format": "atlas-v1", "duration": duration, "lang": "es", "look": "satelite-realista", "worldCopies": True,
             "regions": embedded, "places": {}, "data": {},
             "camera": [{"t": 0, "focus": [-3, 45], "span": 62, "pitch": pitch, "bearing": 0}],
             "looks": [],
             "layers": [], "hud": [], "intro": {"style": "v2", "text": "OCHO ECONOMÍAS", "dur": intro_end, "hideCaptions": False},
             # atlas.outrov2 compone cámara/look/título; el CTA genérico no debe taparlo.
             "outro": False, "captions": {"enabled": True, "y": 0.91, "yLandscape": 0.925, "maxWords": 4, "color": "#ffffff"}}
    intro_text = f"{data['ranking']['metric']} · {data['ranking']['year']} · Proyección"
    scene["layers"].append({"type": "title", "text": intro_text, "sub": "Del octavo al primer puesto",
                            "t": intro_end, "out": country_start, "y": 0.19, "size": 40, "upper": False})
    if country_start - intro_end > 5:
        scene["camera"].append({"t": intro_end, "focus": [35, 48], "span": 105,
                                 "pitch": pitch, "bearing": 0, "dur": min(10, country_start - intro_end - 4.2),
                                 "ease": "inOut", "through": False})
    evidence = {"intro_end": {"time": intro_end, "word_index": intro_end_word}, "chapters": [],
                "geometry": geometry_evidence, "responsive": {"screen_fields": "HUD portrait x/y fixed; no at",
                "safe_zones": "Header .07, metric .20, regional photo .41, portrait .66, mandate .74, region criterion .82, captions .91/.925",
                "visual_validation": "required in 16:9 and 9:16"}}
    ordered = sorted(data["countries"], key=lambda country: country["rank"], reverse=True)
    for index, country in enumerate(ordered):
        chapter = segments[1 + 4 * index:5 + 4 * index]
        first, insight, region1, region2 = chapter
        following = segments[5 + 4 * index]
        start, chapter_end = first["start"], following["start"]
        reveal_start = start
        if index:
            reveal_start, _ = real_boundary(words, start + 3.4, start + 3.4,
                                             min(start + 4.2, region1["start"] - 6), key="start")
        flag_end, flag_word = real_boundary(words, reveal_start + 4.5, reveal_start + 4.0,
                                            min(reveal_start + 5.0, region1["start"] - .5), key="end")
        portrait_start, portrait_word = real_boundary(words, flag_end + 0.4, flag_end + 0.35,
                                                      min(insight["end"], region1["start"]), key="start")
        frame = country.get("cinematic_frame", {})
        center = point(frame.get("center", country.get("center")), country["iso2"])
        span = frame.get("span", country.get("span"))
        # Una transición hace visible la ruta completa antes de llegar al país.
        transition_start = start
        overlay_end = chapter_end
        flag = media_path(ctx, country.get("flag_src"))
        portrait = media_path(ctx, country.get("portrait_src"))
        metric_id = "gdp-" + country["iso2"].lower()
        gdp = cited_gdp(country, data, research)
        scene["data"][metric_id] = gdp
        scene["places"]["country-" + country["iso2"]] = center
        # Llegar al país al nombrarlo; la bandera dispone de su ventana completa.
        if index:
            previous = ordered[index - 1]
            origin = embedded[previous["regions"][1]["id"]]["label"]
            destination = embedded[country["regions"][0]["id"]]["label"]
            delta = ((destination[0] - origin[0] + 180) % 360) - 180
            midpoint = [((origin[0] + delta / 2 + 180) % 360) - 180, (origin[1] + destination[1]) / 2]
            route_span = max(abs(delta) * 1.5, abs(destination[1] - origin[1]) * 3.4, 28)
            overview = fly(transition_start, reveal_start, midpoint, route_span, pitch=pitch)
            overview.update({"dur": 0.9, "arc": 0})
            scene["camera"].append(overview)
            arrow_start = start + .95
            route = {"type": "arrow", "from": origin, "to": destination, "t": arrow_start,
                "out": reveal_start + 0.5, "dur": 0.85, "path": "curve", "keep": True,
                "head": "arrow", "headSize": 23, "width": 7, "lift": 95, "color": "#55cce0",
                "exit": {"style": "fade", "dur": 0.3}, "upper": False}
            scene["layers"].append(route)
            scene["layers"].append({"type": "title", "text": previous["name"] + " → " + country["name"],
                "sub": "Siguiente país del recorrido", "t": arrow_start, "out": reveal_start,
                "y": .12, "size": 38, "upper": False})
            plan("country_transition", "atlas.arrowCurved", {"segment": first["id"], "time": arrow_start},
                {"from": origin, "to": destination}, layout={"camera": "both_endpoints_overview"},
                reason="Itinerario visual entre capítulos; no representa comercio ni magnitudes económicas.")
        arrival = fly(max(0, reveal_start - (1.2 if index else 2.4)), reveal_start, center, span, pitch=pitch, bearing=4)
        arrival["dur"] = round(reveal_start - arrival["t"], 3)
        arrival["arc"] = 0
        scene["camera"].append(arrival)
        # Mantener exactamente esta pose durante los estados: el mapa sigue siendo nacional.
        flag_fit = country.get("flag_fit", "global")
        if flag_fit not in ("global", "landmass"):
            raise host.StageError("flag_fit debe ser global o landmass")
        scene["layers"] += [
            {"type": "highlight", "region": country["iso2"], "t": start, "out": chapter_end, "dur": 0.7,
             "style": {"fill": "#b0b848", "opacity": 0.045, "line": "#d4eff5", "width": 1.4}, "border": True},
            {"type": "flag-fill", "region": country["iso2"], "src": flag, "fit": flag_fit, "t": reveal_start, "out": chapter_end,
             "dur": 0.7, "fadeOut": 0.25, "opacity": 1.0,
             "opacityKeys": [{"t": reveal_start, "value": opacity["intro"]},
                 {"t": flag_end, "value": opacity["intro"]},
                 {"t": portrait_start, "value": opacity["country"]},
                 {"t": max(portrait_start, region1["start"] - 0.4), "value": opacity["country"]},
                 {"t": region1["start"], "value": opacity["region"]}]},
            {"type": "title", "text": f"{country['rank']} · {country['name']}", "t": reveal_start, "out": overlay_end,
             "y": 0.07, "size": 42, "upper": False},
            {"type": "metric", "dataRef": metric_id, "t": portrait_start, "out": overlay_end,
             "x": 0.5, "y": 0.20, "width": 640, "color": "#55cce0", "upper": False,
             "sub": f"Proyección {gdp['year']} · {gdp['source_label']}",
             "enter": {"style": "rise", "dur": 0.5}, "exit": {"style": "fade", "dur": 0.25}},
        ]
        leader = country["leader"]
        scene["hud"].append({"type": "portrait", "src": portrait, "name": leader["name"], "role": leader.get("display_role") or leader["title"],
              "x": 0.20, "y": 0.66, "size": 100 * profile["portrait"]["photo_scale"],
              "nameSize": 24 * profile["portrait"]["text_scale"], "roleSize": 11 * profile["portrait"]["text_scale"],
              "scalePortrait": 1.0, "scaleLandscape": 0.95,
              "focus": country.get("portrait_focus", [0.5, 0.35]), "t": portrait_start,
              "out": overlay_end, "dur": 0.5, "exit": 0, "color": "#55cce0", "upper": False})
        mandate = term_lines(leader)
        scene["hud"].append({"type": "lower-title", "x": 0.40, "y": 0.74, "t": portrait_start,
              "out": overlay_end, "dur": 0.5, "exit": 0, "upper": False, "gap": 33.6,
              "lines": [{"text": line, "size": 28.8, "weight": 500, "color": "#ecf9fc"} for line in mandate]})
        plan("country_identity", "atlas.flagFill", {"segment": first["id"], "time": reveal_start}, country["iso2"],
             media=flag, layout={"persistent": True, "opacity": opacity}, reason="Identidad nacional clara al entrar y tenue durante el análisis regional.")
        plan("leader_context", "atlas.persistentPortrait", {"segment": first["id"], "time": portrait_start},
             country["iso2"], media=portrait, ref=leader.get("fact_ids"), layout={"x": .20, "y": .66, "photo_scale": 1.3, "text_scale": 1.2},
             reason="El retrato permanece mientras se explica el país y sus regiones; no atribuye el PIB a una persona.")
        regional_evidence = []
        for rindex, (region, timing) in enumerate(zip(country["regions"][:2], [region1, region2])):
            region_end = region2["start"] if rindex == 0 else overlay_end
            region_center = embedded[region["id"]]["label"]
            bbox = embedded[region["id"]]["bbox"]
            media = region.get("photo")
            if not isinstance(media, dict) or not media.get("caption"):
                raise host.StageError("Falta fotografía documental regional: " + region["id"])
            region_photo = media_path(ctx, media.get("src"))
            scene["layers"] += [
                {"type": "highlight", "region": region["id"], "t": timing["start"], "out": region_end,
                 "dur": 0.65, "style": {"fill": profile["region_highlight"]["color"], "opacity": 0.67, "line": "#ffe0da", "width": 2.2}, "border": True},
            ]
            # Los territorios diminutos conservan su geometría real; el anillo sólo facilita encontrarlos.
            if max(bbox[2] - bbox[0], bbox[3] - bbox[1]) / span < .09:
                scene["layers"].append({"type": "ring", "at": region_center, "t": timing["start"],
                    "out": region_end, "r": 28, "pulse": True, "color": "#ff6b5f"})
                plan("locate_small_region", "atlas.ring", {"segment": timing["id"], "time": timing["start"]}, region["id"],
                     ref=region.get("fact_ids"), layout={"at": region_center},
                     reason="Localiza una región pequeña sin ampliar su geometría ni acercar la cámara.")
            # Panel explica la región principal; circular/hexagonal alternan la segunda sin duplicar dibujantes.
            photo_type = "panel" if rindex == 0 else ("pole-photo" if index % 2 == 0 else "hex-photo")
            names = {"panel": "atlas.panel", "pole-photo": "atlas.polePhoto", "hex-photo": "atlas.hexPhoto"}
            photo = {"type": photo_type, "at": region_center, "src": region_photo, "focus": media.get("focus", [.5, .5]),
                "t": timing["start"], "out": region_end, "screen": [.46, .43],
                "title": region["name"], "label": region["name"], "text": media["caption"], "sub": media["caption"],
                "upper": False, "size": 92, "poleH": 155, "side": "right", "anchor": "right", "blankFor": .2,
                "fillAt": timing["start"] + .35, "accent": "#e53935", "enter": {"style": "rise", "dur": .5}}
            scene["layers"].append(photo)
            lines = textwrap.wrap(region["criterion"], width=38, break_long_words=False)
            if len(lines) > 4:
                raise host.StageError("Criterio regional demasiado largo para el callout responsive: " + region["id"])
            scene["hud"].append({"type": "lower-title", "x": 0.40, "y": 0.82, "t": timing["start"],
                 "out": region_end, "dur": 0.45, "exit": 0, "upper": False, "gap": 30,
                 "lines": [{"text": line, "size": 26, "weight": 500, "color": "#ecf9fc"} for line in lines]})
            regional_evidence.append({"id": region["id"], "start": timing["start"], "out": region_end,
                  "fact_ids": region.get("fact_ids", []), "criterion": region["criterion"], "span": span,
                  "span_source": "held_country_frame", "photo_component": names[photo_type], "photo_src": region_photo})
            plan("regional_context", names[photo_type], {"segment": timing["id"], "time": timing["start"]}, region["id"],
                 media=region_photo, ref=region.get("fact_ids"), layout={"screen": photo["screen"], "camera": "held_country_frame"},
                 reason="Foto documental vinculada al estado rojo; panel para contexto y foto circular/hexagonal para el segundo polo regional.")
        evidence["chapters"].append({"iso2": country["iso2"], "rank": country["rank"], "start": start,
              "camera_arrival": reveal_start, "flag_reveal_start": reveal_start, "flag_fit": flag_fit,
              "out": chapter_end, "segment_ids": [s["id"] for s in chapter],
              "flag_reveal_end": {"time": flag_end, "word_index": flag_word, "duration_seconds": round(flag_end - reveal_start, 3)},
              "flag_out": {"time": chapter_end, "persistent": True}, "country_frame": {"center": center, "span": span, "pitch": pitch},
              "transition": {"start": transition_start, "route_checkpoint": start + 2.0} if index else None,
              "portrait_start": {"time": portrait_start, "word_index": portrait_word},
              "leader_fact_ids": leader.get("fact_ids", []), "leader_as_of": leader.get("as_of"), "mandate_display": mandate,
              "gdp_data_ref": metric_id, "gdp_fact_ids": country["gdp"]["fact_ids"], "regions": regional_evidence})
    cameras, layers, look, closing = closing_fragment(outro["start"], duration,
        "PIB nominal · Proyección " + str(data["ranking"]["year"]))
    scene["camera"].extend(cameras)
    scene["layers"].extend(layers)
    scene["looks"].append(look)
    evidence["outro"] = closing
    plan("closing", closing["component"], {"segment": outro["id"], "time": outro["start"]}, None,
         ref=outro.get("fact_ids"), layout={"camera": "globe_below_title", "end": duration},
         reason="Cierre Atlas del catálogo: Tierra 3D giratoria bajo el título, visible hasta terminar el audio.")
    scene["camera"].sort(key=lambda key: key["t"])
    evidence["visual_plan"] = visual_plan
    evidence["orchestration_sha256"] = host.digest(host.ATLAS / "orchestration.json")
    return scene, evidence


def check_ready(ctx):
    result = subprocess.run(["node", str(host.ATLAS / "produce.mjs"), "check", str(ctx.episode), "--ready"],
                            capture_output=True, text=True, timeout=90)
    try:
        report = json.loads(result.stdout)
    except ValueError:
        raise host.StageError("El validador Atlas no devolvió JSON; revisar su instalación local") from None
    return {**report, "ok": result.returncode == 0 and report.get("ok") is True, "validator": "Atlas check --ready"}


def prepare_geography(ctx):
    """Resolver sólo geometría; reutiliza el filtro oficial sin planificar descargas."""
    from src.adapters.maps.geodata import GeoData
    scratch = ctx.file("assets/.atlas-geoprep-compiler.json")
    program = """import fs from 'node:fs';
import {geographicPreparation} from './src/templates/sandbox/nodehistory/_atlas/produce.mjs';
fs.writeFileSync(process.argv[2],JSON.stringify(geographicPreparation(JSON.parse(fs.readFileSync(process.argv[1],'utf8')))));
"""
    try:
        subprocess.run(["node", "--input-type=module", "-e", program, str(ctx.file("assets/scene.json")), str(scratch)],
                       cwd=host.SERVER, capture_output=True, text=True, check=True, timeout=30)
        GeoData().resolve_scene(scratch)
    finally:
        scratch.unlink(missing_ok=True)
    return host.digest(ctx.file("assets/geo.resolved.json"))


def compile_episode(ctx, force=False):
    started = time.monotonic()
    data, research, _ = host.inputs(ctx)
    usage = host.tools_modules()
    import narrate
    script = host.load(ctx.file("assets/script.json"))
    host.validate_script(script, data, research, host.load(host.ATLAS / "voice.json"), narrate.STYLE)
    required = ["assets/script.json", "assets/episode-data.json", "research.json", "assets/lyrics.json",
                "assets/song.mp3", "assets/regions.json", "assets/config.json", "work/results/test/transcript-raw.json",
                "assets/media/credits.json"]
    for country in data["countries"]:
        for region in country["regions"][:2]:
            required.append("assets/" + media_path(ctx, region.get("photo", {}).get("src")))
    if any(not ctx.file(name).is_file() for name in required):
        raise host.StageError("Se requieren guion, dataset, research, MP3, lyrics reales, RAW, regions y config")
    hashes = {name: host.digest(ctx.file(name)) for name in required}
    orchestration_hash = host.digest(host.ATLAS / "orchestration.json")
    catalog_hash = host.digest(host.ATLAS / "components.json")
    compiler_hash = host.digest(Path(__file__))
    lyrics, geometry = host.load(ctx.file("assets/lyrics.json")), host.load(ctx.file("assets/regions.json"))
    if lyrics.get("metadata", {}).get("audio_sha256") != hashes["assets/song.mp3"]:
        raise host.StageError("lyrics.json no corresponde al hash del MP3 final")
    raw = host.load(ctx.file("work/results/test/transcript-raw.json"))
    if raw.get("metadata", {}).get("audio_sha256") != hashes["assets/song.mp3"]:
        raise host.StageError("La evidencia RAW no corresponde al hash del MP3 final")
    voice_checkpoint = ctx.previous("voice")
    if voice_checkpoint.get("script_sha256") != hashes["assets/script.json"]:
        raise host.StageError("El guion cambió después de generar la voz o falta su checkpoint")
    report_path, scene_path = ctx.file("work/results/test/compile-report.json"), ctx.file("assets/scene.json")
    if scene_path.exists() and not force:
        previous = host.load(report_path) if report_path.is_file() else {}
        if (previous.get("compiler_version") == VERSION and previous.get("source_hashes") == hashes
                and previous.get("compiler_sha256") == compiler_hash
                and previous.get("catalog_sha256") == catalog_hash
                and previous.get("plan_sha256") == host.digest(ctx.file("work/component-plan.json"))
                and previous.get("geo_sha256") == host.digest(ctx.file("assets/geo.resolved.json"))
                and previous.get("evidence", {}).get("orchestration_sha256") == orchestration_hash
                and previous.get("scene_sha256") == host.digest(scene_path) and previous.get("ready", {}).get("ok")):
            return {"ok": True, "reused": True, "scene_sha256": previous["scene_sha256"], "ready": True}
        raise host.StageError("scene.json ya existe con entradas distintas; revisar o usar --force explícito")
    duration = host.audio_duration(ctx.file("assets/song.mp3"))
    alignment, words = align(script, lyrics, duration)
    alignment.update({"source_hashes": hashes, "compiler_version": VERSION, "at": host.utc()})
    ctx.save("work/results/test/alignment.json", alignment)
    scene, evidence = build_scene(ctx, script, data, research, geometry, alignment, words, duration)
    if any(host.digest(ctx.file(name)) != value for name, value in hashes.items()):
        raise host.StageError("Las entradas cambiaron durante la compilación; reintentar con una versión estable")
    if host.digest(host.ATLAS / "orchestration.json") != orchestration_hash:
        raise host.StageError("El perfil del orquestador cambió durante la compilación")
    if host.digest(host.ATLAS / "components.json") != catalog_hash:
        raise host.StageError("El catálogo cambió durante la compilación")
    ctx.save("assets/scene.json", scene)
    ctx.save("work/component-plan.json", {"schema_version": 1, "orchestration_sha256": orchestration_hash,
        "source_hashes": hashes, "entries": evidence["visual_plan"],
        "not_selected": {"atlas.flow": "No hay flujos cuantificados en este guion.",
            "atlas.arrowBidirectional": "El itinerario tiene un único sentido; no se afirma intercambio.",
            "atlas.bars": "Los paneles regionales ya rotulan cada punto; una segunda etiqueta duplicaría la información."}})
    geo_hash = prepare_geography(ctx)
    ready = check_ready(ctx)
    report = {"compiler_version": VERSION, "at": host.utc(), "source_hashes": hashes,
              "compiler_sha256": compiler_hash, "catalog_sha256": catalog_hash,
              "plan_sha256": host.digest(ctx.file("work/component-plan.json")),
              "geo_sha256": geo_hash, "geography_source_scene_sha256": host.digest(scene_path),
              "scene_sha256": host.digest(scene_path), "duration_seconds": duration,
              "alignment_coverage": alignment["coverage"], "alignment_uncertainties": {
                  s["id"]: s["uncertainties"] for s in alignment["segments"] if s["uncertainties"]},
              "ready": ready, "evidence": evidence,
              "pending": ["Escucha y revisión de diferencias de transcripción", "Revisión visual 16:9 y 9:16; colisiones y encuadres",
                          "Preparación/verificación de teselas y geometrías por el supervisor", "Permisos de medios y exactitud factual del supervisor"],
              "complete_production_certification": False}
    ctx.save("work/results/test/compile-report.json", report)
    entry = usage.record(ctx.episode, provider="kit", model="deterministic-atlas-compiler-v1", role="storyboard",
                 step="atlas-compile", seconds=time.monotonic() - started, ok=ready["ok"], usage_known=False,
                 note="Local deterministic compiler; no model, TTS, render or network")
    return {"ok": ready["ok"], "reused": False, "ready": ready["ok"], "scene_sha256": report["scene_sha256"],
            "duration_seconds": duration, "alignment_coverage": alignment["coverage"],
            "uncertain_segments": len(report["alignment_uncertainties"]), "layers": len(scene["layers"]),
            "regions": len(scene["regions"]), "hud_portraits": sum(h["type"] == "portrait" for h in scene["hud"]),
            "usage_event_id": entry["event_id"], "report": "work/results/test/compile-report.json",
            "errors": ready.get("errors", [])}


def self_test():
    script = {"segments": [
        {"id": "intro", "text": "El PIB de dos mil veintiséis es una proyección de tres coma cuatro billones, según el FMI.", "plan": {"kind": "intro"}, "fact_ids": []},
        {"id": "region", "text": "Ahora miramos la región del mapa que concentra servicios financieros y manufactura especializada.", "plan": {"kind": "region"}, "fact_ids": []}]}
    spoken = "El pe i be de 2026 es una proyección de 3,4 billones según el efe eme i Ahora miramos la región del mapa que concentra servicios financieros y manufactura especializada".split()
    words = [{"word": " " + value, "start": 1 + i * 0.4, "end": 1.35 + i * 0.4} for i, value in enumerate(spoken)]
    lyrics = {"segments": [{"words": words}]}
    report, actual = align(script, lyrics, 20)
    assert not report["failed_segments"] and report["coverage"] == 1
    assert report["segments"][0]["start"] == words[0]["start"]
    assert report["segments"][1]["start"] == next(w["start"] for w in words if w["word"].strip() == "Ahora")
    assert lexical_atoms("32.642,373") == "treinta y dos mil seiscientos cuarenta y dos coma trescientos setenta y tres".split()
    assert lexical_atoms("3.400") == "tres mil cuatrocientos".split()
    assert lexical_atoms("4,06") == "cuatro coma cero seis".split()
    assert lexical_atoms("0.006") == "cero coma cero cero seis".split()
    brief_word = json.loads(json.dumps(lyrics))
    brief_word["segments"][0]["words"][7]["end"] = brief_word["segments"][0]["words"][7]["start"] + 0.02
    brief_report = align(script, brief_word, 20)[0]
    assert brief_report["coverage"] == 1 and len(brief_report["short_words"]) == 1
    bad = {"segments": [{"words": words[:5]}]}
    assert align(script, bad, 20)[0]["failed_segments"]
    boundary, index = real_boundary(actual, 5.5, 5, 6, key="end")
    assert boundary == actual[index]["end"]
    assert align(script, lyrics, 20)[0] == report
    cameras, layers, look, closing = closing_fragment(30, 42, "Prueba de cierre")
    assert look["look"] == "espacio" and look["t"] == 30
    assert all(k["pitch"] == 0 and k["lift"] > 0 for k in cameras)
    assert cameras[-1]["t"] + cameras[-1]["dur"] == 42 and layers[0]["out"] == 42
    assert closing["end_checkpoint"] > 41.9 and closing["component"] == "atlas.outrov2"
    return {"ok": True, "synthetic": True, "checks": ["spanish_numbers", "decimal_thousands", "pib_fmi_aliases",
            "real_anchor_only", "missing_segment_rejected", "deterministic_alignment", "catalog_globe_outro_until_audio_end"],
            "not_exercised": ["actual episode", "models", "TTS", "render", "visual layout"]}


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--episode")
    parser.add_argument("--category", default="nodeatlas")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        print(json.dumps(self_test(), ensure_ascii=False))
        return 0
    if not args.episode:
        parser.error("--episode es obligatorio")
    sys.path.insert(0, str(host.SERVER))
    ctx = None
    try:
        from src.config.settings import settings
        from src.config.profile_layout import layout_for_settings
        layout = layout_for_settings(settings)
        if not settings.storage_profile_dir:
            raise host.StageError("Se requiere perfil v2/v3; no se admite destino legacy")
        manifest_path = layout.root / "profile.json"
        manifest = host.load(manifest_path)
        if manifest["id"] != settings.storage_profile_id or manifest["schema_version"] != layout.schema_version:
            raise host.StageError("El manifiesto y el perfil efectivo no coinciden")
        profile = {"id": manifest["id"], "schema_version": manifest["schema_version"],
                   "manifest_sha256": host.digest(manifest_path), "real_root": str(layout.root.resolve())}
        ctx = host.Context(layout, profile, args.episode, args.category)
        ctx.log.mkdir(parents=True, exist_ok=True, mode=0o700)
        with host.checked(ctx.log / "run.lock", ctx.log).open("a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise host.StageError("Otra etapa está activa para este episodio") from None
            ctx.require()
            try:
                result = compile_episode(ctx, args.force)
            except Exception as exc:
                result = {"ok": False, "error": str(exc) if isinstance(exc, host.StageError) else type(exc).__name__}
            ctx.checkpoint("compile", result)
            host.private_tree(ctx.episode)
            host.private_tree(ctx.log)
        print(json.dumps({"stage": "compile", **result}, ensure_ascii=False))
        return 0 if result["ok"] else 1
    except Exception as exc:
        print(json.dumps({"stage": "compile", "ok": False, "error": str(exc) if isinstance(exc, host.StageError) else type(exc).__name__}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
