#!/usr/bin/env python3
"""QA real de common.capas: capturas, seek, carga, rendimiento y liberación.

No produce video ni usa servicios de la aplicación. Cierra su HTTP y Chromium.
"""
import argparse
import asyncio
from functools import partial
import http.server
import json
import os
from pathlib import Path
import statistics
import threading

from PIL import Image, ImageDraw, ImageFont
from playwright.async_api import async_playwright

KIT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


async def processes(cdp):
    data = await cdp.send("SystemInfo.getProcessInfo")
    rows = []
    for row in data["processInfo"]:
        info = {"pid": row["id"], "type": row["type"], "cpu_seconds": row["cpuTime"]}
        try:
            values = Path(f"/proc/{row['id']}/status").read_text().splitlines()
            info["rss_kib"] = next(int(line.split()[1]) for line in values if line.startswith("VmRSS:"))
        except (OSError, StopIteration):
            info["rss_kib"] = None
        rows.append(info)
    return rows


async def memory(page):
    session = await page.context.new_cdp_session(page)
    try:
        await session.send("Performance.enable")
        data = await session.send("Performance.getMetrics")
        values = {item["name"]: item["value"] for item in data["metrics"]}
        return {key: values.get(key) for key in ["JSHeapUsedSize", "JSHeapTotalSize", "Nodes", "Documents", "JSEventListeners"]}
    finally:
        await session.detach()


async def idle(cdp):
    before = await processes(cdp)
    await asyncio.sleep(.5)
    after = await processes(cdp)
    return {"seconds": .5, "cpu_seconds": sum(p["cpu_seconds"] for p in after) - sum(p["cpu_seconds"] for p in before), "rss_kib": sum(p["rss_kib"] or 0 for p in after)}


