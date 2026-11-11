#!/usr/bin/env python3
"""Finalize Atlas preparation for human review; never approve, render or publish."""
from __future__ import annotations

import argparse
from array import array
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
import time
import uuid
import wave

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import atlas_factory as host
import atlas_compile as compiler

SIZES = ("1920x1080", "1080x1920")
BOUND_INPUTS = ("assets/scene.json", "assets/lyrics.json", "assets/song.mp3",
                "assets/geo.resolved.json", "assets/config.json", "index.html")
EVIDENCE = "work/results/test/"


def sha(path):
    return host.digest(path)


def require(test, message):
    if not test:
        raise host.StageError(message)


def read(ctx, name):
    path = ctx.file(name)
    require(path.is_file(), "Falta evidencia: " + name)
    return host.load(path)


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def http(value):
    return isinstance(value, str) and bool(re.match(r"https?://[^\s]+\Z", value))


def bound_hashes(ctx):
    hashes = {name: sha(ctx.file(name)) for name in BOUND_INPUTS}
    require(all(hashes.values()), "Faltan entradas finales de escena, lyrics, MP3, geometría, configuración o wrapper")
    return hashes


def renderer_hashes():
    hashes = {name: sha(path) for name, path in host.PUBLIC_HASHES.items()}
    require(all(hashes.values()) and "atlas.js" in hashes and "proto.js" in hashes,
            "Faltan hashes compartidos del renderizador")
    return hashes


def closing_capture_gate(report, closing):
    """Require three distinct, correctly timed closing captures, not labels alone."""
    frames = {}
    for name, anchor in (("outro-entry", "entry_checkpoint"), ("outro", "mid_checkpoint"),
                         ("outro-end", "end_checkpoint")):
        matches = [item for item in report.get("captures", []) if isinstance(item, dict) and item.get("id") == name]
        require(len(matches) == 1, "Falta una captura única del cierre: " + name)
        frame = matches[0]
        require(finite(frame.get("time")) and finite(closing.get(anchor))
                and abs(frame["time"] - closing[anchor]) < .01,
                "La captura no corresponde al momento compilado del cierre: " + name)
        require(isinstance(frame.get("file"), str) and frame["file"], "Falta el archivo de captura: " + name)
        frames[name] = frame
    require(len({frame["file"] for frame in frames.values()}) == 3,
            "Entrada, giro y final requieren tres archivos de captura distintos")
    return frames


def preview_gate(report, hashes, duration, renderer, closing):
    require(report.get("ok") is True and report.get("cache_only_browser") is True,
            "El preview debe haber pasado desde caché")
    require(report.get("verification_scope") == "full_timeline_grid", "Los shots no sustituyen el barrido completo")
    step = report.get("step")
    require(finite(step) and 0 < step <= 0.25, "El paso de cobertura debe ser positivo y <=0.25s")
    require(finite(report.get("duration_seconds")) and abs(report["duration_seconds"] - duration) < 0.02,
            "La duración del preview no coincide con la escena actual")
    require(type(report.get("frames")) is int and report["frames"] >= math.ceil(duration / step) + 1,
            "El preview no cubre todos los pasos del episodio")
    closing_capture_gate(report, closing)
    require(all(report.get("source_hashes", {}).get(name) == value for name, value in hashes.items()),
            "El preview no corresponde a las seis entradas actuales del episodio")
    require(report.get("renderer_hashes") == renderer, "El renderizador cambió desde el preview")
    require(report.get("inputs_unchanged") is True
            and report.get("source_hashes_after") == report.get("source_hashes")
            and report.get("renderer_hashes_after") == renderer,
            "El preview no demuestra estabilidad de entradas y renderizador durante el barrido")
    for key in ("missing", "page_errors", "console_errors", "failed_responses", "blocked_requests"):
        require(isinstance(report.get(key), list) and not report[key], "El preview contiene errores o ausencias: " + key)
    require(report.get("resources", {}).get("browser_or_driver_descendants_remaining") == [],
            "Falta demostrar el cierre de los procesos propios del navegador")


def showcase_gate(bundle):
    report = bundle.get("atlas-showcase-final-report.json", bundle)
    catalog, tests = report.get("catalog", {}), report.get("tests", {})
    require(type(catalog.get("entries")) is int and catalog["entries"] >= 38
            and catalog.get("thumbs") == catalog["entries"], "Catálogo oficial incompleto: mínimo38 entradas y sus miniaturas")
    require(type(tests.get("passed")) is int and tests["passed"] >= 64 and tests.get("failed") == 0,
            "La evidencia del Showcase requiere al menos64 tests pasados y cero fallos")
    posters = {item.get("entry"): item for item in report.get("posters", []) if isinstance(item, dict)}
    for name in ("atlas.flagFill", "atlas.persistentPortrait"):
        poster = posters.get(name, {})
        require(poster.get("status") == 200 and str(poster.get("content_type", "")).startswith("image/"),
                "Falta respuesta200 de imagen oficial para " + name)
    return {"catalog_entries": catalog["entries"], "thumbs": catalog["thumbs"], "tests_passed": tests["passed"],
            "tests_failed": 0, "official_component_posters": [posters[name] for name in ("atlas.flagFill", "atlas.persistentPortrait")]}


