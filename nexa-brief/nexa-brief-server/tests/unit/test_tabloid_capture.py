"""Capturas del componente con red externa bloqueada y medios decodificados."""
import asyncio
import importlib.util
import json
import sys
import urllib.parse
from pathlib import Path

import pytest
from PIL import Image
from playwright.async_api import Error, async_playwright

TOOLS = Path(__file__).resolve().parents[2] / "src/templates/_tools/explainer-kit/tools"
sys.path.insert(0, str(TOOLS))
spec = importlib.util.spec_from_file_location("kit_thumbnail", TOOLS / "thumbnail.py")
thumbnail = importlib.util.module_from_spec(spec)
spec.loader.exec_module(thumbnail)


def test_tabloid_capture_works_with_external_network_blocked(tmp_path):
    out = tmp_path / "mini.jpg"
    errors = asyncio.run(thumbnail.capture(out, "rough", "common.tabloid", {
        "text": "UN DÍA\nDESPUÉS", "accent": "DESPUÉS",
        "src": "/nodetech/ia-despidos-programadores-amazon/assets/media/oficina-estres.jpg",
    }, 4.5, "16x9"))
    assert errors == [] and out.exists()
    image = Image.open(out).convert("RGB")
    assert image.size == (1280, 720)
    assert sum(1 for r, g, b in image.resize((128, 72)).getdata() if g > 140 and r > 90 and b < 100) > 50


def test_tabloid_capture_rejects_undecodable_photo(tmp_path):
    with pytest.raises(Error):
        asyncio.run(thumbnail.capture(tmp_path / "bad.jpg", "rough", "common.tabloid", {
            "text": "ALERTA", "src": "/no-existe.jpg",
        }, 4.5, "16x9"))
    assert not (tmp_path / "bad.jpg").exists()


def test_all_designs_load_their_font_and_have_readable_brand_colors():
    asyncio.run(_check_designs())


def _contrast(a, b):
    def luminance(color):
        rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
        return sum(x * y for x, y in zip(linear, (.2126, .7152, .0722), strict=True))
    x, y = sorted((luminance(a), luminance(b)))
    return (y + .05) / (x + .05)


async def _check_designs():
    server = thumbnail.shoot.serve(thumbnail.shoot.SANDBOX)
    kit = thumbnail.KIT.relative_to(thumbnail.shoot.SANDBOX).as_posix()
    designs = json.loads((thumbnail.KIT / "showcase/designs.json").read_text())["designs"]
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(executable_path=thumbnail.shoot.CHROMIUM)
            page = await browser.new_page(viewport={"width": 1280, "height": 720})
            async def local_only(route):
                if urllib.parse.urlparse(route.request.url).hostname in {"127.0.0.1", "localhost"}:
                    await route.continue_()
                else:
                    await route.abort()
            await page.route("**/*", local_only)
            for design in designs:
                q = urllib.parse.urlencode({"d": design, "c": "common.tabloid", "p": json.dumps({"text": "UNA PRUEBA", "accent": "PRUEBA"}), "solo": "1", "paused": "1"})
                await page.goto(f"http://127.0.0.1:{server.server_port}/{kit}/showcase/stage.html?{q}")
                await page.wait_for_function("window.__promo && window.__tabloidFontReady")
                await page.evaluate("window.__tabloidFontReady")
                data = await page.evaluate("""() => ({style: window.__tabloidLayout.style,
                  fonts: [...document.fonts].map(f => ({family:f.family, status:f.status}))})""")
                style = data["style"]
                palette = json.loads((thumbnail.KIT / "designs" / design / "design.json").read_text())["defaults"]["palette"]
                assert style["palette"] == "brand"
                assert _contrast(style["ink"], style["bg"]) >= 4.5, (design, style)
                assert _contrast(style["highlight"], style["bg"]) >= 4.5, (design, style)
                assert style["ink"] in palette.values() and style["highlight"] in palette.values(), (design, style)
                assert any(f["family"].strip('"\'') == style["family"] and f["status"] == "loaded" for f in data["fonts"]), (design, data)
                # Capture the actual canvas operations: a shared family and no per-line stretching,
                # even when different headlines require different line breaks.
                for title in ("TÚ ERES EL SIGUIENTE", "CASI ABORTAN LA LUNA"):
                    for width, height in ((1280, 720), (720, 1280)):
                        drawn = await page.evaluate("""async ({title, width, height}) => {
                          const proto = CanvasRenderingContext2D.prototype, original = proto.fillText;
                          const calls = [];
                          proto.fillText = function(text, ...args) {
                            calls.push({text, font: this.font, scale: this.getTransform().a});
                            return original.call(this, text, ...args);
                          };
                          const parent = document.createElement('div'); document.body.appendChild(parent);
                          try {
                            const component = Kit.registry.get('common.tabloid').create({
                              stage: {W: width, H: height, u: Math.min(width,height)/100, portrait: height > width},
                              layers: {dom: parent}, beat: {}, C: Kit.design.defaults
                            }, {text: title, palette: 'brand'});
                            await window.__tabloidFontReady;
                            const rows = window.__tabloidLayout.boxes.filter(b => b.type === 'title');
                            component.dispose();
                            return calls.filter(call => rows.some(row => row.text === call.text));
                          } finally { proto.fillText = original; parent.remove(); }
                        }""", {"title": title, "width": width, "height": height})
                        assert drawn, (design, title, width)
                        assert all(style["family"] in call["font"] and abs(call["scale"] - 1) < .001
                                   for call in drawn), (design, title, drawn)
            await browser.close()
    finally:
        server.shutdown()
        server.server_close()
