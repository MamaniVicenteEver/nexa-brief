import asyncio, json, os, sys
from playwright.async_api import async_playwright
URL = sys.argv[1]; SECS = float(sys.argv[2]); LO = float(sys.argv[3]); HI = float(sys.argv[4])
POLL = """
() => { window.__k = []; const au = document.getElementById('audio');
  const short = k => k.id.split('|').slice(1).join('|').replace(/\\.0+,/g, ',');
  setInterval(() => { const s = Kit.imperio.keyStats(); window.__k.push([+au.currentTime.toFixed(2), s.queue, s.keys.map(k => short(k) + ':' + k.done)]); }, 250); }
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None, args=["--autoplay-policy=no-user-gesture-required"])
        page = await (await b.new_context(viewport={"width": 1280, "height": 720})).new_page()
        await page.goto(URL); await page.wait_for_function("window.__promo && window.__promo.beats", timeout=180000)
        sc = await page.evaluate("window.__promo.beats.map(b => [+b.t0.toFixed(1), +b.t1.toFixed(1), b.use, b.layer || 'main', b.params && b.params.country || ''])")
        await page.evaluate(POLL); await page.wait_for_timeout(int(SECS * 1000)); k = await page.evaluate("window.__k"); await b.close()
    print("beats alrededor:", [x for x in sc if x[1] > LO - 6 and x[0] < HI + 1 and x[3] == 'main'])
    for t, q, keys in k:
        if LO <= t <= HI: print(f"t={t:6.2f} cola={q:2d} n={len(keys):2d} " + " ".join(keys)[:420])
asyncio.run(main())
