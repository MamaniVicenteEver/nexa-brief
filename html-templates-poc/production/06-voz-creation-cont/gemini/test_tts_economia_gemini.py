#!/usr/bin/env python3
"""
gemini · TTS ECONOMÍA (~3 min) — 3 modelos de Gemini (por millón de tokens)
===========================================================================
Genera la MISMA narración de economía del siglo XIV (~3 min) con los 3 modelos
de voz de Gemini que se cobran por 1M de tokens, para comparar su nivel:
    · gemini-2.5-flash-preview-tts   ($0.50 in / $10 out por 1M)  -> el más barato
    · gemini-2.5-pro-preview-tts     ($1.00 in / $20 out por 1M)  -> más natural
    · gemini-3.1-flash-tts-preview   ($1.00 in / $20 out por 1M)  -> el más nuevo/expresivo

MISMA voz (grave/documental) + MISMO estilo en los 3 → comparación modelo vs modelo.
Devuelve PCM (16-bit, 24 kHz, mono) que se envuelve en WAV.

Requiere GEMINI_API_KEY en el .env de la raíz (ya lo tienes).
Correr desde la raíz del repo:
    uv run python html-templates/production/06-voz-creation-cont/gemini/test_tts_economia_gemini.py
"""
import base64
import os
import re
import wave
from pathlib import Path

import httpx
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT  = SCRIPT_DIR.parents[3]
OUT_DIR    = SCRIPT_DIR / "output"; OUT_DIR.mkdir(parents=True, exist_ok=True)
load_dotenv(REPO_ROOT / ".env")
KEY = os.getenv("GEMINI_API_KEY", "").strip()

MODELS = [
    "gemini-2.5-flash-preview-tts",
    "gemini-2.5-pro-preview-tts",
    "gemini-3.1-flash-tts-preview",
]
VOICE = "Charon"     # grave/documental. Otras graves: Algenib (gravelly), Gacrux (madura), Orus (firme)
MAX_CHARS = 1800     # trocear texto largo (misma voz/estilo siempre)

# Estilo (instrucción NO hablada — Gemini la obedece, no la lee):
STYLE = ("Narra el siguiente texto como un documental histórico serio, con voz grave, "
         "profunda y solemne, ritmo pausado, emoción genuina y énfasis marcado en los "
         "momentos clave. Construye tensión y llega a un clímax serio y conmovedor en la "
         "Peste Negra. Habla en español latino neutro:\n\n")

TEXTO = (
    "Europa, siglo catorce. El continente despierta a una era de comercio como jamás se había visto. "
    "Los caminos se llenan de mercaderes, y las grandes ferias de Champaña laten con oro, seda y "
    "especias traídas desde el otro extremo del mundo. En el corazón de todo, tres ciudades italianas, "
    "Florencia, Venecia y Génova, se convierten en el centro financiero del mundo conocido. "
    "Es la época en que nace la banca moderna. Las casas Bardi y Peruzzi prestan fortunas a reyes, a "
    "nobles y hasta al mismísimo Papa. Se inventan la letra de cambio, el crédito, la contabilidad por "
    "partida doble. Por primera vez en la historia, el dinero viaja más rápido que los ejércitos. "
    "Europa parecía, sencillamente, imparable. "
    "En las ciudades, los gremios lo controlaban todo. En Florencia, el Arte de la Lana transformaba la "
    "lana inglesa en los paños más finos de Europa; en Flandes, telares enteros trabajaban sin descanso. "
    "Artesanos, tejedores y comerciantes tejían, sin saberlo, la primera economía verdaderamente "
    "internacional de la historia. "
    "Pero bajo tanta prosperidad, algo comenzaba a agrietarse. Entre mil trescientos quince y mil "
    "trescientos diecisiete, la Gran Hambruna vació los campos: lluvias interminables pudrieron las "
    "cosechas, y millones pasaron hambre. Y cuando el rey de Inglaterra se negó a pagar sus enormes "
    "deudas, los bancos más poderosos de Florencia cayeron, uno tras otro. "
    "Y entonces, llegó la muerte. Año mil trescientos cuarenta y ocho. La Peste Negra cruzó el "
    "continente como una sombra silenciosa. En apenas tres años, murió un tercio de toda Europa. Pueblos "
    "enteros quedaron vacíos. Los mercados, en silencio. Las rutas, abandonadas. La economía que parecía "
    "eterna se detuvo de golpe. "
    "Y sin embargo, de aquella tragedia nació un mundo nuevo. Con tan pocos trabajadores vivos, la mano "
    "de obra pasó a valer oro. Los salarios subieron, los campesinos exigieron libertad, y el viejo "
    "orden feudal empezó a desmoronarse para siempre. De las cenizas del siglo catorce nacería, siglos "
    "más tarde, la economía moderna que hoy conocemos. "
    "Lo que el siglo catorce le enseñó al mundo es que ninguna riqueza es eterna. Que hasta las crisis "
    "más terribles también siembran el futuro. Porque la economía, al final, no es solo dinero: es la "
    "historia de cómo los seres humanos caen, se reinventan, y vuelven a empezar."
)

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def make_chunks(text, limit):
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    chunks, cur = [], ""
    for s in parts:
        if len(cur) + len(s) + 1 <= limit:
            cur = (cur + " " + s).strip()
        else:
            if cur:
                chunks.append(cur)
            cur = s
    if cur:
        chunks.append(cur)
    return chunks


def tts_chunk(client, model, text):
    body = {
        "contents": [{"parts": [{"text": STYLE + text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}},
        },
    }
    r = client.post(ENDPOINT.format(model=model), json=body,
                    headers={"x-goog-api-key": KEY, "Content-Type": "application/json"})
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
    j = r.json()
    try:
        b64 = j["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
    except (KeyError, IndexError):
        raise RuntimeError(f"sin audio: {str(j)[:300]}")
    return base64.b64decode(b64)


def main():
    if not KEY:
        raise SystemExit(f"✖ Falta GEMINI_API_KEY en {REPO_ROOT / '.env'}")

    chunks = make_chunks(TEXTO, MAX_CHARS)
    print(f"Voz: {VOICE} · {len(TEXTO)} caracteres en {len(chunks)} trozos · {len(MODELS)} modelos\n")

    results = []
    with httpx.Client(timeout=300) as client:
        for model in MODELS:
            print(f"[{model}]")
            try:
                pcm = b""
                for i, c in enumerate(chunks, 1):
                    print(f"    · trozo {i}/{len(chunks)} ...", flush=True)
                    pcm += tts_chunk(client, model, c)
                out = OUT_DIR / f"audio_{model}_economia.wav"
                with wave.open(str(out), "wb") as w:
                    w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
                    w.writeframes(pcm)
                dur = len(pcm) / 2 / 24000
                print(f"    ✔ {out.name}  ({dur:.0f}s)\n")
                results.append((model, "OK", dur, out.name))
            except Exception as e:
                print(f"    ✖ falló: {e}\n")
                results.append((model, "FALLÓ", 0, str(e)[:60]))

    print("=" * 80)
    for model, st, dur, extra in results:
        print(f"{model:34} {st:7} {(str(int(dur))+'s') if dur else '-':>5}   {extra}")
    print("=" * 80)
    print(f"Audios en: {OUT_DIR}")


if __name__ == "__main__":
    main()
