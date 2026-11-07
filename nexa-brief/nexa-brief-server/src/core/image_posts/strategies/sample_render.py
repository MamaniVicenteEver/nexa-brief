"""Render de muestras: categoría, id de video, carpeta y estrategia opcional."""
import argparse
import asyncio
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from src.adapters.data.publication_factory import build_publication_components
from src.core.image_posts.service import _cached_media
from src.core.image_posts.render import render_async
from src.core.image_posts import strategies

async def main(args):
    out = args.out
    out.mkdir(parents=True, exist_ok=True)
    os.environ['IMAGE_QC_DEBUG_DIR'] = str(out)
    components = build_publication_components()
    service = components.service
    style = service._style(args.category)
    for strategy in strategies.list_strategies():
        selected = [args.strategy] if args.strategy else (args.legacy_strategies or ["amarillista"])
        if selected and strategy.id not in selected:
            continue
        built = await service._build_plan_from_source(category_id=args.category, style_id=style.style_id,
            source_video_id=args.video, template_id=strategy.template_id, strategy_id=strategy.id, level=args.level)
        raw = built.plan.to_dict()
        prefix = strategy.id + ('-' + args.level if strategy.id == 'amarillista' else '')
        (out / f'{prefix}.plan.json').write_text(json.dumps(raw, ensure_ascii=False, indent=2))
        manifest = await render_async(raw, style, _cached_media(built.plan, components.image_cache))
        for i, asset in enumerate(manifest.assets, 1):
            (out / f'{prefix}-{i}.jpg').write_bytes(asset.content)
            print(prefix, i, asset.width, asset.height, asset.qc)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('category'); parser.add_argument('video'); parser.add_argument('out', type=Path)
    parser.add_argument('legacy_strategies', nargs='*', help='IDs de estrategia (forma anterior)')
    parser.add_argument('--strategy'); parser.add_argument('--level', choices=['negro', 'alto', 'medio', 'basico'], default='alto')
    args = parser.parse_args()
    asyncio.run(main(args))
