#!/usr/bin/env python3
"""
06-voz-creation-cont · Narración ECONOMÍA DEL SIGLO XIV (Europa) — voces elegidas
================================================================================
Genera la MISMA narración (~3 min) con las 5 voces de Novita que elegiste,
aplicando las MEJORES configuraciones de cada motor:
  · MiniMax  -> emoción por segmento + PAUSAS dramáticas <#seg#> + ritmo documental
  · Fish S1  -> ETIQUETAS inline de emoción/suspiros: (serious) (sighing) (sad)...
Arco con clímax SERIO en la Peste Negra de 1348.

Voces elegidas (tu feedback):
  01 · MiniMax HD    · Deep_Voice_Man   -> "me gusta, para otro sector"
  05 · MiniMax HD    · Patient_Man      -> "WAO increíble"
  04 · MiniMax HD    · Imposing_Manner  -> "también está bien"
  07 · MiniMax Turbo · Deep_Voice_Man   -> comparar HD vs barato
  08 · Fish Audio S1 · voz por defecto  -> "decente"

Correr desde la RAÍZ del repo (ahí está el .env):
    uv run python html-templates/production/06-voz-creation-cont/test_economia_novita.py
"""
from __future__ import annotations

import os
import re
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

# ── Token y rutas ────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT  = SCRIPT_DIR.parents[2]
OUTPUT_DIR = SCRIPT_DIR / "output_economia"
load_dotenv(REPO_ROOT / ".env")
TOKEN = os.getenv("NOVITA_IA", "").strip()

BASE = "https://api.novita.ai"
ENDPOINTS = {
    "minimax-hd":    f"{BASE}/v3/minimax-speech-2.8-hd",
    "minimax-turbo": f"{BASE}/v3/minimax-speech-2.8-turbo",
    "fish":          f"{BASE}/v4beta/txt2speech",
}
PRICE_PER_M = {"minimax-hd": 100.0, "minimax-turbo": 60.0, "fish": 15.0}

SPEED = {"minimax-hd": 0.95, "minimax-turbo": 0.95, "fish": 0.85}  # Fish lee rápido → más lento

# ── Voces elegidas ───────────────────────────────────────────────────────────
VOICES = [
    {"key": "01_hd_DeepVoiceMan",    "engine": "minimax-hd",    "voice_id": "Deep_Voice_Man"},
    {"key": "05_hd_PatientMan",      "engine": "minimax-hd",    "voice_id": "Patient_Man"},
    {"key": "04_hd_ImposingManner",  "engine": "minimax-hd",    "voice_id": "Imposing_Manner"},
    {"key": "07_turbo_DeepVoiceMan", "engine": "minimax-turbo", "voice_id": "Deep_Voice_Man"},
    {"key": "08_fish_default",       "engine": "fish",          "voice_id": None},
]