def contact(images, output, columns=3, cell=(480, 320)):
    width, height = cell
    result = Image.new("RGB", (columns * width, ((len(images) + columns - 1) // columns) * height), "#101722")
    draw = ImageDraw.Draw(result)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 17)
    for i, (filename, label) in enumerate(images):
        with Image.open(filename) as source:
            image = source.convert("RGB")
            image.thumbnail((width - 16, height - 36), Image.Resampling.LANCZOS)
        x, y = i % columns * width, i // columns * height
        result.paste(image, (x + (width - image.width) // 2, y + 32))
        draw.text((x + 10, y + 8), label, fill="#EFE9DF", font=font)
    result.save(output)


async def run(output, port):
    report = {"frames_per_format": 150, "formats": {}, "console_errors": []}
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or None,
            args=["--disable-dev-shm-usage"])
        cdp = await browser.new_browser_cdp_session()
        before = await processes(cdp)
        report["before_browser_page"] = before
        report["idle_before_page"] = await idle(cdp)
        browser_ids = set()
        try:
            for name, size in [("16x9", (1280, 720)), ("9x16", (720, 1280))]:
                context = await browser.new_context(viewport={"width": size[0], "height": size[1]}, device_scale_factor=1)
                page = await context.new_page()
                page.on("pageerror", lambda e: report["console_errors"].append(str(e)))
                page.on("console", lambda msg: report["console_errors"].append(msg.text) if msg.type == "error" else None)
                await page.goto(f"http://127.0.0.1:{port}/capas/tests/harness.html?t=0", wait_until="load")
                await page.evaluate("qaReady")
                captures = []
                for time in [0.6, 1.8, 2.6, 3.7, 4.4, 5.6]:
                    await page.evaluate("t => __promo.seek(t)", time)
                    target = output / f"{name}-{time:.1f}.png"
                    await page.screenshot(path=target)
                    captures.append((target, f"{name} · {time:.1f} s"))
                contact(captures, output / f"hoja-{name}.png", columns=3, cell=(480, 650) if name == "9x16" else (480, 320))
                # Seek desordenado: el mismo t debe recuperar exactamente los píxeles.
                await page.evaluate("__promo.seek(3.7)")
                first = await page.locator(".k-main").screenshot()
                await page.evaluate("__promo.seek(.6)")
                await page.evaluate("__promo.seek(3.7)")
                second = await page.locator(".k-main").screenshot()
                assert first == second, "El seek no es determinista"
                initial_memory = await memory(page)
                idle_with_page = await idle(cdp)
                initial_processes = await processes(cdp)
                await page.evaluate("qa.draw=[]")
                sequence = await page.evaluate("""async () => {
                  const start = performance.now();
                  for(let i=0;i<150;i++) await __promo.seek(.1+i*5.7/149);
                  return {elapsed_ms:performance.now()-start,draw:qa.draw,stats:qa.instance.stats(),anchors:qa.instance.anchors(3)};
                }""")
                final_memory = await memory(page)
                final_processes = await processes(cdp)
                draw_times = sequence.pop("draw")
                sequence["draw_ms"] = {"mean": statistics.mean(draw_times), "median": statistics.median(draw_times), "p95": sorted(draw_times)[int(len(draw_times) * .95)], "max": max(draw_times)}
                sequence.update({"memory_before": initial_memory, "memory_after": final_memory, "processes_before": initial_processes, "processes_after": final_processes, "idle_with_page": idle_with_page, "deterministic_seek": True})
                await page.evaluate("__promo.seek(6)")
                sequence["after_dispose"] = await page.evaluate("qa.instance.stats()")
                assert sequence["after_dispose"]["surfaces"] == 0
                # Cerrar y reabrir el beat cinco veces detecta superficies retenidas.
                reopen = []
                for _ in range(5):
                    await page.evaluate("__promo.seek(2)")
                    reopen.append(await page.evaluate("qa.instance.stats()"))
                    await page.evaluate("__promo.seek(6)")
                    assert (await page.evaluate("qa.instance.stats()"))["surfaces"] == 0
                assert all(item == reopen[0] for item in reopen), "Caché creciente al reabrir"
                sequence["reopen_stats"] = reopen
                await context.close()
                sequence["after_close"] = await processes(cdp)
                sequence["idle_after_close"] = await idle(cdp)
                report["formats"][name] = sequence
            context = await browser.new_context(viewport={"width": 1280, "height": 720})
            page = await context.new_page()
            await page.goto(f"http://127.0.0.1:{port}/capas/tests/harness.html?t=0&invalid=1")
            await page.evaluate("qaReady")
            await page.screenshot(path=output / "error-16x9.png")
            await page.set_viewport_size({"width": 720, "height": 1280})
            await page.wait_for_function("document.querySelector('.k-main').width === 720")
            await page.evaluate("__promo.seek(0)")
            await page.screenshot(path=output / "error-9x16.png")
            contact([(output / "error-16x9.png", "Error 16x9"), (output / "error-9x16.png", "Error 9x16")], output / "hoja-errores.png", columns=2, cell=(640, 650))
            report["error_messages"] = await page.evaluate("qa.instance.errors")
            await page.goto(f"http://127.0.0.1:{port}/capas/tests/harness.html?t=0&primitive=1")
            await page.evaluate("qaReady")
            assert await page.evaluate("qa.instance.errors.length > 0"), "Params primitivo sin tarjeta"
            report["primitive_error_messages"] = await page.evaluate("qa.instance.errors")
            await page.goto(f"http://127.0.0.1:{port}/capas/tests/harness.html?t=0")
            await page.evaluate("qaReady")
            report["runtime_matrix"] = await page.evaluate("""async () => {
              const rt=Kit.capas, canvas=document.createElement('canvas'); canvas.width=640;canvas.height=360;
              const ctx={g:{main:canvas.getContext('2d')},stage:Kit.makeStage(640,360),C:{}};
              const original=qa.instance, results=[];
              const variants=[];
              for(const preset of ['foco','degradado','horizonte','ciudad','sala','rayos','liso']) variants.push(['fondo:'+preset,p=>p.fondo.preset=preset]);
              for(const mov of ['acercar','alejar','paneo-izq','paneo-der','fijo','temblor']) variants.push(['camara:'+mov,p=>p.camara.mov=mov]);
              for(const anim of ['entrar-sube','entrar-cae','entrar-desliza','salir-cae','salir-funde','respirar','flotar','temblar','girar','caer','latir']) variants.push(['anim:'+anim,p=>p.elenco[1].anim=anim]);
              for(const tipo of ['hilo','linea','cadena']) variants.push(['conexion:'+tipo,p=>p.conexiones.forEach(c=>c.tipo=tipo)]);
              for(const [name,change] of variants){
                const scene=structuredClone(qa.scene);change(scene);await rt.prepare(scene,6);
                const inst=rt.create(ctx,scene,6);if(inst.errors.length) throw new Error(name+': '+inst.errors.join(';'));
                inst.render(.2);inst.render(2.6);const before=canvas.toDataURL();inst.render(.7);inst.render(2.6);
                if(before!==canvas.toDataURL())throw new Error('Seek no determinista: '+name);
                inst.dispose();if(inst.stats().surfaces!==0)throw new Error('Fuga: '+name);results.push(name);
              }
              // Centro de la máscara corbata: mezcla de rojo y oro al 50 %.
              const scene=structuredClone(qa.scene);scene.camara={mov:'fijo'};scene.elenco=scene.elenco.slice(0,1);
              scene.elenco[0]={...scene.elenco[0],x:.5,y:.9,escala:1,anim:undefined,entrada:undefined};
              scene.conexiones=[];scene.eventos=[{en:0,id:'jefe',accion:'color',valor:{zona:'corbata',color:'#E9B23B',dur:1}}];
              scene.formato={};scene.textos=[];
              await rt.prepare(scene,6);const inst=rt.create(ctx,scene,6);inst.render(.5);
              const scale=.6*360/650, x=Math.round(320+(523-530)*scale), y=Math.round(.9*360+(886-1300)*scale);
              const rgb=[...ctx.g.main.getImageData(x,y,1,1).data].slice(0,3), expected=[230,108,53];
              if(rgb.some((n,i)=>Math.abs(n-expected[i])>3))throw new Error('Fundido de color incorrecto: '+rgb);
              inst.dispose();qa.instance=original;
              return {variants:results,color_halfway:rgb,color_expected:expected};
            }""")
            await context.close()
            browser_ids = {row["pid"] for row in await processes(cdp)}
        finally:
            await cdp.detach()
            await browser.close()
        report["remaining_owned_pids"] = [pid for pid in browser_ids if Path(f"/proc/{pid}").exists()]
    (output / "metrics.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    assert not report["console_errors"], report["console_errors"]
    print(json.dumps({name: data["draw_ms"] for name, data in report["formats"].items()}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(KIT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        asyncio.run(run(args.output, server.server_port))
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == "__main__":
    main()
