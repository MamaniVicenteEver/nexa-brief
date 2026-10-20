"""Duración de los videos (explainer-kit/lengths.json), textos sin emojis y prompt del agente."""

from __future__ import annotations

import importlib.util
from pathlib import Path

from src.core.explainer import lengths
from src.core.explainer.briefs import ExplainerBrief
from src.core.explainer.designs import KIT_DIR
from src.core.explainer.producer import build_agent_prompt


def _kit_lengths():
    """tools/lengths.py del kit: lo usan kit.py, check y la voz (mismo archivo de datos)."""
    spec = importlib.util.spec_from_file_location("kit_lengths", KIT_DIR / "tools" / "lengths.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_presets_come_from_the_kit_table():
    assert [p.minutes for p in lengths.presets()] == [5, 10, 15, 30]
    assert (lengths.min_minutes(), lengths.default_minutes(), lengths.max_minutes()) == (5, 10, 60)


def test_minutes_are_clamped_and_long_videos_get_more_time():
    assert lengths.clamp_minutes(2) == 5
    assert lengths.clamp_minutes(None) == 10
    assert lengths.clamp_minutes(500) == 60
    assert lengths.agent_timeout_seconds(30) > lengths.agent_timeout_seconds(10) > lengths.agent_timeout_seconds(5)
    assert lengths.chapters_range(10) == (4, 8)


def test_kit_and_backend_read_the_same_table():
    kit = _kit_lengths()
    assert kit.agent_timeout_seconds(10) == lengths.agent_timeout_seconds(10)
    ten = kit.targets(10, (115, 130))
    assert ten["words"] == [1092, 1404] and ten["chapters"] == [4, 8] and ten["domain_components"] == 2
    assert kit.targets(30, (115, 130))["domain_components"] == 4
    legacy = kit.targets(None)
    assert legacy["legacy"] and legacy["words"] == [420, 560] and legacy["lyrics"] == [4, 6]


def test_voice_is_split_by_length():
    kit = _kit_lengths()
    assert kit.voice_parts(500) == 1      # formato corto: un solo pedido, como siempre
    assert kit.voice_parts(1300) == 2     # 10 min
    assert kit.voice_parts(3900) == 6     # 30 min


BRIEF = {
    "video_id": "ajedrez",
    "working_title": "EL REY 👑",
    "hook": "Una pieza cayó 🔥 Nadie lo esperaba.",
    "angle": "La partida 6",
    "thesis": "Una máquina aprendió a sacrificar.",
    "youtube": {
        "title": "La jugada que nadie esperaba 😱",
        "title_alternatives": ["El rey sin refugio 👑"],
        "description": "Primera línea 🔥\n\nSegunda línea 👇 Más abajo.",
        "tags": ["ajedrez"],
    },
    "facebook": {"title": "La jugada ♟️", "description": "¿Tú qué harías? 🤔"},
    "tiktok": {"caption": "La partida que cambió todo 🚀 ¿La conocías?", "hashtags": ["#ajedrez", "#🔥"]},
    "thumbnail_text": "SIN REFUGIO 👑",
}


def test_brief_texts_never_keep_emojis():
    brief = ExplainerBrief.model_validate(BRIEF)
    assert brief.youtube.title == "La jugada que nadie esperaba"
    assert brief.youtube.title_alternatives == ["El rey sin refugio"]
    assert brief.youtube.description == "Primera línea\n\nSegunda línea. Más abajo."   # se conservan los saltos
    assert brief.hook == "Una pieza cayó. Nadie lo esperaba."
    assert brief.tiktok.caption == "La partida que cambió todo. ¿La conocías?"
    assert brief.tiktok.hashtags == ["#ajedrez"]
    assert brief.facebook.title == "La jugada" and brief.thumbnail_text == "SIN REFUGIO"
    assert "👑" not in brief.working_title


def test_codex_prompt_reads_with_the_shell_and_reviews_components(tmp_path: Path):
    rec = {"video_id": "v1", "design": "binary", "category_path": "node_tech", "topic": "Ajedrez",
           "agent": "codex", "target_minutes": 10}
    prompt = build_agent_prompt(rec, tmp_path / "v1")
    assert "cat, sed -n" in prompt and "herramienta de lectura (Read)" not in prompt
    assert "kit.py components v1" in prompt and "inventario visual" in prompt and "Máximo 3 rondas" in prompt
    assert "Duración objetivo: 10 minutos" in prompt
    assert "Sin emojis" in prompt
    assert "PAQUETE v2" in prompt and "publishing build v1" in prompt   # NodeTech: paquete de publicación
    assert "kit.py outro v1" in prompt and "cierre con voz" in prompt


def test_claude_prompt_keeps_the_read_tool_and_old_productions_have_no_target(tmp_path: Path):
    rec = {"video_id": "v1", "design": "binary", "category_path": "node_tech", "topic": "IA", "agent": "claude"}
    prompt = build_agent_prompt(rec, tmp_path / "v1")
    assert "herramienta de lectura (Read)" in prompt
    assert "Duración objetivo" not in prompt   # producción anterior a lengths.json: formato corto
    politics = build_agent_prompt({**rec, "category_path": "node_politics"}, tmp_path / "v1")
    assert "PAQUETE v2" not in politics   # sin perfil de categoría: textos v1