def media_gate(ctx, data, credits):
    result = []
    for country in data["countries"]:
        assigned = [country.get(field) for field in ("flag_src", "portrait_src")]
        assigned += [region.get("photo", {}).get("src") for region in country["regions"][:2]]
        for source in assigned:
            relative = compiler.media_path(ctx, source)
            path = ctx.file("assets/" + relative)
            credit = credits.get(Path(relative).name) or credits.get(relative)
            require(isinstance(credit, dict), "Falta crédito documental para " + relative)
            require(http(credit.get("source_url")) and isinstance(credit.get("author"), str) and credit["author"].strip()
                    and isinstance(credit.get("license"), str) and credit["license"].strip(),
                    "Crédito sin autor, licencia o fuente HTTP: " + relative)
            require(credit.get("sha256") == sha(path), "El crédito no corresponde al archivo actual: " + relative)
            result.append({**credit, "file": "assets/" + relative})
    expected = sum(2 + len(country["regions"][:2]) for country in data["countries"])
    require(len(result) == expected and len({item["file"] for item in result}) == expected,
            "Cada bandera, retrato y fotografía regional requiere su archivo y crédito verificable")
    return result


def audio_gate(ctx, report):
    require(report.get("source") in ("song.wav", "assets/song.wav") and report.get("clipped_samples") == 0,
            "audio-signal.json debe documentar WAV real sin muestras recortadas")
    path, clipped, samples = ctx.file("assets/song.wav"), 0, 0
    with wave.open(str(path), "rb") as audio:
        require(audio.getsampwidth() == 2 and audio.getcomptype() == "NONE", "Se requiere WAV PCM16 para verificar clipping")
        rate, channels = audio.getframerate(), audio.getnchannels()
        while block := audio.readframes(65536):
            values = array("h", block)
            if sys.byteorder != "little":
                values.byteswap()
            clipped += values.count(-32768) + values.count(32767)
            samples += len(values)
    require(clipped == 0, "El WAV contiene muestras recortadas")
    require(report.get("sample_rate") == rate and report.get("channels") == channels
            and report.get("sample_width_bytes") == 2 and report.get("samples") == samples,
            "El informe de señal no coincide con el WAV actual")
    return {**report, "wav_sha256": sha(path), "clipped_samples_rechecked": clipped,
            "scope": "PCM WAV original; no se certifican escucha subjetiva ni picos decodificados del MP3",
            "subjective_listening_verified": False}


def supervisor_gate(ctx, approval, hashes, previews, closing):
    require(approval.get("approved_for_review") is True, "Falta aprobación visual del supervisor para revisión")
    require(all(approval.get("source_hashes", {}).get(name) == value for name, value in hashes.items()),
            "La aprobación visual no está ligada a los archivos actuales")
    seen = []
    for size in SIZES:
        item = approval.get("formats", {}).get(size, {})
        require(item.get("inspected") is True and isinstance(item.get("frames"), list) and item["frames"],
                "Falta inspección visual documentada del formato " + size)
        for frame in item["frames"]:
            require(isinstance(frame, dict) and isinstance(frame.get("file"), str), "Referencia visual inválida")
            path = ctx.file(frame["file"])
            require(path.is_file() and frame.get("sha256") == sha(path), "La captura aprobada cambió: " + frame["file"])
            seen.append({"format": size, "file": frame["file"], "sha256": frame["sha256"]})
        approved = {frame["file"] for frame in item["frames"]}
        captures = closing_capture_gate(previews[size], closing)
        require(all(frame["file"] in approved for frame in captures.values()),
                "Falta inspección del supervisor de entrada, giro o último cuadro del outro en " + size)
    return seen


def shared_gate(ctx, audit):
    initial = read(ctx, EVIDENCE + "initial.json").get("shared_hashes", {})
    final = audit.get("snapshot", {}).get("shared_hashes", {})
    current = {name: sha(path) for name, path in host.PUBLIC_HASHES.items()}
    require(all(current.values()) and final == current, "La auditoría no refleja los archivos compartidos actuales")
    changes = {name: {"before": initial.get(name), "after": value}
               for name, value in current.items() if initial.get(name) != value}
    if changes:
        review = read(ctx, EVIDENCE + "shared-changes-review.json")
        require(review.get("acknowledged") is True, "Falta revisión explícita de cambios compartidos")
        for name, delta in changes.items():
            item = review.get("changes", {}).get(name, {})
            require(item.get("before") == delta["before"] and item.get("after") == delta["after"]
                    and isinstance(item.get("reason"), str) and item["reason"].strip(),
                    "Cambio compartido sin hashes y motivo del supervisor: " + name)
            delta["reason"] = item["reason"]
    return {"hash_scope": list(current), "changes": changes,
            "certifies_entire_engine": False, "note": "Se revisa únicamente el alcance hash declarado por la auditoría; no se certifica todo el motor ni el backend."}


