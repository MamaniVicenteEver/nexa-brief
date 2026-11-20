"""Adapta una plantilla de letras con guion explícito a la canción elegida.

Contexto. Holograma Mundos y Grunge Montaje nacieron como réplicas de un video: su guion
(`assets/config.json` → `timeline`) tiene escenas escritas a mano, con las palabras y los
tiempos de la referencia. Una canción nueva no puede reutilizar ese guion tal cual.

Este módulo separa lo que es de la plantilla de lo que es de la canción:

* `contenido-static.json` (carpeta de la plantilla): recetas de escena. Cada receta conserva
  la geometría, la decoración y las entradas del guion, pero SIN ninguna palabra de la
  referencia: el texto es una ranura (`ranuras`) que llena la canción.
* `adaptacion.json` (carpeta de la plantilla): umbrales de calidad, reglas de frases y de
  tiempos, y el esquema del guion (`els` o `pieces`).
* La transcripción de la canción (segmentos con palabras y tiempos).

`apply_song_lyrics` genera una línea de tiempo explícita (la que los motores ya dibujan):
una escena por frase, con cada palabra en su tiempo real. Las plantillas sin
`adaptacion.json` no se tocan. Con `contenido-static.json` vacío o ausente se quita el
guion y el motor de la plantilla muestra solo la transcripción con su mazo de respaldo.

El núcleo es puro (diccionarios y listas); solo `apply_song_lyrics` toca el servidor.
"""
from __future__ import annotations

import copy
import json
import math
import random
import re
import sys
import unicodedata
from collections import deque
from pathlib import Path
from typing import Any

RULES_FILE = "adaptacion.json"
RECIPES_FILE = "contenido-static.json"
CONTENT_VERSION = 1

# Esquemas de guion: dónde viven los elementos de una escena y cuáles llevan texto.
SCHEMAS: dict[str, dict[str, Any]] = {
    "els": {"text_kinds": {"text": "t", "rep": "t", "vcol": "t", "lab": "t"}, "label_kinds": {"vcol", "lab"}},
    "pieces": {"text_kinds": {"text": "s", "stack": "s", "grid": "s"}, "label_kinds": set()},
}
_CJK = re.compile(r"[⺀-鿿豈-﫿぀-ヿ가-힯]")
_KANA = re.compile(r"[぀-ヿ]")

DEFAULT_RULES: dict[str, Any] = {
    "umbrales": {
        "coberturaMin": 0.5, "coberturaRehacer": 0.3,
        "idiomaMin": 0.8, "idiomaRehacer": 0.5,
        "huecoMaxSec": 15.0, "logprobMin": -1.0,
    },
    "frases": {"maxWords": 4, "maxSec": 2.4, "minWords": 2},
    "tiempos": {
        "leadSec": 0.12, "holdSec": 0.9, "huecoMinSec": 0.35, "huecoTrozoSec": 3.5,
        "introMinSec": 0.9, "escenaMinSec": 0.4, "outroSec": None,
    },
    "recetas": {"enfriamiento": 4, "fraccionTop": 0.3, "mundoBloqueSec": [6, 14]},
    "entrada": {"porPalabraDesde": 2, "rotuloMaxPalabras": 3},
    "mensajes": {"activo": True, "minHuecoSec": 4.0, "duracionSec": 2.4, "maxPorHueco": 1, "maxPalabras": 6, "propios": []},
    "intro": {"valoresDemo": []},
    "config": {},
}


# --------------------------------------------------------------------------- utilidades

