"""Optimizador HyperFrames de plantillas (src/templates/_tools/hyperframes/optimize.py)
y el path genérico de HyperframesAdapter que lo consume."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

from src.adapters.recorder.infrastructure import hyperframes_adapter as ha
from src.config.niche_config import find_niche_by_template_id
from src.config.settings import settings

_TOOL = Path(settings.templates_dir) / "_tools" / "hyperframes" / "optimize.py"
_spec = importlib.util.spec_from_file_location("nb_hf_optimize", _TOOL)
assert _spec and _spec.loader
opt = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = opt  # dataclasses lo necesita registrado
_spec.loader.exec_module(opt)

# Plantilla mínima con la misma forma que las reales (bloques copiados de lyrics-caution).
TEMPLATE = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>x</title>
<style>
  body { background: #000; }

  /* ── Recording UI ─────────────────────────────────────────── */
  #rec-btn { position: fixed; }
  #rec-btn.recording { animation: rec-pulse 1.2s ease-in-out infinite; }
  @keyframes rec-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
  #rec-panel { display: none; }
  .rec-engine { display: flex; }
  .badge-fast { color: #3cc878; }
  #rec-status { font-size: 10px; }
  body.headless #rec-btn, body.headless #rec-panel, body.headless #hint { display: none !important; }
</style>
</head>
<body>
<div id="hint"></div>
<audio id="audio" preload="auto"></audio>
<!-- ── Recording panel ─────────────────────────────── -->
<button id="rec-btn" title="Motor de grabación (R)"><svg></svg></button>
<div id="rec-panel">
  <div class="rec-engine" data-engine="hyperframes"><div class="rec-engine-icon">x</div></div>
  <button id="rec-go" disabled>● Grabar</button>
  <p id="rec-status"></p>
</div>
<!-- ──────────────────────────────── -->

<script type="module">
const t = setTimeout(() => go(), 100);
clearTimeout(t);
window.setInterval(tick, 50);
obj.setTimeout(1);
mySetTimeout(2);
requestAnimationFrame(frame);

/* ── Recording UI ──────────────────────────────── */
(function initRecUI() {
  const btn = document.getElementById('rec-btn');
  setTimeout(() => btn.blur(), 8000);
})();
/* ─────────────────────────────────────── */
</script>
</body>
</html>
"""

JS = "/* reloj de prueba */\nwindow.__nbSetTimeout = window.__nbSetTimeout || setTimeout;\n"


def test_strip_recording_ui_removes_css_html_js_and_keeps_the_rest() -> None:
    out = opt.strip_recording_ui(TEMPLATE)
    for marker in ("rec-btn", "rec-panel", "initRecUI", "rec-pulse", "Recording", "badge-fast"):
        assert marker not in out
    # lo que no es del panel se queda: el resto de la regla body.headless y el código
    assert "body.headless #hint { display: none !important; }" in out
    assert '<div id="hint"></div>' in out
    assert "requestAnimationFrame(frame);" in out
    assert "\n\n\n" not in out
    assert opt.strip_recording_ui(out) == out  # idempotente


def test_strip_refuses_unknown_rules_inside_the_block() -> None:
    broken = TEMPLATE.replace("  #rec-status { font-size: 10px; }", "  .scene { opacity: 1; }")
    with pytest.raises(opt.OptimizeError):
        opt.strip_recording_ui(broken)


def test_apply_clock_is_first_script_rewrites_timers_and_is_reversible() -> None:
    stripped = opt.strip_recording_ui(TEMPLATE)
    out = opt.apply_clock(stripped, JS)
    # primer <script> del documento, después del <meta charset> (codificación)
    assert out.index("<meta charset") < out.index("<script data-nb-hf-clock=")
    assert out.lower().index("<script") == out.index("<script data-nb-hf-clock=")
    assert "__nbSetTimeout(() => go(), 100)" in out
    assert "__nbClearTimeout(t)" in out
    assert "window.__nbSetInterval(tick, 50)" in out
    assert "obj.setTimeout(1)" in out and "mySetTimeout(2)" in out
    assert "requestAnimationFrame(frame)" in out  # rAF lo virtualiza HyperFrames
    assert opt.apply_clock(out, JS) == out
    assert opt.revert_clock(out) == stripped
    assert opt.problems(out, hf=True, js=JS) == []


