#!/usr/bin/env python3
"""Generate Showcase posters explicitly, sequentially and without rendering video."""
from __future__ import annotations

import argparse
import asyncio
import io
import json
import math
import os
import sys
import tempfile
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from PIL import Image, ImageChops, ImageStat
from playwright.async_api import async_playwright
from src.adapters.showcase import posters
from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core.task_ownership import TaskLease
from src.presentation.api.routers.showcase import get_showcase_service, _styled_target
from scripts import atlas_preview as gpu_driver

MAP_ENGINES = {'nodehistory/_atlas', 'nodehistory/_mapas'}
THUMBNAIL_VERSIONS = {'V1', 'V2', 'V3'}


class GpuVerificationError(RuntimeError):
    """A driver mismatch aborts the batch instead of retrying every component."""


async def verify_capture_gpu(preview, mode: str) -> None:
    if mode == 'software':
        return  # Preserve compatibility with 2D previews and the existing launch.
    contexts = None
    try:
        contexts = await asyncio.wait_for(preview.evaluate(gpu_driver.GPU_INSPECT_JS), timeout=10)
        verified = gpu_driver.verify_gpu(mode, contexts)
    except Exception as exc:
        print('GPU: ' + json.dumps({'requested_mode': mode, 'contexts': contexts,
                                   'verification_failed': True}, ensure_ascii=False), flush=True)
        raise GpuVerificationError(str(exc) or type(exc).__name__) from exc
    print('GPU: ' + json.dumps({'requested_mode': mode, 'contexts': contexts, **verified},
                               ensure_ascii=False), flush=True)


def is_reusable_miniature(entry) -> bool:
    data = getattr(entry, 'data', None)
    return isinstance(data, dict) and data.get('thumbnail_version') in THUMBNAIL_VERSIONS


def capture_target(target: str, frame: str = 'middle') -> str:
    parts = urlsplit(target)
    if parts.scheme or parts.netloc or not parts.path.startswith('/api/v1/'):
        raise ValueError('La vista previa debe ser una ruta interna /api/v1/')
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.update(framePosition=frame, autoplay='0', loop='0')
    if '/preview/tactico/' in parts.path:
        query['formato'] = 'escritorio'
    query.pop('t', None)
    return urlunsplit(('', '', parts.path, urlencode(query), parts.fragment))


def has_visible_content(image: Image.Image) -> bool:
    # Full resolution keeps small but meaningful details, such as a missile trail.
    return max(ImageStat.Stat(image).stddev) >= 2.0


def component_visible_until(entry, target: str, allow_last_visible: bool) -> float | None:
    """Use the noticiero HUD's declared exit before it disappears over the globe."""
    if not allow_last_visible or '/resumen-geopolitico-demo/showcase' not in target:
        return None
    example = getattr(entry, 'example', None)
    value = example.get('out') if isinstance(example, dict) else None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        return None
    return float(value)


def _manifest_path(poster: Path) -> Path:
    return poster.parent / ".showcase-posters.json"


def _read_manifest(path: Path) -> dict[str, str]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    posters_map = payload.get("posters") if isinstance(payload, dict) else None
    if not isinstance(posters_map, dict):
        return {}
    return {
        str(name): str(signature)
        for name, signature in posters_map.items()
        if isinstance(name, str) and isinstance(signature, str)
    }


def _read_frames(path: Path) -> dict[str, str]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    frames = payload.get("frames") if isinstance(payload, dict) else None
    return {name: frame for name, frame in frames.items()
            if isinstance(name, str) and isinstance(frame, str)
            and frame in {'first', 'middle', 'last', 'last-visible'}} if isinstance(frames, dict) else {}


