#!/usr/bin/env python3
"""Bounded Atlas host verification through the selected profile's same-origin API."""
from __future__ import annotations

import argparse
import asyncio
import contextlib
from concurrent.futures import ThreadPoolExecutor
import fcntl
import json
import math
import mimetypes
import os
from pathlib import Path
import re
import sys
import threading
import time
from urllib.parse import quote, unquote, urlencode, urlsplit

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import atlas_factory as host

INTEL_ICD = "/usr/share/vulkan/icd.d/intel_icd.json"


def gpu_arguments(mode):
    if mode == "software":
        return ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
    if mode == "intel-vulkan":
        return ["--use-gl=angle", "--use-angle=vulkan", "--enable-features=Vulkan", "--disable-vulkan-surface", "--ignore-gpu-blocklist"]
    raise host.StageError("GPU desconocida: " + str(mode))


def verify_gpu(mode, contexts):
    if (not isinstance(contexts, list) or not contexts
            or any(not isinstance(item, dict) or item.get("context_lost") is True for item in contexts)):
        raise host.StageError("No se pudo inspeccionar el contexto WebGL real de MapLibre")
    identities = [" ".join(str(item.get(key) or "") for key in
                  ("vendor", "renderer", "unmasked_vendor", "unmasked_renderer")).lower() for item in contexts]
    software = any(re.search(r"swiftshader|llvmpipe|lavapipe|softpipe|software rasterizer", identity) for identity in identities)
    intel_vulkan = all("intel" in identity and "vulkan" in identity for identity in identities) and not software
    if mode == "intel-vulkan" and not intel_vulkan:
        raise host.StageError("Intel Vulkan solicitado pero WebGL no confirma Intel Vulkan; no se acepta fallback de GPU")
    return {"software_detected": software, "intel_vulkan_verified": intel_vulkan}


GPU_INSPECT_JS = '''() => [...document.querySelectorAll('canvas.maplibregl-canvas')].map(canvas => {
  const gl=canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) return null;
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  return {vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER),
    version:gl.getParameter(gl.VERSION),shading_language_version:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    unmasked_vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):null,
    unmasked_renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,
    debug_renderer_info_available:!!debug,context_lost:gl.isContextLost()};
}).filter(Boolean)'''

SWEEP_INSPECT_JS = '''() => ({sweep_stats:window.__atlas?.sweepStats?.() ?? null,
  missing:[...new Set([...(window.__atlas?.missingTiles?.() || []),...(window.__promo?.missingTiles?.() || [])])],
  progress:window.__atlasHostProgress ?? null})'''


def origin_url(value):
    parsed = urlsplit(value)
    if (parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password
            or parsed.path not in ("", "/") or parsed.query or parsed.fragment):
        raise host.StageError("base-url debe ser un origen HTTP(S), sin credenciales, ruta ni query")
    return parsed.scheme + "://" + parsed.netloc


def error_details(exc):
    return {"error_type": type(exc).__name__, "error": host.safe_message(str(exc)) or type(exc).__name__}


@contextlib.asynccontextmanager
async def driver_context(gpu="software"):
    from playwright.async_api import async_playwright
    overrides = {"PW_TEST_SCREENSHOT_NO_FONTS_READY": "1"}
    if gpu == "intel-vulkan":
        overrides["VK_ICD_FILENAMES"] = INTEL_ICD
    previous = {name: os.environ.get(name) for name in overrides}
    os.environ.update(overrides)
    try:
        async with async_playwright() as playwright:
            yield playwright
    finally:
        for name, value in previous.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value


def proc_table():
    table = {}
    for path in Path("/proc").iterdir():
        if not path.name.isdigit():
            continue
        try:
            fields = (path / "stat").read_text().rpartition(")")[2].split()
            table[int(path.name)] = {"ppid": int(fields[1]), "state": fields[0],
                "cpu_ticks": int(fields[11]) + int(fields[12]), "start_ticks": int(fields[19]),
                "rss_bytes": int(fields[21]) * os.sysconf("SC_PAGE_SIZE")}
        except (OSError, ValueError, IndexError):
            continue
    return table