def _num(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def _merge(base: dict[str, Any], extra: dict[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    for key, value in (extra or {}).items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _merge(out[key], value)
        else:
            out[key] = copy.deepcopy(value)
    return out


def load_json(path: Path) -> Any:
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def load_rules(template_dir: Path) -> dict[str, Any] | None:
    """Reglas de la plantilla, o None si la plantilla no está adaptada (no se toca)."""
    raw = load_json(Path(template_dir) / RULES_FILE)
    if not isinstance(raw, dict):
        return None
    rules = _merge(DEFAULT_RULES, raw)
    rules["esquema"] = raw.get("esquema") if raw.get("esquema") in SCHEMAS else "els"
    return rules


def load_content(template_dir: Path) -> dict[str, Any]:
    raw = load_json(Path(template_dir) / RECIPES_FILE)
    return raw if isinstance(raw, dict) else {}


def _has_letters(text: str) -> bool:
    return any(ch.isalnum() for ch in text)


def _norm_tokens(text: str) -> list[str]:
    tokens = []
    for raw in str(text).split():
        token = re.sub(r"[^\w']", "", unicodedata.normalize("NFKC", raw).casefold()).replace("_", "")
        if token:
            tokens.append(token)
    return tokens


def _period(tokens: list[str]) -> tuple[list[str], int]:
    """('a b a b') → (['a','b'], 2): la unidad mínima y cuántas veces se repite."""
    n = len(tokens)
    for size in range(1, n + 1):
        if n % size == 0 and tokens == tokens[:size] * (n // size):
            return tokens[:size], n // size
    return tokens, 1


def _find(haystack: list[str], needle: list[str], start: int) -> int | None:
    if not needle:
        return None
    for pos in range(max(0, start), len(haystack) - len(needle) + 1):
        if haystack[pos:pos + len(needle)] == needle:
            return pos
    return None


# --------------------------------------------------------------------------- recetas

def _scene_items(scene: dict[str, Any], schema: str) -> list[Any]:
    if schema == "els":
        params = scene.get("p")
        return params.get("els") if isinstance(params, dict) and isinstance(params.get("els"), list) else []
    return scene.get("pieces") if isinstance(scene.get("pieces"), list) else []


def _set_items(scene: dict[str, Any], schema: str, items: list[Any]) -> None:
    if schema == "els":
        scene.setdefault("p", {})["els"] = items
    else:
        scene["pieces"] = items


def _text_field(item: Any, schema: str) -> str | None:
    if not isinstance(item, dict):
        return None
    return SCHEMAS[schema]["text_kinds"].get(item.get("k"))


def _is_special(scene: dict[str, Any]) -> bool:
    return scene.get("type") in ("intro", "outro")


def classify_scene(texts: list[str]) -> tuple[list[dict[str, Any]], int, bool] | None:
    """Clasifica los textos de una escena. Devuelve (ranuras, n, apta) o None si no hay letra.

    `linea`: la frase completa. `parte`: un tramo contiguo de la frase (`tok` = [a, b)).
    `rep`: cuántas veces se repite la unidad. `ajeno`: texto que no está en la frase más larga
    (se llenará con la frase completa). Una escena con letras sueltas (L I K E) no es apta.
    """
    parsed = []
    for text in texts:
        tokens = _norm_tokens(text)
        if not tokens:
            return None
        base, rep = _period(tokens)
        parsed.append((base, rep))
    longest = max((b for b, _ in parsed), key=len)
    n = len(longest)
    apta = True
    ranuras, cursor = [], 0
    for base, rep in parsed:
        info: dict[str, Any] = {"tipo": "linea", "tok": [0, n], "rep": rep, "ajeno": False}
        if base != longest:
            pos = _find(longest, base, cursor)
            if pos is None:
                pos = _find(longest, base, 0)
            if pos is None:
                info["ajeno"] = True
                info["rep"] = 1
                if len(base) == 1 and len(base[0]) == 1:
                    apta = False  # letra suelta de una palabra deletreada
            else:
                info = {"tipo": "parte", "tok": [pos, pos + len(base)], "rep": rep, "ajeno": False}
                cursor = pos + len(base)
        ranuras.append(info)
    return ranuras, n, apta


def _compress(ranuras: list[dict[str, Any]], n: int, labels: list[bool]) -> int:
    """Si los textos principales no cubren toda la frase, reduce n a las palabras cubiertas.

    Los rótulos (`lab`, `vcol`) no cuentan: se recortan a pocas palabras y no pueden ser
    el único sitio donde aparece una palabra de la letra.
    """
    main = [r for r, is_label in zip(ranuras, labels) if not is_label]
    if not main or any(r["tipo"] == "linea" for r in main):
        return n
    covered = sorted({i for r in main for i in range(*r["tok"])})
    if len(covered) == n or not covered:
        return n
    rank = {index: pos for pos, index in enumerate(covered)}
    for r in ranuras:
        if r["tipo"] != "parte":
            continue
        a, b = r["tok"]
        inside = [rank[i] for i in range(a, b) if i in rank]
        r["tok"] = [min(inside), max(inside) + 1] if inside else [0, len(covered)]
    return len(covered)


def extract_recipes(timeline: list[dict[str, Any]], schema: str) -> dict[str, Any]:
    """Convierte el guion en recetas sin texto de la referencia + la intro y el outro."""
    spec = SCHEMAS[schema]
    recipes: list[dict[str, Any]] = []
    intro = outro = None
    skipped = 0
    for index, original in enumerate(timeline):
        if not isinstance(original, dict):
            continue
        scene = copy.deepcopy(original)
        t0, t1 = _num(scene.get("t0")) or 0.0, _num(scene.get("t1"))
        if scene.get("type") == "intro" and intro is None:
            intro = {"dur": round((t1 if t1 is not None else t0 + 1.7) - t0, 3), "escena": _blank_special(scene, schema)}
            continue
        if scene.get("type") == "outro":
            outro = {"dur": round((t1 - t0) if t1 is not None else 3.6, 3), "escena": _blank_special(scene, schema)}
            continue
        items = _scene_items(scene, schema)
        slot_ids = [i for i, item in enumerate(items) if _text_field(item, schema) and _has_letters(str(item.get(_text_field(item, schema)) or ""))]
        if slot_ids and all(items[i].get("k") in spec["label_kinds"] for i in slot_ids):
            # un rótulo no puede ser el único sitio donde aparece la letra: la escena queda decorativa
            drop = set(slot_ids)
            items[:] = [it for j, it in enumerate(items) if j not in drop]
            slot_ids = []
        dur = round((t1 - t0) if t1 is not None else 1.5, 3)
        bg = scene.get("bg")
        base = {"id": f"r{len(recipes) + 1:03d}", "origen": scene.get("name") or index, "dur": dur,
                "mundo": bg if isinstance(bg, str) else None}
        if not slot_ids:
            clean = _drop_times(scene)
            recipes.append({**base, "n": 0, "palabras": [0, 0], "ranuras": [], "escena": clean})
            continue
        classified = classify_scene([str(items[i].get(_text_field(items[i], schema))) for i in slot_ids])
        if classified is None or not classified[2]:
            skipped += 1
            continue
        ranuras, n, _ = classified
        n = _compress(ranuras, n, [items[i].get("k") in spec["label_kinds"] for i in slot_ids])
        for slot, i in zip(ranuras, slot_ids):
            slot["i"] = i
            items[i][_text_field(items[i], schema)] = ""
            for key in ("wt", "hl", "nocase"):
                items[i].pop(key, None)
        parts = {tuple(r["tok"]) for r in ranuras if r["tipo"] == "parte"}
        pmin = max(1, int(n / 2 + 0.5), len(parts))
        pmax = max(pmin, 2 * n)
        recipes.append({**base, "n": n, "palabras": [pmin, pmax], "ranuras": ranuras, "escena": _drop_times(scene)})
    return {"version": CONTENT_VERSION, "esquema": schema, "intro": intro, "outro": outro,
            "descartadas": skipped, "recetas": recipes}


def _drop_times(scene: dict[str, Any]) -> dict[str, Any]:
    scene.pop("t0", None)
    scene.pop("t1", None)
    return scene


def _blank_special(scene: dict[str, Any], schema: str) -> dict[str, Any]:
    """Intro/outro: se conserva el diseño; el texto de letra del guion (no el de marca) se vacía."""
    scene = _drop_times(scene)
    items = _scene_items(scene, schema)
    if schema == "pieces" and scene.get("type") == "intro":
        # Solo se queda el texto que toma su valor de config.intro (clave `intro`).
        items[:] = [it for it in items if not (isinstance(it, dict) and it.get("k") == "text" and not it.get("intro"))]
        for it in items:
            if isinstance(it, dict) and it.get("k") == "text" and it.get("intro"):
                it["s"] = ""
                it.pop("wt", None)
    return scene


# --------------------------------------------------------------------------- canción

def _clean_word(text: str) -> str:
    text = str(text).strip()
    text = re.sub(r"[.,;:!?¡¿\"“”()\[\]]", "", text)
    return re.sub(r"[`´’]", "'", text)


def filter_segments(segments: list[Any], config_filter: dict[str, Any] | None, min_logprob: float | None) -> tuple[list[dict], list[dict]]:
    """Mismo criterio que `loadScript` del motor: descarta alucinaciones. Devuelve (buenos, descartados)."""
    flt = config_filter or {}
    drop = []
    for pattern in flt.get("drop") or []:
        try:
            drop.append(re.compile(pattern, re.I))
        except re.error:
            continue
    limit = min_logprob  # el umbral lo fija adaptacion.json; la config solo aporta las expresiones de descarte
    kept, dropped = [], []
    for seg in segments:
        if not isinstance(seg, dict) or _num(seg.get("start")) is None:
            continue
        logp = _num(seg.get("avg_logprob"))
        text = str(seg.get("text") or "")
        bad = (limit is not None and logp is not None and logp < limit) or any(rx.search(text) for rx in drop)
        (dropped if bad else kept).append(seg)
    kept.sort(key=lambda s: float(s["start"]))
    return kept, dropped


def segment_words(seg: dict[str, Any]) -> list[dict[str, Any]]:
    start = float(seg["start"])
    end = _num(seg.get("end"))
    words = []
    raw = seg.get("words") if isinstance(seg.get("words"), list) else []
    for w in raw:
        if not isinstance(w, dict):
            continue
        t = _num(w.get("start", w.get("t")))
        text = _clean_word(w.get("word", w.get("text")) or "")
        if t is None or not text:
            continue
        e = _num(w.get("end"))
        words.append({"text": text, "t": t, "end": e if e is not None and e > t else t + 0.3})
    if not words:  # sin tiempos por palabra: se reparten dentro del segmento
        pieces = [_clean_word(p) for p in str(seg.get("text") or "").split()]
        pieces = [p for p in pieces if p]
        stop = end if end is not None and end > start else start + max(0.6, 0.35 * len(pieces))
        step = (stop - start) / max(1, len(pieces))
        words = [{"text": p, "t": start + i * step, "end": start + (i + 1) * step} for i, p in enumerate(pieces)]
    merged: list[dict[str, Any]] = []
    for w in words:  # Whisper parte "y'all" en "y" + "'all"
        if w["text"].startswith("'") and merged:
            merged[-1]["text"] += w["text"]
            merged[-1]["end"] = w["end"]
        else:
            merged.append(w)
    return merged


def build_phrases(segments: list[dict[str, Any]], max_words: int, max_sec: float, min_words: int) -> list[list[dict[str, Any]]]:
    """Frases de ≤ max_words y ≤ max_sec cortando en la pausa más larga (igual que `lyricPhrases`)."""
    queue = deque(segment_words(seg) for seg in segments)
    out: list[list[dict[str, Any]]] = []
    while queue:
        words = queue.popleft()
        if not words:
            continue
        span = words[-1]["end"] - words[0]["t"]
        if len(words) > max_words or (span > max_sec and len(words) >= 2 * min_words):
            cut, best = math.ceil(len(words) / 2), -1.0
            lo = max(min_words, math.ceil(len(words) * 0.2))
            hi = min(len(words) - min_words, math.floor(len(words) * 0.8))
            for i in range(lo, hi + 1):
                gap = words[i]["t"] - words[i - 1]["end"] + (0.12 if re.match(r"^(and|but|i|i'm|y|pero|que)$", words[i]["text"], re.I) else 0.0)
                if gap > best:
                    best, cut = gap, i
            cut = min(max(cut, 1), len(words) - 1)
            queue.appendleft(words[cut:])
            queue.appendleft(words[:cut])
            continue
        out.append(words)
    return out


def merge_short_phrases(phrases: list[list[dict[str, Any]]], lead: float, min_sec: float, max_words: int) -> list[list[dict[str, Any]]]:
    """Fusiona una frase con la siguiente si no le da tiempo a una escena de `min_sec`.

    Evita que las escenas mínimas se acumulen y arranquen tarde (palabras muy cortas,
    p. ej. un carácter por palabra). No se pierde ninguna palabra.
    """
    out: list[list[dict[str, Any]]] = []
    i = 0
    while i < len(phrases):
        current = list(phrases[i])
        i += 1
        while i < len(phrases) and (phrases[i][0]["t"] - lead) - (current[0]["t"] - lead) < min_sec \
                and len(current) + len(phrases[i]) <= max_words:
            current += phrases[i]
            i += 1
        out.append(current)
    return out


def analyze_song(segments: list[dict], dropped: list[dict], duration: float, language: str | None,
                 probability: float | None, declared: bool, thresholds: dict[str, Any]) -> dict[str, Any]:
    """Calidad de la transcripción para esta plantilla. Nunca bloquea: informa."""
    spans = sorted((float(s["start"]), float(s["end"])) for s in segments
                   if _num(s.get("end")) is not None and float(s["end"]) > float(s["start"]))
    covered, cur = 0.0, None
    gaps, prev = [], 0.0
    for start, end in spans:
        if cur is None or start > cur[1]:
            if cur is not None:
                covered += cur[1] - cur[0]
            cur = [start, end]
        else:
            cur[1] = max(cur[1], end)
        if start - prev > thresholds["huecoMaxSec"]:
            gaps.append(round(start - prev, 1))
        prev = max(prev, end)
    if cur is not None:
        covered += cur[1] - cur[0]
    if duration and duration - prev > thresholds["huecoMaxSec"]:
        gaps.append(round(duration - prev, 1))
    coverage = covered / duration if duration else 0.0
    if declared:
        probability = 1.0
    text = " ".join(str(s.get("text") or "") for s in segments)
    notes, state = [], "ok"
    if not segments:
        state = "instrumental"
        notes.append("La canción no tiene letra transcrita: se mostrará solo intro, decoración y outro.")
    else:
        trusted = probability is not None and probability >= thresholds["idiomaMin"]
        if coverage < thresholds["coberturaRehacer"] and trusted:
            state = "revisar"  # idioma fiable: lo normal es que el tema tenga largos tramos instrumentales
            notes.append(f"La letra cubre {coverage:.0%} del tema: parece tener largos tramos instrumentales; los huecos se rellenan con decoración.")
        elif coverage < thresholds["coberturaRehacer"]:
            state = "rehacer"
            notes.append(f"Cobertura de letra {coverage:.0%}: conviene volver a transcribir (indicando el idioma).")
        elif coverage < thresholds["coberturaMin"]:
            state = "revisar"
            notes.append(f"Cobertura de letra {coverage:.0%}: revisa la transcripción.")
        if probability is None:
            state = state if state == "rehacer" else "revisar"
            notes.append("El idioma no está declarado ni detectado con confianza.")
        elif probability < thresholds["idiomaRehacer"]:
            state = "rehacer"
            notes.append(f"Idioma detectado con confianza {probability:.2f}: vuelve a transcribir indicando el idioma.")
        elif probability < thresholds["idiomaMin"]:
            state = state if state == "rehacer" else "revisar"
            notes.append(f"Idioma detectado con confianza {probability:.2f}: revisa la letra.")
    if dropped:
        notes.append(f"{len(dropped)} segmento(s) de baja confianza se excluyeron.")
        state = state if state in ("rehacer", "instrumental") else "revisar"
    if gaps:
        notes.append(f"{len(gaps)} hueco(s) sin letra de más de {thresholds['huecoMaxSec']:.0f} s (mayor: {max(gaps):.0f} s): se rellenan con decoración.")
    if _KANA.search(text):
        notes.append("La letra incluye kana: comprueba que la tipografía de la plantilla lo cubre.")
    elif _CJK.search(text):
        notes.append("La letra incluye hangul/CJK: comprueba la tipografía.")
    return {"estado": state, "cobertura": round(coverage, 3), "idioma": language, "confianzaIdioma": probability,
            "segmentos": len(segments), "excluidos": len(dropped), "huecos": gaps, "avisos": notes}


# --------------------------------------------------------------------------- tiempos de los elementos

def _shift_times(item: dict[str, Any], delta: float) -> None:
    """Desplaza las anclas de tiempo de un elemento (todo menos `out`, que se ancla al final)."""
    for key, value in item.items():
        if key == "out":
            continue
        if isinstance(value, dict) and _num(value.get("at")) is not None:
            value["at"] = round(max(0.0, value["at"] + delta), 3)
    kf = item.get("kf")
    if isinstance(kf, list):
        for frame in kf:
            if isinstance(frame, list) and frame and _num(frame[0]) is not None:
                frame[0] = round(max(0.0, frame[0] + delta), 3)


def _retime(item: dict[str, Any], at_old: float, at_new: float, dur_new: float, dur_old: float) -> None:
    delta = at_new - at_old
    _shift_times(item, delta)
    item["at"] = round(max(0.0, at_new), 3)
    until = _num(item.get("until"))
    if until is not None:
        life = max(0.15, until - at_old)
        item["until"] = round(at_new + life, 3)
        if item["until"] >= dur_new - 0.08:
            del item["until"]
    out = item.get("out")
    if isinstance(out, dict) and _num(out.get("at")) is not None:
        anchored = dur_new - max(0.0, dur_old - out["at"])
        out["at"] = round(min(max(anchored, at_new + 0.2), max(at_new + 0.2, dur_new - 0.05)), 3)


def _word_range(tok: list[int], n: int, m: int) -> tuple[int, int]:
    a, b = tok
    start = min(m - 1, (a * m) // max(1, n))
    stop = max(start + 1, min(m, -(-(b * m) // max(1, n))))
    return start, stop


def instantiate(recipe: dict[str, Any], words: list[dict[str, Any]], t0: float, t1: float,
                schema: str, rules: dict[str, Any], name: str) -> dict[str, Any]:
    """Una escena de la receta con la frase y los tiempos de la canción."""
    scene = copy.deepcopy(recipe["escena"])
    duration = max(0.05, t1 - t0)
    old = float(recipe.get("dur") or duration)
    items = _scene_items(scene, schema)
    m, n = len(words), max(1, int(recipe.get("n") or 1))
    entry = rules["entrada"]
    first_delta: float | None = None
    deltas: dict[str, float] = {}
    slot_index = {r["i"] for r in recipe["ranuras"]}
    for slot in recipe["ranuras"]:
        item = items[slot["i"]]
        field = _text_field(item, schema)
        a, b = _word_range(slot["tok"], n, m) if slot["tipo"] == "parte" else (0, m)
        chunk = words[a:b]
        kind = item.get("k")
        if kind in SCHEMAS[schema]["label_kinds"]:
            chunk = chunk[: max(1, int(entry["rotuloMaxPalabras"]))]
        reps = max(1, int(slot.get("rep") or 1))
        text = " ".join([w["text"] for w in chunk] * reps)
        item[field] = text
        at_old = _num(item.get("at")) or 0.0
        start_rel = max(0.0, chunk[0]["t"] - t0)
        rel_times = [round(max(0.0, w["t"] - t0), 3) for w in chunk]
        if first_delta is None:
            first_delta = start_rel - at_old
        if item.get("id") is not None:
            deltas[str(item["id"])] = start_rel - at_old
        for key in ("hl", "nocase", "wt"):
            item.pop(key, None)
        if kind in ("text", "rep"):
            cjk = bool(_CJK.search(text))
            if schema == "els":
                item["f"] = "ko" if cjk else ("w" if item.get("f") == "w" else "c")
                width = min(0.9, max(0.3, len(text) * 0.025))
                item["maxw"] = round(max(_num(item.get("maxw")) or 0.0, width), 3)
        mode = item.get("in")
        if kind == "text" and reps == 1 and len(chunk) >= int(entry["porPalabraDesde"]) and mode in (None, "cut", "words"):
            item["in"] = "words"
            item["wt"] = rel_times
        elif mode == "words" and reps == 1 and len(chunk) >= 1:
            item["wt"] = rel_times
        elif mode == "words":
            item["in"] = "cut"
        _retime(item, at_old, start_rel, duration, old)
    scene_delta = first_delta or 0.0
    for index, item in enumerate(items):
        if index in slot_index or not isinstance(item, dict):
            continue
        ref = deltas.get(str(item.get("ref"))) if item.get("ref") is not None else None
        delta = ref if ref is not None else scene_delta
        at_old = _num(item.get("at"))
        if at_old is not None:
            _retime(item, at_old, max(0.0, at_old + delta), duration, old)
        elif ref is not None and delta > 0:
            _retime(item, 0.0, delta, duration, old)  # adorno atado a un texto: nace con él
        elif isinstance(item.get("kf"), list):
            _shift_times(item, delta)
    scene["t0"], scene["t1"] = round(t0, 3), round(t1, 3)
    if schema == "pieces":
        scene["name"] = name
    return scene


def strip_text(scene: dict[str, Any], schema: str) -> dict[str, Any]:
    """Escena decorativa a partir de una receta con texto (respaldo si no hay recetas sin letra)."""
    scene = copy.deepcopy(scene)
    items = _scene_items(scene, schema)
    removed = {str(it.get("id")) for it in items if _text_field(it, schema) and it.get("id") is not None}
    kept = [it for it in items if not _text_field(it, schema) and not (isinstance(it, dict) and str(it.get("ref")) in removed)]
    _set_items(scene, schema, kept)
    return scene


# --------------------------------------------------------------------------- línea de tiempo

def _pick(recipes: list[dict], m: int, dur: float, recent: list[str], prev_world: Any, block_left: float,
          rules: dict[str, Any], rng: random.Random) -> dict:
    cands = [r for r in recipes if r["palabras"][0] <= m <= r["palabras"][1]]
    if not cands:
        cands = sorted(recipes, key=lambda r: abs(m - max(1, r["n"])))[: max(5, len(recipes) // 10)]
    fresh = [r for r in cands if r["id"] not in recent]
    cands = fresh or cands
    if prev_world is not None:
        same = [r for r in cands if r.get("mundo") in (prev_world, None)]
        other = [r for r in cands if r.get("mundo") not in (prev_world, None)]
        if block_left > 0 and same:
            cands = same
        elif block_left <= 0 and other:
            cands = other
    cands = sorted(cands, key=lambda r: abs(math.log(max(dur, 0.2) / max(float(r.get("dur") or 0.2), 0.2))))
    top = cands[: max(3, math.ceil(len(cands) * float(rules["recetas"]["fraccionTop"])))]
    return rng.choice(top)


def _message_pool(phrases: list[list[dict[str, Any]]], song: dict[str, Any]) -> dict[str, str | None]:
    """Textos con sentido que salen de la propia canción (nada genérico)."""
    texts = [" ".join(w["text"] for w in p) for p in phrases]
    counts: dict[str, int] = {}
    for t in texts:
        counts[t.casefold()] = counts.get(t.casefold(), 0) + 1
    chorus = None
    if counts:
        key, n = max(counts.items(), key=lambda kv: (kv[1], len(kv[0])))
        if n >= 2:
            chorus = next(t for t in texts if t.casefold() == key)
    return {"titulo": (song.get("titulo") or None), "artista": (song.get("artista") or None), "estribillo": chorus}


def fix_intro(case: dict[str, Any], rules: dict[str, Any], song: dict[str, Any]) -> None:
    """Quita de la intro los textos de la demo (título y artista de la referencia)."""
    intro = case.get("intro")
    if not isinstance(intro, dict):
        return
    demo = {str(v).casefold() for v in rules["intro"].get("valoresDemo") or []}
    for key, new in (("title", song.get("titulo")), ("artist", song.get("artista"))):
        current = str(intro.get(key) or "").strip()
        full = [f"{song.get('artista') or ''} {song.get('titulo') or ''}".strip(), str(song.get("titulo") or "")]
        if current.casefold() in demo:
            intro[key] = new or ""
        elif not current and new:
            intro[key] = new
        elif key == "title" and new and current != new and len(current) >= 20 and any(f.startswith(current) for f in full):
            intro[key] = new  # título recortado al crear el prototipo: se completa con el real


def build_timeline(case: dict[str, Any], content: dict[str, Any], rules: dict[str, Any],
                   phrases: list[list[dict[str, Any]]], duration: float, seed: int,
                   song: dict[str, Any] | None = None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    schema = rules["esquema"]
    song = song or {}
    msg_cfg = rules["mensajes"]
    pool = _message_pool(phrases, song)
    timing = rules["tiempos"]
    lead, hold = float(timing["leadSec"]), float(timing["holdSec"])
    gap_min, chunk = float(timing["huecoMinSec"]), float(timing["huecoTrozoSec"])
    scene_min = float(timing["escenaMinSec"])
    recipes = [r for r in content.get("recetas", []) if isinstance(r, dict) and isinstance(r.get("escena"), dict)]
    spoken = [r for r in recipes if r["ranuras"]]
    decor = [r for r in recipes if not r["ranuras"]]
    rng = random.Random(seed)

    intro = content.get("intro") if isinstance(content.get("intro"), dict) else None
    intro_on = intro is not None
    if schema == "pieces":  # Grunge: la intro toma su texto de config.intro y sin título no existe
        intro_on = intro_on and bool(str((case.get("intro") or {}).get("title") or "").strip()) and (case.get("intro") or {}).get("enabled") is not False
    first_start = (phrases[0][0]["t"] - lead) if phrases else duration
    intro_len = min(float(intro["dur"]), first_start) if intro_on else 0.0
    if intro_on and intro_len < float(timing["introMinSec"]):
        intro_on, intro_len = False, 0.0

    outro = content.get("outro") if isinstance(content.get("outro"), dict) else None
    outro_s = _num(timing.get("outroSec")) or _num((case.get("outro") or {}).get("sec")) or (float(outro["dur"]) if outro else 0.0)
    outro_s = min(12.0, max(1.5, outro_s)) if outro else 0.0
    outro_start = max(intro_len, duration - outro_s) if outro else duration
    if outro and phrases:  # la letra manda: el outro se acorta (mínimo 1 s) o se omite antes que cortarla
        last_end = phrases[-1][-1]["end"] + 0.3
        if last_end > outro_start:
            if duration - last_end < 1.0:
                outro, outro_start = None, duration
            else:
                outro_start = max(intro_len, last_end)

    scenes: list[dict[str, Any]] = []
    counter = [0]

    def next_name() -> str:
        counter[0] += 1
        return f"s{counter[0]:03d}"

    if intro_on:
        scene = copy.deepcopy(intro["escena"])
        scene["t0"], scene["t1"] = 0.0, round(intro_len, 3)
        if schema == "pieces":
            scene["name"] = next_name()
            intro_cfg = case.get("intro") or {}
            scene["pieces"] = [p for p in scene.get("pieces", [])
                               if not (isinstance(p, dict) and p.get("intro") and not str(intro_cfg.get(p["intro"]) or "").strip())]
        scenes.append(scene)

    decor_cursor = [rng.randrange(max(1, len(decor)))] if decor else [0]

    def decor_scene(t0: float, t1: float) -> dict[str, Any]:
        if decor:
            recipe = decor[decor_cursor[0] % len(decor)]
            decor_cursor[0] += 1 + rng.randrange(3)
            scene = copy.deepcopy(recipe["escena"])
        elif recipes:
            scene = strip_text(rng.choice(recipes)["escena"], schema)
        else:
            scene = {"type": "compose", "bg": "void", "trans": "cut", "p": {"els": []}} if schema == "els" else {"bg": {"paper": True}, "pieces": []}
        scene["t0"], scene["t1"] = round(t0, 3), round(t1, 3)
        if schema == "pieces":
            scene["name"] = next_name()
        return scene

    recent: list[str] = []
    world: Any = None
    msg_used: dict[str, int] = {}
    msg_last: list[str | None] = [None]
    prev_text: list[str | None] = [None]

    def decor_run(t0: float, t1: float) -> None:
        total = t1 - t0
        if total <= 0.02:
            return
        parts = max(1, math.ceil(total / chunk))
        for i in range(parts):
            scenes.append(decor_scene(t0 + total * i / parts, t0 + total * (i + 1) / parts))

    def candidates(kind: str) -> list[str]:
        order = {"inicio": [] if intro_on else ["titulo", "artista"],
                 "medio": ["ultima", "estribillo"], "final": ["estribillo", "ultima", "titulo"]}[kind]
        texts = []
        for name in order:
            value = prev_text[0] if name == "ultima" else pool.get(name)
            if name == "ultima" and value and len(str(value).split()) < 2:
                value = None  # repetir una sola palabra recién cantada no aporta nada
            if value:
                texts.append(str(value))
        texts += [str(t) for t in msg_cfg.get("propios") or [] if str(t).strip()]
        limit = int(msg_cfg["maxPalabras"])
        return [t for t in texts if 0 < len(t.split()) <= limit]

    def message_scene(text: str, t0: float, t1: float) -> None:
        nonlocal recent
        words = [{"text": w, "t": t0 + 0.15 + i * 0.3, "end": t0 + 0.15 + i * 0.3 + 0.28} for i, w in enumerate(text.split())]
        recipe = _pick(spoken, len(words), t1 - t0, recent, None, 0.0, rules, rng)
        recent = (recent + [recipe["id"]])[-int(rules["recetas"]["enfriamiento"]):]
        scenes.append(instantiate(recipe, words, t0, t1, schema, rules, next_name()))

    def fill_gap(t0: float, t1: float, kind: str = "medio") -> None:
        total = t1 - t0
        picked: list[str] = []
        if msg_cfg.get("activo") and spoken and total >= float(msg_cfg["minHuecoSec"]):
            options = candidates(kind)
            count = min(int(msg_cfg["maxPorHueco"]), int(total // float(msg_cfg["minHuecoSec"])), len(options))
            ranked = sorted(options, key=lambda t: (t == msg_last[0], msg_used.get(t, 0), options.index(t)))
            picked = ranked[:count]
        if not picked:
            decor_run(t0, t1)
            return
        dur = min(float(msg_cfg["duracionSec"]), total - 0.6)
        cur = t0
        for k, text in enumerate(picked):
            centre = t0 + (k + 0.5) * total / len(picked)
            start = min(max(centre - dur / 2, cur), t1 - dur)
            if start - cur < gap_min:
                start = cur
            decor_run(cur, start)
            message_scene(text, start, start + dur)
            msg_used[text] = msg_used.get(text, 0) + 1
            msg_last[0] = text
            cur = start + dur
        decor_run(cur, t1)

    cursor = intro_len
    last: dict[str, Any] | None = scenes[-1] if scenes else None
    last_extendable = False
    block_left = 0.0
    used = 0
    for index, phrase in enumerate(phrases):
        natural = phrase[0]["t"] - lead
        if last is not None and last_extendable and natural < last["t1"]:
            cut = max(float(last["t0"]) + scene_min / 2, natural)  # prioridad: la palabra en su tiempo
            last["t1"] = round(cut, 3)
            cursor = cut
        start = max(natural, cursor)
        if start >= outro_start - 0.05:
            break
        if last is not None and start - last["t1"] >= gap_min:
            fill_gap(last["t1"], start, "inicio" if used == 0 else "medio")
        elif last is not None and last_extendable:
            last["t1"] = round(start, 3)
        elif last is None and start - cursor >= gap_min:
            fill_gap(cursor, start, "inicio")
        else:
            start = cursor if last is None else max(start, last["t1"])
        nxt = phrases[index + 1][0]["t"] - lead if index + 1 < len(phrases) else outro_start
        end = min(phrase[-1]["end"] + hold, outro_start)
        if nxt < end:
            end = nxt
        end = min(max(end, start + scene_min), outro_start)
        if end - start < 0.05:
            break
        if not spoken:
            break
        recipe = _pick(spoken, len(phrase), end - start, recent, world, block_left, rules, rng)
        if block_left <= 0 or recipe.get("mundo") not in (world, None):
            lo, hi = rules["recetas"]["mundoBloqueSec"]
            block_left = rng.uniform(float(lo), float(hi))
            world = recipe.get("mundo") if recipe.get("mundo") is not None else world
        block_left -= end - start
        recent = (recent + [recipe["id"]])[-int(rules["recetas"]["enfriamiento"]):]
        scene = instantiate(recipe, phrase, start, end, schema, rules, next_name())
        scenes.append(scene)
        last, last_extendable, cursor = scene, True, end
        prev_text[0] = " ".join(w["text"] for w in phrase)
        used += 1
    tail_from = last["t1"] if last is not None else cursor
    if outro_start - tail_from >= gap_min:
        fill_gap(tail_from, outro_start, "final" if used else "inicio")
    elif last is not None and last_extendable:
        last["t1"] = round(outro_start, 3)
    if outro:
        scene = copy.deepcopy(outro["escena"])
        scene["t0"], scene["t1"] = round(outro_start, 3), None if schema == "els" else round(duration, 3)
        if schema == "pieces":
            scene["name"] = next_name()
        scenes.append(scene)
    for scene in scenes:
        if scene.get("t1") is None:
            scene.pop("t1", None)
    return scenes, {"escenas": len(scenes), "frases": len(phrases), "frasesUsadas": used, "recetas": len(spoken), "decorativas": len(decor)}


# --------------------------------------------------------------------------- integración con el servidor

def _transcription(job: Any) -> dict[str, Any]:
    data = job.artifacts.lyrics_json
    if isinstance(data, dict) and isinstance(data.get("segments"), list):
        return data
    asset_id = job.artifacts.music_asset_id
    if asset_id:
        from src.core.library import asset_library
        cached = asset_library.get_lyrics_cache(asset_id)
        if isinstance(cached, dict):
            return cached
    return {}


def _duration(transcription: dict[str, Any], job: Any) -> float:
    asset_duration = None
    asset_id = job.artifacts.music_asset_id
    if asset_id:
        try:
            from src.core.library import asset_library
            asset_duration = _num(getattr(asset_library.get_music_entry(asset_id), "duration_seconds", None))
        except Exception:  # la transcripción puede dar una duración segura
            asset_duration = None
    meta = transcription.get("metadata") if isinstance(transcription.get("metadata"), dict) else {}
    transcript = next((v for v in (_num(meta.get(k)) for k in ("audio_duration_sec", "duration_seconds", "duration")) if v and v > 0), None)
    if transcript and (not asset_duration or asset_duration <= 0 or abs(transcript - asset_duration) <= 5):
        return transcript
    if asset_duration and asset_duration > 0:
        return asset_duration
    if transcript:
        return transcript
    value = _num(getattr(job.input, "duration_seconds", None))
    return value if value and value > 0 else 0.0


def _fallback(case: dict[str, Any], rules: dict[str, Any]) -> None:
    """Sin recetas: se quita el guion y el motor muestra solo la transcripción con su mazo."""
    case.pop("timeline", None)
    for key, value in ((rules.get("respaldo") or {}).get("config") or {}).items():
        case[key] = copy.deepcopy(value)


def adapt_config(case: dict[str, Any], rules: dict[str, Any], content: dict[str, Any], transcription: dict[str, Any],
                 duration: float, declared_language: str | None = None, song: dict[str, Any] | None = None) -> dict[str, Any]:
    """Aplica la adaptación a `case` (se modifica) y devuelve el reporte."""
    segments_raw = transcription.get("segments") if isinstance(transcription.get("segments"), list) else []
    kept, dropped = filter_segments(segments_raw, case.get("lyricsFilter"), rules["umbrales"]["logprobMin"])
    if not duration:
        duration = max((float(s.get("end") or s["start"]) for s in kept), default=0.0) + 3.0
    meta = transcription.get("metadata") if isinstance(transcription.get("metadata"), dict) else {}
    language = declared_language or meta.get("language")
    report = analyze_song(kept, dropped, duration, language, _num(meta.get("language_probability")),
                          bool(declared_language), rules["umbrales"])
    for key, value in (rules.get("config") or {}).items():
        case[key] = copy.deepcopy(value)
    fix_intro(case, rules, song or {})
    if not content.get("recetas"):
        _fallback(case, rules)
        report["modo"] = "solo_transcripcion"
        report["avisos"].append("La plantilla no tiene recetas (contenido-static.json): se muestra solo la transcripción con el mazo de respaldo.")
        return report
    ph = rules["frases"]
    phrases = build_phrases(kept, int(ph["maxWords"]), float(ph["maxSec"]), int(ph["minWords"]))
    phrases = merge_short_phrases(phrases, float(rules["tiempos"]["leadSec"]), float(rules["tiempos"]["escenaMinSec"]),
                                  int(ph.get("fusionMaxWords") or 2 * int(ph["maxWords"])))
    seed = int(_num(case.get("seed")) or 7) * 977 + len(phrases)
    timeline, stats = build_timeline(case, content, rules, phrases, duration, seed, song)
    case["timeline"] = timeline
    report.update({"modo": "recetas", "duracion": round(duration, 2), **stats})
    return report


def apply_song_lyrics(template_id: str, config: dict[str, Any], job: Any) -> dict[str, Any] | None:
    """Punto de entrada de `html_generator`. None = plantilla sin adaptación (no se toca)."""
    from src.config.template_manifest import get_template_root
    root = get_template_root(template_id)
    if root is None:
        return None
    rules = load_rules(root)
    if rules is None:
        return None
    if getattr(job.input, "timed_content", None) is not None:
        return None  # la demo conserva su guion original
    song = getattr(job.input, "song_info", None)
    declared = getattr(song, "language", None) if song else None
    try:
        transcription = _transcription(job)
        duration = _duration(transcription, job)
        meta = {}
        try:
            from src.core.draft_details import song_of
            title, artist = song_of(job)
            meta = {"titulo": (title or "").strip(), "artista": (artist or "").strip()}
        except Exception:
            meta = {}
        return adapt_config(config, rules, load_content(root), transcription, duration, declared or None, meta)
    except Exception as exc:  # nunca dejar el guion de la referencia puesto a una canción ajena
        _fallback(config, rules)
        return {"estado": "error", "modo": "solo_transcripcion", "avisos": [f"Adaptación fallida ({type(exc).__name__}: {exc}); se muestra solo la transcripción."]}


# --------------------------------------------------------------------------- CLI

def main(argv: list[str]) -> int:
    if len(argv) < 3 or argv[1] != "extraer":
        print("uso: song_adapter.py extraer <carpeta-de-la-plantilla>")
        return 2
    root = Path(argv[2])
    rules = load_rules(root)
    if rules is None:
        print(f"falta {RULES_FILE} en {root}")
        return 1
    raw = load_json(root / "assets" / "config.json")
    case = (raw.get("configs") or [raw])[0] if isinstance(raw, dict) else None
    timeline = (case or {}).get("timeline")
    if not isinstance(timeline, list) or not timeline:
        print("el config de la demo no tiene timeline")
        return 1
    content = extract_recipes(timeline, rules["esquema"])
    (root / RECIPES_FILE).write_text(json.dumps(content, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{RECIPES_FILE}: {len(content['recetas'])} recetas ({sum(1 for r in content['recetas'] if r['ranuras'])} con letra), {content['descartadas']} descartadas")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
