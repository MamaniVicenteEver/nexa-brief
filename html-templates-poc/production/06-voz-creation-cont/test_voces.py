#!/usr/bin/env python3
"""
06-voz-creation-cont · Test de VOCES (texto -> audio) con Novita AI
===================================================================

Objetivo: generar la MISMA narración (~30s) con VARIAS voces y tonos, para
escucharlas y decidir cuál vale la pena. NO clona voces (eso es para después).

Qué hace:
  - Manda un texto en español a la API de voz de Novita.
  - Prueba varias voces graves/autoritarias de MiniMax (con emoción + tono).
  - Compara MiniMax HD vs Turbo (calidad vs precio) y una muestra de Fish Audio.
  - Guarda cada resultado como .mp3 en ./output/ y al final imprime una tabla
    con estado, tiempo, tamaño y costo estimado de cada uno.

Cómo correr (desde la raíz del repo, que es donde está el .env):
    uv run python html-templates/production/06-voz-creation-cont/test_voces.py

El token se lee de la variable NOVITA_IA del archivo .env (ya lo pusiste).
"""

from __future__ import annotations

import time
from pathlib import Path

import httpx
from dotenv import load_dotenv
import os

# ─────────────────────────────────────────────────────────────────────────────
# 0) Token y rutas
# ─────────────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[2]          # 06-.. -> production -> html-templates -> raíz
OUTPUT_DIR = SCRIPT_DIR / "output"

load_dotenv(REPO_ROOT / ".env")            # carga el .env de la raíz del repo
TOKEN = os.getenv("NOVITA_IA", "").strip()

BASE = "https://api.novita.ai"

# ─────────────────────────────────────────────────────────────────────────────
# 1) EL TEXTO a narrar (~30s). Edítalo libremente para probar otros guiones.
#    Ritmo de lectura ~150 palabras/min -> ~75-85 palabras ≈ 30 segundos.
# ─────────────────────────────────────────────────────────────────────────────
TEXTO = (
    "Mucho antes de las monedas y los mercados, el ser humano ya negociaba. "
    "Un puñado de grano por una piel curtida; una herramienta por un día de trabajo. "
    "Así nació la economía: no en un banco, sino en la confianza entre dos personas. "
    "Con el tiempo, el trueque se volvió moneda, la moneda se volvió deuda, "
    "y la deuda movió imperios. La economía no es solo dinero: "
    "es la historia de cómo aprendimos a depender los unos de los otros."
)

# ─────────────────────────────────────────────────────────────────────────────
# 2) MATRIZ DE PRUEBAS — voz dura, con experiencia y conocimiento.
#    Cada fila = un audio. Añade/quita filas para probar más combinaciones.
#
#    engine:   "minimax-hd" | "minimax-turbo" | "fish"
#    voice_id: (solo MiniMax) voz del sistema. Graves/autoritarias:
#              Deep_Voice_Man, Determined_Man, Imposing_Manner, Patient_Man, Elegant_Man
#    emotion:  happy|sad|angry|fearful|disgusted|surprised|calm|fluent|whisper
#    pitch:    (solo MiniMax) -12..12  (negativo = más grave / más "dura")
# ─────────────────────────────────────────────────────────────────────────────
TEST_CASES = [
    # --- MiniMax 2.8 HD: comparar voces graves con tono serio/documental ---
    {"engine": "minimax-hd",    "voice_id": "Deep_Voice_Man", "emotion": "calm",   "pitch": 0,  "label": "hd_DeepVoiceMan_calm"},
    {"engine": "minimax-hd",    "voice_id": "Deep_Voice_Man", "emotion": "calm",   "pitch": -4, "label": "hd_DeepVoiceMan_calm_grave"},
    {"engine": "minimax-hd",    "voice_id": "Determined_Man", "emotion": "calm",   "pitch": 0,  "label": "hd_DeterminedMan_calm"},
    {"engine": "minimax-hd",    "voice_id": "Imposing_Manner","emotion": "calm",   "pitch": 0,  "label": "hd_ImposingManner_calm"},
    {"engine": "minimax-hd",    "voice_id": "Patient_Man",    "emotion": "fluent", "pitch": 0,  "label": "hd_PatientMan_fluent"},
    {"engine": "minimax-hd",    "voice_id": "Elegant_Man",    "emotion": "fluent", "pitch": 0,  "label": "hd_ElegantMan_fluent"},
    # --- MiniMax 2.8 Turbo: misma voz, para comparar CALIDAD vs PRECIO ---
    {"engine": "minimax-turbo", "voice_id": "Deep_Voice_Man", "emotion": "calm",   "pitch": 0,  "label": "turbo_DeepVoiceMan_calm"},
    # --- Fish Audio S1: voz por defecto (sin clonar), 1 muestra de referencia ---
    {"engine": "fish",          "voice_id": None,             "emotion": None,     "pitch": 0,  "label": "fish_default"},
]

# Precio por 1M de caracteres (para estimar el costo de cada llamada)
PRICE_PER_M = {"minimax-hd": 100.0, "minimax-turbo": 60.0, "fish": 15.0}

ENDPOINTS = {
    "minimax-hd":    f"{BASE}/v3/minimax-speech-2.8-hd",
    "minimax-turbo": f"{BASE}/v3/minimax-speech-2.8-turbo",
    "fish":          f"{BASE}/v4beta/txt2speech",
}