# ── Narración por segmentos ──────────────────────────────────────────────────
#   text    : texto base. Las pausas <#s#> son para MiniMax (se quitan en Fish).
#   mm_emo  : emoción MiniMax (happy|sad|angry|fearful|disgusted|surprised|calm|fluent|whisper)
#   fish    : etiquetas inline de Fish (emoción/suspiros) que se anteponen al texto
SEGMENTS = [
    {"mm_emo": "calm", "fish": "(serious)",
     "text": ("Europa, siglo catorce. <#0.5#> El continente despierta a una era de "
              "comercio como jamás se había visto. Los caminos se llenan de mercaderes, "
              "y las grandes ferias de Champaña laten con oro, seda y especias traídas "
              "desde el otro extremo del mundo. <#0.4#> En el corazón de todo, tres "
              "ciudades italianas —Florencia, Venecia y Génova— se convierten en el "
              "centro financiero del mundo conocido.")},
    {"mm_emo": "fluent", "fish": "(serious)",
     "text": ("Es la época en que nace la banca moderna. <#0.4#> Las casas Bardi y "
              "Peruzzi prestan fortunas a reyes, a nobles y hasta al mismísimo Papa. "
              "Se inventan la letra de cambio, el crédito, la contabilidad por partida "
              "doble. <#0.3#> Por primera vez en la historia, el dinero viaja más rápido "
              "que los ejércitos. Europa parecía, sencillamente, imparable.")},
    {"mm_emo": "fluent", "fish": "(serious)",
     "text": ("En las ciudades, los gremios lo controlaban todo. <#0.3#> En Florencia, "
              "el Arte de la Lana transformaba la lana inglesa en los paños más finos de "
              "Europa; en Flandes, telares enteros trabajaban sin descanso. <#0.4#> "
              "Artesanos, tejedores y comerciantes tejían, sin saberlo, la primera "
              "economía verdaderamente internacional de la historia.")},
    {"mm_emo": "calm", "fish": "(worried)",
     "text": ("Pero bajo tanta prosperidad, algo comenzaba a agrietarse. <#0.5#> Entre "
              "mil trescientos quince y mil trescientos diecisiete, la Gran Hambruna "
              "vació los campos: lluvias interminables pudrieron las cosechas, y millones "
              "pasaron hambre. <#0.4#> Y cuando el rey de Inglaterra se negó a pagar sus "
              "enormes deudas, los bancos más poderosos de Florencia cayeron, uno tras otro.")},
    {"mm_emo": "sad", "fish": "(serious)(sad) (sighing)",
     "text": ("Y entonces <#0.7#> llegó la muerte. <#0.6#> Año mil trescientos cuarenta "
              "y ocho. La Peste Negra cruzó el continente como una sombra silenciosa. "
              "<#0.4#> En apenas tres años, murió un tercio de toda Europa. <#0.5#> "
              "Pueblos enteros quedaron vacíos. Los mercados, en silencio. Las rutas, "
              "abandonadas. <#0.4#> La economía que parecía eterna <#0.4#> se detuvo de golpe.")},
    {"mm_emo": "calm", "fish": "(moved)",
     "text": ("Y sin embargo, de aquella tragedia <#0.5#> nació un mundo nuevo. Con tan "
              "pocos trabajadores vivos, la mano de obra pasó a valer oro. Los salarios "
              "subieron, los campesinos exigieron libertad, y el viejo orden feudal "
              "empezó a desmoronarse para siempre. <#0.5#> De las cenizas del siglo "
              "catorce <#0.3#> nacería, siglos más tarde, la economía moderna que hoy "
              "conocemos.")},
    {"mm_emo": "calm", "fish": "(moved)",
     "text": ("Lo que el siglo catorce le enseñó al mundo <#0.4#> es que ninguna riqueza "
              "es eterna. Que hasta las crisis más terribles <#0.3#> también siembran el "
              "futuro. <#0.5#> Porque la economía, al final, no es solo dinero: es la "
              "historia de cómo los seres humanos caen, se reinventan, y vuelven a empezar.")},
]

PAUSE_RE = re.compile(r"<#[\d.]+#>")


# ── Llamadas ─────────────────────────────────────────────────────────────────
def _post(client, url, body, tries=4):
    """POST con reintentos ante 5xx / errores de red (los 500 de MiniMax son transitorios)."""
    for attempt in range(tries):
        try:
            r = client.post(url, json=body)
        except httpx.RequestError as e:
            if attempt < tries - 1:
                time.sleep(2 * (attempt + 1)); continue
            raise RuntimeError(f"red: {e}")
        if r.status_code < 400:
            return r
        if r.status_code >= 500 and attempt < tries - 1:
            print(f"(500, reintento {attempt+1})", end=" ", flush=True)
            time.sleep(2 * (attempt + 1)); continue
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
    raise RuntimeError("agotados los reintentos")


def minimax_call(client, engine, voice_id, text, emotion):
    """Devuelve (audio_bytes, audio_length_ms, chars_facturados)."""
    body = {
        "text": text,
        "voice_setting": {"voice_id": voice_id, "vol": 1.0, "pitch": 0,
                          "speed": SPEED[engine], "emotion": emotion},
        "audio_setting": {"format": "mp3", "bitrate": 128000,
                          "sample_rate": 32000, "channel": 1},
        "language_boost": "Spanish", "stream": False, "output_format": "hex",
    }
    j = _post(client, ENDPOINTS[engine], body).json()
    if j.get("base_resp", {}).get("status_code", 0) != 0:
        raise RuntimeError(f"MiniMax: {j.get('base_resp')}")
    audio = bytes.fromhex(j["data"]["audio"])
    ms = j.get("extra_info", {}).get("audio_length", 0)
    return audio, ms, len(text)


def fish_call(client, text):
    body = {"text": text, "model": "s1", "format": "mp3",
            "temperature": 0.7, "top_p": 0.7,
            "prosody": {"speed": SPEED["fish"], "volume": 0}}
    r = _post(client, ENDPOINTS["fish"], body)
    if "json" in r.headers.get("content-type", ""):
        raise RuntimeError(f"Fish: {r.text[:300]}")
    secs = len(r.content) / 16000  # estimación a 128kbps
    return r.content, int(secs * 1000), len(text)