def _write_manifest(path: Path, posters_map: dict[str, str], frames: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, name = tempfile.mkstemp(prefix=".showcase-manifest-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump({"posters": posters_map, "frames": frames}, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def _save_webp(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, name = tempfile.mkstemp(prefix=".poster-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            image.convert("RGB").save(stream, format="WEBP", quality=78, method=4)
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def _recoverable_sources(cache: Path, design, entry, revision: str, target: str) -> list[Path]:
    return [
        posters.revision_scoped_poster_path(
            cache, design.id, revision, entry.id, "16x9", target, engine=design.engine_id
        ),
        posters.poster_path(cache, design.id, revision, entry.id, "16x9", target, hashed=True),
        posters.poster_path(cache, design.id, revision, entry.id, "16x9", target, legacy=True),
    ]


def _migrate(source: Path, target: Path) -> None:
    with Image.open(source) as source_image:
        _save_webp(source_image, target)


async def capture(browser, path: Path, target: str, port: int, frame_position: str = 'middle',
                  allow_last_visible: bool = False, context=None, gpu: str = 'software',
                  visible_until: float | None = None) -> str:
    page = await context.new_page() if context else await browser.new_page(viewport={'width': 640, 'height': 360}, device_scale_factor=1)
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
        await page.locator('iframe').evaluate('(f,url)=>f.src=url', f'http://127.0.0.1:{port}{capture_target(target, frame_position)}')
        frame = page.frame_locator('iframe')
        await frame.locator('body').wait_for(timeout=120000)
        child = await page.locator('iframe').element_handle()
        preview = await child.content_frame()
        cara_gallery = '/nodeactualidad/cara-a-cara/showcase.html' in target
        if cara_gallery:
            await preview.wait_for_function('''document.documentElement.dataset.ready === "true" || document.documentElement.dataset.ready === "error"''', timeout=120000)
            if await preview.evaluate('document.documentElement.dataset.ready === "error"'):
                raise RuntimeError(await preview.locator('#status').text_content() or 'La vista previa de Cara a Cara falló')
        else:
            await page.wait_for_function('''() => {
              const child = document.querySelector('iframe')?.contentWindow;
              const p = child?.__promo;
              return window.previewError || (p && Number.isFinite(p.total) && p.total > 0 && typeof p.seek === 'function') || !!child?.document.querySelector('#error:not([hidden])');
            }''', timeout=120000)
            if await page.evaluate('window.previewError === true'):
                raise RuntimeError('El componente no se pudo iniciar en la vista previa')
            if await preview.evaluate('!!document.querySelector("#error:not([hidden])")'):
                raise RuntimeError(await preview.locator('#error').text_content() or 'La vista previa falló')
        native_preview = '/_atlas/showcase/' in target or '/resumen-geopolitico-demo/showcase' in target
        if native_preview or '/_mapas/showcase/' in target:
            await page.wait_for_function('window.previewReady || window.previewError', timeout=120000)
            if await page.evaluate('window.previewError === true'):
                raise RuntimeError('El motor informó un error al preparar la vista previa')
        saved_frame = frame_position
        if not cara_gallery:
            selected = await asyncio.wait_for(preview.evaluate('''async ({position, visibleUntil}) => {
              if (window.__atlas?.ready) await window.__atlas.ready;
              const p = window.__promo;
              if (p.pause) p.pause();
              const last = Math.max(0, p.total - 1 / 30);
              const t = position === 'first' ? 0 : position === 'last' ?
                (Number.isFinite(visibleUntil) ? Math.min(last, Math.max(0, visibleUntil)) : last) : p.total / 2;
              await p.seek(t);
              if (p.pause) p.pause();
              return {time: t, last};
            }''', {'position': frame_position, 'visibleUntil': visible_until}), timeout=30)
            if frame_position == 'last' and visible_until is not None and selected['time'] < selected['last']:
                saved_frame = 'last-visible'
                print(f"AVISO: último fotograma antes de la salida del componente: {selected['time']:.2f}s", flush=True)
        await page.wait_for_timeout(700)
        missing = await preview.evaluate('() => window.__atlasPreview?.missing || []')
        serious = [item for item in missing if not str(item).startswith('timeout at ')]
        if serious:
            raise RuntimeError(f'Recursos de mapa ausentes: {str(serious)[:500]}')
        if missing:
            print(f'AVISO: el mapa alcanzó el límite de espera: {str(missing)[:300]}', flush=True)
            await preview.locator('#status').evaluate("el => { el.style.display = 'none'; }")
        await verify_capture_gpu(preview, gpu)
        png = await page.screenshot(type='png', timeout=90000)
        image = Image.open(io.BytesIO(png)).convert('RGB')
        if not has_visible_content(image):
            if cara_gallery:
                raise RuntimeError('La captura del canvas de Cara a Cara quedó vacía')
            if frame_position == 'last' and allow_last_visible:
                # Work backwards from the end; record the exception instead of
                # labelling an earlier frame as the exact last frame.
                final_image = image
                total = await preview.evaluate('() => window.__promo.total')
                moments = sorted({max(0, total - step) for step in
                                  (.1, .2, .35, .5, .75, 1, 1.5, 2, 3, 4, 5, 6)}, reverse=True)
                moments += [t for t in (.1, .05, 0) if t < total and t not in moments]
                for moment in moments:
                    await preview.evaluate('(t) => window.__promo.seek(t)', moment)
                    await page.wait_for_timeout(150)
                    image = Image.open(io.BytesIO(await page.screenshot(type='png', timeout=90000))).convert('RGB')
                    difference = ImageStat.Stat(ImageChops.difference(image, final_image)).mean
                    if has_visible_content(image) or max(difference) >= 12:
                        saved_frame = 'last-visible'
                        print(f'AVISO: último fotograma visible en {moment:.2f}s; el final estaba vacío', flush=True)
                        break
                else:
                    raise RuntimeError('No se encontró un fotograma visible')
            elif frame_position != 'middle':
                raise RuntimeError(f'El fotograma solicitado ({frame_position}) parece vacío')
            else:
                # Some short effects have disappeared at the midpoint.
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
        _save_webp(image, path)
        return saved_frame
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
    component_ids = set(args.component or [])
    if component_ids and not args.design:
        raise ValueError('--component requiere al menos un --design')

    if getattr(args, 'only_missing', False) and (args.force or component_ids):
        raise ValueError('--only-missing no se combina con --force ni --component')
    operations = []
    manifest_maps: dict[Path, dict[str, str]] = {}
    manifest_frames: dict[Path, dict[str, str]] = {}
    found_components: set[str] = set()
    not_capturable = 0
    for design in selected:
        styles = getattr(args, 'estilo', None) or [None]
        if getattr(args, 'all_styles', False):
            styles = [None, *[row['id'] for row in service.styles(design.id)['styles']]]
        for estilo in styles:
            for entry in service.catalog(design.id, estilo).entries:
                if component_ids and entry.id not in component_ids:
                    continue
                if entry.id in component_ids:
                    found_components.add(entry.id)
                if args.miniaturas and not is_reusable_miniature(entry):
                    continue
                if entry.preview_kind != 'iframe' or not entry.preview_url:
                    not_capturable += 1
                    continue
                target = _styled_target(service, design.id, entry.id, '16x9', estilo)
                revision = posters.source_revision(settings.templates_dir, layout.sandbox_dir, design.engine_id, target)
                signature = posters.poster_signature(design.revision, revision, target)
                path = posters.poster_path(layout.cache_dir, design.id, signature, entry.id, '16x9', target,
                                           engine=design.engine_id)
                manifest_path = _manifest_path(path)
                if manifest_path not in manifest_maps:
                    manifest_maps[manifest_path] = _read_manifest(manifest_path)
                    manifest_frames[manifest_path] = _read_frames(manifest_path)
                manifest = manifest_maps[manifest_path]
                # Relocating a design does not change an existing component image.
                # This opt-in mode deliberately ignores route/revision changes.
                if getattr(args, 'only_missing', False) and path.is_file():
                    with Image.open(path) as image:
                        image.verify()
                    continue
                current_signature = manifest.get(path.name)
                current_frame = manifest_frames[manifest_path].get(path.name, 'middle')
                acceptable_frames = {args.frame}
                if args.frame == 'last' and args.allow_last_visible:
                    acceptable_frames.add('last-visible')
                if not args.force and not component_ids and path.is_file() and current_signature == signature and current_frame in acceptable_frames:
                    continue

                sources = [] if args.force or component_ids or args.frame != 'middle' else _recoverable_sources(
                    layout.cache_dir, design, entry, design.revision + revision, target
                )
                source = next((candidate for candidate in sources if candidate.is_file()), None)
                action = 'recover' if source else 'capture'
                operations.append((action, design, entry, target, path, signature, manifest_path, source))

    missing_components = component_ids - found_components
    if missing_components:
        raise ValueError('Componentes no encontrados: ' + ', '.join(sorted(missing_components)))

    captures = sum(operation[0] == 'capture' for operation in operations)
    recoveries = len(operations) - captures
    print(f'Diseños: {len(selected)}; fotograma: {args.frame}; capturas nuevas: {captures}; recuperables: {recoveries}; '
          f'entradas sin vista iframe: {not_capturable}', flush=True)
    if args.limit:
        operations = operations[:args.limit]
    if not operations:
        return 0
    lease = TaskLease('showcase', 'poster-capture')
    if not lease.acquire():
        raise RuntimeError('Ya hay otra captura de Showcase en curso')
    failures = []
    completed_captures = 0
    completed_recoveries = 0
    gpu = getattr(args, 'gpu', 'software')
    driver = async_playwright() if gpu == 'software' else gpu_driver.driver_context(gpu)
    try:
        async with driver as playwright:
            browser = None
            capture_context = None
            if any(operation[0] == 'capture' for operation in operations):
                opts = {'headless': True}
                if gpu != 'software':
                    opts['args'] = gpu_driver.gpu_arguments(gpu)
                if settings.playwright_chromium_executable_path:
                    opts['executable_path'] = settings.playwright_chromium_executable_path
                browser = await playwright.chromium.launch(**opts)
                capture_context = await browser.new_context(viewport={"width": 640, "height": 360}, device_scale_factor=1)
            try:
                for index, (action, design, entry, target, path, signature, manifest_path, source) in enumerate(operations, 1):
                    try:
                        if action == 'recover':
                            _migrate(source, path)
                            saved_frame = args.frame
                            completed_recoveries += 1
                        else:
                            visible_until = component_visible_until(entry, target, args.allow_last_visible)
                            saved_frame = await capture(browser, path, target, args.port, args.frame, args.allow_last_visible, context=capture_context, gpu=gpu, visible_until=visible_until)
                            completed_captures += 1
                        manifest_maps[manifest_path][path.name] = signature
                        manifest_frames[manifest_path][path.name] = saved_frame
                        _write_manifest(manifest_path, manifest_maps[manifest_path], manifest_frames[manifest_path])
                        label = 'RECUPERADA' if action == 'recover' else 'CAPTURADA'
                        print(f'[{index}/{len(operations)}] {label} {design.id} / {entry.id} '
                              f'({path.stat().st_size // 1024} KiB)', flush=True)
                    except Exception as initial_error:
                        if isinstance(initial_error, GpuVerificationError):
                            raise
                        capture_error = initial_error
                        # Tactical galleries may have an outdated cached crop. Recompute it once.
                        if action == 'capture' and '/preview/tactico/' in target and 'layout=measure' not in target:
                            parts = urlsplit(target)
                            query = dict(parse_qsl(parts.query, keep_blank_values=True))
                            query['layout'] = 'measure'
                            retry_target = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
                            try:
                                print(f'[{index}/{len(operations)}] Recalculando encuadre {design.id} / {entry.id}', flush=True)
                                visible_until = component_visible_until(entry, retry_target, args.allow_last_visible)
                                saved_frame = await capture(browser, path, retry_target, args.port, args.frame, args.allow_last_visible, context=capture_context, gpu=gpu, visible_until=visible_until)
                                completed_captures += 1
                                manifest_maps[manifest_path][path.name] = signature
                                manifest_frames[manifest_path][path.name] = saved_frame
                                _write_manifest(manifest_path, manifest_maps[manifest_path], manifest_frames[manifest_path])
                                print(f'[{index}/{len(operations)}] OK {design.id} / {entry.id} '
                                      f'({path.stat().st_size // 1024} KiB)', flush=True)
                                continue
                            except Exception as retry_exc:
                                capture_error = retry_exc
                        failures.append((design.id, entry.id, str(capture_error)))
                        print(f'[{index}/{len(operations)}] ERROR {design.id} / {entry.id}: {capture_error}', flush=True)
            finally:
                if capture_context:
                    await capture_context.close()
                if browser:
                    await browser.close()
    finally:
        lease.release()
    print(f'Terminadas: capturas {completed_captures}; recuperadas {completed_recoveries}; '
          f'errores {len(failures)}', flush=True)
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--design', action='append', help='ID de diseño; repetible. Por defecto: motores de mapas.')
    parser.add_argument('--estilo', action='append', help='ID del estilo; repetible.')
    parser.add_argument('--all-styles', action='store_true', help='Preparar también todos los estilos declarados, secuencialmente.')
    parser.add_argument('--component', action='append', help='ID exacto del componente; requiere --design y reemplaza su captura.')
    parser.add_argument('--all', action='store_true', help='Todos los diseños (no solo mapas).')
    parser.add_argument('--miniaturas', action='store_true', help='Solo componentes de miniatura V1, V2 y V3.')
    parser.add_argument('--only-missing', action='store_true', help='Conservar las imágenes existentes; capturar solo las que faltan, sin invalidarlas por cambios de rutas.')
    parser.add_argument('--force', action='store_true', help='Regenerar imágenes existentes.')
    parser.add_argument('--frame', choices=('first', 'middle', 'last'), default='middle', help='Fotograma: primero, central o último (por defecto: middle).')
    parser.add_argument('--allow-last-visible', action='store_true', help='Si el fotograma final está vacío, usar el último instante visible y registrarlo como excepción.')
    parser.add_argument('--limit', type=int, default=0, help='Máximo de capturas en esta ejecución (0 = sin límite).')
    parser.add_argument('--port', type=int, default=8000, help='Puerto local de la API.')
    parser.add_argument('--gpu', choices=('software', 'intel-vulkan'), default='software',
                        help='software conserva el navegador actual; intel-vulkan exige Intel Vulkan en el contexto MapLibre real, sin fallback.')
    args = parser.parse_args()
    if args.limit < 0 or args.port < 1 or args.port > 65535:
        parser.error('Límite o puerto inválido')
    return asyncio.run(generate(args))


if __name__ == '__main__':
    raise SystemExit(main())