def server_pids(port):
    inodes = set()
    for name in ("tcp", "tcp6"):
        try:
            for line in (Path("/proc/net") / name).read_text().splitlines()[1:]:
                fields = line.split()
                if int(fields[1].split(":")[-1], 16) == port and fields[3] == "0A":
                    inodes.add("socket:[" + fields[9] + "]")
        except OSError:
            pass
    result = []
    for pid in proc_table():
        proc = Path("/proc") / str(pid)
        try:
            if proc.stat().st_uid == os.getuid() and any(os.readlink(fd) in inodes for fd in (proc / "fd").iterdir()):
                result.append(pid)
        except (OSError, PermissionError):
            continue
    return result


class Resources:
    def __init__(self, server):
        self.server, self.samples, self.seen = set(server), [], {}

    def sample(self, phase):
        table, own = proc_table(), {os.getpid()}
        while True:
            children = {pid for pid, row in table.items() if row["ppid"] in own}
            if children <= own:
                break
            own |= children
        selected = own | self.server
        while True:
            children = {pid for pid, row in table.items() if row["ppid"] in selected}
            if children <= selected:
                break
            selected |= children
        rows = {str(pid): table[pid] for pid in selected if pid in table}
        memory = {}
        for line in Path("/proc/meminfo").read_text().splitlines():
            key, _, value = line.partition(":")
            if key in ("MemAvailable", "SwapFree"):
                memory[key + "_kB"] = int(value.split()[0])
        sample = {"phase": phase, "monotonic": time.monotonic(), "at": host.utc(), "memory": memory,
                  "processes": rows, "rss_bytes": sum(row["rss_bytes"] for row in rows.values())}
        for pid, row in rows.items():
            if int(pid) != os.getpid() and int(pid) in own:
                self.seen[pid] = row["start_ticks"]
        if self.samples:
            previous, elapsed = self.samples[-1], sample["monotonic"] - self.samples[-1]["monotonic"]
            ticks = sum(max(0, row["cpu_ticks"] - previous["processes"][pid]["cpu_ticks"])
                        for pid, row in rows.items() if pid in previous["processes"]
                        and row["start_ticks"] == previous["processes"][pid]["start_ticks"])
            sample["cpu_percent_one_core"] = round(ticks / os.sysconf("SC_CLK_TCK") / max(elapsed, 0.001) * 100, 2)
        self.samples.append(sample)
        return sample

    def report(self):
        table = proc_table()
        remaining = [int(pid) for pid, start in self.seen.items() if int(pid) in table
                     and table[int(pid)]["start_ticks"] == start and table[int(pid)]["state"] != "Z"]
        return {"server_pids": sorted(self.server), "samples": self.samples,
                "peak_sampled_rss_bytes": max((s["rss_bytes"] for s in self.samples), default=0),
                "browser_or_driver_descendants_remaining": remaining,
                "limits": "Samples cover this host process, descendants and discovered API listeners; no process command lines or environment read. A single verification does not establish absence of a long-term leak."}


def budget_cache(base_class):
    class BudgetCache(base_class):
        def __init__(self, max_tiles, max_bytes):
            super().__init__()
            self.max_tiles, self.max_bytes = max_tiles, max_bytes
            self.budget_lock, self.written = threading.Lock(), {}

        def put(self, provider, z, x, y, data):
            with self.budget_lock:
                path = self.path_for(provider, z, x, y)
                if path.is_file():
                    return path
                used = self.written.setdefault(provider.id, {"tiles": 0, "bytes": 0})
                if used["tiles"] >= self.max_tiles or used["bytes"] + len(data) > self.max_bytes:
                    raise host.StageError("Presupuesto de caché alcanzado para " + provider.id)
                result = super().put(provider, z, x, y, data)
                used["tiles"] += 1
                used["bytes"] += len(data)
                return result
    return BudgetCache


