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
  python3 _tools/commercial/render_promo.py commercial/promo-trendy/index.html out.mp4
  python3 _tools/commercial/render_promo.py lyrics/lyrics-grunge/index.html out.mp4 [--fps 30] [--size 1920x1080] [--from 0] [--to END] [--workers 3]
Requiere: playwright (chromium) y ffmpeg. Levanta su propio servidor HTTP.
"""
import argparse, asyncio, functools, http.server, json, pathlib, subprocess, threading

HERE = pathlib.Path(__file__).resolve().parents[2]   # src/templates/

class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k): pass

def serve(root):
    handler = functools.partial(_Quiet, directory=str(root))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

async def worker(b, url, W, H, frames, fps, t0, outdir, tag):
    pg = await b.new_page(viewport={"width": W, "height": H})
    await pg.goto(url)
    await pg.wait_for_function("window.__promo && window.__promo.scenes().length > 0", timeout=60000)
    for n, i in enumerate(frames):
        t = t0 + i / fps
        await pg.evaluate(f"window.__promo.seek({t:.5f})")
        (outdir / f"{i:06d}.jpg").write_bytes(await pg.screenshot(type="jpeg", quality=92))
        if n % (fps * 3) == 0: print(f"  [{tag}] {t:6.2f}s", flush=True)
    await pg.close()

async def render(args):
    import tempfile
    from playwright.async_api import async_playwright
    W, H = map(int, args.size.lower().split("x"))
    httpd = serve(HERE)
    url = f"http://127.0.0.1:{httpd.server_address[1]}/{args.page}?t=0&headless=1"
    page = pathlib.Path(args.page)   # relativo a src/templates/, p.ej. commercial/promo-trendy/index.html
    folder = HERE / page.parent
    cands = [folder / "assets" / (page.stem + ".config.json"), folder / "assets" / "config.json"]
    cfg_file = next(c for c in cands if c.exists())
    cfg = json.loads(cfg_file.read_text())["configs"][0]
    with tempfile.TemporaryDirectory() as td:
        outdir = pathlib.Path(td)
        async with async_playwright() as p:
            b = await p.chromium.launch()
            probe = await b.new_page(); await probe.goto(url)
            await probe.wait_for_function("window.__promo && window.__promo.scenes().length > 0", timeout=60000)
            end = await probe.evaluate("(() => { const s = window.__promo.scenes(); return s[s.length - 1].t1; })()")
            await probe.close()
            t_end = args.to if args.to is not None else end
            n = int(round((t_end - args.frm) * args.fps))
            k = max(1, args.workers)
            chunks = [list(range(n))[j::k] for j in range(k)]   # intercalado: todos avanzan parejo
            await asyncio.gather(*[worker(b, url, W, H, c, args.fps, args.frm, outdir, f"w{j}") for j, c in enumerate(chunks)])
            await b.close()
        httpd.shutdown()
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-framerate", str(args.fps), "-i", str(outdir / "%06d.jpg"),
                        "-ss", str(args.frm), "-t", str(t_end - args.frm), "-i", str(folder / cfg["audio"]["src"]),
                        "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", args.out], check=True)
    print("listo:", args.out)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("page"); ap.add_argument("out")
    ap.add_argument("--fps", type=int, default=30); ap.add_argument("--size", default="1920x1080")
    ap.add_argument("--from", dest="frm", type=float, default=0.0); ap.add_argument("--to", type=float, default=None)
    ap.add_argument("--workers", type=int, default=3)
    asyncio.run(render(ap.parse_args()))
