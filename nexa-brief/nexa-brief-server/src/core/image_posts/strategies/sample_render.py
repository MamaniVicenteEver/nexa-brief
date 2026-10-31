"""Renderiza muestras de las 2 estrategias para revisión visual. Uso: sample.py <cat> <video> <out>"""
import asyncio
import json
import os
import pathlib
import sys

sys.path.insert(0, ".")
from src.adapters.data.publication_factory import build_publication_components
from src.core.image_posts.service import _cached_media
from src.core.image_posts.render import render_async

async def main(cat, video, out):
    out.mkdir(parents=True, exist_ok=True)
    os.environ["IMAGE_QC_DEBUG_DIR"] = str(out)
    components = build_publication_components()
    service = components.service
    style = service._style(cat)
    from src.core.image_posts import strategies
    only = sys.argv[4:]   # opcional: ids de estrategia a probar
    for strategy in strategies.list_strategies():
        if only and strategy.id not in only:
            continue
        template = strategy.id
        try:
            built = await service._build_plan_from_source(
                category_id=cat, style_id=style.style_id, source_video_id=video,
                template_id=strategy.template_id, strategy_id=strategy.id,
            )
        except Exception as exc:
            print(strategy.id, "PLAN FALLÓ:", str(exc)[-300:])
            continue
        print(strategy.id, "textos:", built.copy_sources)
        raw = built.plan.to_dict() if hasattr(built.plan, "to_dict") else built.plan
        (out / f"{template}.plan.json").write_text(json.dumps(raw, ensure_ascii=False, indent=1))
        for sl in raw["slides"]:
            print("  ", sl["layout"], " | ".join(t["role"] + "=" + t["value"].replace(chr(10), " / ") for t in sl["texts"]))
        try:
            manifest = await render_async(raw, style, _cached_media(built.plan, components.image_cache))
        except Exception as exc:
            print("RENDER FALLÓ:", str(exc)[-300:])
            continue
        for i, asset in enumerate(manifest.assets, 1):
            (out / f"{template}-{i}.jpg").write_bytes(asset.content)
        print(template, "OK", [a.bytes for a in manifest.assets])

asyncio.run(main(sys.argv[1], sys.argv[2], pathlib.Path(sys.argv[3])))
