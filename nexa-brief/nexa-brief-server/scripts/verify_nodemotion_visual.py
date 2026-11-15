"""Compare canonical engines against the pre-refactor checkout, without encoding video."""
from __future__ import annotations
import argparse, asyncio, functools, http.server, io, json, sys, threading, subprocess
from pathlib import Path
from PIL import Image, ImageChops

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--baseline",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--baseline-revision",default=None)
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[1]
    sys.path.insert(0,str(root))
    from src.config.settings import settings
    settings.templates_dir=root/"src/templates"
    from src.templates._tools.http_media import MediaRequestHandler
    class Handler(MediaRequestHandler):
        def translate_path(self,url):
            path=Path(super().translate_path(url))
            if not path.exists():
                try: relative=path.relative_to(root/"src/templates")
                except ValueError:return str(path)
                source=args.baseline/"src/templates"/relative
                # Baseline media is read-only and used only when not tracked in the checkout.
                if source.is_file() and source.suffix.lower() not in {".js",".css",".html",".py"}:
                    return str(source)
            return str(path)
    class BaselineHandler(Handler):
        def send_head(self):
            if args.baseline_revision:
                from urllib.parse import unquote, urlsplit
                relative = Path(unquote(urlsplit(self.path).path).lstrip("/"))
                if relative.suffix == "":
                    relative = relative / "index.html"
                if relative.suffix.lower() in {".html", ".js", ".css"} and ".." not in relative.parts:
                    prefix = subprocess.check_output(["git","rev-parse","--show-prefix"],cwd=args.baseline,text=True).strip()
                    blob = subprocess.run(["git","show",f"{args.baseline_revision}:{prefix}src/templates/{relative.as_posix()}"],
                                          cwd=args.baseline,capture_output=True)
                    if blob.returncode == 0:
                        self._range_left = None
                        self.send_response(200)
                        self.send_header("Content-Type",self.guess_type(relative.name))
                        self.send_header("Content-Length",str(len(blob.stdout)))
                        self.end_headers()
                        return io.BytesIO(blob.stdout)
            return super().send_head()
    servers=[]
    for directory in (args.baseline/"src/templates",root/"src/templates"):
        handler = BaselineHandler if directory == args.baseline/"src/templates" else Handler
        server=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(handler,directory=str(directory)))
        threading.Thread(target=server.serve_forever,daemon=True).start();servers.append(server)
    args.output.mkdir(parents=True,exist_ok=True)
    async def compare():
        from playwright.async_api import async_playwright
        results=[]
        async with async_playwright() as pw:
            browser=await pw.chromium.launch(args=["--no-sandbox","--disable-dev-shm-usage"])
            try:
                for design,folder,api in [
                    ("promo-editorial","commercial","__promo"),
                    ("lyrics-trazo","lyrics","__trazo"),
                    ("lyrics-latido","lyrics",None),
                ]:
                    for width,height in [(1920,1080),(1080,1920)]:
                        pictures=[];issues=[]
                        for index,server in enumerate(servers):
                            page=await browser.new_page(viewport={"width":width,"height":height},device_scale_factor=1)
                            if api is None:
                                # Frame-driven designs require an identical number of animation frames.
                                await page.clock.install(time=0)
                                await page.clock.pause_at(1000)
                                await page.add_init_script("HTMLAudioElement.prototype.play=function(){return Promise.resolve()};")
                            errors=[]
                            page.on("pageerror",lambda error:errors.append(str(error)))
                            page.on("response",lambda r:errors.append(f"HTTP {r.status} {r.url}") if r.status>=400 else None)
                            await page.add_init_script("Math.random=(()=>{let s=123456;return ()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296}})();")
                            try:
                                url=f"http://127.0.0.1:{server.server_port}/nodemotion/{folder}/{design}/index.html?headless=1&t=12.5"
                                await page.goto(url,wait_until="networkidle",timeout=45000)
                                await page.evaluate("document.fonts.ready")
                                if api:
                                    await page.wait_for_function(f"window.{api} && typeof window.{api}.seek === 'function'",timeout=15000)
                                    await page.evaluate(f"window.{api}.seek(12.5)")
                                else:
                                    await page.clock.run_for(12500)
                                if api is None:
                                    await page.evaluate("document.getAnimations().forEach(a=>{a.pause();a.currentTime=12500})")
                                await page.wait_for_timeout(250)
                                picture=await page.screenshot()
                                path=args.output/f"{design}-{width}x{height}-{'before' if index==0 else 'after'}.png"
                                path.write_bytes(picture);pictures.append(picture)
                            finally:
                                issues.append(errors);await page.close()
                        difference=ImageChops.difference(Image.open(io.BytesIO(pictures[0])).convert("RGB"),Image.open(io.BytesIO(pictures[1])).convert("RGB"))
                        results.append({"design":design,"format":f"{width}x{height}","identical_pixels":difference.getbbox() is None,"errors":issues})
            finally:await browser.close()
        return results
    try:
        results=asyncio.run(compare())
        (args.output/"results.json").write_text(json.dumps(results,indent=2))
        print(json.dumps(results,indent=2))
    finally:
        for server in servers:server.shutdown();server.server_close()
if __name__=="__main__":main()