def no_engine_copies(ctx):
    names = {path.name for path in host.ATLAS.glob("*.js")} | {"proto.js", "maplibre-gl.mjs", "maplibre-gl-worker.mjs"}
    copies = [path.relative_to(ctx.episode).as_posix() for path in ctx.episode.rglob("*")
              if path.name in names or path.is_dir() and path.name in ("engine", "vendor")]
    require(not copies, "El episodio contiene posibles copias del motor: " + ", ".join(copies[:5]))


def outro_gate(scene, closing):
    require(closing.get("component") == "atlas.outrov2" and closing.get("end") == scene["duration"],
            "Falta el outro Atlas del catálogo hasta el final del audio")
    anchors = [closing.get(key) for key in ("start", "entry_checkpoint", "transition_end", "mid_checkpoint", "end_checkpoint", "end")]
    require(all(finite(value) for value in anchors) and 0 <= anchors[0]
            and all(a < b for a, b in zip(anchors, anchors[1:]))
            and abs(closing["end_checkpoint"] - (scene["duration"] - .05)) < .001,
            "Los momentos del cierre deben estar ordenados y cubrir el final real del audio")
    start = closing["start"]
    looks = scene.get("looks", [])
    require(len(looks) == 1 and looks[0].get("look") == "espacio" and looks[0].get("t") == start,
            "El look de globo debe activarse exclusivamente al comenzar el outro")
    keys = [key for key in scene["camera"] if key["t"] >= start]
    require(len(keys) >= 2 and all(key.get("pitch") == 0 and key.get("lift", 0) > 0 for key in keys)
            and keys[-1]["t"] + keys[-1].get("dur", 0) >= scene["duration"] - .1,
            "El cierre requiere Tierra 3D abajo y movimiento hasta el último fotograma")
    require(keys[0]["t"] == start and keys[-1]["t"] == closing["transition_end"]
            and keys[0].get("focus") != keys[-1].get("focus"),
            "La Tierra debe girar durante el cierre; dos poses iguales no constituyen un outro animado")
    require(any(layer.get("type") == "title" and start <= layer["t"] < closing["transition_end"]
                and layer.get("out") == scene["duration"] for layer in scene["layers"]),
            "El título del outro debe permanecer con la Tierra hasta terminar")
    return {"ok": True, "component": closing["component"], "start": start,
            "end": closing["end"], "final_frame_checked": closing["end_checkpoint"]}


