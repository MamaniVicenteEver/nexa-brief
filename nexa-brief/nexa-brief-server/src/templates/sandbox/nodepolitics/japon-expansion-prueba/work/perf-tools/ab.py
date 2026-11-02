import asyncio, json, os, sys
from playwright.async_api import async_playwright
URL, SECS, OUT, MODE = sys.argv[1], float(sys.argv[2]), sys.argv[3], sys.argv[4]      # MODE: nuevo | original
B = "/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server/src/templates/sandbox/nodepolitics/japon-expansion-prueba/work/engine-backup/"
INIT = """
(() => { window.__fr = []; window.__kitTrace = []; const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => { const a = performance.now(); cb(ts); const d = performance.now() - a; const au = document.getElementById('audio'); window.__fr.push([a, d, au ? au.currentTime : -1, au && au.paused ? 1 : 0]); }); })();
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None, args=["--autoplay-policy=no-user-gesture-required"])
        ctx = await b.new_context(viewport={"width": 1280, "height": 720}); page = await ctx.new_page(); await page.add_init_script(INIT)
        if MODE == "original":
            async def kit(route): await route.fulfill(status=200, content_type="application/javascript", body=open(B + "kit.js.orig").read())
            async def imp(route): await route.fulfill(status=200, content_type="application/javascript", body=open(B + "_imperio.js.orig").read())
            await page.route("**/engine/kit.js*", kit); await page.route("**/components/_imperio.js*", imp)
        await page.goto(URL); await page.wait_for_function("window.__promo && window.__promo.beats", timeout=180000)
        await page.wait_for_timeout(int(SECS * 1000))
        fr = await page.evaluate("window.__fr"); tr = await page.evaluate("window.__kitTrace"); errs = []
        await b.close()
    json.dump({"fr": fr, "trace": tr}, open(OUT, "w"))
asyncio.run(main())
