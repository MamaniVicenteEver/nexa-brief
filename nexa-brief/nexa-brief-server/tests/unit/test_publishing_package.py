"""Paquete de publicación v2: modelo, descripción, cifras, validación, apertura y guardado."""

from __future__ import annotations

import copy
import json
import subprocess
from pathlib import Path

import pytest
from pydantic import ValidationError

from src.core.explainer.catalog import TEMPLATES_DIR, ExplainerVideo
from src.core.explainer.publishing import __main__ as cli
from src.core.explainer.publishing import service
from src.core.explainer.publishing.checks import check_package
from src.core.explainer.publishing.description import (
    GratitudeError,
    gratitude_text,
    gratitude_variant,
    render_facebook,
    render_youtube,
)
from src.core.explainer.publishing import opening as opening_mod
from src.core.explainer.publishing.opening import CHOSEN_TO_OPTION, OpeningError, apply_opening, design_of, opening_specs
from src.core.explainer.publishing.numbers import digit_numbers, numbers_in, word_numbers
from src.core.explainer.publishing.package import PublishPackage
from src.core.explainer.publishing.store import compat_fields, is_package, load_package, read_publish, save_package
from src.core.explainer.publishing.strategies import active_strategies

PACKAGE = {
    "schema_version": 2,
    "category": "node_tech",
    "thumbnail": {
        "kicker": "APOLO 11 · 20 JUL 1969",
        "text_only": {"lines": ["LA COMPUTADORA", "DEL APOLO 11", "SE RINDIÓ"], "highlight": "SE RINDIÓ", "pair_title": "A"},
        "with_image": {"text": "ELLA LO PREVIÓ", "image": "hamilton.jpg", "composition": "…", "pair_title": "A"},
        "chosen": "text_only",
    },
    "titles": {
        "youtube": [
            {"option": "A", "text": "La alarma que casi aborta la llegada a la Luna", "strategy": 4, "emotion": "Ansiedad"},
            {"option": "B", "text": "Tenía 26 años y segundos para decidir si se pisaba la Luna", "strategy": 9, "emotion": "Tensión"},
            {"option": "C", "text": "Programó para el error, y eso salvó al Apolo 11", "strategy": 1, "emotion": "Asombro"},
        ],
        "facebook": {"title": "La alarma que casi aborta la llegada a la Luna", "first_line": "A 10 km de la Luna, la computadora mostró el error 1202."},
        "tiktok": {"caption": "La alarma que casi aborta el Apolo 11. ¿La conocías?"},
        "chosen": "A",
    },
    "description": {
        "hook": "A 10 kilómetros de la Luna, la computadora mostró un número: 1202.",
        "context": "Una computadora con unos 4 kilobytes de memoria.",
        "chapters": [{"at": "0:00", "title": "Se rinde"}, {"at": "0:29", "title": "4 KB"}, {"at": "1:05", "title": "Hamilton"}],
        "reflection": "Innovar es construir algo que sepa qué hacer cuando falla.",
        "question": "¿Tú habrías dicho «Go»?",
        "gratitude": "G2_reciprocidad",
        "gratitude_topic": "la ingeniería",
    },
    "sources": ["NASA — Apollo 11 Lunar Surface Journal"],
    "credits": ["Margaret Hamilton — Draper Laboratory — dominio público"],
    "tags": {
        "youtube": ["Apolo 11", "Apollo 11", "alarma 1202", "error 1202", "Margaret Hamilton", "llegada a la Luna",
                    "alunizaje", "computadora del Apolo", "NASA", "documental corto"],
        "youtube_hashtags": ["#Apolo11", "#MargaretHamilton", "#NodeTech"],
        "tiktok": ["#apolo11", "#nasa", "#sabiasque"],
        "facebook": ["#Apolo11", "#Tecnología"],
    },
    "pinned_comment": "Dato extra: la alarma 1202 avisaba de una sobrecarga, no de una falla. ¿Qué otro momento de la carrera espacial te gustaría que investiguemos? ¿O de qué otro tema te gustaría escuchar?",
}

SCRIPT_TEXT = (
    "Veinte de julio de mil novecientos sesenta y nueve. A diez kilómetros de la Luna, la computadora del Apolo once "
    "se rinde. Un controlador de veintiséis años. Quedaban treinta segundos de combustible. Cuatro kilobytes."
)


@pytest.fixture
def strategies():
    return active_strategies("node_tech")


