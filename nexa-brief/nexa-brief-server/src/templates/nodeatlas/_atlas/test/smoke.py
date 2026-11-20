"""Manual smoke test; run from any directory with Playwright installed."""
import argparse
import functools
import importlib.util
import os
from pathlib import Path
import socketserver
import threading

HERE = Path(__file__).resolve().parent
TEMPLATES = HERE.parents[3]
spec = importlib.util.spec_from_file_location('http_media', TEMPLATES / '_tools/http_media.py')
http_media = importlib.util.module_from_spec(spec)
spec.loader.exec_module(http_media)

class Handler(http_media.MediaRequestHandler):
    # The shared media handler has byte ranges for video/audio. PMTiles also needs 206.
    def send_head(self):
        if not self.path.split('?', 1)[0].endswith('.pmtiles'):
            return super().send_head()
        self._range_left = None
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            self.send_error(404)
            return None
        source = open(path, 'rb')
        size = os.fstat(source.fileno()).st_size
        header = self.headers.get('Range')
        if not header:
            self.send_response(200)
            self.send_header('Content-Length', str(size))
        else:
            try:
                first, last = header.removeprefix('bytes=').split('-', 1)
                start = int(first)
                end = min(int(last), size - 1) if last else size - 1
                if start < 0 or start > end:
                    raise ValueError()
            except ValueError:
                source.close()
                self.send_error(416)
                return None
            source.seek(start)
            self._range_left = end - start + 1
            self.send_response(206)
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
            self.send_header('Content-Length', str(self._range_left))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Type', 'application/octet-stream')
        self.end_headers()
        return source

def main():
    from playwright.sync_api import sync_playwright
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=0)
    args = parser.parse_args()
    server = socketserver.ThreadingTCPServer(('127.0.0.1', args.port), functools.partial(Handler, directory=str(TEMPLATES)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    output = Path('/tmp/atlas-smoke')
    output.mkdir(parents=True, exist_ok=True)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
            page = browser.new_page(viewport={'width':1920,'height':1080}, device_scale_factor=1)
            page.on('console', lambda m: print('console:', m.type, m.text) if m.type in ('error','warning') else None)
            page.on('pageerror', lambda e: print('pageerror:', e))
            page.goto(f'http://127.0.0.1:{server.server_address[1]}/sandbox/nodehistory/_atlas/test/smoke.html?preload=0', wait_until='domcontentloaded')
            page.wait_for_function('window.__promo && window.__atlas', timeout=90000)
            for t in (4.5, 0.5, 3):
                page.evaluate('t => window.__promo.seek(t)', t)
                page.screenshot(path=str(output / f't-{t}.png'))
            print('missingTiles:', page.evaluate('window.__promo.missingTiles()'))
            print('frame timings:', page.evaluate('window.__atlas.fps()'))
            browser.close()
    finally:
        server.shutdown()
        server.server_close()

if __name__ == '__main__':
    main()
