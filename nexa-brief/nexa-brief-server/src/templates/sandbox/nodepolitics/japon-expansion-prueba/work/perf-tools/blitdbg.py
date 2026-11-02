import asyncio, json, os, sys
from playwright.async_api import async_playwright
URL = sys.argv[1]; SECS = float(sys.argv[2])
INIT = """
(() => { window.__sl = []; const seen = new WeakMap(); const od = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (src, ...a) { const t0 = performance.now(); const r = od.call(this, src, ...a); const d = performance.now() - t0;
    const n = (seen.get(src) || 0) + 1; seen.set(src, n);
    if (d > 35) { const au = document.getElementById('audio'); window.__sl.push([+(au ? au.currentTime : 0).toFixed(2), +d.toFixed(0), src.tagName || '?', src.width, src.height, n, this.canvas ? this.canvas.width + 'x' + this.canvas.height : '?']); }
    return r; }; })();
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None, args=["--autoplay-policy=no-user-gesture-required"])
        page = await (await b.new_context(viewport={"width": 1280, "height": 720})).new_page(); await page.add_init_script(INIT)
        await page.goto(URL); await page.wait_for_function("window.__promo && window.__promo.beats", timeout=180000)
        await page.wait_for_timeout(int(SECS * 1000)); sl = await page.evaluate("window.__sl"); await b.close()
    print("drawImage > 35 ms:", len(sl))
    for r in sl[:40]: print("  audio %.2f s · %d ms · origen %s %dx%d · uso nº %d · destino %s" % tuple(r))
asyncio.run(main())
