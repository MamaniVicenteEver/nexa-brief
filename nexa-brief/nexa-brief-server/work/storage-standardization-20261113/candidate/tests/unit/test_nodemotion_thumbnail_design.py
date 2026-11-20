from __future__ import annotations

import asyncio
import json
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image, ImageDraw, ImageStat
import pytest

from src.core import draft_thumbnails as thumbs
from src.core.draft_details import DraftDetails, PlatformDetails
from src.core.job import Job, JobArtifacts, JobInput, JobStage


SERVER_ROOT = Path(__file__).resolve().parents[2]
TEMPLATE_DIRS = {
    "promo-editorial": ("commercial", "promo_video_editorial"),
    "promo-kinetic": ("commercial", "promo_video_kinetic"),
    "promo-trendy": ("commercial", "promo_video_trendy"),
    "promo-dynamic": ("commercial", "promo_video_dynamic"),
    "promo-urban": ("commercial", "promo_video_urban"),
    "promo-sports": ("commercial", "promo_video_sports"),
    "lyrics-manifiesto": ("lyrics", "lyrics_video_manifiesto"),
    "lyrics-caution": ("lyrics", "lyrics_video_caution"),
}
EXPECTED_LAYOUT = {
    "promo-editorial": "editorial",
    "promo-kinetic": "kinetic",
    "promo-trendy": "trendy",
    "promo-dynamic": "dynamic",
    "promo-urban": "urban",
    "promo-sports": "sports",
    "lyrics-manifiesto": "manifesto",
    "lyrics-caution": "caution",
}


def sample_job(tmp_path: Path, template_id: str = "lyrics-caution") -> Job:
    family, niche_id = TEMPLATE_DIRS[template_id]
    template = SERVER_ROOT / "src" / "templates" / "nodemotion" / family / template_id
    output = tmp_path / "production"
    assets = output / "assets"
    assets.mkdir(parents=True)
    config = json.loads((template / "assets" / "config.json").read_text(encoding="utf-8"))
    (assets / "config.json").write_text(json.dumps(config), encoding="utf-8")
    html_path = output / "index.html"
    html_path.write_text("<!doctype html><title>NodeMotion preview</title>", encoding="utf-8")
    return Job(
        input=JobInput(category_name=niche_id),
        stage=JobStage.HTML_GENERATED,
        artifacts=JobArtifacts(
            output_dir=output,
            assets_dir=assets,
            html_path=html_path,
            config_json_path=assets / "config.json",
        ),
    )


def config_hex_colors(value: dict) -> set[str]:
    colors: set[str] = set()
    configs = value.get("configs")
    if isinstance(configs, list):
        active_id = value.get("activeId")
        value = next((item for item in configs if item.get("id") == active_id), configs[0])
    for group_name in ("palette", "colors"):
        group = value.get(group_name)
        if isinstance(group, dict):
            colors.update(item.upper() for item in group.values() if isinstance(item, str) and re.fullmatch(r"#[0-9A-Fa-f]{6}", item))
    return colors


@pytest.mark.parametrize("template_id", list(EXPECTED_LAYOUT))
def test_each_template_gets_its_own_composition_palette_and_copy(tmp_path: Path, template_id: str):
    job = sample_job(tmp_path, template_id)
    details = DraftDetails(song_name="Dueles Tan Bien", artist="Bruses")
    manifest = thumbs.preview_manifest(job, details)
    a = manifest["options"]["A"]
    b = manifest["options"]["B"]
    config = json.loads((job.artifacts.config_json_path).read_text(encoding="utf-8"))
    known_colors = config_hex_colors(config) | {
        color.upper()
        for color in thumbs._FALLBACK_PALETTES.get(template_id, {}).values()
    }

    assert manifest["templateId"] == template_id
    assert set(manifest["options"]) == {"A", "B"}
    assert a["text"] == ("Gran Final" if template_id == "promo-editorial" else "Dueles Tan Bien")
    assert b["text"] == a["text"]  # Sin letra no se inventa una frase.
    assert a["design"]["layout"] == b["design"]["layout"] == EXPECTED_LAYOUT[template_id]
    assert a["design"]["composition"] == b["design"]["composition"] == "center"
    assert a["design"]["palette"] == b["design"]["palette"]
    assert a["design"]["background"]["kind"] == b["design"]["background"]["kind"] == "frame"
    assert set(a["design"]["palette"].values()) <= known_colors
    assert a["design"]["typography"]["display"] == thumbs._design_tokens()[template_id]["display"]
    assert a["design"]["badges"] == []
    assert a["design"]["subtitle"] == ("" if template_id == "promo-editorial" else "LETRAS")