def orchestration_gate(ctx, data, scene):
    profile = host.load(host.ATLAS / "orchestration.json")
    plan = read(ctx, "work/component-plan.json")
    require(plan.get("orchestration_sha256") == sha(host.ATLAS / "orchestration.json"),
            "La planificación no corresponde al contrato actual de Atlas Cinemático")
    require(all(sha(ctx.file(name)) == value for name, value in plan.get("source_hashes", {}).items())
            and bool(plan.get("source_hashes")), "La planificación visual tiene entradas desactualizadas")
    entries = plan.get("entries", [])
    fields = ("intent", "component", "timeAnchor", "location", "media", "ref", "layout", "reason")
    require(entries and all(all(field in entry for field in fields) and entry["reason"] for entry in entries),
            "El orquestador debe justificar componente, momento, lugar, medio y distribución")
    require(scene.get("look") == "satelite-realista" and not scene.get("lookOverrides"),
            "Los capítulos requieren el estilo satelital inclinado original")
    report = read(ctx, EVIDENCE + "compile-report.json")
    closing = outro_gate(scene, report.get("evidence", {}).get("outro", {}))
    require(report.get("compiler_sha256") == sha(Path(compiler.__file__))
            and report.get("plan_sha256") == sha(ctx.file("work/component-plan.json")),
            "La escena debe compilarse con la lógica y el plan actuales")
    require(report.get("geography_source_scene_sha256") == sha(ctx.file("assets/scene.json"))
            and report.get("geo_sha256") == sha(ctx.file("assets/geo.resolved.json")),
            "La geometría resuelta debe derivar de la escena actual")
    resolved = read(ctx, "assets/geo.resolved.json")["regions"]
    for item in resolved:
        index = item.get("layer")
        require(type(index) is int and 0 <= index < len(scene["layers"])
                and item.get("field") == "region"
                and scene["layers"][index].get("region") == item.get("id"),
                "Índice o ID administrativo desalineado en geo.resolved.json")
    expected_geo = {index for index, layer in enumerate(scene["layers"])
                    if layer.get("type") in ("highlight", "flag-fill") and layer.get("region") not in scene["regions"]}
    require({item["layer"] for item in resolved} == expected_geo, "Faltan geometrías administrativas de la escena")
    aligned = {item["id"]: item for item in read(ctx, EVIDENCE + "alignment.json")["segments"]}
    require(closing["start"] == next(item["start"] for item in aligned.values() if item["plan"]["kind"] == "outro"),
            "El outro debe comenzar en el segmento real de cierre")
    photos = {"panel", "pole-photo", "hex-photo"}
    used = set()
    for chapter in report["evidence"]["chapters"]:
        country = next(item for item in data["countries"] if item["iso2"] == chapter["iso2"])
        flags = [layer for layer in scene["layers"] if layer.get("type") == "flag-fill" and layer.get("region") == chapter["iso2"]]
        require(len(flags) == 1 and flags[0].get("out") == chapter["out"], "La bandera debe persistir hasta salir del país")
        values = [key.get("value") for key in flags[0].get("opacityKeys", [])]
        require(values and max(values) == profile["visual_profile"]["flag"]["opacity"]["intro"]
                and values[-1] == profile["visual_profile"]["flag"]["opacity"]["region"],
                "La bandera requiere revelado claro y opacidad mínima durante estados")
        portraits = [item for item in scene["hud"] if item.get("type") == "portrait"
                     and item.get("src") == country["portrait_src"]]
        require(len(portraits) == 1 and abs(portraits[0].get("size", 0) - 130) < .001
                and abs(portraits[0].get("nameSize", 0) - 28.8) < .001
                and abs(portraits[0].get("roleSize", 0) - 13.2) < .001,
                "El retrato requiere foto130% y textos120% respecto a la versión anterior")
        for region_index, region in enumerate(chapter["regions"]):
            spoken = aligned[chapter["segment_ids"][2 + region_index]]
            require(region["out"] >= spoken["end"], "La región debe conservarse hasta terminar su narración")
            require(not any(region["start"] <= key["t"] < region["out"] for key in scene["camera"]),
                    "No se permite acercar ni cambiar la cámara durante una explicación regional")
            red = [layer for layer in scene["layers"] if layer.get("type") == "highlight"
                   and layer.get("region") == region["id"]]
            require(len(red) == 1 and red[0].get("style", {}).get("fill") == "#e53935",
                    "Cada región debe resaltarse en rojo")
            layers = [layer for layer in scene["layers"] if layer.get("src") == region["photo_src"]
                      and layer.get("type") in photos and layer.get("t") == region["start"]]
            require(len(layers) == 1 and layers[0].get("at") is not None,
                    "Cada región requiere una foto documental conectada al mapa")
            used.add(layers[0]["type"])
    transitions = [entry for entry in entries if entry["intent"] == "country_transition"]
    require(len(transitions) == len(data["countries"]) - 1, "Falta planificar una ruta entre países")
    require(bool(used) and used <= photos, "La planificación requiere fotos regionales del catálogo")
    return {"ok": True, "countrywide_oblique_camera": True, "persistent_flags": 8,
            "red_regions_with_photos": 16, "transition_routes": len(transitions),
            "photo_components": sorted(used), "outro": closing, "plan_sha256": sha(ctx.file("work/component-plan.json"))}


def gates(ctx, ready_fn=compiler.check_ready):
    data, research, _ = host.inputs(ctx)
    hashes = bound_hashes(ctx)
    renderer = renderer_hashes()
    scene, script = read(ctx, "assets/scene.json"), read(ctx, "assets/script.json")
    require(finite(scene.get("duration")) and scene["duration"] > 0, "Duración de escena inválida")
    audit, consumption = read(ctx, EVIDENCE + "final.json"), read(ctx, "usage-report.json")
    require(audit.get("ok") is True and audit.get("usage") == consumption, "Ejecuta atlas_factory.py audit antes de finalizar")
    manifest = audit.get("snapshot", {}).get("manifest", {})
    for name, value in {**hashes, "assets/script.json": sha(ctx.file("assets/script.json"))}.items():
        require(manifest.get(name, {}).get("sha256") == value, "Auditoría desactualizada para " + name)
    require(abs(audit.get("durations", {}).get("song.mp3", 0) - scene["duration"]) < 0.02,
            "La escena no coincide con la duración medida del MP3")
    review = read(ctx, EVIDENCE + "editorial-review.json")
    require(review.get("approved_for_tts") is True and review.get("script_sha256") == sha(ctx.file("assets/script.json")),
            "Falta revisión editorial vinculada al guion actual")
    closing = read(ctx, EVIDENCE + "compile-report.json").get("evidence", {}).get("outro", {})
    outro_gate(scene, closing)
    previews = {size: read(ctx, EVIDENCE + "preview-" + size + ".json") for size in SIZES}
    for size, preview in previews.items():
        preview_gate(preview, hashes, scene["duration"], renderer, closing)
    viewed = supervisor_gate(ctx, read(ctx, EVIDENCE + "supervisor-approved.json"), hashes, previews, closing)
    media = media_gate(ctx, data, read(ctx, "assets/media/credits.json"))
    signal = audio_gate(ctx, read(ctx, EVIDENCE + "audio-signal.json"))
    showcase = showcase_gate(read(ctx, EVIDENCE + "showcase-evidence.json"))
    shared = shared_gate(ctx, audit)
    orchestration = orchestration_gate(ctx, data, scene)
    no_engine_copies(ctx)
    ready = ready_fn(ctx)
    require(ready.get("ok") is True, "Atlas check --ready no pasó")
    raw = read(ctx, EVIDENCE + "transcript-raw.json")
    require(raw.get("metadata", {}).get("audio_sha256") == hashes["assets/song.mp3"], "La transcripción RAW pertenece a otro audio")
    alignment, _ = compiler.align(script, raw, scene["duration"])
    return {"hashes": hashes, "renderer_hashes": renderer, "data": data, "research": research, "script": script, "usage": consumption,
            "media": media, "signal": signal, "showcase": showcase, "shared": shared, "orchestration": orchestration,
            "viewed": viewed, "ready": ready, "raw_review_points": alignment["differences"],
            "audit_hashes": {EVIDENCE + "final.json": sha(ctx.file(EVIDENCE + "final.json")),
                             "usage-report.json": sha(ctx.file("usage-report.json"))}}


