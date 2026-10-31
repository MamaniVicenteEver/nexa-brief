"""Prueba de cajas en Chromium con métricas reales de la fuente."""
import asyncio
import json
import sys
import urllib.parse
from pathlib import Path

import pytest
from playwright.async_api import async_playwright

TOOLS = Path(__file__).resolve().parents[2] / "src/templates/_tools/explainer-kit/tools"
sys.path.insert(0, str(TOOLS))
import shoot  # noqa: E402

TITLES = [
    "ALERTA", "UN DÍA DESPUÉS", "TÚ ERES EL SIGUIENTE", "LA MÁQUINA CEDIÓ",
    "NO ENCONTRÓ LA FECHA", "EL CÓDIGO CEDIÓ A LA LÓGICA", "250 PUESTOS MENOS",
    "AÑO 2000: TODO PUDO DETENERSE", "NIÑEZ Y EDUCACIÓN EN CRISIS",
    "¿QUIÉN GANÓ LA ELECCIÓN?", "EL PAÍS CAMBIÓ EN 24 HORAS", "LA ÚLTIMA SEÑAL",
    "SEIS PALABRAS MUY LARGAS PARA PROBAR", "EL EXTRAORDINARIO DESENLACE",
    "HOY", "1929: EL MERCADO SE DERRUMBÓ", "JAPÓN MIRÓ AL SUR",
    "LA NOCHE QUE CAYÓ EL MURO", "¿POR QUÉ PERDIÓ ESPAÑA?", "EL ÚLTIMO AÑO DE PODER",
]
PHOTO = "/nodetech/ia-despidos-programadores-amazon/assets/media/oficina-estres.jpg"


def intersects(a, b):
    return (a["x"] < b["x"] + b["w"] - .001 and a["x"] + a["w"] > b["x"] + .001
            and a["y"] < b["y"] + b["h"] - .001 and a["y"] + a["h"] > b["y"] + .001)


@pytest.mark.parametrize("design,palette", [("rough", "alert"), ("rough", "brand"), ("binary", "brand"),
                                           ("cronica", "brand"), ("memorias", "brand")])
def test_160_layouts_are_safe(design, palette):
    asyncio.run(_check_layouts(design, palette))


async def _check_layouts(design, palette):
    server = shoot.serve(shoot.SANDBOX)
    kit = TOOLS.parent.relative_to(shoot.SANDBOX).as_posix()
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(executable_path=shoot.CHROMIUM)
            try:
                for orientation, width, height in [("16x9", 1280, 720), ("9x16", 720, 1280)]:
                    page = await browser.new_page(viewport={"width": width, "height": height})
                    params = urllib.parse.urlencode({"d": design, "c": "common.tabloid", "p": json.dumps({"text": "PRUEBA", "palette": palette}), "solo": "1", "paused": "1"})
                    await page.goto(f"http://127.0.0.1:{server.server_port}/{kit}/showcase/stage.html?{params}")
                    await page.wait_for_function("window.__promo && window.__tabloidFontReady")
                    await page.evaluate("window.__tabloidFontReady")
                    for title in TITLES:
                        for variant in range(4):
                            p = {"text": title, "accent": title.split()[-1], "palette": palette}
                            if variant:
                                p.update(src=PHOTO, focus=[.72, .35, .10])
                            if variant == 2:
                                p.update(mode="split", marker=True, beforeLabel="ANTES", afterLabel="AHORA")
                            if variant == 3:
                                p.update(strap="ALERTA", seal="URGENTE", tapeText="ATENCIÓN", bullet="250 PUESTOS")
                            result = await page.evaluate("""async ({p,w,h}) => {
                              const parent=document.createElement('div'); document.body.appendChild(parent);
                              const component=Kit.registry.get('common.tabloid').create({stage:{W:w,H:h,u:Math.min(w,h)/100,portrait:h>w},layers:{dom:parent},beat:{},C:Kit.design.defaults},p);
                              await window.__tabloidFontReady;
                              const layout=structuredClone(window.__tabloidLayout); component.dispose(); parent.remove(); return layout;
                            }""", {"p": p, "w": width, "h": height})
                            boxes = result["boxes"]
                            rows = [b for b in boxes if b["type"] == "title"]
                            assert rows, (orientation, title, variant, result)
                            assert " ".join(b["text"] for b in rows) == title.upper(), (orientation, title, variant)
                            if orientation == "16x9" and palette == "alert":
                                title_h = max(b["y"] + b["h"] for b in rows) - min(b["y"] for b in rows)
                                assert .55 <= title_h / height <= .65, (title, variant, title_h / height)
                                if len(title.split()) > 1:
                                    assert 2 <= len(rows) <= 3, (title, variant, rows)
                            if orientation == "16x9" and title == "TÚ ERES EL SIGUIENTE" and variant == 2:
                                assert any(intersects(b, result["photo"]) for b in rows)
                            for b in boxes:
                                assert b["x"] >= -0.01 and b["y"] >= -0.01
                                assert b["x"] + b["w"] <= width + .01 and b["y"] + b["h"] <= height + .01, (title, b)
                            non_accent = [b for b in boxes if b["type"] != "accent"]
                            for i, a in enumerate(non_accent):
                                for b in non_accent[i + 1:]:
                                    assert not intersects(a, b), (orientation, title, variant, a, b)
                            for accent in [b for b in boxes if b["type"] == "accent"]:
                                parent = rows[accent["parent"]]
                                assert (accent["x"] >= parent["x"] and accent["y"] >= parent["y"]
                                        and accent["x"] + accent["w"] <= parent["x"] + parent["w"] + .01
                                        and accent["y"] + accent["h"] <= parent["y"] + parent["h"] + .01)
                    for extra in [
                        {"text": "TÚ ERES EL SIGUIENTE", "accent": "SIGUIENTE", "bullet": "250 PUESTOS"},
                        {"text": "ALERTA", "src": PHOTO, "marker": True, "seal": "URGENTE"},
                        {"text": "UN DÍA DESPUÉS", "src": PHOTO, "imageSide": "left", "focus": [.1, .2, .3], "marker": True},
                    ]:
                        extra["palette"] = palette
                        result = await page.evaluate("""async ({p,w,h}) => {
                          const parent=document.createElement('div'); document.body.appendChild(parent);
                          const component=Kit.registry.get('common.tabloid').create({stage:{W:w,H:h,u:Math.min(w,h)/100,portrait:h>w},layers:{dom:parent},beat:{},C:Kit.design.defaults},p);
                          await window.__tabloidFontReady; const layout=structuredClone(window.__tabloidLayout);
                          component.dispose(); parent.remove(); return layout;
                        }""", {"p": extra, "w": width, "h": height})
                        if "bullet" in extra:
                            rows = [b for b in result["boxes"] if b["type"] == "title"]
                            assert any(b["type"] == "bullet" for b in result["boxes"])
                            if orientation == "16x9":
                                # Brand headlines keep the natural width of the display font.
                                assert max(b["w"] for b in rows) >= width * (.8 if palette == "brand" else .9)
                                bullet = next(b for b in result["boxes"] if b["type"] == "bullet")
                                assert bullet["y"] >= max(b["y"] + b["h"] for b in rows)
                                assert bullet["w"] >= width * .9
                        elif "focus" not in extra:
                            assert not any(b["type"] in {"marker", "seal"} for b in result["boxes"])
                            assert any("focus" in warning for warning in result["warnings"])
                        else:
                            assert any(b["type"] == "title" for b in result["boxes"])
                            boxes = [b for b in result["boxes"] if b["type"] != "accent"]
                            assert all(not intersects(a, b) for i, a in enumerate(boxes) for b in boxes[i + 1:])
                    await page.close()
            finally:
                await browser.close()
    finally:
        server.shutdown()
        server.server_close()


