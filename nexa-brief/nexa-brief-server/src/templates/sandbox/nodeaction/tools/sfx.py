#!/usr/bin/env python3
"""Efectos de sonido de una escena NodeAction, sintetizados a partir de lo que pasa en ella.

Lee los eventos compilados del motor (window.__action.audioEvents(): disparos, impactos en el
cuerpo, manchas en el suelo, caídas, saltos y aterrizajes, con paneo y volumen por distancia)
y sintetiza cada sonido con numpy (sin bancos de sonido externos: nada de licencias).
Mezcla opcional con la narración (--voice) y/o una música (--music) → assets/song.mp3, que es
la pista que usan el motor y el grabador (config.audio.src).

Uso (desde nexa-brief-server/):
  .venv/bin/python src/templates/sandbox/nodeaction/tools/sfx.py <carpeta-escena>
        [--voice assets/narration.mp3] [--music pista.mp3 --music-gain 0.25] [--sfx-gain 1.0] [--tail 0.5]
Salida: <escena>/assets/sfx.wav (solo efectos) y <escena>/assets/song.mp3 (mezcla final).
"""
import argparse, asyncio, functools, http.server, json, pathlib, subprocess, tempfile, threading, wave

import numpy as np
from scipy.signal import butter, sosfilt

HERE = pathlib.Path(__file__).resolve()
TEMPLATES = HERE.parents[3]
SR = 48000


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k):
        pass


async def events_of(scene_dir: pathlib.Path):
    from playwright.async_api import async_playwright
    h = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(_Quiet, directory=str(TEMPLATES)))
    threading.Thread(target=h.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{h.server_port}/{scene_dir.resolve().relative_to(TEMPLATES).as_posix()}/index.html?t=0"
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1920, "height": 1080})
        await pg.goto(url)
        await pg.wait_for_function("window.__action", timeout=30000)
        ev = await pg.evaluate("window.__action.audioEvents()")
        await b.close()
    h.shutdown()
    return ev


# ------------------------------ síntesis ------------------------------
def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], btype="band", fs=SR, output="sos"), x)


def lp(x, f):
    return sosfilt(butter(2, f, btype="low", fs=SR, output="sos"), x)


def tvec(sec):
    return np.arange(int(sec * SR)) / SR


def shot(R, hero):
    t = tvec(0.12)
    burst = bp(R.standard_normal(t.size), 900, 5200) * np.exp(-t / 0.011)
    f = 190 * np.exp(-t / 0.05) + 80
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.028)
    click = bp(R.standard_normal(t.size), 3000, 9000) * np.exp(-t / 0.003) * 0.6
    return (burst * 0.9 + thump * 0.85 + click) * (1.0 if hero else 0.6) * R.uniform(0.9, 1.08)


def splat(R, body):
    t = tvec(0.28)
    x = np.zeros(t.size)
    for d0, a in ((0, 1.0), (R.uniform(0.012, 0.022), 0.6), (R.uniform(0.035, 0.06), 0.35)):
        k = t >= d0
        x[k] += lp(R.standard_normal(k.sum()), 2600 if body else 1900) * np.exp(-(t[k] - d0) / 0.026) * a
    if body:
        x += np.sin(2 * np.pi * 155 * t) * np.exp(-t / 0.04) * 0.55
    return x * (1.0 if body else 0.55)


def fall(R):
    t = tvec(0.45)
    x = np.sin(2 * np.pi * 62 * t) * np.exp(-t / 0.09) + lp(R.standard_normal(t.size), 380) * np.exp(-t / 0.06) * 0.8
    k = t >= 0.13
    x[k] += (np.sin(2 * np.pi * 75 * (t[k] - 0.13)) * np.exp(-(t[k] - 0.13) / 0.05)) * 0.35
    return x * 0.9


