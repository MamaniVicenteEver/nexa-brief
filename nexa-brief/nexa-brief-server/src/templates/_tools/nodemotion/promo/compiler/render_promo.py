#!/usr/bin/env python3
"""Render CUADRO A CUADRO de una plantilla promo-* → mp4 fluido con audio.

Por qué: grabar en tiempo real (Playwright) depende de cuántos fps logre el
navegador; en Chrome headless sin GPU, componer video + texto + grano a 1080p
da 10–40 fps según la escena → el video grabado sale entrecortado. Estas
plantillas son deterministas y buscables (window.__promo.seek(t) posiciona
todas las animaciones y espera a que cada <video> llegue a su cuadro), así que
se captura cada instante exacto y ffmpeg arma el mp4 a fps constantes. Tarda
más que tiempo real, pero el resultado no depende de la potencia del equipo.

Uso (rutas de página relativas a src/templates/):
  python3 src/templates/_tools/nodemotion/promo/compiler/render_promo.py nodemotion/commercial/promo-trendy/index.html out.mp4
  python3 src/templates/_tools/nodemotion/promo/compiler/render_promo.py nodemotion/lyrics/lyrics-grunge/index.html out.mp4 [--fps 30] [--size 1920x1080] [--from 0] [--to END] [--workers 3]
Requiere: playwright (chromium) y ffmpeg. Levanta su propio servidor HTTP.
"""
import argparse
import asyncio
import functools
import http.server
import json
import pathlib
import threading
import os
import sys
import signal
import re
from urllib.parse import urlencode

# En Docker se usa el Chromium del sistema (PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH);
# fuera de Docker, el que instala `playwright install chromium`.
CHROMIUM = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None

HERE = pathlib.Path(__file__).resolve().parents[4]   # src/templates/

sys.path.insert(0, str(HERE / "_tools"))
from http_media import MediaRequestHandler as _Quiet, ProfileContentMixin  # noqa: E402
sys.path.insert(0, str(HERE.parent.parent))
from src.adapters.recorder.infrastructure.render_workspace import render_workspace  # noqa: E402
from src.config.content_paths import resolve_content_key  # noqa: E402


class ContentHandler(ProfileContentMixin, _Quiet):
    def __init__(self, *args, config_override=None, **kwargs):
        self.config_override = config_override
        super().__init__(*args, **kwargs)

    def translate_path(self, path):
        translated = super().translate_path(path)
        if self.config_override is not None:
            original, native = self.config_override
            if pathlib.Path(translated) == original:
                return str(native)
        return translated

def serve(root, config_override=None):
    handler = functools.partial(ContentHandler, directory=str(root), config_override=config_override)
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    httpd.worker_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    httpd.worker_thread.start()
    return httpd


def render_inputs(page_key, edition_arg=None):
    """Bind the encoder and browser to one profile-owned, immutable revision."""
    page = pathlib.Path(page_key)
    folder = resolve_content_key(page_key).parent
    cands = [folder / "assets" / (page.stem + ".config.json"), folder / "assets" / "config.json"]
    original = next(c for c in cands if c.is_file())
    config_file, native = original, None
    if edition_arg:
        edition_file = pathlib.Path(edition_arg).absolute()
        try:
            relative = edition_file.relative_to(folder)
        except ValueError as exc:
            raise ValueError("La edición pertenece a otra producción") from exc
        parts = relative.parts
        if (len(parts) != 5 or parts[0] != "languages" or parts[2] != "revisions"
                or not re.fullmatch(r"rev-\d{3,}", parts[3]) or parts[4] != "edition.json"):
            raise ValueError("La ruta de revisión no es válida")
        current = folder
        for part in parts:
            current = current / part
            if current.is_symlink():
                raise ValueError("La revisión no admite enlaces simbólicos")
        from src.core.markets import normalize_locale
        locale = normalize_locale(parts[1])
        if locale != parts[1] or locale == "es-419":
            raise ValueError("El idioma de la revisión no es válido")
        data = json.loads(edition_file.read_text(encoding="utf-8"))
        prefix = "/".join(parts[:4])
        if (data.get("schema") != "nexa.edition/1" or data.get("locale") != locale
                or data.get("revision") != parts[3]
                or data.get("paths", {}).get("config") != f"{prefix}/config.json"
                or data.get("paths", {}).get("audio_with_outro") != f"{prefix}/song-with-outro.mp3"):
            raise ValueError("La edición no coincide con su revisión")
        revision = edition_file.parent
        config_file = revision / "config.publication.json"
        if not config_file.exists():
            config_file = revision / "config.json"
        audio = revision / "song-with-outro.mp3"
        for path in (config_file, audio):
            if path.is_symlink() or not path.is_file():
                raise ValueError("Faltan archivos locales de la revisión")
        native = {"locale": locale, "revision": parts[3], "config_override": (original, config_file)}
    value = json.loads(config_file.read_text(encoding="utf-8"))
    cfg = value["configs"][0] if "configs" in value else value
    if native is None:
        audio = folder / cfg["audio"]["src"]
    elif (cfg.get("locale") != native["locale"]
          or cfg.get("audio", {}).get("src") != f"{prefix}/song-with-outro.mp3"):
        raise ValueError("El config o su audio no corresponde al idioma seleccionado")
    return folder, cfg, audio, native

