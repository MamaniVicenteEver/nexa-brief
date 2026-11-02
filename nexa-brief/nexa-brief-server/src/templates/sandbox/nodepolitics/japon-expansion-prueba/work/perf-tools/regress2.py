import asyncio, hashlib, io, os, sys
from playwright.async_api import async_playwright
BASE = "http://127.0.0.1:8000/api/v1/explainer/files/sandbox/nodepolitics/"
B = "/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server/src/templates/sandbox/nodepolitics/japon-expansion-prueba/work/engine-backup/"
CASES = {"imperio-demo": [3.0, 14.0, 31.0, 48.5, 70.0, 105.0, 140.0, 230.0]}
async def shots(mode):
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None, args=["--autoplay-policy=no-user-gesture-required"])
        for tpl, times in CASES.items():
            for orient, (w, h) in (("16x9", (1280, 720)), ("9x16", (720, 1280))):
                page = await (await b.new_context(viewport={"width": w, "height": h})).new_page()
                if mode == "original":
                    async def kit(route): await route.fulfill(status=200, content_type="application/javascript", body=open(B + "kit.js.orig").read())
                    async def imp(route): await route.fulfill(status=200, content_type="application/javascript", body=open(B + "_imperio.js.orig").read())
                    await page.route("**/engine/kit.js*", kit); await page.route("**/components/_imperio.js*", imp)
                await page.goto(BASE + tpl + "/index.html?paused&t=0"); await page.wait_for_function("window.__promo && window.__promo.beats", timeout=180000)
                for t in times:
                    await page.evaluate(f"__promo.seek({t})"); png = await page.screenshot()
                    out[(tpl, orient, t)] = hashlib.sha256(png).hexdigest()[:16]
                await page.close()
        await b.close()
    return out
async def main():
    o1 = await shots("original"); o2 = await shots("original"); n1 = await shots("nuevo"); n2 = await shots("nuevo")
    d = lambda a, b: sorted(k for k in a if a[k] != b[k])
    print("original vs original:", d(o1, o2)); print("nuevo vs nuevo      :", d(n1, n2)); print("original vs nuevo   :", d(o1, n1))
    print("original vs nuevo (2ª pasada):", d(o2, n2))
asyncio.run(main())