def text_file(ctx, name, content):
    path = ctx.file(name)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    try:
        with temporary.open("x", encoding="utf-8") as stream:
            stream.write(content.rstrip() + "\n")
        temporary.chmod(0o600)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def cell(value):
    return str(value if value is not None else "desconocido").replace("|", "/").replace("\n", " ")


def documents(ctx, evidence):
    usage = evidence["usage"]
    rows = ["# Consumo y costes", "", "Consumo conocido del episodio. La caché y el razonamiento se muestran aparte; el razonamiento ya incluido en output no se vuelve a sumar.", "",
            "| Proveedor | Entrada fresca | Caché leída | Salida | Razonamiento incluido | Llamadas con/sin contador |",
            "|---|---:|---:|---:|---:|---:|"]
    for provider, item in usage.get("by_provider", {}).items():
        rows.append("| " + " | ".join(map(cell, [provider, item.get("fresh_input_tokens"), item.get("cached_input_tokens"),
                    item.get("output_tokens"), item.get("reasoning_tokens"), f"{item.get('known_calls', 0)}/{item.get('unknown_calls', 0)}"])) + " |")
    totals = usage.get("known_totals", {})
    fresh_output, cached = totals.get("fresh_input_plus_output_tokens"), totals.get("cached_input_tokens")
    if type(fresh_output) is int and type(cached) is int:
        rows += ["", f"Entrada fresca + salida medidas: **{fresh_output:,} tokens**.",
                 f"Caché leída: **{cached:,} tokens**.",
                 f"Total procesado medido, incluida la caché: **{fresh_output + cached:,} tokens**.",
                 "Este recuento describe las llamadas con contador; no es un precio ni el consumo absoluto de todo el trabajo."]
    counts = usage.get("call_counts", {})
    rows += ["", f"Llamadas a modelos/agentes registradas: {counts.get('model_or_agent', 'desconocido')}. "
             f"Ajustes contables: {counts.get('accounting_events', 0)}; no representan llamadas nuevas."]
    rows += ["", "Costes no medidos por episodio: investigación, revisión editorial, supervisión y escucha. No se presentan como cero.",
             "Ingeniería reutilizable: coste no medido y separado del trabajo por episodio. No se demuestra un coste mínimo global.",
             "El uso de suscripción o un precio de lista informado por un proveedor no demuestra el cargo real de una factura."]
    text_file(ctx, "COSTE.md", "\n".join(rows))
    credits = ["# Créditos y fuentes", "", "Fuentes documentales consultadas; los derechos de reutilización se conservan según cada registro.", "", "## Investigación", ""]
    for source in evidence["research"]["sources"]:
        credits.append(f"- {cell(source['id'])}: {cell(source.get('title', source['id']))} — {source['url']}")
    credits += ["", "## Geometrías", ""]
    for name, entry in read(ctx, "assets/regions.json").get("regions", {}).items():
        source = entry.get("source", {})
        credits.append(f"- {cell(name)}: {cell(source.get('name'))}; {cell(source.get('license'))}; {cell(source.get('url'))}; fuente SHA256 {cell(source.get('source_file_sha256'))}.")
    credits += ["", "## Banderas, retratos y fotografías regionales", ""]
    for item in evidence["media"]:
        credits.append(f"- {item['file']}: {cell(item.get('title'))}; autor {cell(item.get('author'))}; licencia {cell(item.get('license'))}. {item['source_url']} Licencia: {cell(item.get('license_url'))}. Cambios: {cell(item.get('changes'))}. SHA256 {item['sha256']}.")
    text_file(ctx, "CREDITS.md", "\n".join(credits))
    section = "\n".join(["<!-- atlas-finalize:start -->", "## Preparación para revisión", "",
        "Estado: lista para revisar. No aprobada para producción, promoción ni publicación; no se ha renderizado video.",
        "Se verificaron ambos barridos completos desde caché, archivos actuales, referencias y créditos; ver work/results/test/readiness.json.",
        "La escucha subjetiva y los puntos de la transcripción RAW permanecen pendientes. Ver COSTE.md, CREDITS.md y recipefactoryworkflow.json.",
        "<!-- atlas-finalize:end -->"])
    plan = ctx.file("PLAN.md").read_text(encoding="utf-8") if ctx.file("PLAN.md").is_file() else "# " + evidence["script"]["title"] + "\n"
    pattern = r"<!-- atlas-finalize:start -->.*?<!-- atlas-finalize:end -->"
    plan = re.sub(pattern, lambda _: section, plan, flags=re.S) if re.search(pattern, plan, re.S) else plan.rstrip() + "\n\n" + section
    text_file(ctx, "PLAN.md", plan)
    ctx.save("voice-profile.json", {"voice": evidence["script"]["voice"], "voice_direction": evidence["script"]["voice_direction"],
        "sources": {name: {"source": "sandbox/nodehistory/_atlas/" + name, "sha256": sha(host.ATLAS / name)}
                    for name in ("voice.json", "narrative.json")},
        "public_profile": host.load(host.ATLAS / "voice.json"), "subjective_listening_verified": False})
    gpu_modes = {size: read(ctx, EVIDENCE + "preview-" + size + ".json").get("gpu", {}).get("requested_mode", "software")
                 for size in SIZES}
    ctx.save("recipefactoryworkflow.json", {"version": 1, "engine": "nodehistory/_atlas", "design": "atlas-cinematico",
        "destination": "selected-profile/sandbox/category/episode", "commands": [
            "atlas_factory.py init", "supervisor: dataset + research + brief", "atlas_factory.py run-script",
            "supervisor: editorial-review approved_for_tts + script hash", "atlas_factory.py voice",
            "atlas_factory.py transcribe", "supervisor: raw audio/ASR differences + geometry + credited media",
            "atlas_compile.py", "atlas_preview.py --fetch --width 1920 --height 1080 --step .25 --capture-checkpoints --gpu " + gpu_modes["1920x1080"],
            "atlas_preview.py --fetch --width 1080 --height 1920 --step .25 --capture-checkpoints --gpu " + gpu_modes["1080x1920"], "supervisor: inspect both formats and record source/frame hashes",
            "atlas_factory.py audit", "atlas_finalize.py"], "postconditions": {"status": "lista para revisar",
            "production_ready": False, "rendered": False, "publication": False},
        "verified_gpu_modes": gpu_modes,
        "note": "Receta de preparación host. La opción GPU requiere verificar el renderer real en cada servidor; no certifica integración NATIVE_DESIGNS ni rendimiento/coste global y no copia motores."})


