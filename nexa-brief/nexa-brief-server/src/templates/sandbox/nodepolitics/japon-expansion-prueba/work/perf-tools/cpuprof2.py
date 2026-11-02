import asyncio, json, os, sys
from playwright.async_api import async_playwright
URL = sys.argv[1]; SECS = float(sys.argv[2]); OUT = sys.argv[3]
INIT = """
(() => { window.__fr = []; const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => { const a = performance.now(); cb(ts); const d = performance.now() - a; const au = document.getElementById('audio'); if (d > 1) window.__fr.push([a, d, au ? au.currentTime : -1]); }); })();
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None, args=["--autoplay-policy=no-user-gesture-required"])
        ctx = await b.new_context(viewport={"width": 1280, "height": 720}); page = await ctx.new_page(); await page.add_init_script(INIT)
        cdp = await ctx.new_cdp_session(page)
        await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", {"interval": 300})
        await page.goto(URL); await page.wait_for_function("window.__promo && window.__promo.beats", timeout=120000)
        p0 = await page.evaluate("performance.now()"); await cdp.send("Profiler.start")
        await page.wait_for_timeout(int(SECS * 1000))
        prof = (await cdp.send("Profiler.stop"))["profile"]; fr = await page.evaluate("window.__fr")
        await b.close()
    json.dump({"prof": prof, "fr": fr, "p0": p0}, open(OUT, "w"))
asyncio.run(main())
