#!/usr/bin/env python3
"""Generate Showcase posters explicitly, sequentially and without rendering video."""
from __future__ import annotations

import argparse
import asyncio
import io
import os
import sys
import tempfile
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from PIL import Image, ImageStat
from playwright.async_api import async_playwright
from src.adapters.showcase import posters
from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core.task_ownership import TaskLease
from src.presentation.api.routers.showcase import get_showcase_service

MAP_ENGINES = {'nodehistory/_atlas', 'nodehistory/_mapas'}


def capture_target(target: str) -> str:
    parts = urlsplit(target)
    if parts.scheme or parts.netloc or not parts.path.startswith('/api/v1/'):
        raise ValueError('La vista previa debe ser una ruta interna /api/v1/')
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.update(framePosition='middle', autoplay='0', loop='0')
    if '/preview/tactico/' in parts.path:
        query['formato'] = 'escritorio'
    query.pop('t', None)
    return urlunsplit(('', '', parts.path, urlencode(query), parts.fragment))


def has_visible_content(image: Image.Image) -> bool:
    # Full resolution keeps small but meaningful details, such as a missile trail.
    return max(ImageStat.Stat(image).stddev) >= 2.0


async def capture(browser, path: Path, target: str, port: int) -> None:
    page = await browser.new_page(viewport={'width': 640, 'height': 360}, device_scale_factor=1)
    try:
        async def restrict(route):
            u = urlsplit(route.request.url)
            if u.scheme == 'http' and u.hostname == '127.0.0.1' and u.port == port and u.path.startswith('/api/v1/'):
                await route.continue_()
            else:
                await route.abort()
        await page.route('**/*', restrict)
        await page.goto(f'http://127.0.0.1:{port}/api/v1/__showcase_poster_origin__', wait_until='domcontentloaded')
        await page.set_content("<style>html,body,iframe{margin:0;border:0;width:100%;height:100%;overflow:hidden}</style><iframe></iframe><script>window.addEventListener('message',e=>{if(e.data?.type==='nexa-animation-ready') window.previewReady=true; if(e.data?.type==='nexa-animation-error') window.previewError=true})</script>")
        await page.locator('iframe').evaluate('(f,url)=>f.src=url', f'http://127.0.0.1:{port}{capture_target(target)}')
        frame = page.frame_locator('iframe')
        await frame.locator('body').wait_for(timeout=120000)
        child = await page.locator('iframe').element_handle()
        preview = await child.content_frame()
        await preview.wait_for_function('''(window.__promo && Number.isFinite(window.__promo.total) && window.__promo.total > 0 && typeof window.__promo.seek === "function") || !!document.querySelector("#error:not([hidden])")''', timeout=120000)
        if await preview.evaluate('!!document.querySelector("#error:not([hidden])")'):
            raise RuntimeError(await preview.locator('#error').text_content() or 'La vista previa falló')
        native_middle = '/_atlas/showcase/' in target or '/resumen-geopolitico-demo/showcase' in target
        if native_middle or '/_mapas/showcase/' in target:
            await page.wait_for_function('window.previewReady || window.previewError', timeout=120000)
            if await page.evaluate('window.previewError === true'):
                raise RuntimeError('El motor informó un error al preparar la vista previa')
        if not native_middle:
            await preview.evaluate('''async () => {
              if (window.__atlas?.ready) await window.__atlas.ready;
              const p = window.__promo;
              if (p.pause) p.pause();
              await p.seek(p.total / 2);
              if (p.pause) p.pause();
            }''')
        await page.wait_for_timeout(700)
        missing = await preview.evaluate('() => window.__atlasPreview?.missing || []')
        serious = [item for item in missing if not str(item).startswith('timeout at ')]
        if serious:
            raise RuntimeError(f'Recursos de mapa ausentes: {str(serious)[:500]}')
        if missing:
            print(f'AVISO: el mapa alcanzó el límite de espera: {str(missing)[:300]}', flush=True)
            await preview.locator('#status').evaluate("el => { el.style.display = 'none'; }")
        png = await page.screenshot(type='png', timeout=90000)
        image = Image.open(io.BytesIO(png)).convert('RGB')
        if not has_visible_content(image):
            # Some short effects have disappeared at the midpoint. Use the engine's
            # strongest frame when available, then nearby positions as a fallback.
            candidates = await preview.evaluate('''() => {
              const total = window.__promo.total;
              const peak = window.__animationPreview?.peakTime;
              return [peak, total * .4, total * .6, total * .25, total * .75]
                .filter(t => Number.isFinite(t) && t >= 0 && t < total);
            }''')
            for moment in candidates:
                await preview.evaluate('(t) => window.__promo.seek(t)', moment)
                await page.wait_for_timeout(150)
                image = Image.open(io.BytesIO(await page.screenshot(type='png', timeout=90000))).convert('RGB')
                if has_visible_content(image):
                    print(f'AVISO: fotograma alternativo en {moment:.2f}s; el central estaba vacío', flush=True)
                    break
            else:
                raise RuntimeError('La captura central y los fotogramas alternativos parecen vacíos')
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd, name = tempfile.mkstemp(prefix='.poster-', dir=path.parent)
        try:
            with os.fdopen(fd, 'wb') as stream:
                image.save(stream, format='WEBP', quality=78, method=4)
            os.replace(name, path)
        finally:
            Path(name).unlink(missing_ok=True)
    finally:
        await page.close()