def finalize(ctx, demo=False, poster=False, ready_fn=compiler.check_ready):
    started = time.monotonic()
    evidence = gates(ctx, ready_fn)
    documents(ctx, evidence)
    poster_record = None
    if poster:
        from PIL import Image
        frame = next(item for item in evidence["viewed"] if item["format"] == "1920x1080")
        target = ctx.file("render/poster.jpg")
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with Image.open(ctx.file(frame["file"])) as source:
            image = source.convert("RGB")
            require(image.width > image.height, "El poster debe proceder de una captura horizontal aprobada")
            image.thumbnail((1280, 720))
            image.save(target, "JPEG", quality=90, optimize=True)
        poster_record = {"file": "render/poster.jpg", "sha256": sha(target), "derived_from": frame}
    for name, value in {**evidence["hashes"], **evidence["audit_hashes"]}.items():
        require(sha(ctx.file(name)) == value, "Una entrada o auditoría cambió durante la finalización: " + name)
    require(renderer_hashes() == evidence["renderer_hashes"], "El renderizador cambió durante la finalización")
    points = [{**point, "interpretation": "Diferencia RAW ASR para escucha; no demuestra por sí sola una omisión/error del TTS"}
              for point in evidence["raw_review_points"]]
    readiness = {"at": host.utc(), "ok": True, "status": "lista para revisar", "source_hashes": evidence["hashes"],
        "renderer_hashes": evidence["renderer_hashes"],
        "renderer_hash_scope": "atlas_factory.PUBLIC_HASHES only; does not certify the entire engine",
        "audit_files_unchanged": evidence["audit_hashes"], "gates": {"full_cache_only_previews": list(SIZES),
        "atlas_ready": evidence["ready"], "editorial_review_hash_matched": True, "documented_media": len(evidence["media"]),
        "signal": evidence["signal"], "showcase": evidence["showcase"], "orchestration": evidence["orchestration"], "supervisor_frames": evidence["viewed"],
        "shared_files": evidence["shared"], "no_episode_engine_copies_detected": True},
        "review_notes": points, "subjective_listening": False, "subjective_listening_verified": False,
        "production_ready": False, "rendered": False, "publication": False, "promotion_authorized": False,
        "poster": poster_record, "host_seconds": round(time.monotonic() - started, 2),
        "limits": ["Preparación técnica para revisión humana; no aprobación de publicación.",
                   "Escucha subjetiva y diferencias de transcripción RAW pendientes.",
                   "No certifica toda la fábrica, integración backend nativa ni coste mínimo global."]}
    ctx.save(EVIDENCE + "readiness.json", readiness)
    info = read(ctx, "info.json")
    info.update(status="lista para revisar", production_ready=False, rendered=False, publication=False,
                subjective_listening=False, subjective_listening_verified=False, review_notes=points)
    ctx.save("info.json", info)
    if demo:
        manifest_path = ctx.file("manifest.json")
        manifest = host.load(manifest_path) if manifest_path.is_file() else {}
        manifest.update(title=info["title"], design="atlas-cinematico", engine="nodehistory/_atlas",
                        status="en preparación", demo=True, production_ready=False, rendered=False, publication=False)
        ctx.save("manifest.json", manifest)
    # Registrar también los documentos, la ficha y el póster creados al finalizar.
    completed = host.snapshot(ctx)
    excluded = (EVIDENCE + "completed-snapshot.json", EVIDENCE + "stage-finalize.json")
    for name in excluded:
        completed.get("manifest", {}).pop(name, None)
    completed["snapshot_scope"] = "Episode files after finalization; excludes this snapshot and the subsequent finalize stage checkpoint."
    completed["excluded"] = list(excluded)
    ctx.save(EVIDENCE + "completed-snapshot.json", completed)
    return {"ok": True, "status": "lista para revisar", "demo_manifest": demo, "review_points": len(points),
            "subjective_listening": False, "rendered": False, "publication": False, "report": EVIDENCE + "readiness.json",
            "final_snapshot": EVIDENCE + "completed-snapshot.json"}


