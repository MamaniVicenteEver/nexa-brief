import asyncio, os, json
from playwright.async_api import async_playwright
URL = "http://127.0.0.1:8000/api/v1/explainer/files/sandbox/nodepolitics/japon-expansion-prueba/index.html?controls=1"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None, args=["--autoplay-policy=no-user-gesture-required"])
        page = await (await b.new_context(viewport={"width": 1280, "height": 720})).new_page()
        errs = []; page.on("console", lambda m: errs.append(m.text[:160]) if m.type == "error" else None); page.on("pageerror", lambda e: errs.append(str(e)[:160]))
        await page.add_init_script("window.__kitTrace = [];")
        await page.goto(URL); await page.wait_for_function("window.__promo && window.__promo.beats", timeout=120000)
        A = "document.getElementById('audio')"
        async def state(): return await page.evaluate(f"({{t: {A}.currentTime, p: {A}.paused, k: (window.__kitTrace.slice(-1)[0]||[0,0,0])[1]}})")
        print("pausado al inicio       ", await state())
        await page.evaluate("postMessage({type:'nexa-template-playback', playing:true}, '*')"); await page.wait_for_timeout(3000); s = await state(); print("sonando 3 s            ", s, "| motor − audio = %.0f ms" % ((s['k'] - s['t']) * 1000))
        await page.evaluate("postMessage({type:'nexa-template-seek', time:40}, '*')"); await page.wait_for_timeout(700); s = await state(); print("adelantar a 40 s       ", s, "| motor − audio = %.0f ms" % ((s['k'] - s['t']) * 1000))
        await page.evaluate("postMessage({type:'nexa-template-seek', time:12}, '*')"); await page.wait_for_timeout(700); s = await state(); print("retroceder a 12 s      ", s, "| motor − audio = %.0f ms" % ((s['k'] - s['t']) * 1000))
        await page.evaluate("postMessage({type:'nexa-template-playback', playing:false}, '*')"); await page.wait_for_timeout(500); s = await state(); print("pausa                  ", s, "| motor − audio = %.0f ms (debe ser 0)" % ((s['k'] - s['t']) * 1000))
        await page.evaluate("postMessage({type:'nexa-template-seek', time:77.25}, '*')"); await page.wait_for_timeout(500); s = await state(); print("buscar en pausa a 77,25", s, "| motor − audio = %.0f ms (debe ser 0)" % ((s['k'] - s['t']) * 1000))
        await page.evaluate("postMessage({type:'nexa-template-playback', playing:true}, '*')"); await page.wait_for_timeout(1500); s = await state(); print("reanudar               ", s, "| motor − audio = %.0f ms" % ((s['k'] - s['t']) * 1000))
        print("errores de consola:", [e for e in errs if "404" not in e][:5]); await b.close()
asyncio.run(main())