async def generate(args) -> int:
    service = get_showcase_service()
    layout = layout_for_settings(settings)
    designs = service.list_designs().designs
    if args.design:
        selected = [d for d in designs if d.id in args.design]
        missing = set(args.design) - {d.id for d in selected}
        if missing:
            raise ValueError('Diseños no encontrados: ' + ', '.join(sorted(missing)))
    elif args.all:
        selected = designs
    else:
        selected = [d for d in designs if d.engine_id in MAP_ENGINES]
    jobs = []
    for design in selected:
        for entry in service.catalog(design.id).entries:
            if entry.preview_kind != 'iframe' or not entry.preview_url:
                continue
            target = service.preview(design.id, entry.id, '16x9')
            revision = posters.source_revision(settings.templates_dir, layout.sandbox_dir, design.engine_id, target)
            path = posters.poster_path(layout.cache_dir, design.id, design.revision + revision, entry.id, '16x9', target)
            if args.force or not path.is_file():
                jobs.append((design.id, entry.id, target, path))
    print(f'Diseños: {len(selected)}; miniaturas pendientes: {len(jobs)}', flush=True)
    if args.limit:
        jobs = jobs[:args.limit]
    if not jobs:
        return 0
    lease = TaskLease('showcase', 'poster-capture')
    if not lease.acquire():
        raise RuntimeError('Ya hay otra captura de Showcase en curso')
    failures = []
    try:
        async with async_playwright() as playwright:
            opts = {'headless': True}
            if settings.playwright_chromium_executable_path:
                opts['executable_path'] = settings.playwright_chromium_executable_path
            browser = await playwright.chromium.launch(**opts)
            try:
                for index, (design, entry, target, path) in enumerate(jobs, 1):
                    try:
                        await capture(browser, path, target, args.port)
                        print(f'[{index}/{len(jobs)}] OK {design} / {entry} ({path.stat().st_size // 1024} KiB)', flush=True)
                    except Exception as exc:
                        # Tactical galleries may have an outdated cached crop. Recompute it once.
                        if '/preview/tactico/' in target and 'layout=measure' not in target:
                            parts = urlsplit(target)
                            query = dict(parse_qsl(parts.query, keep_blank_values=True))
                            query['layout'] = 'measure'
                            retry_target = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
                            try:
                                print(f'[{index}/{len(jobs)}] Recalculando encuadre {design} / {entry}', flush=True)
                                await capture(browser, path, retry_target, args.port)
                                print(f'[{index}/{len(jobs)}] OK {design} / {entry} ({path.stat().st_size // 1024} KiB)', flush=True)
                                continue
                            except Exception as retry_exc:
                                exc = retry_exc
                        failures.append((design, entry, str(exc)))
                        print(f'[{index}/{len(jobs)}] ERROR {design} / {entry}: {exc}', flush=True)
            finally:
                await browser.close()
    finally:
        lease.release()
    print(f'Terminadas: {len(jobs)-len(failures)}; errores: {len(failures)}', flush=True)
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--design', action='append', help='ID de diseño; repetible. Por defecto: motores de mapas.')
    parser.add_argument('--all', action='store_true', help='Todos los diseños (no solo mapas).')
    parser.add_argument('--force', action='store_true', help='Regenerar imágenes existentes.')
    parser.add_argument('--limit', type=int, default=0, help='Máximo de capturas en esta ejecución (0 = sin límite).')
    parser.add_argument('--port', type=int, default=8000, help='Puerto local de la API.')
    args = parser.parse_args()
    if args.limit < 0 or args.port < 1 or args.port > 65535:
        parser.error('Límite o puerto inválido')
    return asyncio.run(generate(args))


if __name__ == '__main__':
    raise SystemExit(main())
