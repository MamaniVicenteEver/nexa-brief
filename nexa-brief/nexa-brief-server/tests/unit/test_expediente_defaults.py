"""Defaults de miniatura para el diseño lyrics-expediente (Hilo Rojo).

La opción B sale con un cuadro del tablero del propio diseño; A sigue como texto sobre fondo sólido.
Los borradores con el fotograma automático antiguo pasan al default; los que el usuario eligió a mano no cambian.
"""
from src.core.draft_thumbnails import _build_designs, _safe_design

TEMPLATE = "lyrics-expediente"


def test_expediente_option_b_defaults_to_design_frame():
    designs = _build_designs(TEMPLATE, {})
    assert designs["B"]["background"]["kind"] == "design"
    assert designs["B"]["background"]["at"] == 0.5
    assert designs["A"]["background"]["kind"] == "design"


def test_old_automatic_frame_migrates_to_design_default():
    default_b = _build_designs(TEMPLATE, {})["B"]
    old = {"styleVersion": 5, "background": {"kind": "frame", "time": 12}}
    assert _safe_design(old, default_b, TEMPLATE)["background"]["kind"] == "design"


def test_manual_frame_choice_is_kept():
    default_b = _build_designs(TEMPLATE, {})["B"]
    manual = {"styleVersion": 5, "background": {"kind": "frame", "time": 30}}
    background = _safe_design(manual, default_b, TEMPLATE)["background"]
    assert background["kind"] == "frame"
    assert background["time"] == 30


def test_missing_saved_design_uses_design_default():
    default_b = _build_designs(TEMPLATE, {})["B"]
    assert _safe_design(None, default_b, TEMPLATE)["background"]["kind"] == "design"


def test_designs_without_capture_hooks_keep_text_thumbnails():
    for template in ("lyrics-neon", "lyrics-manifiesto"):
        designs = _build_designs(template, {})
        assert designs["A"]["background"]["kind"] == "frame"
        assert designs["B"]["background"]["kind"] == "frame"


def test_design_background_reverts_when_design_has_no_components():
    default_b = _build_designs("lyrics-manifiesto", {})["B"]
    saved = {"styleVersion": 5, "background": {"kind": "design", "at": .5, "bare": True, "inside": False}}
    assert _safe_design(saved, default_b, "lyrics-manifiesto")["background"]["kind"] == "frame"


def test_promo_designs_keep_their_frame_default():
    assert _build_designs("promo-editorial", {})["B"]["background"]["kind"] == "frame"
