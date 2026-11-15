import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 960, "height": 540})
        logs = []
        pg.on("console", lambda m: logs.append(f"{m.type}: {m.text[:300]}"))
        pg.on("pageerror", lambda e: logs.append(f"pageerror: {e}"))
        pg.on("requestfailed", lambda r: logs.append(f"failed: {r.url[-90:]} {r.failure}"))
        pg.on("response", lambda r: logs.append(f"{r.status} {r.url[-80:]}") if r.status >= 400 else None)
        await pg.goto(sys.argv[1] + "?t=0"); await pg.wait_for_timeout(12000)
        st = await pg.evaluate("() => ({promo: !!window.__promo, n: window.__promo ? window.__promo.scenes().length : -1, info: window.__promoInfo ? window.__promoInfo.components : null, base: document.baseURI})")
        print(st); print("\n".join(logs[:40])); await b.close()
asyncio.run(main())