class DemandFetch:
    def __init__(self, cache, providers):
        self.cache, self.providers = cache, providers
        self.semaphores = {name: threading.BoundedSemaphore(4) for name in providers}
        self.lock, self.blocked, self.stats = threading.Lock(), set(), {}
        self.pool = ThreadPoolExecutor(max_workers=8)

    def fetch(self, name, tile):
        with self.semaphores[name]:
            with self.lock:
                row = self.stats.setdefault(name, {"demanded": 0, "served": 0, "missing": 0, "failed": 0, "blocked": 0})
                row["demanded"] += 1
                if name in self.blocked:
                    row["blocked"] += 1
                    return
            try:
                # Existing adapter: finite attempts, license guard, four requests/provider and atomic writes.
                data = self.cache.get_or_fetch(self.providers[name], *tile)
                with self.lock:
                    row["served" if data else "missing"] += 1
            except Exception as exc:
                with self.lock:
                    self.blocked.add(name)
                    row["failed"] += 1
                    row["failure_type"] = type(exc).__name__

    def report(self):
        return {"providers": self.stats, "new_cache": self.cache.written, "blocked_providers": sorted(self.blocked),
                "limits": {"workers": 8, "per_provider": 4, "attempts_per_tile": 3,
                           "new_tiles_per_provider": self.cache.max_tiles, "new_bytes_per_provider": self.cache.max_bytes}}


def file_response(path, header=None):
    size = path.stat().st_size
    headers = {"Accept-Ranges": "bytes", "Cache-Control": "no-cache"}
    start, end, status = 0, size - 1, 200
    if header:
        match = re.fullmatch(r"bytes=(\d+)-(\d*)", header)
        if not match:
            return {"status": 416, "body": b"", "headers": {**headers, "Content-Range": f"bytes */{size}"}}
        start = int(match[1])
        end = min(int(match[2]), size - 1) if match[2] else size - 1
        if start > end:
            return {"status": 416, "body": b"", "headers": {**headers, "Content-Range": f"bytes */{size}"}}
        status = 206
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    if end - start + 1 > 32 * 1024 * 1024:
        raise host.StageError("Solicitud de caché >32MiB; se requieren rangos para PMTiles")
    with path.open("rb") as stream:
        stream.seek(start)
        body = stream.read(end - start + 1)
    return {"status": status, "body": body, "headers": headers,
            "content_type": mimetypes.guess_type(path.name)[0] or "application/octet-stream"}


def checkpoints(ctx, shots=False):
    report_path = ctx.file("work/results/test/compile-report.json")
    if not report_path.is_file():
        raise host.StageError("Se requiere compile-report.json para capturar checkpoints")
    report = host.load(report_path)
    words = [word for segment in host.load(ctx.file("assets/lyrics.json"))["segments"] for word in segment["words"]]
    result = []
    def add(ident, target):
        time_value = min(words, key=lambda word: abs(word["start"] - target))["start"]
        result.append({"id": ident, "time": time_value})
    add("intro", 0 if shots else report["evidence"]["intro_end"]["time"])
    for chapter in report["evidence"]["chapters"]:
        if chapter.get("transition"):
            # El checkpoint de ruta debe conservar el instante exacto del plano general.
            result.append({"id": chapter["iso2"].lower() + "-route",
                           "time": chapter["transition"]["route_checkpoint"]})
        add(chapter["iso2"].lower() + "-flag", chapter.get("flag_reveal_start", chapter["start"]) + (3 if shots else 2))
        if not shots:
            add(chapter["iso2"].lower() + "-portrait", chapter["portrait_start"]["time"] + 1)
        for region in chapter["regions"][:1 if shots else 2]:
            add(region["id"], (region["start"] + region["out"]) / 2 if shots
                else min(region["out"] - 0.3, region["start"] + 3.5))
    closing = report["evidence"].get("outro")
    if closing:
        # Hay cola de audio sin palabras: revisar también el último cuadro real.
        result.extend({"id": ident, "time": closing[key]} for ident, key in (
            ("outro-entry", "entry_checkpoint"), ("outro", "mid_checkpoint"), ("outro-end", "end_checkpoint")))
    else:
        add("outro", words[-1]["start"])
    return result