@pytest.mark.parametrize("design,title,accent,src,focus", [
    ("rough", "TÚ ERES EL SIGUIENTE", "SIGUIENTE", PHOTO, [.7, .43, .07]),
    ("binary", "EL CÓDIGO CEDIÓ", "CÓDIGO", "/nodehistory/turing-enigma/assets/media/turing.jpg", [.5, .27, .14]),
    ("cronica", "EL CÓDIGO CEDIÓ", "CÓDIGO", "/nodehistory/turing-enigma/assets/media/turing.jpg", [.5, .27, .14]),
    ("memorias", "EL CÓDIGO CEDIÓ", "CÓDIGO", "/nodehistory/turing-enigma/assets/media/turing.jpg", [.5, .27, .14]),
    ("rough", "CASI ABORTAN LA LUNA", "LUNA", "/nodetech/apolo-1202/assets/media/hamilton-rostro.jpg", [.49, .34, .15]),
])
def test_brand_portrait_headline_fills_half_frame(design, title, accent, src, focus):
    async def check():
        server = shoot.serve(shoot.SANDBOX)
        kit = TOOLS.parent.relative_to(shoot.SANDBOX).as_posix()
        try:
            async with async_playwright() as playwright:
                browser = await playwright.chromium.launch(executable_path=shoot.CHROMIUM)
                page = await browser.new_page(viewport={"width": 720, "height": 1280})
                params = {"text": title, "accent": accent, "src": src, "focus": focus, "palette": "brand"}
                query = urllib.parse.urlencode({"d": design, "c": "common.tabloid", "p": json.dumps(params), "solo": "1", "paused": "1"})
                await page.goto(f"http://127.0.0.1:{server.server_port}/{kit}/showcase/stage.html?{query}")
                await page.wait_for_function("window.__promo && window.__tabloidFontReady")
                await page.evaluate("window.__tabloidFontReady")
                result = await page.evaluate("window.__tabloidLayout")
                boxes = [b for b in result["boxes"] if b["type"] != "accent"]
                rows = [b for b in boxes if b["type"] == "title"]
                assert " ".join(b["text"] for b in rows) == title
                height = (max(b["y"] + b["h"] for b in rows) - min(b["y"] for b in rows)) / 1280
                assert .48 <= height <= .60, (design, title, height)
                assert all(not intersects(a, b) for i, a in enumerate(boxes) for b in boxes[i + 1:])
                assert all(0 <= b["x"] and b["x"] + b["w"] <= 720 and
                           0 <= b["y"] and b["y"] + b["h"] <= 1280 for b in boxes)
                await browser.close()
        finally:
            server.shutdown()
            server.server_close()
    asyncio.run(check())
