"""Generate small, profile-scoped, disposable showcase posters on demand."""
from __future__ import annotations

import asyncio
import hashlib
import io
import json
import logging
import time
from urllib.parse import parse_qsl, parse_qs, urlencode, urlunsplit
import os
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image
from playwright.async_api import async_playwright

_running: dict[str, asyncio.Task] = {}
_failed: dict[str, str] = {}
_logger = logging.getLogger(__name__)
_source_cache: dict[tuple[str, str], tuple[float, str]] = {}
_gate = asyncio.Semaphore(1)


def _safe_segment(value: str) -> str:
    text = "".join(char if char.isalnum() or char in ".-_" else "-" for char in str(value)).strip(".-")
    if not text or text in {".", ".."}:
        return hashlib.sha256(str(value).encode()).hexdigest()[:16]
    return text[:120]


def poster_path(
    cache: Path,
    design: str,
    revision: str,
    entry: str,
    aspect: str,
    target: str,
    *,
    engine: str | None = None,
    legacy: bool = False,
    original: bool = False,
    hashed: bool = False,
) -> Path:
    """Return the permanent, readable location for a component poster."""
    if original or legacy or hashed:
        version = "poster-v1" if original else "poster-v2" if legacy else "poster-v3-middle"
        extension = ".jpg" if original or legacy else ".webp"
        key = json.dumps([version, design, revision, entry, aspect, target], ensure_ascii=False)
        return cache / "showcase-posters" / (hashlib.sha256(key.encode()).hexdigest() + extension)

    engine_name = _safe_segment((engine or design).rsplit("/", 1)[-1].lstrip("_"))
    design_name = _safe_segment(design)
    component_id = str(entry)
    if component_id.startswith(f"{engine_name}."):
        component_id = component_id[len(engine_name) + 1:]
    component_name = _safe_segment(component_id)
    style = parse_qs(urlsplit(target).query).get("estilo", [""])[0]
    variant = _safe_segment(style) if style else "default"
    # Keep parameter variants human-readable; this is not a revision identifier.
    params = parse_qs(urlsplit(target).query).get("p", [""])[0]
    if params:
        variant = f"{variant}-p-{_safe_segment(params)[:48]}"
    return (
        cache
        / "showcase-posters"
        / design_name
        / _safe_segment(aspect)
        / variant
        / f"{engine_name}.{design_name}.{component_name}.webp"
    )


def legacy_style_poster_path(
    cache: Path, design: str, revision: str, entry: str, aspect: str, target: str,
    *, engine: str | None = None,
) -> Path | None:
    """Find the former style-revision directory for the exact same style."""
    query = parse_qs(urlsplit(target).query)
    style = query.get("estilo", [""])[0]
    style_revision = query.get("styleRevision", [""])[0]
    if not style or not style_revision:
        return None
    stable = poster_path(cache, design, revision, entry, aspect, target, engine=engine)
    variant = f"{_safe_segment(style)}-{_safe_segment(style_revision)[:16]}"
    params = query.get("p", [""])[0]
    if params:
        variant = f"{variant}-p-{_safe_segment(params)[:48]}"
    return stable.parent.parent / variant / stable.name


def revision_scoped_poster_path(
    cache: Path,
    design: str,
    revision: str,
    entry: str,
    aspect: str,
    target: str,
    *,
    engine: str | None = None,
) -> Path:
    """Locate the previous readable layout so the generator can recover it."""
    engine_name = _safe_segment((engine or design).rsplit("/", 1)[-1].lstrip("_"))
    component_name = _safe_segment(entry)
    if not component_name.startswith(f"{engine_name}."):
        component_name = f"{engine_name}.{component_name}"
    style = parse_qs(urlsplit(target).query).get("estilo", [""])[0]
    variant = _safe_segment(style) if style else "default"
    style_revision = parse_qs(urlsplit(target).query).get("styleRevision", [""])[0]
    if style_revision:
        variant += "-" + _safe_segment(style_revision)[:16]
    params = parse_qs(urlsplit(target).query).get("p", [""])[0]
    if params:
        variant = f"{variant}-p{hashlib.sha256(params.encode()).hexdigest()[:12]}"
    return (
        cache
        / "showcase-posters"
        / _safe_segment(design)
        / _safe_segment(revision)
        / _safe_segment(aspect)
        / variant
        / f"{component_name}.webp"
    )


