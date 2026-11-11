"""Captura A/B para documentación; no graba videos ni modifica proyectos del perfil.

Desde nexa-brief-server: PYTHONPATH=. .venv/bin/python src/templates/nodemotion/tools/preview_thumbnails.py [template-id]
"""
from __future__ import annotations

import asyncio
import json
import sys
import tempfile
from pathlib import Path
from io import BytesIO
from PIL import Image

from playwright.async_api import async_playwright

from src.core.draft_details import DraftDetails
from src.core.draft_thumbnails import _active_config, preview_manifest, RENDERER_PATH
from src.core.draft_thumbnail_assets import embedded_assets
from src.core.job import Job, JobInput, JobArtifacts

ROOT = Path(__file__).resolve().parents[1]


async def main() -> None:
    output = ROOT / "docs/previews"
    output.mkdir(parents=True, exist_ok=True)
    measurements = []
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        try:
            page = await browser.new_page(viewport={"width": 1280, "height": 360}, device_scale_factor=1)
            await page.set_content("<body style='margin:0;display:flex;background:#000'><div id='A' style='width:640px;height:360px'></div><div id='B' style='width:640px;height:360px'></div></body>")
            await page.add_script_tag(path=str(RENDERER_PATH))
            with tempfile.TemporaryDirectory(prefix="nodemotion-design-") as temporary:
                for template in sorted(ROOT.glob("*/*/index.html")):
                    tid = template.parent.name
                    chosen = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
                    if chosen and tid not in chosen:
                        continue
                    config_path = template.parent / "assets/config.json"
                    config = _active_config(json.loads(config_path.read_text()))
                    lyric_path = template.parent / str(config.get("lyricsUrl", "assets/lyrics.json"))
                    lyrics = json.loads(lyric_path.read_text()) if lyric_path.is_file() else {}
                    song = str(config.get("intro", {}).get("title") or config.get("track") or "Siente la música").replace("\n", " ")
                    assets_dir = Path(temporary) / tid
                    assets_dir.mkdir()
                    job = Job(input=JobInput(category_name=tid), artifacts=JobArtifacts(output_dir=template.parent, assets_dir=assets_dir, html_path=template, config_json_path=config_path, lyrics_json=lyrics))
                    manifest = preview_manifest(job, DraftDetails(song_name=song))
                    assets = {option: await embedded_assets(job, manifest["options"][option]["design"]) for option in ("A", "B")}
                    measured = await page.evaluate('''async ({manifest, assets}) => {
                      const renderer = globalThis.NexaDraftThumbnailRenderer;
                      const result = [];
                      for (const option of ['A','B']) {
                        const svg = await renderer.renderSvgAsync(manifest, option, 640, 360, {assets: assets[option]});
                        document.getElementById(option).innerHTML = svg;
                        const text = document.querySelector(`#${option} svg > text`);
                        const box = text.getBBox();
                        result.push({option, x:box.x, y:box.y, right:box.x+box.width, bottom:box.y+box.height, lines:text.querySelectorAll('tspan').length});
                      }
                      await document.fonts.ready;
                      await Promise.all([...document.querySelectorAll('image')].map(el => new Promise((resolve, reject) => { const img = new Image(); img.onload=resolve;img.onerror=reject;img.src=el.getAttribute('href'); })));
                      return result;
                    }''', {"manifest": manifest, "assets": assets})
                    await page.screenshot(path=str(output / f"{tid}.jpg"), type="jpeg", quality=92)
                    if "--posters" in sys.argv:
                        await page.set_viewport_size({"width": 1280, "height": 720})
                        await page.evaluate("""async ({manifest, assets}) => {
                          const a=document.getElementById('A'), b=document.getElementById('B');
                          a.style.width='1280px'; a.style.height='720px'; b.style.display='none';
                          a.innerHTML=await globalThis.NexaDraftThumbnailRenderer.renderSvgAsync(manifest,'A',1280,720,{assets:assets.A});
                        }""", {"manifest":manifest,"assets":assets})
                        png=await page.screenshot(type="png")
                        with Image.open(BytesIO(png)) as frame:
                            frame.convert("RGB").resize((960,540), Image.Resampling.LANCZOS).save(template.parent / "assets/card-poster.webp", "WEBP", quality=90)
                        await page.set_viewport_size({"width":1280,"height":360})
                        await page.evaluate("""() => {const a=document.getElementById('A'),b=document.getElementById('B');a.style.width='640px';a.style.height='360px';b.style.display='block';}""")
                    measurements.append({"template": tid, "bounds": measured})
                    print(tid, flush=True)
        finally:
            await browser.close()
    failures = [item for item in measurements if any(b["x"] < 45 or b["right"] > 1235 or b["y"] < 45 or b["bottom"] > 645 or b["lines"] > (2 if b["option"] == "A" else 4) for b in item["bounds"])]
    if failures:
        raise RuntimeError(f"Texto fuera de la zona segura: {failures}")
    print(f"Verificadas {len(measurements)} parejas A/B; sin texto fuera de la zona segura.")


if __name__ == "__main__":
    asyncio.run(main())