@pytest.fixture
def video_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Video mínimo con la forma del explainer-kit: guion, transcripción, storyboard, medios y renders."""
    monkeypatch.setattr(opening_mod, "TEMPLATES_DIR", tmp_path)   # rutas de fotos relativas a este árbol
    d = tmp_path / "apolo-1202"
    media = d / "assets" / "media"
    media.mkdir(parents=True)
    (media / "hamilton.jpg").write_bytes(b"jpg")
    (media / "CREDITS.md").write_text("hamilton.jpg — Margaret Hamilton — Draper — PD\n", encoding="utf-8")
    (d / "assets" / "script.json").write_text(json.dumps({
        "title": "1202", "kicker": "APOLO 11 · 20 JUL 1969", "subtitle": "EL ERROR",
        "segments": [{"id": "s01", "text": SCRIPT_TEXT}],
    }), encoding="utf-8")
    (d / "assets" / "lyrics.json").write_text(json.dumps({
        "segments": [{"words": [{"word": "1202."}, {"word": "1969."}, {"word": "10"}]}],
    }), encoding="utf-8")
    (d / "assets" / "config.json").write_text(json.dumps({"configs": [{"id": "apolo-1202", "design": "rough"}]}), encoding="utf-8")
    (d / "assets" / "storyboard.json").write_text(json.dumps({"beats": [
        {"t": 0, "use": "rough.title", "params": {"text": "1202", "textPortrait": "12\n02", "kicker": "APOLO 11", "sub": "EL ERROR"}, "until": "otro beat"},
        {"t": 4, "use": "rough.label", "params": {"text": "otro beat"}},
    ]}), encoding="utf-8")
    (d / "render" / "preview").mkdir(parents=True)
    (d / "render" / "apolo-1202-16x9.mp4").write_bytes(b"mp4")
    (d / "render" / "preview" / "apolo-1202-9x16-10s.mp4").write_bytes(b"mp4")
    (d / "render" / "poster.jpg").write_bytes(b"jpg")
    return d


def _package(**changes) -> PublishPackage:
    data = copy.deepcopy(PACKAGE)
    for path, value in changes.items():
        target = data
        *parents, leaf = path.split("__")
        for key in parents:
            target = target[int(key)] if key.isdigit() else target[key]
        target[int(leaf) if leaf.isdigit() else leaf] = value
    return PublishPackage.model_validate(data)


def _tabloid_package(**tabloid) -> PublishPackage:
    data = copy.deepcopy(PACKAGE)
    data["thumbnail"]["tabloid"] = tabloid
    data["thumbnail"]["chosen"] = "tabloid"
    return PublishPackage.model_validate(data)


def _fields(issues, level="error") -> set[str]:
    return {i.field for i in issues if i.level == level}


# ── modelo ────────────────────────────────────────────────────────────────────

def test_highlight_must_be_part_of_the_thumbnail_text():
    with pytest.raises(ValidationError, match="highlight"):
        _package(thumbnail__text_only__highlight="NO ESTÁ")


def test_highlight_cannot_span_two_lines():
    # la web resalta renglón por renglón: un resaltado que cruza el salto no se vería
    with pytest.raises(ValidationError, match="ningún renglón"):
        _package(thumbnail__text_only__highlight="APOLO 11 SE")


def test_unknown_fields_are_rejected():
    with pytest.raises(ValidationError, match="titel"):
        _package(titles__youtube__0__titel="typo")


def test_image_side_defaults_to_auto_and_only_accepts_known_sides():
    assert _package().thumbnail.with_image.image_side == "auto"
    assert _package(thumbnail__with_image__image_side="left").thumbnail.with_image.image_side == "left"
    with pytest.raises(ValidationError, match="image_side"):
        _package(thumbnail__with_image__image_side="arriba")


def test_chosen_title_must_exist_and_options_be_unique():
    with pytest.raises(ValidationError, match="elegido"):
        _package(titles__chosen="C", titles__youtube=PACKAGE["titles"]["youtube"][:2])
    duplicated = [dict(t, option="A") for t in PACKAGE["titles"]["youtube"]]
    with pytest.raises(ValidationError, match="repetidas"):
        _package(titles__youtube=duplicated)


@pytest.mark.parametrize("at", ["00:00:00", "0:75", "0:7"])
def test_chapter_time_format_is_validated(at: str):
    with pytest.raises(ValidationError):
        _package(description__chapters__0__at=at)


# ── cifras ────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize(("text", "expected"), [
    ("mil novecientos sesenta y nueve", "1969"),
    ("treinta y siete segundos", "37"),
    ("veintiséis años", "26"),
    ("trece mil quinientos dólares", "13500"),
    ("seis mil millones", "6000000000"),
])
def test_word_numbers(text: str, expected: str):
    assert expected in word_numbers(text)


@pytest.mark.parametrize(("text", "expected"), [
    ("dos y tres", {"2", "3"}),
    ("dos tres", {"2", "3"}),
    ("sesenta y nueve. Mil novecientos setenta", {"69", "1970"}),
    ("doscientos trescientos", {"200", "300"}),
    ("mil mil", {"1000"}),
])
def test_word_numbers_do_not_merge_separate_numbers(text: str, expected: set[str]):
    assert word_numbers(text) == expected


def test_digit_numbers_normalize_thousands_separator():
    assert digit_numbers("1.178 lugares, 706 salvados, 0,048 s") == {"1178", "706", "0,048"}
    assert numbers_in("treinta y 30") == {"30"}


@pytest.mark.parametrize(("text", "expected"), [
    ("6.000 millones", "6000000000"),
    ("7 mil millones", "7000000000"),
    ("1,5 millones", "1500000"),
    ("13 mil", "13000"),
])
def test_digits_with_a_scale_word_match_the_spoken_number(text: str, expected: str):
    assert digit_numbers(text) == {expected}


# ── descripción ───────────────────────────────────────────────────────────────

def test_youtube_description_has_the_nine_blocks_in_order(strategies):
    package = _package()
    text = render_youtube(package, "GRACIAS", strategies.description)
    blocks = text.split("\n\n")
    assert blocks[0] == package.description.hook
    assert blocks[2].startswith("CAPÍTULOS\n0:00 Se rinde")
    assert blocks[4] == "GRACIAS"
    assert blocks[6].startswith("FUENTES\n- NASA")
    assert blocks[7].startswith("IMÁGENES (Wikimedia Commons)\n- Margaret Hamilton")
    assert blocks[-1] == "#Apolo11 #MargaretHamilton #NodeTech"


def test_empty_sources_block_is_omitted_not_left_half_written(strategies):
    text = render_youtube(_package(sources=[]), "GRACIAS", strategies.description)
    assert "FUENTES" not in text


def test_facebook_description_starts_with_its_first_line():
    package = _package()
    assert render_facebook(package).split("\n\n") == [
        package.titles.facebook.first_line, package.description.reflection,
        package.description.question, "#Apolo11 #Tecnología",
    ]


def test_gratitude_uses_the_chosen_variant_and_topic(strategies):
    package = _package()
    variant = gratitude_variant("apolo-1202", package, strategies.gratitude)
    assert variant == "G2_reciprocidad"
    assert gratitude_text(variant, package, strategies.gratitude).endswith("le encante la ingeniería.")


def test_gratitude_errors_are_explicit(strategies):
    package = _package()
    with pytest.raises(GratitudeError, match="no existe"):
        gratitude_text("G9_inexistente", package, strategies.gratitude)
    with pytest.raises(GratitudeError, match="gratitude_topic"):
        gratitude_text("G2_reciprocidad", _package(description__gratitude_topic=" "), strategies.gratitude)


def test_gratitude_rotation_is_stable_per_video_and_varies_between_videos(strategies):
    package = _package(description__gratitude=None)
    picks = {vid: gratitude_variant(vid, package, strategies.gratitude) for vid in (f"video-{i}" for i in range(12))}
    assert picks == {vid: gratitude_variant(vid, package, strategies.gratitude) for vid in picks}
    assert len(set(picks.values())) > 1


# ── validación ────────────────────────────────────────────────────────────────

def test_valid_package_has_no_errors(strategies, video_dir):
    issues = check_package(_package(), strategies, video_dir, duration_seconds=233)
    assert _fields(issues) == set()


@pytest.mark.parametrize(("changes", "field"), [
    ({"titles__youtube__0__text": "x" * 61}, "titles.youtube.A"),
    ({"titles__youtube__0__strategy": 42}, "titles.youtube.A"),
    ({"titles__youtube": PACKAGE["titles"]["youtube"][:2], "thumbnail__with_image__pair_title": "A"}, "titles.youtube"),
    ({"thumbnail__text_only__lines": ["MUY", "CORTO"], "thumbnail__text_only__highlight": ""}, "thumbnail.text_only"),
    ({"thumbnail__text_only__lines": ["UN RENGLÓN DEMASIADO LARGO", "B", "C"], "thumbnail__text_only__highlight": ""}, "thumbnail.text_only"),
    ({"thumbnail__with_image__text": "UNA FRASE DEMASIADO LARGA PARA IMAGEN"}, "thumbnail.with_image"),
    ({"thumbnail__with_image__image": "no-existe.jpg"}, "thumbnail.with_image"),
    ({"thumbnail__text_only__lines": ["LA ALARMA", "QUE CASI", "ABORTA"], "thumbnail__text_only__highlight": ""}, "thumbnail.text_only"),
    ({"titles__facebook__first_line": "x" * 126}, "titles.facebook"),
    ({"titles__tiktok__caption": "x" * 151}, "titles.tiktok"),
    ({"tags__tiktok": ["#apolo11", "#fyp", "#sabiasque"]}, "tags.tiktok"),
    ({"description__chapters": [{"at": "0:05", "title": "a"}, {"at": "0:30", "title": "b"}, {"at": "1:00", "title": "c"}]}, "description.chapters"),
    ({"description__chapters": [{"at": "0:00", "title": "a"}, {"at": "0:05", "title": "b"}, {"at": "1:00", "title": "c"}]}, "description.chapters"),
    ({"description__chapters": [{"at": "0:00", "title": "a"}, {"at": "1:00", "title": "b"}, {"at": "9:00", "title": "c"}]}, "description.chapters"),
    ({"description__chapters": [{"at": "0:00", "title": "a"}, {"at": "1:00", "title": "b"}, {"at": "3:50", "title": "c"}]}, "description.chapters"),
    ({"description__gratitude": "G9_inexistente"}, "description.gratitude"),
    ({"description__gratitude_topic": ""}, "description.gratitude"),
    ({"description__context": "x" * 5000}, "description"),
    ({"sources": []}, "sources"),
    ({"credits": []}, "credits"),
    ({"tags__youtube": ["solo", "tres", "tags"]}, "tags.youtube"),
    # 10 tags de 48 letras con espacio: 10 × (48 + 2 comillas) + 9 comas = 509 > 500
    ({"tags__youtube": [f"tag {i:02d} " + "x" * 41 for i in range(10)]}, "tags.youtube"),
    ({"tags__youtube_hashtags": ["#Apolo11", "#NASA", "#Luna"]}, "tags.youtube"),
    ({"tags__facebook": ["#Apolo11", "Tecnología"]}, "tags.facebook"),
    ({"titles__youtube__2__text": "Programó para el error, y eso salvó 7 misiones"}, "titles.youtube.C"),
    ({"thumbnail__kicker": "APOLO 11 · 45 JUL 1969"}, "thumbnail.kicker"),
    ({"pinned_comment": "Gracias por llegar hasta el final. Dato extra: algo. ¿Te gustó? ¿Qué tema sigue?"}, "pinned_comment"),
    ({"pinned_comment": "Dato extra: la alarma 1202 era una sobrecarga. ¿Qué otro momento te gustaría ver?"}, "pinned_comment"),
    ({"pinned_comment": "Dato extra: " + "muy largo " * 50 + "¿Uno? ¿Dos?"}, "pinned_comment"),
    ({"pinned_comment": "Dato extra: la alarma 7777 era una sobrecarga. ¿Qué otro momento? ¿Qué otro tema?"}, "pinned_comment"),
    ({"titles__tiktok__caption": "La alarma que casi aborta el Apolo 11 🚀"}, "titles.tiktok"),
    ({"description__question": "¿Tú habrías dicho «Go»? 🤔"}, "description"),
])
def test_each_rule_is_enforced(strategies, video_dir, changes, field):
    issues = check_package(_package(**changes), strategies, video_dir, duration_seconds=233)
    assert field in _fields(issues), [vars(i) for i in issues]


def test_uncredited_thumbnail_image_is_an_error(strategies, video_dir):
    (video_dir / "assets" / "media" / "CREDITS.md").write_text("otra.jpg — …\n", encoding="utf-8")
    issues = check_package(_package(), strategies, video_dir, duration_seconds=233)
    assert any("crédito" in i.message for i in issues if i.field == "thumbnail.with_image")


def test_both_thumbnail_options_are_required(strategies, video_dir):
    for chosen in ("text_only", "with_image"):
        pending = _package(thumbnail__with_image__image=None, thumbnail__chosen=chosen)
        assert "thumbnail.with_image" in _fields(check_package(pending, strategies, video_dir, 233))


def test_tabloid_thumbnail_checks_word_limit_and_optional_photo_credit(strategies, video_dir):
    long = _tabloid_package(text="TÚ ERES EL SIGUIENTE AHORA MISMO SIN EMPLEO")
    assert "thumbnail.tabloid" in _fields(check_package(long, strategies, video_dir, 233))

    (video_dir / "assets" / "media" / "uncited.jpg").write_bytes(b"jpg")
    uncredited = _tabloid_package(text="TÚ ERES EL SIGUIENTE", image="uncited.jpg")
    issues = check_package(uncredited, strategies, video_dir, 233)
    assert any("crédito" in i.message for i in issues if i.field == "thumbnail.tabloid.image")

    text_only = _tabloid_package(text="TÚ ERES EL SIGUIENTE", image=None)
    assert "thumbnail.tabloid.image" not in _fields(check_package(text_only, strategies, video_dir, 233))


def test_tabloid_option_is_gated_to_amarillista_or_explicit_package(video_dir):
    assert "C" not in opening_specs(_package(), video_dir, "rough")
    config_path = video_dir / "assets" / "config.json"
    config = json.loads(config_path.read_text())
    config["configs"][0]["narrative_id"] = "narrative_amarillista_v1"
    config_path.write_text(json.dumps(config))
    assert "C" in opening_specs(_package(), video_dir, "rough")


def test_repeated_emotions_are_a_warning(strategies, video_dir):
    same = [dict(t, emotion="Asombro") for t in PACKAGE["titles"]["youtube"]]
    issues = check_package(_package(titles__youtube=same), strategies, video_dir, 233)
    assert "titles.youtube" in _fields(issues, "warning")


# ── apertura = miniatura elegida ─────────────────────────────────────────────

def _opening_beat(video_dir: Path) -> dict:
    return json.loads((video_dir / "assets" / "storyboard.json").read_text())["beats"][0]


def test_opening_is_the_chosen_thumbnail_and_removes_stale_renders(video_dir):
    result = apply_opening(video_dir, _package())
    assert result.changed
    assert sorted(result.removed_renders) == ["render/apolo-1202-16x9.mp4", "render/preview/apolo-1202-9x16-10s.mp4"]
    assert (video_dir / "render" / "poster.jpg").exists()  # la portada no es un render: la regenera el kit
    beat = _opening_beat(video_dir)
    assert beat["use"] == "rough.introv1" and beat["until"] == "otro beat"   # el momento en que termina no cambia
    assert beat["params"] == {"text": "LA COMPUTADORA\nDEL APOLO 11\nSE RINDIÓ", "textPortrait": "LA COMPUTADORA\nDEL APOLO 11\nSE RINDIÓ",
                              "highlight": "SE RINDIÓ", "kicker": "APOLO 11 · 20 JUL 1969"}
    script = json.loads((video_dir / "assets" / "script.json").read_text())
    assert (script["title"], script["kicker"], script["subtitle"]) == ("LA COMPUTADORA DEL APOLO 11 SE RINDIÓ", "APOLO 11 · 20 JUL 1969", "")
    assert script["segments"][0]["text"] == SCRIPT_TEXT


def test_choosing_b_opens_with_the_photo(video_dir):
    apply_opening(video_dir, _package(thumbnail__chosen="with_image", thumbnail__with_image__image_side="left"))
    beat = _opening_beat(video_dir)
    assert beat["use"] == "rough.introv2"
    assert beat["params"]["src"] == "/apolo-1202/assets/media/hamilton.jpg"  # relativa a la raíz de plantillas
    assert "imageSide" not in beat["params"]   # rough.introv2 no tiene ese param
    assert beat["params"]["text"] == "ELLA LO PREVIÓ"


def test_choosing_c_opens_with_the_common_tabloid_component(video_dir):
    specs = opening_specs(_tabloid_package(text="TÚ ERES EL SIGUIENTE", image="hamilton.jpg"), video_dir, "rough")
    assert specs["C"]["component"] == "common.tabloid"
    assert specs["C"]["params"]["src"].endswith("/apolo-1202/assets/media/hamilton.jpg")

    apply_opening(video_dir, _tabloid_package(text="TÚ ERES EL SIGUIENTE", image="hamilton.jpg"))
    beat = _opening_beat(video_dir)
    assert beat["use"] == "common.tabloid"
    assert beat["params"]["text"] == "TÚ ERES EL SIGUIENTE"
    assert beat["params"]["src"].endswith("/apolo-1202/assets/media/hamilton.jpg")


def test_tabloid_brand_default_and_explicit_alert_are_forwarded(video_dir):
    brand = _tabloid_package(text="ALERTA")
    assert brand.thumbnail.tabloid.palette == "brand"
    assert "palette" not in opening_specs(brand, video_dir, "rough")["C"]["params"]
    alert = _tabloid_package(text="ALERTA", palette="alert")
    assert opening_specs(alert, video_dir, "rough")["C"]["params"]["palette"] == "alert"


def test_intro_params_follow_what_each_design_accepts():
    catalog = opening_mod.kit_catalog()
    binary = opening_mod.intro_params(catalog["binary.introv2"], "ELLA LO\nPREVIÓ", "K", image_src="/x.jpg", image_side="left")
    assert binary["imageSide"] == "left" and binary["textPortrait"] == "ELLA LO\nPREVIÓ" and "bg" not in binary
    # contrato common/hook.js: resaltado con ^…^ en el texto y la foto como fondo
    hook_a = opening_mod.intro_params(catalog["acuarela.introv1"], "LA NOCHE QUE\nCAYÓ EL MURO", "K", highlight="MURO")
    assert hook_a == {"text": "LA NOCHE QUE\nCAYÓ EL ^MURO^", "kicker": "K"}
    hook_b = opening_mod.intro_params(catalog["acuarela.introv2"], "NADIE DIO LA ORDEN", "K", image_src="/x.jpg")
    assert hook_b == {"text": "NADIE DIO LA ORDEN", "kicker": "K", "src": "/x.jpg", "bg": "image"}


def test_applying_the_same_opening_twice_changes_nothing(video_dir):
    apply_opening(video_dir, _package())
    (video_dir / "render" / "apolo-1202-16x9.mp4").write_bytes(b"render nuevo")
    assert apply_opening(video_dir, _package()).changed is False
    assert (video_dir / "render" / "apolo-1202-16x9.mp4").exists()


def test_b_without_its_photo_cannot_open_the_video(video_dir):
    with pytest.raises(OpeningError, match="no está disponible"):
        apply_opening(video_dir, _package(thumbnail__chosen="with_image", thumbnail__with_image__image=None))


def test_unknown_opening_component_is_refused(video_dir):
    path = video_dir / "assets" / "storyboard.json"
    storyboard = json.loads(path.read_text())
    storyboard["beats"][0]["use"] = "rough.label"
    path.write_text(json.dumps(storyboard))
    with pytest.raises(OpeningError, match="cartel de apertura"):
        apply_opening(video_dir, _package())


# ── guardado ──────────────────────────────────────────────────────────────────

def test_save_writes_package_and_derived_v1_fields(strategies, video_dir):
    data = save_package(video_dir, _package(), strategies)
    on_disk = json.loads((video_dir / "publish.json").read_text())
    assert on_disk == data
    assert data["youtube_title"] == "La alarma que casi aborta la llegada a la Luna"
    assert data["youtube_title_alternatives"] == [t["text"] for t in PACKAGE["titles"]["youtube"][1:]]
    assert data["thumbnail_text"] == "LA COMPUTADORA DEL APOLO 11 SE RINDIÓ"
    assert "tabloid" not in data["thumbnail"]  # Paquetes A/B viejos conservan su forma.
    assert data["gratitude_used"] == "G2_reciprocidad"
    assert data["strategies_used"] == strategies.ids()
    assert load_package(video_dir) == _package().model_copy(update={"strategies_used": strategies.ids()})


def test_compat_follows_the_chosen_title_and_thumbnail(strategies):
    fields = compat_fields("apolo-1202", _package(titles__chosen="C", thumbnail__chosen="with_image"), strategies)
    assert fields["youtube_title"] == "Programó para el error, y eso salvó al Apolo 11"
    assert fields["thumbnail_text"] == "ELLA LO PREVIÓ"


def test_v1_publish_json_has_no_package(tmp_path: Path):
    (tmp_path / "publish.json").write_text(json.dumps({"youtube_title": "viejo"}))
    assert load_package(tmp_path) is None


# ── reconstrucción (service.build) y CLI ─────────────────────────────────────

def _video(video_dir: Path) -> ExplainerVideo:
    return ExplainerVideo(
        video_id=video_dir.name, path=video_dir, design="rough", category_path="node_tech",
        title="", status="listo", duration_seconds=233,
    )


@pytest.fixture
def kit_calls(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, ...]]:
    """Reemplaza las llamadas a kit.py (manifest, poster) y las registra."""
    calls: list[tuple[str, ...]] = []
    monkeypatch.setattr(service, "_kit", lambda *args: calls.append(args))
    return calls


def _write_v2(video_dir: Path, **changes) -> None:
    data = _package(**changes).model_dump(mode="json")
    (video_dir / "publish.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def test_build_derives_publish_json_opens_with_the_thumbnail_and_syncs_the_kit(video_dir, kit_calls):
    _write_v2(video_dir)
    result = service.build(_video(video_dir))
    assert result.opening.changed and result.review.errors == []
    assert json.loads((video_dir / "publish.json").read_text())["youtube_title"] == PACKAGE["titles"]["youtube"][0]["text"]
    assert kit_calls == [("manifest", "apolo-1202"), ("poster", "apolo-1202")]

    kit_calls.clear()
    assert service.build(_video(video_dir)).opening.changed is False
    assert kit_calls == [("manifest", "apolo-1202")]  # misma apertura y portada existente: no se regenera


def test_build_refuses_a_v1_publish_json(video_dir, kit_calls):
    (video_dir / "publish.json").write_text(json.dumps({"youtube_title": "viejo"}))
    with pytest.raises(ValueError, match="no es un paquete"):
        service.build(_video(video_dir))
    assert kit_calls == []


def test_kit_failure_reports_the_step_and_its_stderr(monkeypatch: pytest.MonkeyPatch):
    def failing(cmd, **_kwargs):
        raise subprocess.CalledProcessError(2, cmd, stderr="Traceback …\nKeyError: 'design'")

    monkeypatch.setattr(service.subprocess, "run", failing)
    with pytest.raises(service.KitError, match=r"(?s)kit\.py manifest x falló \(código 2\).*KeyError: 'design'"):
        service._kit("manifest", "x")


def test_review_is_none_for_v1_and_carries_the_strategies_for_v2(video_dir):
    assert service.review(_video(video_dir)) is None
    _write_v2(video_dir)
    result = service.review(_video(video_dir))
    assert result is not None and result.strategies.title.id == active_strategies("node_tech").title.id


def test_cli_check_reports_each_video_and_keeps_going_after_a_broken_one(tmp_path, video_dir, monkeypatch, capsys):
    _write_v2(video_dir, sources=[])
    broken = tmp_path / "roto"
    broken.mkdir()
    (broken / "publish.json").write_text('{"schema_version": 2, "category": "node_tech"}')
    v1 = tmp_path / "viejo"
    v1.mkdir()
    (v1 / "publish.json").write_text(json.dumps({"youtube_title": "viejo"}))
    monkeypatch.setattr(cli, "list_videos", lambda: [_video(broken), _video(v1), _video(video_dir)])

    assert cli.main(["check"]) == 1
    out = capsys.readouterr().out
    assert "✗ roto:" in out and "viejo" not in out  # sin ids solo se revisan los v2
    assert "✗ apolo-1202: 1 errores" in out and "sources: sin fuentes" in out


def test_cli_check_passes_for_a_clean_package(video_dir, monkeypatch, capsys):
    _write_v2(video_dir)
    monkeypatch.setattr(cli, "get_video", lambda _id: _video(video_dir))
    assert cli.main(["check", "apolo-1202"]) == 0
    assert "✓ apolo-1202: 0 errores" in capsys.readouterr().out


def test_cli_build_prints_the_removed_renders(video_dir, monkeypatch, kit_calls, capsys):
    _write_v2(video_dir)
    monkeypatch.setattr(cli, "get_video", lambda _id: _video(video_dir))
    assert cli.main(["build", "apolo-1202"]) == 0
    assert "renders viejos borrados: render/apolo-1202-16x9.mp4" in capsys.readouterr().out


# ── videos reales de NodeTech ─────────────────────────────────────────────────

# los videos nuevos llegan con textos v1 (brief); solo los que ya tienen paquete v2 se comparan
NODETECH = sorted(p.parent for p in (TEMPLATES_DIR / "nodetech").glob("*/publish.json") if is_package(read_publish(p.parent)))


@pytest.mark.parametrize("video_dir", NODETECH, ids=lambda p: p.name)
def test_nodetech_packages_are_consistent(strategies, video_dir: Path):
    package = load_package(video_dir)
    assert package is not None, f"{video_dir.name}: publish.json todavía es v1"
    on_disk = json.loads((video_dir / "publish.json").read_text())
    # los campos planos en disco son exactamente los derivados del paquete (nadie los editó a mano)
    for key, value in compat_fields(video_dir.name, package, strategies).items():
        assert on_disk[key] == value, key
    beat = json.loads((video_dir / "assets" / "storyboard.json").read_text())["beats"][0]
    spec = opening_specs(package, video_dir, design_of(video_dir))[CHOSEN_TO_OPTION[package.thumbnail.chosen]]
    # Los defaults explícitos y ausentes son visualmente iguales.
    defaults = {"palette": "brand", "bulletScale": 1}
    normalize = lambda params: {k: v for k, v in params.items() if k not in defaults or v != defaults[k]}
    assert (beat["use"], normalize(beat["params"])) == (spec["component"], normalize(spec["params"]))
    manifest = json.loads((video_dir / "manifest.json").read_text())
    issues = check_package(package, strategies, video_dir, manifest.get("duration_seconds"))
    # Deuda de paquetes históricos: se registra sin alterar videos ni relajar los checks nuevos.
    historical = {"apolo-1202": {"sources"},
                  "codex-ariane-501": {"thumbnail.with_image"}}
    assert _fields(issues) == historical.get(video_dir.name, set()), [vars(i) for i in issues if i.level == "error"]
    if video_dir.name == "ia-despidos-programadores-amazon":
        assert "thumbnail.tabloid.image_review" in _fields(issues, "warning")


def test_generating_v1_texts_for_a_v2_video_is_refused_before_calling_the_ai():
    from fastapi.testclient import TestClient

    from src.presentation.main import app

    response = TestClient(app).post("/api/v1/explainer/videos/apolo-1202/publish-texts", json={"provider": "deepseek"})
    assert response.status_code == 409
    assert "paquete de publicación v2" in response.json()["detail"]


def test_api_lists_the_package_and_its_issues_only_for_v2_videos():
    from fastapi.testclient import TestClient

    from src.presentation.main import app

    client = TestClient(app)
    videos = {v["video_id"]: v for v in client.get("/api/v1/explainer/videos?category=node_tech").json()}
    apolo = videos["apolo-1202"]["publish_package"]
    assert [t["option"] for t in apolo["package"]["titles"]["youtube"]] == ["A", "B", "C"]
    assert {(i["level"], i["field"]) for i in apolo["issues"]} == {("error", "sources")}
    assert apolo["thumbnail_image_url"].endswith("/nodetech/apolo-1202/assets/media/hamilton.jpg")
    assert apolo["hook_strategy_names"]["4"] == "Casi no pasa"
    assert apolo["title_max_chars"] == 60
    history = client.get("/api/v1/explainer/videos?category=node_history").json()
    # NodeHistory también publica con el paquete v2 (perfil categories/node_history.json)
    assert history and all(v["publish_package"] and v["publish_package"]["package"] for v in history)


def test_api_reports_a_broken_package_without_failing_the_list(monkeypatch):
    from fastapi.testclient import TestClient

    from src.core.explainer.publishing.strategies import StrategyError
    from src.presentation.api.routers import explainer as router
    from src.presentation.main import app

    def broken(_video):
        raise StrategyError("title_x_v9 no existe")

    monkeypatch.setattr(router, "review_package", broken)
    response = TestClient(app).get("/api/v1/explainer/videos?category=node_tech")
    assert response.status_code == 200
    issues = [v["publish_package"]["issues"] for v in response.json() if v["publish_package"]]
    assert issues and all(i[0]["field"] == "publish.json" and "title_x_v9" in i[0]["message"] for i in issues)


@pytest.mark.parametrize("field", ["strap", "seal", "tape_text", "bullet", "before_label", "after_label"])
def test_tabloid_visible_numbers_are_checked(strategies, video_dir, field):
    package = _tabloid_package(**{field: "7777 PUESTOS"})
    issues = check_package(package, strategies, video_dir, 233)
    assert any(i.field == f"thumbnail.tabloid.{field}" and "7777" in i.message for i in issues)
    package = _tabloid_package(**{field: "1202 PUESTOS"})
    assert not any(i.field == f"thumbnail.tabloid.{field}" and "cifras" in i.message
                   for i in check_package(package, strategies, video_dir, 233))


def test_tabloid_missing_explicit_photo_is_not_offered_and_cannot_open(video_dir):
    for field in ("image", "image_after"):
        package = _tabloid_package(**{field: "ausente.jpg"})
        assert "C" not in opening_specs(package, video_dir, "rough")
        with pytest.raises(OpeningError, match="falta la foto ausente.jpg"):
            apply_opening(video_dir, package)
    assert "C" in opening_specs(_tabloid_package(image=None), video_dir, "rough")


def test_tabloid_repeated_seal_is_reported(strategies, video_dir):
    issues = check_package(_tabloid_package(strap="ALERTA · AMAZON", seal="alerta"), strategies, video_dir, 233)
    assert any(i.field == "thumbnail.tabloid.seal" and i.level == "warning" for i in issues)


def test_tabloid_parameter_changes_invalidate_saved_captures(strategies, video_dir):
    first = _tabloid_package(text="TÚ ERES EL SIGUIENTE", accent="SIGUIENTE")
    save_package(video_dir, first, strategies)
    for ext in ("jpg", "webp"):
        (video_dir / "render" / f"thumbnail-C.{ext}").write_bytes(b"image")
    save_package(video_dir, first, strategies)
    assert (video_dir / "render" / "thumbnail-C.jpg").exists()
    save_package(video_dir, _tabloid_package(text="TÚ ERES EL SIGUIENTE", accent="TÚ"), strategies)
    assert not (video_dir / "render" / "thumbnail-C.jpg").exists()
    assert not (video_dir / "render" / "thumbnail-C.webp").exists()


def test_tabloid_passes_new_parameters_and_second_photo(video_dir):
    package = _tabloid_package(image="hamilton.jpg", image_after="hamilton.jpg", accent="SIGUIENTE",
                                bullet="1202 ALERTAS", before_label="ANTES", after_label="AHORA")
    params = opening_specs(package, video_dir, "rough")["C"]["params"]
    assert params["srcAfter"].endswith("/assets/media/hamilton.jpg")
    assert (params["accent"], params["bullet"], params["beforeLabel"], params["afterLabel"]) == (
        "SIGUIENTE", "1202 ALERTAS", "ANTES", "AHORA")


def test_stale_c_capture_is_not_served_after_external_parameter_change(video_dir):
    import hashlib
    from src.core.explainer import thumbnails

    video = _video(video_dir)
    spec = opening_specs(_tabloid_package(accent="SIGUIENTE"), video_dir, "rough")["C"]
    path = thumbnails.thumbnail_file(video, "C")
    path.write_bytes(b"image")
    assert not thumbnails.capture_current(video, "C", spec)
    path.with_suffix(".sha256").write_text(hashlib.sha256(json.dumps(spec, sort_keys=True, ensure_ascii=False).encode()).hexdigest())
    assert not thumbnails.capture_current(video, "C", spec)  # sello anterior a la identidad del diseño
    path.with_suffix(".sha256").write_text(thumbnails._capture_digest(video, spec))
    assert thumbnails.capture_current(video, "C", spec)
    spec["params"]["accent"] = "TÚ"
    assert not thumbnails.capture_current(video, "C", spec)


def test_choose_and_capture_refuse_missing_explicit_c_photo(strategies, video_dir):
    import asyncio
    from src.core.explainer import thumbnails

    save_package(video_dir, _tabloid_package(image="ausente.jpg"), strategies)
    video = _video(video_dir)
    with pytest.raises(thumbnails.ThumbnailError, match="falta la foto ausente.jpg"):
        thumbnails.choose(video, "C")
    with pytest.raises(thumbnails.ThumbnailError, match="falta la foto ausente.jpg"):
        asyncio.run(thumbnails.ensure(video, "C"))
    with pytest.raises(thumbnails.ThumbnailError, match="falta la foto ausente.jpg"):
        asyncio.run(thumbnails.render(video, ("C",)))


def test_tabloid_focus_round_trips_and_warns_when_missing(strategies, video_dir):
    package = _tabloid_package(image="hamilton.jpg", marker=True, seal="ALERTA", focus=[.7, .35, .12])
    assert opening_specs(package, video_dir, "rough")["C"]["params"]["focus"] == [.7, .35, .12]
    assert "thumbnail.tabloid.focus" not in _fields(check_package(package, strategies, video_dir, 233), "warning")
    missing = _tabloid_package(image="hamilton.jpg", marker=True)
    assert "thumbnail.tabloid.focus" in _fields(check_package(missing, strategies, video_dir, 233), "warning")
    with pytest.raises(ValidationError, match="focus"):
        _tabloid_package(focus=[.5, .5, 0])


def test_amarillista_tabloid_requires_sourced_bullet_and_image_review(video_dir, strategies):
    config = {"narrative_id": "narrative_amarillista_v1"}
    (video_dir / "assets/config.json").write_text(json.dumps(config))
    bad = _tabloid_package(image="hamilton.jpg", bullet="99")
    issues = check_package(bad, strategies, video_dir, 120)
    assert {"thumbnail.tabloid.bullet", "thumbnail.tabloid.image_review"} <= _fields(issues)
    data = bad.model_dump()
    data["sources"].append("NASA — 99 registros")
    data["thumbnail"]["tabloid"]["image_review"] = [{"image": "hamilton.jpg", "verdict": "elegida", "reason": "Muestra la ingeniera del Apolo."}]
    good = PublishPackage.model_validate(data)
    fields = _fields(check_package(good, strategies, video_dir, 120))
    assert "thumbnail.tabloid.bullet" in fields and "thumbnail.tabloid.image_review" not in fields
    (video_dir / "assets/script.json").write_text(json.dumps({"segments": [{"text": "Noventa y nueve registros."}]}))
    fields = _fields(check_package(good, strategies, video_dir, 120))
    assert "thumbnail.tabloid.bullet" not in fields
    data["thumbnail"]["tabloid"]["bullet"] = "SIN DATO"
    fields = _fields(check_package(PublishPackage.model_validate(data), strategies, video_dir, 120))
    assert "thumbnail.tabloid.bullet" in fields


def test_tabloid_bullet_cannot_use_only_transcription_or_url(video_dir, strategies):
    (video_dir / "assets/config.json").write_text(json.dumps({"narrative_id": "narrative_amarillista_v1"}))
    data = _tabloid_package(image="hamilton.jpg", bullet="999").model_dump()
    data["sources"] = ["NASA — https://example.org/999"]
    (video_dir / "assets/lyrics.json").write_text(json.dumps({"segments": [{"words": [{"word": "999"}]}]}))
    fields = _fields(check_package(PublishPackage.model_validate(data), strategies, video_dir, 120))
    assert "thumbnail.tabloid.bullet" in fields
    data["sources"] = ["NASA — 999 registros"]
    fields = _fields(check_package(PublishPackage.model_validate(data), strategies, video_dir, 120))
    assert "thumbnail.tabloid.bullet" in fields


def test_amarillista_requires_chosen_c(video_dir, strategies):
    (video_dir / "assets/config.json").write_text(json.dumps({"narrative_id": "narrative_amarillista_v1"}))
    package = _package()
    assert "thumbnail.chosen" in _fields(check_package(package, strategies, video_dir, 120))


def test_bullet_numbers_equivalent_words_digits_and_scale():
    from src.core.explainer.publishing.numbers import bullet_numbers_in
    evidence = bullet_numbers_in("Se perdieron veinte millones de empleos.")
    assert {"20", "20000000"} <= evidence
    assert numbers_in("20 millones") == {"20000000"}
    assert numbers_in("20.000.000") == {"20000000"}
    assert "21" not in evidence


@pytest.mark.parametrize("bullet", ["20", "20 millones", "20.000.000", "20 000 000", "20\u00a0000\u00a0000"])
def test_bullet_matches_number_spelled_in_script(video_dir, strategies, bullet):
    (video_dir / "assets/config.json").write_text(json.dumps({"narrative_id": "narrative_amarillista_v1"}))
    (video_dir / "assets/script.json").write_text(json.dumps({"segments": [{"text": "Se perdieron veinte millones de empleos."}]}))
    data = _tabloid_package(image="hamilton.jpg", bullet=bullet).model_dump()
    data["sources"] = []
    fields = _fields(check_package(PublishPackage.model_validate(data), strategies, video_dir, 120))
    assert "thumbnail.tabloid.bullet" not in fields