def poster_signature(design_revision: str, source: str, target: str) -> str:
    """Track style changes without placing revision codes in poster paths."""
    signature = f"{design_revision}:{source}"
    style_revision = parse_qs(urlsplit(target).query).get("styleRevision", [""])[0]
    return f"{signature}:style:{style_revision}" if style_revision else signature


def with_style(target: str, style: str | None) -> str:
    if not style:
        return target
    if len(style) > 80 or not all(c.isascii() and (c.isalnum() or c in "-_") for c in style):
        raise ValueError("Invalid style")
    parts = urlsplit(target)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["estilo"] = style
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def source_revision(templates: Path, sandbox: Path, engine: str, target: str) -> str:
    """Fingerprint renderer and project assets; periodically rechecked after edits."""
    key = (str(templates), f"{sandbox}:{engine}:{urlsplit(target).path}")
    cached = _source_cache.get(key)
    if cached and time.monotonic() - cached[0] < 30:
        return cached[1]
    roots = []
    engine_path = templates / ("_tools/explainer-kit" if engine == "explainer-kit" else f"sandbox/{engine}")
    if engine_path.resolve().is_relative_to(templates.resolve()):
        roots.append(engine_path)
    target_path = urlsplit(target).path
    if target_path.startswith('/api/v1/explainer/files/bundled/nodeatlas/atlas-en-movimiento/'):
        # La galería importa el motor central fuera de preview/tactico/.
        roots.append(templates / 'nodeatlas/atlas-en-movimiento/engine')
    shared_kit_prefix = "/api/v1/explainer/files/_tools/explainer-kit/"
    if engine != "explainer-kit" and target_path.startswith(shared_kit_prefix):
        shared_kit = templates / "_tools/explainer-kit"
        if shared_kit.resolve().is_relative_to(templates.resolve()):
            roots.append(shared_kit)
    for prefix, bases in (
        ("/api/v1/explainer/files/sandbox/", (sandbox, templates / "sandbox")),
        ("/api/v1/explainer/files/bundled/", (templates,)),
    ):
        if not target_path.startswith(prefix):
            continue
        from urllib.parse import unquote
        relative = Path(unquote(target_path[len(prefix):]))
        for base in bases:
            root = (base / relative).parent
            if root.resolve().is_relative_to(base.resolve()):
                roots.append(root)
    digest = hashlib.sha256()
    for root in roots:
        if not root.is_dir():
            continue
        for parent, dirs, names in os.walk(root, followlinks=False):
            dirs[:] = sorted(d for d in dirs if d not in {"cache", "node_modules", "work", ".git", "__pycache__"} and not (Path(parent) / d).is_symlink())
            for name in sorted(names):
                file = Path(parent) / name
                if file.is_symlink() or file.suffix.lower() not in {".js", ".mjs", ".css", ".html", ".json", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".ttf", ".woff2"}:
                    continue
                try:
                    stat = file.stat()
                    digest.update(f"{root.name}/{file.relative_to(root)}:{stat.st_mtime_ns}:{stat.st_size}\n".encode())
                except OSError:
                    continue
    value = digest.hexdigest()[:20]
    _source_cache[key] = (time.monotonic(), value)
    return value


def enqueue(path: Path, target: str, aspect: str, port: int, executable: str | None, *, retry: bool = False) -> None:
    key = str(path)
    if retry:
        _failed.pop(key, None)
    if key in _running or key in _failed or len(_running) >= 24:
        return
    async def run():
        for attempt in range(2):
            try:
                await _capture(path, target, aspect, port, executable)
                return
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                _logger.warning("showcase poster capture failed (%s/2): %s: %s", attempt + 1, type(exc).__name__, str(exc)[:300])
                if attempt == 0:
                    await asyncio.sleep(5)
                else:
                    _failed[key] = type(exc).__name__
    task = asyncio.create_task(run())
    _running[key] = task
    task.add_done_callback(lambda done: _running.pop(key, None))


async def _capture(path: Path, target: str, aspect: str, port: int, executable: str | None) -> None:
    if not target.startswith("/api/v1/") or target.startswith("//"):
        raise ValueError("Invalid preview target")
    width, height = ((640, 360) if aspect == "16x9" else (360, 640))
    # A profile-scoped lock also limits captures across multiple API processes.
    from src.core.task_ownership import TaskLease
    lease = TaskLease("showcase", "poster-capture")
    async with _gate:
        while not lease.acquire():
            await asyncio.sleep(2)
        try:
            if not path.is_file():
                await _capture_locked(path, target, width, height, port, executable)
        finally:
            lease.release()