def land(R):
    t = tvec(0.18)
    return np.sin(2 * np.pi * 95 * t) * np.exp(-t / 0.04) * 0.5 + lp(R.standard_normal(t.size), 600) * np.exp(-t / 0.03) * 0.35


def whoosh(R):
    t = tvec(0.32)
    u = t / t[-1]
    return bp(R.standard_normal(t.size), 350, 2200) * np.sin(np.pi * u) ** 2 * 0.22


SYN = {"shot": lambda R, e: shot(R, e.get("hero")), "hit": lambda R, e: splat(R, True), "splat": lambda R, e: splat(R, False),
       "fall": lambda R, e: fall(R), "land": lambda R, e: land(R), "whoosh": lambda R, e: whoosh(R)}


def render(events, total):
    n = int((total + 0.5) * SR)
    out = np.zeros((n, 2))
    for i, e in enumerate(events):
        fn = SYN.get(e["kind"])
        if not fn:
            continue
        R = np.random.default_rng(int(e["t"] * 1000) * 31 + i)
        s = fn(R, e) * e.get("gain", 1.0)
        th = (e.get("pan", 0) + 1) * np.pi / 4
        i0 = int(e["t"] * SR)
        i1 = min(n, i0 + s.size)
        if i0 >= n:
            continue
        out[i0:i1, 0] += s[: i1 - i0] * np.cos(th)
        out[i0:i1, 1] += s[: i1 - i0] * np.sin(th)
    # sala chica: dos reflexiones tempranas
    room = out.copy()
    for d, g in ((0.023, 0.18), (0.047, 0.11)):
        k = int(d * SR)
        room[k:] += out[:-k] * g
    return room


def load_audio(path: pathlib.Path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scene")
    ap.add_argument("--voice", default="")
    ap.add_argument("--music", default="")
    ap.add_argument("--music-gain", type=float, default=0.25)
    ap.add_argument("--sfx-gain", type=float, default=1.0)
    ap.add_argument("--tail", type=float, default=0.5)
    a = ap.parse_args()
    scene = pathlib.Path(a.scene)
    if not (scene / "index.html").exists():
        scene = HERE.parents[1] / a.scene
    ev = asyncio.run(events_of(scene))
    total = max(ev["total"], max((e["t"] for e in ev["events"]), default=0) + 0.6) + a.tail
    fx = render(ev["events"], total)
    peak = np.abs(fx).max() or 1
    fx *= 0.89 / peak * a.sfx_gain
    (scene / "assets").mkdir(exist_ok=True)
    write_wav(scene / "assets" / "sfx.wav", fx)
    mix = fx.copy()
    n = mix.shape[0]
    if a.voice:
        v = load_audio(scene / a.voice if not pathlib.Path(a.voice).is_absolute() else pathlib.Path(a.voice))
        if v.shape[0] > n:
            mix = np.vstack([mix, np.zeros((v.shape[0] - n, 2))]); n = mix.shape[0]
        mix *= 0.55                       # los efectos quedan debajo de la voz
        mix[: v.shape[0]] += v
    if a.music:
        m = load_audio(pathlib.Path(a.music))
        reps = int(np.ceil(n / m.shape[0]))
        mix += np.tile(m, (reps, 1))[:n] * a.music_gain
    mix *= 0.95 / (np.abs(mix).max() or 1)
    with tempfile.TemporaryDirectory() as td:
        wav = pathlib.Path(td) / "mix.wav"
        write_wav(wav, mix)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-c:a", "libmp3lame", "-b:a", "192k", str(scene / "assets" / "song.mp3")], check=True)
    kinds = {}
    for e in ev["events"]:
        kinds[e["kind"]] = kinds.get(e["kind"], 0) + 1
    print(f"efectos: {sum(kinds.values())} ({', '.join(f'{k} {v}' for k, v in sorted(kinds.items()))}) · {total:.2f} s")
    print("→", scene / "assets" / "sfx.wav", "y", scene / "assets" / "song.mp3")


if __name__ == "__main__":
    main()