def minimax_pause_ok(client):
    """Comprueba si MiniMax respeta <#s#> midiendo la diferencia de duración."""
    try:
        _, base_ms, _ = minimax_call(client, "minimax-turbo", "Deep_Voice_Man", "uno dos tres", "calm")
        _, paus_ms, _ = minimax_call(client, "minimax-turbo", "Deep_Voice_Man", "uno <#3#> dos tres", "calm")
        return (paus_ms - base_ms) > 1500
    except Exception as e:
        print("  (no se pudo verificar pausas:", e, ")")
        return False


def build_text(engine, seg, pause_ok):
    if engine == "fish":
        t = PAUSE_RE.sub(" ", seg["text"])         # Fish no usa <#>
        t = re.sub(r"\s+", " ", t).strip()
        return f'{seg["fish"]} {t}'
    return seg["text"] if pause_ok else PAUSE_RE.sub(" ", seg["text"])


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    if not TOKEN:
        raise SystemExit(f"✖ Falta NOVITA_IA en {REPO_ROOT/'.env'}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
    results = []
    with httpx.Client(headers=headers, timeout=180) as client:
        print("Verificando soporte de pausas <#s#> en MiniMax ...", flush=True)
        pause_ok = minimax_pause_ok(client)
        print("  → pausas:", "SÍ (usaré <#s#>)" if pause_ok else "no (uso puntuación)", "\n")

        for v in VOICES:
            eng, key = v["engine"], v["key"]
            print(f"[{key}]  {eng}")
            existing = OUTPUT_DIR / f"{key}_economia.mp3"
            if existing.exists():                       # ya generado → no regastar créditos
                print("    (ya existe, salto)\n")
                results.append((key, eng, 0, existing.stat().st_size / 16000, 0.0, "PREVIO", existing.name))
                continue
            pieces, total_ms, total_chars = [], 0, 0
            try:
                for i, seg in enumerate(SEGMENTS, 1):
                    txt = build_text(eng, seg, pause_ok)
                    print(f"    · seg {i}/{len(SEGMENTS)} ...", end=" ", flush=True)
                    t0 = time.monotonic()
                    if eng == "fish":
                        audio, ms, ch = fish_call(client, txt)
                    else:
                        audio, ms, ch = minimax_call(client, eng, v["voice_id"], txt, seg["mm_emo"])
                    pieces.append(audio); total_ms += ms; total_chars += ch
                    print(f"{time.monotonic()-t0:.1f}s")
                out = OUTPUT_DIR / f"{key}_economia.mp3"
                out.write_bytes(b"".join(pieces))       # concatenar mp3 (mismo formato)
                cost = total_chars / 1_000_000 * PRICE_PER_M[eng]
                dur = total_ms / 1000
                print(f"    ✔ {out.name}  {dur:.0f}s  {total_chars} car  ${cost:.4f}\n")
                results.append((key, eng, total_chars, dur, cost, "OK", out.name))
            except Exception as e:
                print(f"    ✖ falló: {e}\n")
                results.append((key, eng, total_chars, 0, 0, "FALLÓ", str(e)[:50]))

    # ── Resumen ──────────────────────────────────────────────────────────────
    print("=" * 96)
    print(f"{'VOZ':<24}{'MOTOR':<15}{'CAR':>6}{'DUR':>7}{'COSTO real':>12}   ARCHIVO/ERROR")
    print("-" * 96)
    for key, eng, ch, dur, cost, st, extra in results:
        durs = f"{dur:.0f}s" if dur else "-"
        costs = f"${cost:.4f}" if st == "OK" else "-"
        print(f"{key:<24}{eng:<15}{ch:>6}{durs:>7}{costs:>12}   {extra}")
    print("=" * 96)

    # ── Proyección de costos por duración (según precio de cada motor) ────────
    print("\nPROYECCIÓN DE COSTO (≈850 car/min):")
    print(f"{'MOTOR':<16}{'3 min (~2550c)':>16}{'10 min (~8500c)':>18}")
    print("-" * 50)
    for eng, price in PRICE_PER_M.items():
        c3 = 2550 / 1_000_000 * price
        c10 = 8500 / 1_000_000 * price
        print(f"{eng:<16}{'$'+format(c3,'.4f'):>16}{'$'+format(c10,'.4f'):>18}")
    print("-" * 50)
    print("Qwen3-TTS-Flash (Alibaba)  3min: ~$0.0332   10min: ~$0.1105  ($13/1M, 1M gratis)")
    print(f"\nAudios en: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