def invalidate_readiness(ctx, result):
    """A failed recheck must also revoke any old ready badge, not just its report."""
    state = {"status": "en progreso", "production_ready": False, "rendered": False, "publication": False}
    ctx.save(EVIDENCE + "readiness.json", {**result, **state, "at": host.utc()})
    for name in ("info.json", "manifest.json"):
        if ctx.file(name).is_file():
            ctx.save(name, {**read(ctx, name), **state})


def self_test():
    from copy import deepcopy
    cameras, layers, look, closing = compiler.closing_fragment(5, 17, "Prueba")
    closing_scene = {"duration": 17, "camera": cameras, "layers": layers, "looks": [look]}
    captures = [{"id": name, "time": closing[anchor], "file": name + ".jpg"}
                for name, anchor in (("outro-entry", "entry_checkpoint"), ("outro", "mid_checkpoint"),
                                     ("outro-end", "end_checkpoint"))]
    hashes = {name: "a" * 64 for name in BOUND_INPUTS}
    renderer = {"atlas.js": "b" * 64, "proto.js": "c" * 64}
    preview = {"ok": True, "cache_only_browser": True, "verification_scope": "full_timeline_grid", "step": .25,
        "duration_seconds": 17, "frames": 69, "source_hashes": hashes, "missing": [], "page_errors": [], "console_errors": [],
        "captures": captures,
        "source_hashes_after": hashes, "renderer_hashes": renderer, "renderer_hashes_after": renderer, "inputs_unchanged": True,
        "failed_responses": [], "blocked_requests": [], "resources": {"browser_or_driver_descendants_remaining": []}}
    preview_gate(preview, hashes, 17, renderer, closing)
    for changed in ({"frames": 68}, {"verification_scope": "checkpoints_only"}, {"step": .5}, {"source_hashes": {}},
                    {"source_hashes": {name: value for name, value in hashes.items() if name != "assets/geo.resolved.json"}},
                    {"renderer_hashes": {}}, {"inputs_unchanged": False}, {"missing": ["tile"]},
                    {"captures": [{"id": "outro", "time": 8}]}):
        try:
            preview_gate({**preview, **changed}, hashes, 17, renderer, closing)
            raise AssertionError("Invalid preview accepted")
        except host.StageError:
            pass
    showcase = {"atlas-showcase-final-report.json": {"catalog": {"entries": 38, "thumbs": 38},
        "tests": {"passed": 64, "failed": 0}, "posters": [{"entry": name, "status": 200, "content_type": "image/webp"}
        for name in ("atlas.flagFill", "atlas.persistentPortrait")]}}
    assert showcase_gate(showcase)["tests_passed"] == 64
    assert outro_gate(closing_scene, closing)["ok"]
    regressions = []
    def rejected(name, check):
        try:
            check()
        except host.StageError:
            regressions.append(name)
        else:
            raise AssertionError("Invalid closing accepted: " + name)
    rejected("missing-globe", lambda: outro_gate({**closing_scene, "looks": []}, closing))
    frozen = deepcopy(closing_scene)
    frozen["camera"][-1]["focus"] = frozen["camera"][0]["focus"]
    rejected("stationary-earth", lambda: outro_gate(frozen, closing))
    early_title = deepcopy(closing_scene)
    early_title["layers"][0]["out"] = 16
    rejected("title-ends-early", lambda: outro_gate(early_title, closing))
    rejected("last-word-is-not-audio-end", lambda: outro_gate(closing_scene, {**closing, "end_checkpoint": 16}))
    for name, change in (("wrong-entry-time", {"time": 0}), ("reused-capture", {"file": "outro.jpg"})):
        broken = deepcopy(preview)
        broken["captures"][0].update(change)
        rejected(name, lambda: preview_gate(broken, hashes, 17, renderer, closing))
    with tempfile.TemporaryDirectory(prefix="atlas-finalize-signal-", dir="/tmp") as tmp:
        class Fixture:
            def file(self, name):
                return Path(tmp) / Path(name).name
            def save(self, name, value):
                self.file(name).write_text(json.dumps(value))
        ctx = Fixture()
        for capture in captures:
            ctx.file(capture["file"]).write_bytes(capture["id"].encode())
        frames = [{"file": frame["file"], "sha256": sha(ctx.file(frame["file"]))} for frame in captures]
        approval = {"approved_for_review": True, "source_hashes": hashes,
                    "formats": {size: {"inspected": True, "frames": deepcopy(frames)} for size in SIZES}}
        previews = {size: preview for size in SIZES}
        assert len(supervisor_gate(ctx, approval, hashes, previews, closing)) == 6
        for size in SIZES:
            partial = deepcopy(approval)
            partial["formats"][size]["frames"].pop()
            rejected("unreviewed-final-frame-" + size, lambda: supervisor_gate(ctx, partial, hashes, previews, closing))
        ctx.file("outro-end.jpg").write_bytes(b"changed")
        rejected("changed-approved-capture", lambda: supervisor_gate(ctx, approval, hashes, previews, closing))
        for name in ("info.json", "manifest.json"):
            ctx.save(name, {"title": "Keep this title", "status": "lista para revisar"})
        invalidate_readiness(ctx, {"ok": False, "error": "Fixture"})
        for name in ("info.json", "manifest.json"):
            state = read(ctx, name)
            assert state["status"] == "en progreso" and state["title"] == "Keep this title"
        regressions.append("failed-recheck-revokes-ready-badges")
        path = ctx.file("assets/song.wav")
        def write(values):
            with wave.open(str(path), "wb") as audio:
                audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(24000)
                audio.writeframes(array("h", values).tobytes())
        signal = {"source": "song.wav", "clipped_samples": 0, "sample_rate": 24000, "channels": 1,
                  "sample_width_bytes": 2, "samples": 3}
        write([0, 100, -100]); assert audio_gate(ctx, signal)["clipped_samples_rechecked"] == 0
        write([0, 32767, -100])
        try:
            audio_gate(ctx, signal)
            raise AssertionError("Clipped audio accepted")
        except host.StageError:
            pass
    return {"ok": True, "synthetic": True, "checks": ["full-coverage-only", "fresh-source-hashes", "no-missing-tiles",
            "official-showcase-existing-schema", "real-wav-clipping", "globe-outro-required", "last-audio-frame-required"],
            "closing_regressions_rejected": regressions, "not_exercised": ["remote episode", "network", "models", "render"]}


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--episode")
    parser.add_argument("--category", default="nodeatlas")
    parser.add_argument("--demo", action="store_true")
    parser.add_argument("--poster", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        print(json.dumps(self_test(), ensure_ascii=False)); return 0
    if not args.episode:
        parser.error("--episode es obligatorio")
    sys.path.insert(0, str(host.SERVER))
    try:
        from src.config.settings import settings
        from src.config.profile_layout import layout_for_settings
        layout = layout_for_settings(settings)
        require(bool(settings.storage_profile_dir), "Se requiere perfil efectivo v2/v3")
        manifest = host.load(layout.root / "profile.json")
        require(manifest["id"] == settings.storage_profile_id and manifest["schema_version"] == layout.schema_version,
                "El manifiesto no coincide con el perfil efectivo")
        ctx = host.Context(layout, {"id": manifest["id"], "schema_version": manifest["schema_version"]}, args.episode, args.category)
        ctx.log.mkdir(parents=True, exist_ok=True, mode=0o700)
        with host.checked(ctx.log / "run.lock", ctx.log).open("a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise host.StageError("Otra etapa está activa para este episodio") from None
            ctx.require()
            try:
                result = finalize(ctx, args.demo, args.poster)
            except Exception as exc:
                result = {"ok": False, "error": str(exc) if isinstance(exc, host.StageError) else type(exc).__name__}
                invalidate_readiness(ctx, result)
            ctx.checkpoint("finalize", result)
            host.private_tree(ctx.episode); host.private_tree(ctx.log)
        print(json.dumps({"stage": "finalize", **result}, ensure_ascii=False)); return 0 if result["ok"] else 1
    except Exception as exc:
        print(json.dumps({"stage": "finalize", "ok": False, "error": str(exc) if isinstance(exc, host.StageError) else type(exc).__name__}, ensure_ascii=False)); return 1


if __name__ == "__main__":
    raise SystemExit(main())