async def verify_browser(ctx, args, cache, resources, report, fetcher=None):
    origin = origin_url(args.base_url)
    files = "/api/v1/explainer/files/"
    episode_prefix = files + "sandbox/" + quote(args.category) + "/" + quote(args.episode) + "/"
    engine_roots = tuple(dict.fromkeys((host.ATLAS.relative_to(host.TEMPLATES).as_posix(),
                                      "nodeatlas/atlas-cinematico/_atlas", "sandbox/nodehistory/_atlas")))
    engine_prefixes = tuple(files + prefix + root + "/"
                            for root in engine_roots for prefix in ("", "bundled/"))
    allowed = (episode_prefix, *engine_prefixes, files + "sandbox/_proto/", files + "bundled/sandbox/_proto/")
    url = origin + episode_prefix + "index.html?" + urlencode({"warm": "1", "autoplay": "0", "loop": "0", "t": "0"})
    scene = host.load(ctx.file("assets/scene.json"))
    duration = scene["duration"]
    points = checkpoints(ctx, args.shots) if args.capture_checkpoints or args.shots else []
    report.update(url=url, duration_seconds=duration, cache_only_browser=fetcher is None, frames=0, captures=[],
                  missing=[], blocked_requests=[], failed_responses=[], page_errors=[], console_errors=[])
    report["verification_scope"] = "checkpoints_only" if args.shots else "full_timeline_grid"
    gpu = getattr(args, "gpu", "software")
    report["gpu"] = {"requested_mode": gpu, "browser_args": gpu_arguments(gpu),
                     "explicit_driver_overrides": {"VK_ICD_FILENAMES": INTEL_ICD} if gpu == "intel-vulkan" else {}}
    capture_at = {}
    for point in points:
        capture_at.setdefault(point["time"], []).append(point["id"])
    times = sorted(capture_at) if fetcher is None or args.shots else []
    io_limit = asyncio.Semaphore(8)
    async with driver_context(gpu) as playwright:
        browser = await playwright.chromium.launch(headless=True, args=report["gpu"]["browser_args"])
        try:
            page = await browser.new_page(viewport={"width": args.width, "height": args.height}, device_scale_factor=1)
            page.on("pageerror", lambda error: report["page_errors"].append(host.safe_message(error)))
            page.on("console", lambda message: report["console_errors"].append(host.safe_message(message.text)) if message.type == "error" else None)
            page.on("response", lambda response: report["failed_responses"].append({"status": response.status,
                         "path": urlsplit(response.url).path}) if response.status >= 400 else None)
            async def route_request(route):
                parsed = urlsplit(route.request.url)
                path = unquote(parsed.path)
                if parsed.scheme + "://" + parsed.netloc != origin or not path.startswith(allowed):
                    report["blocked_requests"].append({"origin": parsed.scheme + "://" + parsed.netloc, "path": path})
                    await route.abort()
                    return
                cache_prefix = next((prefix + "cache/" for prefix in engine_prefixes
                                     if path.startswith(prefix + "cache/")), None)
                if cache_prefix is not None:
                    suffix = path[len(cache_prefix):]
                    cache_root = cache.root.resolve()
                    target = (cache_root / suffix).resolve()
                    match = re.fullmatch(r"([a-z0-9-]+)/(\d+)/(\d+)/(\d+)\.(jpg|png|webp)", suffix)
                    if fetcher and target.is_relative_to(cache_root) and not target.is_file() and match:
                        name, z, x, y, ext = match.groups()
                        provider = fetcher.providers.get(name)
                        if provider and provider.ext == ext:
                            await asyncio.get_running_loop().run_in_executor(fetcher.pool, fetcher.fetch, name, tuple(map(int, (z, x, y))))
                    if not target.is_relative_to(cache_root) or not target.is_file():
                        report["missing"].append("cache/" + suffix)
                        await route.fulfill(status=404, body=b"")
                        return
                    async with io_limit:
                        try:
                            payload = await asyncio.to_thread(file_response, target, route.request.headers.get("range"))
                            await route.fulfill(**payload)
                        except Exception as exc:
                            report["missing"].append("cache/" + suffix + ":" + type(exc).__name__)
                            await route.fulfill(status=500, body=b"")
                    return
                await route.continue_()
            await page.route("**/*", route_request)
            report["operation"] = "navigate"
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            report["operation"] = "wait_atlas_ready"
            await page.wait_for_function("window.__atlas && window.__promo && typeof window.__promo.seek === 'function'", timeout=90000)
            await asyncio.wait_for(page.evaluate("async () => {await window.__atlas.ready; await window.__promo.prepare(0);}"), timeout=120)
            report["clock"] = "Proto query t=0 freezes before the RAF loop; no continuous canvas copy"
            report["operation"] = "inspect_gpu"
            report["gpu"]["contexts"] = await asyncio.wait_for(page.evaluate(GPU_INSPECT_JS), timeout=10)
            report["gpu"].update(verify_gpu(gpu, report["gpu"]["contexts"]))
            print(json.dumps({"stage": "preview-gpu", "size": [args.width, args.height], "gpu": report["gpu"]}), flush=True)
            report["operation"] = "inspect_fonts"
            try:
                report["fonts"] = await asyncio.wait_for(page.evaluate('''async () => {
                  const ready=await Promise.race([document.fonts.ready.then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),5000))]);
                  return {ready_within_5s:ready,status:document.fonts.status,
                    faces:[...document.fonts].slice(0,128).map(f=>({family:f.family,weight:f.weight,style:f.style,status:f.status}))};
                }'''), timeout=10)
            except Exception as exc:
                report["fonts"] = {"inspection_failed": True, **error_details(exc)}
            report["screenshot_font_wait_skipped"] = True
            resources.sample("browser_ready")
            async def inspect_sweep(phase):
                try:
                    snapshot = await asyncio.wait_for(page.evaluate(SWEEP_INSPECT_JS), timeout=5)
                    if not isinstance(snapshot, dict):
                        raise host.StageError("Telemetría de barrido inválida")
                    report["sweep_stats"] = snapshot.get("sweep_stats")
                    stats = snapshot.get("sweep_stats") or {}
                    if type(stats.get("lastTime")) in (int, float):
                        report["last_time"] = stats["lastTime"]
                    report["missing"] = list(dict.fromkeys(report["missing"] + snapshot.get("missing", [])))
                    entry = {"at": host.utc(), "phase": phase, "sweep_stats": snapshot.get("sweep_stats"),
                             "last_time": report.get("last_time"), "missing": snapshot.get("missing", []),
                             "progress": snapshot.get("progress")}
                except Exception as exc:
                    entry = {"at": host.utc(), "phase": phase, **error_details(exc)}
                report.setdefault("sweep_telemetry", []).append(entry)
                print(json.dumps({"stage": "preview-telemetry", "size": [args.width, args.height],
                                  "pass": "demand" if fetcher else "cache-only", **entry}), flush=True)
            async def sample_during():
                while True:
                    await asyncio.sleep(15)
                    resources.sample("during_sweep")
                    await inspect_sweep("during_sweep")
            sampler = asyncio.create_task(sample_during())
            try:
                if not args.shots:
                    report["operation"] = "native_tile_sweep"
                    total = math.ceil(duration / args.step) + 1
                    def progress(value, stats=None):
                        report["frames"] = round(float(value) * total)
                        report["last_time"] = min(duration, max(0, report["frames"] - 1) * args.step)
                        if isinstance(stats, dict):
                            report["sweep_stats"] = stats
                        print(json.dumps({"stage": "preview-progress", "size": [args.width, args.height],
                            "phase": "demand" if fetcher else "cache-only", "frame": report["frames"],
                            "frames_total": total, "time": report["last_time"], "sweep_stats": report.get("sweep_stats")}), flush=True)
                    await page.expose_function("atlasHostProgress", progress)
                    sweep_missing = await page.evaluate('''async step => {
                      let count=0,last=performance.now();
                      return await window.__atlas.sweep(step, progress => {
                        window.__atlasHostProgress=progress;
                        if (++count % 100 === 0 || progress === 1 || performance.now()-last>=15000) {
                          last=performance.now();void window.atlasHostProgress(progress,window.__atlas.sweepStats?.() ?? null);
                        }
                      });
                    }''', args.step)
                    report["missing"] += sweep_missing
                    report["coverage_samples"] = total
                    report["frames"] = total
                    report["last_time"] = duration
            finally:
                sampler.cancel()
                await asyncio.gather(sampler, return_exceptions=True)
                await inspect_sweep("after_sweep" if not args.shots else "checkpoints_only")
            for number, value in enumerate(times):
                action = "prepare" if fetcher else "seek"
                report["operation"] = action + ":" + str(value)
                await asyncio.wait_for(page.evaluate("async ({t,action}) => {await window.__promo[action](t);}",
                                                      {"t": value, "action": action}), timeout=120)
                if args.shots:
                    report["frames"] += 1
                report["shot_seeks"] = report.get("shot_seeks", 0) + 1
                report["last_time"] = value
                for ident in capture_at.get(value, []) if fetcher is None else []:
                    name = f"preview-{args.width}x{args.height}-{ident}.jpg"
                    target = ctx.file("work/results/test/" + name)
                    attempt = {"id": ident, "time": value, "status": "started"}
                    report.setdefault("capture_attempts", []).append(attempt)
                    report["operation"] = "screenshot:" + ident
                    capture_started = time.monotonic()
                    try:
                        await page.locator("#stage > canvas").first.screenshot(path=str(target), type="jpeg", quality=85,
                                                                              animations="disabled", timeout=120000)
                        attempt["status"] = "complete"
                    except Exception as exc:
                        attempt.update(status="failed", **error_details(exc))
                        raise
                    finally:
                        attempt["seconds"] = round(time.monotonic() - capture_started, 2)
                    report["captures"].append({"id": ident, "time": value, "file": target.relative_to(ctx.episode).as_posix()})
                resources.sample("after_shot")
                if number % 100 == 0:
                    print(json.dumps({"stage": "preview-progress", "size": [args.width, args.height], "frame": number,
                                     "frames_total": len(times), "time": value}), flush=True)
            report["missing"] += await page.evaluate("() => [...new Set([...(window.__atlas.missingTiles?.() || []),...(window.__promo.missingTiles?.() || [])])]")
            report["engine_stats"] = await page.evaluate("() => ({stats:window.__atlas.stats(),fps:window.__atlas.fps()})")
            resources.sample("before_browser_close")
            report["operation"] = "complete"
        finally:
            close_started = time.monotonic()
            try:
                await asyncio.wait_for(browser.close(), timeout=60)
            except Exception as exc:
                report["browser_close_error"] = error_details(exc)
            finally:
                report["browser_close_seconds"] = round(time.monotonic() - close_started, 2)
    await asyncio.sleep(1)
    resources.sample("after_browser_close")


