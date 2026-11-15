import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 960, "height": 540})
        await pg.goto(sys.argv[1] + "?t=0")
        await pg.wait_for_function("() => window.__promo && window.__promo.scenes().length", timeout=60000)
        await pg.evaluate("() => window.__promo.seek(6.5)")
        r1 = await pg.evaluate("() => [...document.querySelectorAll('#stage img')].map(i => [i.complete, i.naturalWidth])")
        await pg.wait_for_timeout(2500)
        r2 = await pg.evaluate("() => [...document.querySelectorAll('#stage img')].map(i => [i.complete, i.naturalWidth])")
        await pg.screenshot(path=sys.argv[2])
        print(r1, r2); await b.close()
asyncio.run(main())
