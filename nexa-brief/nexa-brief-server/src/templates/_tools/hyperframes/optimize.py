#!/usr/bin/env python3
"""Optimizador HyperFrames de las plantillas HTML (src/templates/<categoría>/<id>/index.html).

Uso:
  python optimize.py [plantillas...]            aplica (idempotente)
  python optimize.py --check [plantillas...]    valida sin escribir (exit 1 si falta algo)
  python optimize.py --revert [plantillas...]   quita el reloj HyperFrames (vuelve al HTML original)

`plantillas` acepta template_ids de templates.json (lyrics-neon), carpetas o
rutas a un index.html. Sin argumentos procesa TODAS las plantillas registradas
en templates.json (las carpetas sin registrar se dejan en paz: suelen estar en
construcción por su propio generador).

Qué hace, por qué, y qué NO toca:

1. Quita el bloque "Recording UI" (#rec-btn / #rec-panel: CSS + HTML + JS) de
   todas las plantillas — la grabación se centralizó en la app. Se conserva
   todo lo demás de la regla `body.headless …` (p. ej. `#hint`) y el manejo
   propio de `?headless=1` que algunas plantillas tienen aparte. Este paso es
   una limpieza definitiva (no lo deshace --revert).

2. Solo en las categorías de HF_CATEGORIES (letras): deja la plantilla lista
   para grabarse cuadro a cuadro con HyperFrames SIN cambiar nada visual:
   - inserta inline, como primer <script> (después del <meta charset>: el
     navegador detecta la codificación en los primeros 1024 bytes y un script
     de 30 KB antes rompería los acentos), el reloj determinístico
     runtime/nb-hf-clock.js, marcado con data-nb-hf-clock="<hash>";
   - reescribe setTimeout/setInterval/clearTimeout/clearInterval de la
     plantilla a __nbSetTimeout & cía. El shim de tiempo virtual de HyperFrames
     no los virtualiza (siguen en reloj de pared, que en un render es ~10×
     más lento que el video) y no se pueden reemplazar globalmente porque el
     runtime de HyperFrames los usa para sus propias esperas. Fuera del render
     __nbSetTimeout ES el setTimeout nativo, resuelto en cada llamada.
   Todo esto es reversible (--revert) e idempotente: correrlo dos veces no
   cambia nada, y si runtime/nb-hf-clock.js cambia, se reemplaza el bloque.

El render en sí (qué hace el reloj durante la captura) está documentado en
runtime/nb-hf-clock.js y en docs/investigaciones/hyperframes-optimizacion-2026-10.md.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATES_DIR = HERE.parents[1]  # src/templates
RUNTIME_JS = HERE / "runtime" / "nb-hf-clock.js"

# Categorías de templates.json cuyas plantillas llevan el reloj HyperFrames.
# Las de image/video siguen usando el path genérico tal cual (no tienen letra
# sincronizada; ver supports_niche() en hyperframes_adapter.py).
# Categorías que llevan el reloj HyperFrames. commercial/ se sumó el 2026-10-04:
# sus promos animan con el mismo motor de escenas que las de letras (rAF +
# audio.currentTime) y sin reloj su <audio> queda sin fuente para el mezclador.
HF_CATEGORIES = frozenset({"lyrics", "commercial"})


def template_kind(rel: str) -> str:
    """Tipo de plantilla por su carpeta: 'nodemotion/lyrics/x/index.html' → 'lyrics'."""
    parts = rel.split("/")
    return parts[1] if parts[0] == "nodemotion" and len(parts) > 1 else parts[0]

# category_id de templates.json que la corrida SIN argumentos saltea: plantillas
# "En desarrollo" que su autor sigue puliendo. Nombrándolas explícitamente sí
# se procesan.
SKIP_BY_DEFAULT_CATEGORIES = frozenset({"in_progress"})

_CLOCK_BLOCK_RE = re.compile(r'<script data-nb-hf-clock="[^"]*">.*?</script>\n?', re.DOTALL)
_META_CHARSET_RE = re.compile(r"<meta\s+charset\s*=\s*[\"']?[\w-]+[\"']?\s*/?>[ \t]*\n?", re.IGNORECASE)
_HEAD_OPEN_RE = re.compile(r"<head\b[^>]*>[ \t]*\n?", re.IGNORECASE)
_INLINE_SCRIPT_RE = re.compile(r"(<script\b(?![^>]*\bsrc\s*=)[^>]*>)(.*?)(</script>)", re.DOTALL | re.IGNORECASE)

_TIMER_NAMES = ("setTimeout", "setInterval", "clearTimeout", "clearInterval")
# Llamada directa (setTimeout(…)) o vía window/globalThis/self — nunca un
# método de otro objeto (obj.setTimeout) ni un identificador más largo.
_TIMER_CALL_RE = re.compile(
    r"(?:(?<![\w$.])|(?<=\bwindow\.)|(?<=\bglobalThis\.)|(?<=\bself\.))(" + "|".join(_TIMER_NAMES) + r")(?=\s*\()"
)
_NB_TIMER_RE = re.compile(r"__nb(Set|Clear)(Timeout|Interval)\b")
_RAW_TIMER_LEFT_RE = _TIMER_CALL_RE

# ── Recording UI ────────────────────────────────────────────────────────────
_REC_CSS_START = "/* ── Recording UI"
_REC_HTML_START = "<!-- ── Recording panel"
_REC_HEADLESS_RULE_RE = re.compile(r"^[ \t]*body\.headless #rec-btn,[^{]*\{[^}]*\}[ \t]*\n", re.MULTILINE)
_REC_SELECTOR_RE = re.compile(r"body\.headless\s+(#rec-btn|#rec-panel)")


class OptimizeError(Exception):
    """La plantilla no tiene la forma esperada — no se toca (mejor fallar que romperla)."""


def _clock_source() -> str:
    js = RUNTIME_JS.read_text(encoding="utf-8")
    if "</script" in js.lower():
        raise OptimizeError(f"{RUNTIME_JS} no puede contener '</script' (se inserta inline)")
    return js


def clock_version(js: str | None = None) -> str:
    js = _clock_source() if js is None else js
    return hashlib.sha256(js.encode("utf-8")).hexdigest()[:12]


def clock_block(js: str | None = None) -> str:
    js = _clock_source() if js is None else js
    return (
        f'<script data-nb-hf-clock="{clock_version(js)}">\n'
        "/* Generado por src/templates/_tools/hyperframes/optimize.py — NO editar acá:\n"
        "   la fuente es _tools/hyperframes/runtime/nb-hf-clock.js (regenerar con optimize.py). */\n"
        f"{js.rstrip()}\n</script>\n"
    )


def _skip_ws(html: str, i: int) -> int:
    while i < len(html) and html[i] in " \t":
        i += 1
    return i + 1 if i < len(html) and html[i] == "\n" else i


def _line_start(html: str, i: int) -> int:
    j = html.rfind("\n", 0, i) + 1
    return j if html[j:i].strip() == "" else i


def _join(left: str, right: str) -> str:
    """Une los dos lados de un bloque quitado dejando a lo sumo una línea en blanco."""
    if left.endswith("\n\n") or not left.endswith("\n"):
        right = right.lstrip("\n") if left.endswith("\n\n") else right
    elif right.startswith("\n\n"):
        right = right[1:]
    return left + right


def _remove_rec_css(html: str) -> str:
    start = html.find(_REC_CSS_START)
    style_end = html.find("</style>", start)
    if start < 0 or style_end < 0:
        raise OptimizeError("no se encontró el CSS de Recording UI dentro de <style>")
    m = _REC_HEADLESS_RULE_RE.search(html, start, style_end)
    if not m:
        raise OptimizeError("no se encontró la regla body.headless #rec-btn que cierra el CSS de Recording UI")
    block = html[start : m.start()]
    # Todo lo que hay en el bloque tiene que ser del panel de grabación; si
    # aparece otra regla, la plantilla cambió y no se adivina dónde termina.
    rest = html[: start] + html[m.end() :]
    for sel in re.findall(r"(?m)^\s*([^{}\n/][^{}\n]*)\{", block):
        sel = sel.strip()
        kf = re.match(r"@keyframes\s+([\w-]+)", sel)
        if kf:
            # un @keyframes del panel (rec-pulse, o "pulse" en las más viejas)
            # solo se va si nada fuera del bloque lo usa
            if re.search(rf"\b{re.escape(kf.group(1))}\b", rest):
                raise OptimizeError(f"@keyframes {kf.group(1)} del Recording UI se usa en otra parte")
            continue
        if not re.search(r"rec-|badge-|^\d+%|^from|^to", sel):
            raise OptimizeError(f"regla ajena dentro del CSS de Recording UI: {sel!r}")
    # De la regla body.headless … se conservan los selectores que no son del panel.
    rule = m.group(0)
    selectors = rule[: rule.index("{")].split(",")
    body_decl = rule[rule.index("{") :].rstrip()
    keep = [s.strip() for s in selectors if not _REC_SELECTOR_RE.search(s)]
    indent = re.match(r"[ \t]*", rule).group(0)
    tail = f"{indent}{', '.join(keep)} {body_decl}\n" if keep else ""
    return _join(html[: _line_start(html, start)] + tail, html[m.end() :])


def _find_div_end(html: str, open_at: int) -> int:
    """Índice justo después del </div> que cierra el <div> que empieza en open_at."""
    depth = 0
    for m in re.finditer(r"<div\b|</div\s*>", html[open_at:]):
        depth += 1 if m.group(0).startswith("<div") else -1
        if depth == 0:
            return open_at + m.end()
    raise OptimizeError("<div id=\"rec-panel\"> sin cerrar")


def _remove_rec_html(html: str) -> str:
    start = html.find(_REC_HTML_START)
    if start < 0:
        raise OptimizeError("no se encontró el HTML del Recording panel")
    panel = html.find('<div id="rec-panel"', start)
    if panel < 0:
        raise OptimizeError('no se encontró <div id="rec-panel">')
    between = html[start:panel]
    if "<script" in between or between.count("<button") != 1 or 'id="rec-btn"' not in between:
        raise OptimizeError("forma inesperada entre el comentario del Recording panel y #rec-panel")
    end = _skip_ws(html, _find_div_end(html, panel))
    # línea separadora que cierra el bloque: <!-- ────── -->
    sep = re.match(r"[ \t]*<!--[\s─-]*-->[ \t]*\n?", html[end:])
    if sep:
        end += sep.end()
    return _join(html[: _line_start(html, start)], html[end:])


def _remove_rec_js(html: str) -> str:
    fn = html.find("(function initRecUI()")
    if fn < 0:
        raise OptimizeError("no se encontró initRecUI()")
    start = html.rfind("/* ── Recording UI", 0, fn)
    if start < 0 or html[start:fn].count("*/") != 1 or html[html.find("*/", start) + 2 : fn].strip():
        start = fn  # sin comentario de cabecera inmediatamente antes
    end = html.find("</script>", fn)
    if end < 0:
        raise OptimizeError("initRecUI() fuera de un <script>")
    # el bloque suele cerrar con una línea separadora /* ───── */ (también se va)
    body = re.sub(r"(\s*/\*[\s─-]*\*/)+\s*$", "", html[fn:end]).rstrip()
    if not body.endswith("})();") or body.count("initRecUI") != 1:
        raise OptimizeError("initRecUI() no es lo último del <script> — no se adivina dónde termina")
    # lo que queda del <script> cierra con un solo salto antes de </script>
    return html[: _line_start(html, start)].rstrip() + "\n" + html[end:]


def strip_recording_ui(html: str) -> str:
    """Quita el panel de grabación (CSS + HTML + JS). No-op si ya no está."""
    has = ["rec-btn" in html, "initRecUI" in html, _REC_HTML_START in html]
    if not any(has):
        return html
    if not all(has):
        raise OptimizeError("Recording UI a medias (CSS/HTML/JS no coinciden)")
    html = _remove_rec_js(html)
    html = _remove_rec_html(html)
    html = _remove_rec_css(html)
    if re.search(r"rec-btn|rec-panel|initRecUI", html):
        raise OptimizeError("quedaron restos del Recording UI")
    return html


def _rewrite_scripts(html: str, fn) -> str:
    def repl(m: re.Match) -> str:
        if "data-nb-hf-clock" in m.group(1):
            return m.group(0)
        return m.group(1) + fn(m.group(2)) + m.group(3)

    return _INLINE_SCRIPT_RE.sub(repl, html)


def _to_nb_timers(js: str) -> str:
    return _TIMER_CALL_RE.sub(lambda m: "__nb" + m.group(1)[0].upper() + m.group(1)[1:], js)


def _from_nb_timers(js: str) -> str:
    return _NB_TIMER_RE.sub(lambda m: m.group(1).lower() + m.group(2), js)


def apply_clock(html: str, js: str | None = None) -> str:
    """Inserta/actualiza el reloj HyperFrames y reescribe los timers. Idempotente."""
    block = clock_block(js)
    html = _CLOCK_BLOCK_RE.sub("", html)
    anchor = _META_CHARSET_RE.search(html) or _HEAD_OPEN_RE.search(html)
    if not anchor:
        raise OptimizeError("sin <head> ni <meta charset> donde insertar el reloj")
    html = html[: anchor.end()] + block + html[anchor.end() :]
    return _rewrite_scripts(html, _to_nb_timers)


def revert_clock(html: str) -> str:
    """Deshace apply_clock: el HTML vuelve a ser el de antes de optimizar."""
    html = _CLOCK_BLOCK_RE.sub("", html)
    return _rewrite_scripts(html, _from_nb_timers)


def problems(html: str, *, hf: bool, js: str | None = None) -> list[str]:
    """Qué le falta a una plantilla para estar optimizada (vacío = lista)."""
    out: list[str] = []
    if re.search(r"rec-btn|rec-panel|initRecUI", html):
        out.append("todavía tiene el Recording UI")
    if not hf:
        return out
    m = re.search(r'<script data-nb-hf-clock="([^"]*)">', html)
    if not m:
        out.append("falta el reloj nb-hf-clock")
    elif m.group(1) != clock_version(js):
        out.append(f"reloj nb-hf-clock desactualizado ({m.group(1)} ≠ {clock_version(js)})")
    elif not html[html.lower().find("<script") :].startswith("<script data-nb-hf-clock"):
        # tiene que correr antes que cualquier script de la plantilla
        out.append("el reloj nb-hf-clock no es el primer <script>")
    raw: list[str] = []
    _rewrite_scripts(html, lambda s: raw.extend(_RAW_TIMER_LEFT_RE.findall(s)) or s)
    if raw:
        out.append(f"timers sin reescribir: {sorted(set(raw))}")
    return out


# ── CLI ─────────────────────────────────────────────────────────────────────


@dataclass
class Target:
    path: Path
    template_id: str | None = None
    category: str | None = None
    hf: bool = False
    notes: list[str] = field(default_factory=list)


def _catalog() -> dict[str, dict]:
    data = json.loads((TEMPLATES_DIR / "templates.json").read_text(encoding="utf-8"))
    return data.get("templates", {})


def resolve_targets(args: list[str]) -> list[Target]:
    catalog = _catalog()
    # El tipo de plantilla sale de su carpeta (lyrics/<id>/…), no de category_id:
    # category_id es solo la agrupación que se ve en la app (p. ej. "in_progress").
    by_path = {
        (TEMPLATES_DIR / e["index_html"]).resolve(): (tid, template_kind(e["index_html"]))
        for tid, e in catalog.items()
        if e.get("index_html")
    }
    paths: list[Path] = []
    if not args:
        skipped = {
            (TEMPLATES_DIR / e["index_html"]).resolve()
            for e in catalog.values()
            if e.get("index_html") and e.get("category_id") in SKIP_BY_DEFAULT_CATEGORIES
        }
        paths = sorted(p for p in by_path if p.exists() and p not in skipped)
    for a in args:
        if a in catalog:
            paths.append((TEMPLATES_DIR / catalog[a]["index_html"]).resolve())
            continue
        p = Path(a).resolve()
        paths.append(p / "index.html" if p.is_dir() else p)
    targets = []
    for p in paths:
        tid, cat = by_path.get(p, (None, None))
        if cat is None:  # sin registrar: la categoría sale de la carpeta (nodemotion/lyrics/<id>/index.html)
            try:
                cat = template_kind(p.relative_to(TEMPLATES_DIR).as_posix())
            except ValueError:
                cat = None
        targets.append(Target(path=p, template_id=tid or p.parent.name, category=cat, hf=cat in HF_CATEGORIES))
    return targets


def optimize_html(html: str, *, hf: bool, js: str | None = None) -> str:
    html = strip_recording_ui(html)
    return apply_clock(html, js) if hf else html


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("templates", nargs="*", help="template_ids, carpetas o index.html (def.: todas las registradas)")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="solo valida; exit 1 si alguna no está optimizada")
    mode.add_argument("--revert", action="store_true", help="quita el reloj HyperFrames (el Recording UI no vuelve)")
    a = ap.parse_args(argv)

    js = _clock_source()
    failed = 0
    for t in resolve_targets(a.templates):
        name = f"{t.category or '?'}/{t.template_id}"
        if not t.path.exists():
            print(f"✗ {name}: no existe {t.path}")
            failed += 1
            continue
        html = t.path.read_text(encoding="utf-8")
        try:
            if a.check:
                issues = problems(html, hf=t.hf, js=js)
                print(f"{'✓' if not issues else '✗'} {name}" + (f": {'; '.join(issues)}" if issues else ""))
                failed += bool(issues)
                continue
            new = revert_clock(html) if a.revert else optimize_html(html, hf=t.hf, js=js)
        except OptimizeError as exc:
            print(f"✗ {name}: {exc}")
            failed += 1
            continue
        if new != html:
            t.path.write_text(new, encoding="utf-8")
            print(f"• {name}: {'revertida' if a.revert else 'optimizada'}{' (reloj HF)' if t.hf and not a.revert else ''}")
        else:
            print(f"= {name}: sin cambios")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
