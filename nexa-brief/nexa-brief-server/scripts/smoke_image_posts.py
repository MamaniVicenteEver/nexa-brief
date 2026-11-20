"""Ejecutar en el host: dos posts reales de prueba, sin entregas ni publicación."""
from __future__ import annotations

import argparse
import asyncio
from pathlib import Path
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.adapters.data.publication_factory import build_publication_components
from src.core.explainer.catalog import list_videos


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('videos', nargs='*', help='Exactamente dos IDs de videos con material verificado')
    parser.add_argument('--list-sources', action='store_true', help='Solo listar fuentes; no usa modelos')
    parser.add_argument('--level', choices=['basico', 'medio', 'alto', 'negro'], default='alto')
    parser.add_argument('--run-id', default=str(uuid.uuid4()), help='Reutilizar el mismo UUID evita repetir el gasto al reintentar')
    args = parser.parse_args()
    components = build_publication_components()
    if args.list_sources:
        for video in list_videos():
            if components.resources.load_verified_material(video.video_id, 'node_tech'):
                print(video.video_id)
        return 0
    if len(args.videos) != 2: parser.error('Indica dos IDs, o usa --list-sources')
    run_id = uuid.UUID(args.run_id)
    failed = False
    print(f'Corrida: {run_id}. Dos posts locales, sin entregas.', flush=True)
    for number, video in enumerate(args.videos, 1):
        key = str(uuid.uuid5(run_id, f'{number}:{video}:{args.level}'))
        try:
            style = components.resources.get_style('node_tech')
            plan, post = await components.service.create_plan({
                'category_id': 'node_tech', 'source_video_id': video, 'style_id': style.style_id,
                'template_id': 'five_slides', 'strategy_id': 'amarillista', 'narrative': 'hilo', 'level': args.level,
            }, key)
            if not post.technical.slides:
                post = await components.service.render_plan(plan.plan_id)
            print(f'{number}/2 · {post.post_id} · {post.status.value} · {components.service.trace_folder(post) / "trace.json"}', flush=True)
        except Exception as exc:
            failed = True
            print(f'{number}/2 · FALLÓ {video}: {exc}. Revisa el post fallido y su trace.json.', flush=True)
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