def test_problems_reports_missing_and_stale_clock() -> None:
    stripped = opt.strip_recording_ui(TEMPLATE)
    assert "falta el reloj nb-hf-clock" in opt.problems(stripped, hf=True, js=JS)
    stale = opt.apply_clock(stripped, JS + "// v2\n")
    assert any("desactualizado" in p for p in opt.problems(stale, hf=True, js=JS))
    assert opt.problems(TEMPLATE, hf=False, js=JS) == ["todavía tiene el Recording UI"]


@pytest.mark.parametrize("template_id", sorted(ha.HF_VALIDATED_LYRICS_TEMPLATE_IDS))
def test_validated_templates_are_optimized_on_disk(template_id: str) -> None:
    """Toda plantilla habilitada en HyperFrames lleva el reloj vigente (si
    runtime/nb-hf-clock.js cambió, hay que correr optimize.py y revalidar)."""
    (target,) = opt.resolve_targets([template_id])
    assert target.hf
    assert opt.problems(target.path.read_text(encoding="utf-8"), hf=True) == []


def test_no_registered_template_keeps_the_recording_panel() -> None:
    catalog = json.loads((Path(settings.templates_dir) / "templates.json").read_text(encoding="utf-8"))["templates"]
    for target in opt.resolve_targets([]):
        if target.template_id not in catalog or not target.path.exists():
            continue
        html = target.path.read_text(encoding="utf-8")
        if "nb-hf-clock" not in html and target.hf:
            continue  # plantilla nueva todavía sin pasar por optimize.py
        assert "rec-btn" not in html and "initRecUI" not in html, target.template_id


def test_render_passes_one_per_format_with_mobile_supersampling() -> None:
    niche = find_niche_by_template_id("lyrics-neon")
    passes = ha._render_passes(niche)
    assert [(p.width, p.height, p.scale) for p in passes] == [(1920, 1080, 1), (1080, 1920, 2)]
    assert passes[0].resolution_flag is None
    assert (passes[1].css_width, passes[1].css_height, passes[1].resolution_flag) == (540, 960, "portrait")
    assert [p.scale for p in ha._render_passes(niche, supersample=False)] == [1, 1]


def test_prepare_generic_html_marks_root_and_adds_mix_track_only_with_clock() -> None:
    rp = ha._RenderPass(1080, 1920, 2, ("reels_video.mp4",))
    plain = ha._prepare_generic_html('<html><body class="x"><audio id="audio" src="song.mp3"></audio></body></html>', rp, 12, "s.mp3")
    assert 'data-composition-id="root"' in plain and 'data-width="540" data-height="960"' in plain
    assert 'data-duration="12"' in plain and "data-no-timeline" in plain
    assert 'src="s.mp3"' in plain and "nb-hf-mix" not in plain
    clocked = ha._prepare_generic_html('<html><head><script data-nb-hf-clock="x"></script></head><body></body></html>', rp, 12, "s.mp3")
    assert '<audio id="nb-hf-mix" data-nb-hf-mix src="s.mp3" data-start="0" data-duration="12"' in clocked


def test_supports_niche_only_whitelisted_lyrics_templates(monkeypatch: pytest.MonkeyPatch) -> None:
    niche = find_niche_by_template_id("lyrics-neon")
    monkeypatch.setattr(ha, "HF_VALIDATED_LYRICS_TEMPLATE_IDS", frozenset())
    assert ha.supports_niche(niche) is False
    monkeypatch.setattr(ha, "HF_VALIDATED_LYRICS_TEMPLATE_IDS", frozenset({"lyrics-neon"}))
    assert ha.supports_niche(niche) is True
