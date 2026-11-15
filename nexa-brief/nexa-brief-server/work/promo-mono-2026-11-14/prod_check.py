"""Verificación por API en el servidor: consola, componentes, avisos y capturas 16:9 / 9:16."""
import asyncio, json, sys, pathlib
from playwright.async_api import async_playwright
BASE = sys.argv[1]; OUT = pathlib.Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
TIMES = [float(x) for x in sys.argv[3].split(",")] if len(sys.argv) > 3 else [1.6, 4.6, 6.4, 9.0, 13.4, 16.9, 18.4, 20.8, 21.6, 23.6, 25.4, 29.0, 30.9, 32.5, 36.5, 39.6, 41.5, 43.4, 45.4, 49.0, 54.0]
async def main():
    res = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name, (w, h) in {"169": (960, 540), "916": (540, 960)}.items():
            pg = await b.new_page(viewport={"width": w, "height": h})
            logs = []
            pg.on("console", lambda m: logs.append(f"{m.type}: {m.text[:160]}") if m.type in ("error", "warning") else None)
            pg.on("pageerror", lambda e: logs.append(f"pageerror: {e}"))
            await pg.goto(f"{BASE}?t=0")
            await pg.wait_for_function("() => window.__promo && window.__promo.scenes().length", timeout=60000)
            info = await pg.evaluate("() => ({comps: window.__promoInfo.components, warn: window.__promoInfo.warnings, n: window.__promo.scenes().length})")
            for t in TIMES:
                await pg.evaluate(f"() => window.__promo.seek({t})")
                await pg.wait_for_timeout(120)
                await pg.screenshot(path=str(OUT / f"{name}-{t:05.1f}.png"))
            res[name] = {"info": info, "logs": [l for l in logs if "404" not in l][:10]}
            await pg.close()
        await b.close()
    print(json.dumps(res, ensure_ascii=False))
asyncio.run(main())