async def run(ctx, args):
    from src.adapters.maps.cache import TileCache
    from src.adapters.maps.providers import load_providers
    origin = urlsplit(origin_url(args.base_url))
    resources = Resources(server_pids(origin.port or (443 if origin.scheme == "https" else 80)))
    resources.sample("before")
    cache = budget_cache(TileCache)(args.max_new_tiles_per_provider, args.max_new_mb_per_provider * 1024 * 1024)
    bound_inputs = ("assets/scene.json", "assets/lyrics.json", "assets/song.mp3",
                    "assets/geo.resolved.json", "assets/config.json", "index.html")
    source_hashes = lambda: {name: host.digest(ctx.file(name)) for name in bound_inputs}
    renderer_hashes = lambda: {name: host.digest(path) for name, path in host.PUBLIC_HASHES.items()}
    report = {"at": host.utc(), "ok": False, "width": args.width, "height": args.height, "step": args.step,
              "fetch_requested": args.fetch, "source_hashes": source_hashes(),
              "renderer_hashes": renderer_hashes(),
              "renderer_hash_scope": "atlas_factory.PUBLIC_HASHES only; does not certify the entire engine"}
    try:
        if not all(report["source_hashes"].values()) or not all(report["renderer_hashes"].values()):
            raise host.StageError("Faltan entradas o archivos compartidos para vincular el preview")
        if args.fetch:
            fetcher = DemandFetch(cache, load_providers())
            report["demand_fetch_pass"] = {}
            try:
                await asyncio.wait_for(verify_browser(ctx, args, cache, resources, report["demand_fetch_pass"], fetcher), timeout=args.timeout)
            except Exception as exc:
                report["demand_fetch_pass"].update(ok=False, **error_details(exc))
            finally:
                await asyncio.to_thread(fetcher.pool.shutdown, wait=True, cancel_futures=True)
                report["fetch"] = fetcher.report()
            resources.sample("after_fetch")
        await asyncio.wait_for(verify_browser(ctx, args, cache, resources, report), timeout=args.timeout)
        report["ok"] = not any(report.get(key) for key in ("missing", "blocked_requests", "failed_responses", "page_errors", "console_errors"))
    except Exception as exc:
        report.update(ok=False, **error_details(exc))
    finally:
        report["source_hashes_after"] = source_hashes()
        report["renderer_hashes_after"] = renderer_hashes()
        report["inputs_unchanged"] = (report["source_hashes"] == report["source_hashes_after"]
                                      and report["renderer_hashes"] == report["renderer_hashes_after"])
        if not report["inputs_unchanged"]:
            report.update(ok=False, input_change_error="Los archivos del episodio o del renderizador cambiaron durante el preview")
        resources.sample("finished")
        report["resources"] = resources.report()
        if report["resources"]["browser_or_driver_descendants_remaining"]:
            report["ok"] = False
        report["missing"] = sorted(set(report.get("missing", [])))
        report["rendered_or_published"] = False
        ctx.save(f"work/results/test/preview-{args.width}x{args.height}.json", report)
    return {"ok": report["ok"], "size": [args.width, args.height], "frames": report.get("frames", 0),
            "captures": len(report.get("captures", [])), "missing": len(report["missing"]),
            "error": report.get("error"), "remaining_browser_processes": report["resources"]["browser_or_driver_descendants_remaining"],
            "report": f"work/results/test/preview-{args.width}x{args.height}.json"}