async def _capture_locked(path: Path, target: str, width: int, height: int, port: int, executable: str | None) -> None:
    async with async_playwright() as playwright:
        options = {"headless": True}
        if executable:
            options["executable_path"] = executable
        browser = await playwright.chromium.launch(**options)
        try:
            page = await browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
            async def restrict(route):
                url = urlsplit(route.request.url)
                if url.scheme == "http" and url.hostname == "127.0.0.1" and url.port == port and url.path.startswith("/api/v1/"):
                    await route.continue_()
                else:
                    await route.abort()
            await page.route("**/*", restrict)
            # Some engines send readiness only to their own origin. Establish
            # that origin before building the isolated parent document.
            await page.goto(f"http://127.0.0.1:{port}/api/v1/__showcase_poster_origin__", wait_until="domcontentloaded")
            await page.set_content("<style>html,body,iframe{margin:0;border:0;width:100%;height:100%;overflow:hidden}</style><iframe></iframe><script>window.addEventListener('message',e=>{if(e.data?.type==='nexa-template-ready'){e.source.postMessage({type:'nexa-template-volume',muted:true,volume:0},'*');e.source.postMessage({type:'nexa-template-seek',time:0.35},'*');e.source.postMessage({type:'nexa-template-playback',playing:true},'*')} if(['nexa-template-ready','nexa-animation-ready'].includes(e.data?.type))window.previewReady=true})</script>")
            await page.locator("iframe").evaluate("(frame, url) => frame.src = url", f"http://127.0.0.1:{port}{target}")
            await page.wait_for_function("window.previewReady === true", timeout=120000)
            await page.wait_for_timeout(500)
            image = Image.open(io.BytesIO(await page.screenshot(type="png", timeout=90000))).convert("RGB")
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            fd, name = tempfile.mkstemp(prefix=".poster-", dir=path.parent)
            try:
                with os.fdopen(fd, "wb") as stream:
                    image.save(stream, format="WEBP", quality=78, method=4)
                os.replace(name, path)
            finally:
                Path(name).unlink(missing_ok=True)
        finally:
            await browser.close()


def status(path: Path) -> str:
    if path.is_file():
        return "ready"
    if str(path) in _failed:
        return "failed"
    return "pending"


async def warm_all(service_factory, settings, styles_for_design=None):
    """Generate desktop posters sequentially in the background, isolated by profile."""
    from src.config.profile_layout import layout_for_settings
    await asyncio.sleep(15)
    try:
        service = service_factory()
        layout = layout_for_settings(settings)
        designs = (await asyncio.to_thread(service.list_designs)).designs
        for design in designs:
            try:
                catalog = await asyncio.to_thread(service.catalog, design.id)
            except Exception:
                _logger.exception("showcase catalog unavailable for %s", design.id)
                continue
            styles = [None]
            if styles_for_design:
                try:
                    data = await asyncio.to_thread(styles_for_design, design.id)
                    styles += [s["id"] for s in data.get("styles", []) if isinstance(s.get("id"), str)]
                except Exception:
                    _logger.exception("showcase styles could not be enumerated for %s", design.id)
            for entry in catalog.entries:
                if entry.preview_kind != "iframe" or not entry.preview_url:
                    continue
                for style in styles:
                    try:
                        target = with_style(await asyncio.to_thread(service.preview, design.id, entry.id, "16x9"), style)
                        source = await asyncio.to_thread(source_revision, settings.templates_dir, layout.sandbox_dir, design.engine_id, target)
                        path = poster_path(layout.cache_dir, design.id, design.revision + source, entry.id, "16x9", target,
                                           engine=design.engine_id)
                        if not path.is_file():
                            while len(_running) >= 24:
                                await asyncio.sleep(5)
                            enqueue(path, target, "16x9", 8000, settings.playwright_chromium_executable_path)
                            task = _running.get(str(path))
                            if task:
                                await asyncio.shield(task)
                                await asyncio.sleep(2)
                    except asyncio.CancelledError:
                        raise
                    except Exception:
                        _logger.exception("showcase warmup failed for %s / %s", design.id, entry.id)
    except asyncio.CancelledError:
        raise
    except Exception:
        _logger.exception("showcase warmup stopped")