async def worker(b, url, W, H, frames, fps, t0, outdir, tag, progress, progress_lock, total_frames):
    pg = await b.new_page(viewport={"width": W, "height": H})
    try:
        await pg.goto(url)
        await pg.wait_for_function("window.__promo && window.__promo.scenes().length > 0", timeout=60000)
        for n, i in enumerate(frames):
            t = t0 + i / fps
            await pg.evaluate(f"window.__promo.seek({t:.5f})")
            (outdir / f"{i:06d}.jpg").write_bytes(await pg.screenshot(type="jpeg", quality=92))
            async with progress_lock:
                progress["done"] += 1
                now = asyncio.get_running_loop().time()
                if now - progress["last_emit"] >= 1 or progress["done"] == total_frames:
                    print(f"@@progress {progress['done']} {total_frames}", flush=True)
                    progress["last_emit"] = now
            if n % (fps * 3) == 0:
                print(f"  [{tag}] {t:6.2f}s", flush=True)
    finally:
        await pg.close()

async def render(args):
    from playwright.async_api import async_playwright
    W, H = map(int, args.size.lower().split("x"))
    output = pathlib.Path(args.out).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    _folder, _cfg, audio, native = render_inputs(args.page, getattr(args, "edition", None))
    httpd = serve(HERE, config_override=native["config_override"] if native else None)
    try:
        query = {"t": 0, "headless": 1}
        if native:
            query.update(edition=native["locale"], revision=native["revision"])
        url = f"http://127.0.0.1:{httpd.server_address[1]}/{args.page}?{urlencode(query)}"
        with render_workspace(output.parent, "promo") as outdir:
            async with async_playwright() as p:
                browser = await p.chromium.launch(executable_path=CHROMIUM)
                tasks = []
                try:
                    probe = await browser.new_page()
                    try:
                        await probe.goto(url)
                        await probe.wait_for_function("window.__promo && window.__promo.scenes().length > 0", timeout=60000)
                        end = await probe.evaluate("(() => { const s = window.__promo.scenes(); return s[s.length - 1].t1; })()")
                    finally:
                        await probe.close()
                    t_end = args.to if args.to is not None else end
                    n = int(round((t_end - args.frm) * args.fps))
                    if n <= 0:
                        raise ValueError("El render debe contener al menos un cuadro")
                    k = max(1, args.workers)
                    progress = {"done": 0, "last_emit": 0.0}
                    progress_lock = asyncio.Lock()
                    tasks = [asyncio.create_task(worker(
                        browser, url, W, H, range(j, n, k), args.fps, args.frm,
                        outdir, f"w{j}", progress, progress_lock, n)) for j in range(k)]
                    await asyncio.gather(*tasks)
                finally:
                    for task in tasks:
                        if not task.done():
                            task.cancel()
                    await asyncio.gather(*tasks, return_exceptions=True)
                    await browser.close()
            print("@@phase encode", flush=True)
            staged = outdir / "complete.mp4"
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-y", "-v", "error", "-framerate", str(args.fps), "-i", str(outdir / "%06d.jpg"),
                "-ss", str(args.frm), "-t", str(t_end - args.frm), "-i", str(audio),
                "-map", "0:v", "-map", "1:a", "-vf", "scale=out_range=tv,format=yuv420p",
                "-c:v", "libx264", "-preset", args.preset, "-crf", "23", "-maxrate", "6M", "-bufsize", "12M",
                "-pix_fmt", "yuv420p", "-color_range", "tv",
                "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
                "-shortest", "-movflags", "+faststart", str(staged))
            try:
                code = await proc.wait()
            finally:
                if proc.returncode is None:
                    proc.kill()
                    await proc.wait()
            if code != 0 or not staged.is_file() or staged.stat().st_size == 0:
                raise RuntimeError(f"Falló ffmpeg ({code}); se conserva el video anterior")
            os.replace(staged, output)
    finally:
        httpd.shutdown()
        httpd.server_close()
        httpd.worker_thread.join(timeout=2)
    print("listo:", args.out)


async def render_with_signals(args):
    task = asyncio.current_task()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, task.cancel)
    try:
        await render(args)
    finally:
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.remove_signal_handler(sig)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("page")
    ap.add_argument("out")
    ap.add_argument("--edition", help="edition.json de una revisión del mismo video y perfil")
    # veryfast: benchmark 2026-10-11 → ~38% menos tiempo de codificación que medium,
    # misma calidad a la vista (SSIM 0,9987 vs 0,9991) y archivo algo más chico.
    ap.add_argument("--preset", default="veryfast")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--size", default="1920x1080")
    ap.add_argument("--from", dest="frm", type=float, default=0.0)
    ap.add_argument("--to", type=float, default=None)
    ap.add_argument("--workers", type=int, default=3)
    asyncio.run(render_with_signals(ap.parse_args()))