def self_test():
    import tempfile
    assert origin_url("http://127.0.0.1:8000/") == "http://127.0.0.1:8000"
    for invalid in ("file:///tmp", "http://name:password@localhost", "http://localhost/private"):
        try:
            origin_url(invalid)
            raise AssertionError("invalid origin accepted")
        except host.StageError:
            pass
    with tempfile.TemporaryDirectory(prefix="atlas-preview-range-", dir="/tmp") as tmp:
        path = Path(tmp) / "world.pmtiles"
        path.write_bytes(b"0123456789")
        partial = file_response(path, "bytes=2-5")
        assert partial["status"] == 206 and partial["body"] == b"2345"
        assert file_response(path, "bytes=20-")["status"] == 416
        assert file_response(path)["body"] == b"0123456789"
    resource = Resources([])
    resource.sample("synthetic")
    assert resource.report()["peak_sampled_rss_bytes"] > 0
    assert "--use-angle=swiftshader" in gpu_arguments("software")
    assert "--use-angle=vulkan" in gpu_arguments("intel-vulkan")
    assert "--enable-unsafe-swiftshader" not in gpu_arguments("intel-vulkan")
    assert verify_gpu("intel-vulkan", [{"unmasked_renderer": "ANGLE (Intel, Vulkan1.4 Intel UHD Graphics630)"}])["intel_vulkan_verified"]
    for renderer in ("ANGLE (Google, Vulkan SwiftShader)", "llvmpipe (LLVM15)", "ANGLE (Intel, OpenGL)", "WebGL"):
        try:
            verify_gpu("intel-vulkan", [{"unmasked_renderer": renderer}])
            raise AssertionError("GPU fallback accepted")
        except host.StageError:
            pass
    assert verify_gpu("software", [{"unmasked_renderer": "ANGLE (Google, SwiftShader)"}])["software_detected"]
    return {"ok": True, "synthetic": True, "checks": ["origin_validation", "pmtiles_ranges", "resource_sampling", "gpu_flags", "no_hardware_fallback"],
            "not_exercised": ["API", "browser", "downloads", "tiles", "visual QA"]}


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--episode")
    parser.add_argument("--category", default="nodeatlas")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--width", type=int, default=1920)
    parser.add_argument("--height", type=int, default=1080)
    parser.add_argument("--gpu", choices=("software", "intel-vulkan"), default="software")
    parser.add_argument("--step", type=float, default=0.25)
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--capture-checkpoints", action="store_true")
    parser.add_argument("--shots", action="store_true", help="Checkpoints: intro/end, rutas, banderas +3s y primera región al medio; no verifica todo el timeline")
    parser.add_argument("--max-new-tiles-per-provider", type=int, default=6000)
    parser.add_argument("--max-new-mb-per-provider", type=int, default=256)
    parser.add_argument("--timeout", type=int, default=1800)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        print(json.dumps(self_test(), ensure_ascii=False))
        return 0
    if (not args.episode or args.width <= 0 or args.height <= 0 or not math.isfinite(args.step) or args.step <= 0
            or args.timeout <= 0 or args.max_new_tiles_per_provider <= 0 or args.max_new_mb_per_provider <= 0):
        parser.error("episode y límites positivos son obligatorios")
    sys.path.insert(0, str(host.SERVER))
    try:
        from src.config.settings import settings
        from src.config.profile_layout import layout_for_settings
        layout = layout_for_settings(settings)
        if not settings.storage_profile_dir:
            raise host.StageError("Se requiere perfil efectivo v2/v3")
        manifest_path = layout.root / "profile.json"
        manifest = host.load(manifest_path)
        if manifest["id"] != settings.storage_profile_id or manifest["schema_version"] != layout.schema_version:
            raise host.StageError("El manifiesto no coincide con el perfil efectivo")
        ctx = host.Context(layout, {"id": manifest["id"], "schema_version": manifest["schema_version"]}, args.episode, args.category)
        ctx.log.mkdir(parents=True, exist_ok=True, mode=0o700)
        with host.checked(ctx.log / "run.lock", ctx.log).open("a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise host.StageError("Otra etapa está activa para este episodio") from None
            ctx.require()
            result = asyncio.run(run(ctx, args))
            ctx.checkpoint(f"preview-{args.width}x{args.height}", result)
            host.private_tree(ctx.episode)
            host.private_tree(ctx.log)
        print(json.dumps({"stage": "preview", **result}, ensure_ascii=False))
        return 0 if result["ok"] else 1
    except Exception as exc:
        print(json.dumps({"stage": "preview", "ok": False, **error_details(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