def test_partial_options_are_merged_safely_and_prepare_never_captures(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    job = sample_job(tmp_path, "promo-kinetic")
    details = DraftDetails(song_name="Un nombre", artist="Artista")

    async def forbidden(*_args, **_kwargs):
        raise AssertionError("prepare must not start Chromium or capture a JPEG")

    monkeypatch.setattr(thumbs, "_capture_svg", forbidden)
    prepared = asyncio.run(thumbs.prepare("preview-only", job, details, options={
        "A": {
            "text": "Texto editado",
            "design": {
                "layout": "<script>",
                "composition": "onload=alert(1)",
                "palette": {"background": "url(javascript:alert(1))"},
                "typography": {"display": "url(javascript:alert(1))"},
            },
        },
    }))

    assert prepared is not None
    assert prepared.options["A"].text == "Texto editado"
    assert prepared.options["A"].design["layout"] == "kinetic"
    assert prepared.options["A"].design["palette"]["background"].startswith("#")
    assert prepared.options["A"].design["typography"]["display"] == "Montserrat"
    assert prepared.options["B"].text == "Un nombre"
    assert prepared.urls == {}
    assert not (job.artifacts.content_dir / "thumbnails").exists()
    assert job.artifacts.thumbnail_path is None


def test_short_title_and_real_lyric_phrase_keep_metadata_out(tmp_path: Path):
    job = sample_job(tmp_path, "lyrics-manifiesto")
    job.artifacts.lyrics_json = {"segments": [{"text": "Sin ti nunca voy a olvidar este amor"}]}
    details = DraftDetails(song_name="Esta canción tiene un nombre demasiado largo", artist="Dalex")
    options = thumbs.preview_manifest(job, details)["options"]
    assert options["A"]["text"] == "Esta canción tiene un nombre"
    assert options["B"]["text"] == "Sin ti nunca voy a olvidar este amor"
    options["B"]["text"] = "Ya no estás · Dalex (Letra)"
    assert thumbs.preview_manifest(job, details, options)["options"]["B"]["text"] == "Ya no estás"


def test_background_and_subtitle_persist_independently_while_old_designs_migrate(tmp_path: Path):
    job = sample_job(tmp_path, "lyrics-caution")
    details = DraftDetails(song_name="Hola Remix")
    options = thumbs.preview_manifest(job, details)["options"]
    options["A"]["design"].update(subtitle="LETRA", background={"kind": "image", "asset": "a" * 24, "overlay": .4, "x": 0})
    options["B"]["design"] = {"palette": {"background": "#F0F000"}, "badges": ["ARTISTA"]}
    result = thumbs.preview_manifest(job, details, options)["options"]
    assert result["A"]["design"]["background"]["asset"] == "a" * 24
    assert result["A"]["design"]["subtitle"] == "LETRAS"
    assert result["B"]["design"]["background"]["kind"] == "frame"
    assert result["B"]["design"]["palette"]["background"] == "#000000"
    assert result["B"]["design"]["badges"] == []


def test_renderer_escapes_hostile_text_and_attributes_wraps_long_words_and_scopes_ids(tmp_path: Path):
    node = shutil.which("node")
    if node is None:
        pytest.skip("Node.js no está instalado")
    job = sample_job(tmp_path, "lyrics-caution")
    details = DraftDetails(song_name="Texto", artist='Nora " onload="alert(1)')
    manifest = thumbs.preview_manifest(job, details)
    hostile = '<script>alert("x")</script> & " onload="alert(1)'
    manifest["options"]["A"]["text"] = hostile
    manifest["options"]["A"]["design"]["palette"]["background"] = "url(javascript:alert(1))"
    manifest["options"]["A"]["design"]["typography"]["display"] = '"/><script>'
    manifest["options"]["A"]["design"]["background"]["pattern"] = "stripes"
    manifest["options"]["B"]["design"]["background"]["pattern"] = "dots"
    long_title = "á" * 200
    manifest["options"]["B"]["text"] = long_title
    script = r"""
const fs = require('node:fs');
const vm = require('node:vm');
const context = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(process.argv[1], 'utf8'), context);
const renderer = context.module.exports;
const manifest = JSON.parse(fs.readFileSync(0, 'utf8'));
const a = renderer.renderSvg(manifest, 'A', 1280, 720);
const b = renderer.renderSvg(manifest, 'B', 1280, 720);
console.log(JSON.stringify({a, b, wrapped: renderer.wrapText(manifest.options.B.text, 13).join('')}));
"""
    result = subprocess.run(
        [node, "-e", script, str(thumbs.RENDERER_PATH)],
        input=json.dumps(manifest, ensure_ascii=False),
        text=True,
        capture_output=True,
        check=True,
        timeout=10,
    )
    output = json.loads(result.stdout)
    svg_a = output["a"]
    svg_b = output["b"]
    assert "<script" not in svg_a.lower()
    assert "javascript:" not in svg_a.lower()
    assert '"/><script>' not in svg_a
    assert re.search(r'"\s+onload\s*=', svg_a, flags=re.I) is None
    assert "&lt;SCRIPT&gt;" in svg_a and "&amp;" in svg_a
    assert output["wrapped"] == long_title

    tree_a = ET.fromstring(svg_a)
    tree_b = ET.fromstring(svg_b)
    all_ids = [item.attrib["id"] for tree in (tree_a, tree_b) for item in tree.iter() if "id" in item.attrib]
    assert len(all_ids) == len(set(all_ids)) >= 2
    assert all("onload" not in item.attrib for tree in (tree_a, tree_b) for item in tree.iter())
    text_b = "".join(item.text or "" for item in tree_b.iter() if item.tag.endswith("tspan"))
    assert text_b == long_title.upper()
    assert all(attr not in tree_a.attrib for attr in ("onload", "onclick", "style"))


@pytest.mark.asyncio
async def test_capture_selected_creates_only_the_chosen_jpeg_for_recording(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    pytest.importorskip("playwright.async_api")
    job = sample_job(tmp_path, "lyrics-manifiesto")
    details = DraftDetails(song_name="Manifiesto — letras", artist="Bruses")
    options = thumbs.preview_manifest(job, details)["options"]
    options["B"]["text"] = "La voz que quedó"
    calls: list[tuple[str, str]] = []

    async def capture_manifest(manifest: dict, option: str, destination: Path) -> None:
        calls.append((option, manifest["options"][option]["text"]))
        image = Image.new("RGB", (1280, 720), manifest["options"][option]["design"]["palette"]["background"])
        ImageDraw.Draw(image).rectangle((80, 80, 900, 360), fill=manifest["options"][option]["design"]["palette"]["accent"])
        image.save(destination, format="JPEG")

    monkeypatch.setattr(thumbs, "_capture_svg", capture_manifest)

    captured = await thumbs.capture_selected("capture-test", job, details, "B", options=options)

    manifest = thumbs.preview_manifest(job, details, options=options)
    persisted = thumbs.ThumbnailSet(fingerprint=manifest["fingerprint"], selected="B")
    assert captured == thumbs.image_path(job, persisted, "B")
    assert calls == [("B", "La voz que quedó")]
    assert captured.is_file()
    assert not thumbs.image_path(job, persisted, "A").exists()
    with Image.open(captured) as image:
        assert image.format == "JPEG"
        assert image.size == (1280, 720)
        assert max(ImageStat.Stat(image.convert("RGB")).stddev) > 2
    assert not list(captured.parent.glob("*.pending.jpg"))


def test_neon_outline_stripes_subtitle_and_brand_contract(tmp_path: Path):
    job = sample_job(tmp_path, "lyrics-manifiesto")
    manifest = thumbs.preview_manifest(job, DraftDetails(song_name="Hola Remix"))
    for key in ("A", "B"):
        manifest["options"][key]["design"].update(style="neon", rowTreatments=[])
    manifest["options"]["B"]["text"] = "SOY YO, EL QUE SIEMPRE LE HABLABA DE TI"
    script = r"""
const fs=require('node:fs'), vm=require('node:vm');
const ctx={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),ctx);
const m=JSON.parse(fs.readFileSync(0,'utf8'));
console.log(JSON.stringify(['A','B'].map(key=>ctx.module.exports.renderSvg(m,key))));
"""
    result = subprocess.run([shutil.which("node"), "-e", script, str(thumbs.RENDERER_PATH)], input=json.dumps(manifest), text=True, capture_output=True, check=True, timeout=10)
    for key, svg in zip(("A", "B"), json.loads(result.stdout)):
        tree = ET.fromstring(svg)
        title = next(item for item in tree if item.tag.endswith("text"))
        rows = list(title)
        assert all(row.attrib["data-treatment"] == "outline" and row.attrib["fill"] == "none" for row in rows[:-1])
        assert rows[-1].attrib["data-treatment"] == "striped"
        subtitle = next(item for item in tree if item.attrib.get("data-role") == "subtitle")
        assert subtitle.text == "LETRAS"
        assert subtitle.attrib["fill"] == manifest["options"][key]["design"]["palette"]["foreground"]
        assert "opacity" not in subtitle.attrib
        assert float(subtitle.attrib["data-gap"]) > 0
        assert float(subtitle.attrib["font-size"]) == pytest.approx(float(title.attrib["font-size"]) * (.2187 if key == "A" else .345))
        assert subtitle.attrib["text-anchor"] == "end"
        assert float(subtitle.attrib["y"]) > float(rows[-1].attrib["y"])
        brand = next(item for item in tree if item.text == "NODEMOTION")
        assert brand.attrib["font-size"] == "15.6" and brand.attrib["font-weight"] == "900"
        assert brand.attrib["stroke-width"] == ".4"


def test_neon_b_subtitle_moves_down_ten_percent_of_its_own_size(tmp_path: Path):
    """Neón B lowers LETRAS; the same typography in another style stays unchanged."""
    job = sample_job(tmp_path, "lyrics-manifiesto")
    manifest = thumbs.preview_manifest(job, DraftDetails(song_name="Hola Remix"))
    manifest["options"]["B"]["text"] = "SOY YO EL QUE SIEMPRE HABLABA DE TI"
    script = r"""
const fs=require('node:fs'), vm=require('node:vm');
const ctx={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),ctx);
const m=JSON.parse(fs.readFileSync(0,'utf8'));
m.options.B.design.style='minimal'; const normal=ctx.module.exports.renderSvg(m,'B');
m.options.B.design.style='neon'; const neon=ctx.module.exports.renderSvg(m,'B');
console.log(JSON.stringify([normal,neon]));
"""
    result = subprocess.run([shutil.which("node"), "-e", script, str(thumbs.RENDERER_PATH)], input=json.dumps(manifest), text=True, capture_output=True, check=True, timeout=10)
    normal, neon = [next(el for el in ET.fromstring(svg) if el.attrib.get("data-role") == "subtitle") for svg in json.loads(result.stdout)]
    assert float(neon.attrib["y"]) - float(normal.attrib["y"]) == pytest.approx(float(neon.attrib["font-size"]) * .1)
    assert neon.attrib["font-size"] == normal.attrib["font-size"]
    assert neon.attrib["fill"] == normal.attrib["fill"]