LANGUAGE_BOOST = "Spanish"   # si diera error, prueba "auto"
SPEED = 1.0                  # 0.5..2 (más bajo = más solemne)


# ─────────────────────────────────────────────────────────────────────────────
# 3) Llamadas a la API
# ─────────────────────────────────────────────────────────────────────────────
def synth_minimax(client: httpx.Client, engine: str, case: dict) -> bytes:
    """MiniMax devuelve JSON con el audio en HEX -> lo decodificamos a bytes."""
    body = {
        "text": TEXTO,
        "voice_setting": {
            "voice_id": case["voice_id"],   # ← MiniMax exige el voice_id AQUÍ dentro
            "vol": 1.0,
            "pitch": case["pitch"],
            "speed": SPEED,
            "emotion": case["emotion"],
        },
        "audio_setting": {
            "format": "mp3",
            "bitrate": 128000,
            "sample_rate": 32000,
            "channel": 1,
        },
        "language_boost": LANGUAGE_BOOST,
        "stream": False,
        "output_format": "hex",
    }
    r = client.post(ENDPOINTS[engine], json=body)
    if r.status_code >= 400:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:400]}")
    j = r.json()
    base = j.get("base_resp", {})
    if base.get("status_code", 0) != 0:
        raise RuntimeError(f"MiniMax error {base.get('status_code')}: {base.get('status_msg')}")
    audio_hex = j.get("data", {}).get("audio")
    if not audio_hex:
        raise RuntimeError(f"MiniMax no devolvió audio. Respuesta: {str(j)[:300]}")
    return bytes.fromhex(audio_hex)


def synth_fish(client: httpx.Client, case: dict) -> bytes:
    """Fish Audio devuelve los bytes del audio directamente (o JSON si hay error)."""
    body = {
        "text": TEXTO,
        "model": "s1",
        "format": "mp3",
        "prosody": {"speed": SPEED, "volume": 0},
    }
    r = client.post(ENDPOINTS["fish"], json=body)
    ctype = r.headers.get("content-type", "")
    if "json" in ctype:  # vino un error en JSON, no audio
        raise RuntimeError(f"Fish error: {r.text[:300]}")
    r.raise_for_status()
    if not r.content:
        raise RuntimeError("Fish devolvió respuesta vacía")
    return r.content


# ─────────────────────────────────────────────────────────────────────────────
# 4) Main
# ─────────────────────────────────────────────────────────────────────────────
def main() -> None:
    if not TOKEN:
        print("✖ No encontré NOVITA_IA en el .env de la raíz del repo.")
        print(f"  Busqué en: {REPO_ROOT / '.env'}")
        raise SystemExit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    n_chars = len(TEXTO)
    print(f"Texto: {n_chars} caracteres (~{n_chars/850*60:.0f}s aprox de audio)\n")
    print(f"Generando {len(TEST_CASES)} audios en: {OUTPUT_DIR}\n")

    headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
    results = []

    with httpx.Client(headers=headers, timeout=180) as client:
        for i, case in enumerate(TEST_CASES, 1):
            engine = case["engine"]
            label = case["label"]
            fname = f"{i:02d}_{label}.mp3"
            fpath = OUTPUT_DIR / fname
            print(f"[{i}/{len(TEST_CASES)}] {engine:<14} {label} ...", end=" ", flush=True)
            t0 = time.monotonic()
            try:
                if engine.startswith("minimax"):
                    audio = synth_minimax(client, engine, case)
                elif engine == "fish":
                    audio = synth_fish(client, case)
                else:
                    raise RuntimeError(f"engine desconocido: {engine}")
                fpath.write_bytes(audio)
                dt = time.monotonic() - t0
                kb = len(audio) / 1024
                cost = n_chars / 1_000_000 * PRICE_PER_M[engine]
                print(f"OK  {dt:4.1f}s  {kb:6.1f} KB  ${cost:.4f}")
                results.append((i, engine, label, "OK", f"{dt:.1f}s", f"{kb:.0f}KB", f"${cost:.4f}", fname))
            except Exception as e:
                dt = time.monotonic() - t0
                print(f"FALLÓ  ({e})")
                results.append((i, engine, label, "FALLÓ", f"{dt:.1f}s", "-", "-", str(e)[:60]))

    # ── Resumen ──────────────────────────────────────────────────────────────
    print("\n" + "=" * 92)
    print(f"{'#':>2}  {'ENGINE':<14} {'VOZ/TONO':<28} {'ESTADO':<7} {'T':>6} {'TAM':>7} {'COSTO':>9}  ARCHIVO/ERROR")
    print("-" * 92)
    ok = 0
    for (i, engine, label, status, dt, size, cost, extra) in results:
        if status == "OK":
            ok += 1
        print(f"{i:>2}  {engine:<14} {label:<28} {status:<7} {dt:>6} {size:>7} {cost:>9}  {extra}")
    print("=" * 92)
    total_cost = n_chars / 1_000_000 * sum(PRICE_PER_M[c['engine']] for c in TEST_CASES)
    print(f"\n{ok}/{len(TEST_CASES)} audios generados.  Costo total aprox: ${total_cost:.4f}")
    print(f"Escúchalos en: {OUTPUT_DIR}")
    print("Elige tu favorito y me dices cuál para dejarlo fijo en el pipeline (voice_port).")


if __name__ == "__main__":
    main()
