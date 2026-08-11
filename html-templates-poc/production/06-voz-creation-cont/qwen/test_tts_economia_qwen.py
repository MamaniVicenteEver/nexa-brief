#!/usr/bin/env python3
"""
qwen · TTS ECONOMÍA (~3 min) con UNA sola voz — Qwen3-TTS-Flash (Alibaba DashScope)
==================================================================================
Genera UN audio de ~3 min de la narración de economía del siglo XIV, con la MISMA
voz de principio a fin (no cambia de voz). Misma historia que la de Novita.

Usa el endpoint INTERNACIONAL (Singapur) → consume tu cuota gratis.
La API devuelve una URL de audio; el script la descarga y, si el texto es largo,
trocea por frases (misma voz siempre) y concatena en un solo archivo.

Antes de correr:
  1) Pon tu token en el .env de la raíz:  DASHSCOPE_API_KEY=sk-....
  2) uv run python html-templates/production/06-voz-creation-cont/qwen/test_tts_economia_qwen.py
"""
import io
import os
import re
import wave
from pathlib import Path

import httpx
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT  = SCRIPT_DIR.parents[3]
OUT_DIR    = SCRIPT_DIR / "output"; OUT_DIR.mkdir(exist_ok=True)
load_dotenv(REPO_ROOT / ".env")
KEY = os.getenv("DASHSCOPE_API_KEY", "").strip()

URL   = "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
MODEL = "qwen3-tts-flash"
VOICE = "Ethan"        # voz MASCULINA. Otras: Cherry (mujer), Dylan, Serena, Chelsie, Jada, Sunny...
LANG  = "Spanish"
MAX_CHARS = 450        # trocea el texto largo por frases (siempre la MISMA voz)

# ── La narración de economía (~3 min), como UN texto continuo (una sola voz) ──
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
    "Y entonces… llegó la muerte. Año mil trescientos cuarenta y ocho. La Peste Negra cruzó el "
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


def make_chunks(text, limit):
    """Agrupa frases completas en trozos de <= limit caracteres (respeta las frases)."""
    parts = re.split(r"(?<=[.!?…])\s+", text.strip())
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


def tts(client, text):
    body = {"model": MODEL, "input": {"text": text, "voice": VOICE, "language_type": LANG}}
    r = client.post(URL, json=body, headers={"Authorization": f"Bearer {KEY}",
                                             "Content-Type": "application/json"})
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
    j = r.json()
    audio_url = j.get("output", {}).get("audio", {}).get("url")
    if not audio_url:
        raise RuntimeError(f"sin audio en la respuesta: {str(j)[:300]}")
    return client.get(audio_url, timeout=90).content


def main():
    if not KEY:
        print("✖ Falta DASHSCOPE_API_KEY en el .env de la raíz.")
        print(f"  Agrega:  DASHSCOPE_API_KEY=sk-....  en {REPO_ROOT / '.env'}")
        raise SystemExit(1)

    chunks = make_chunks(TEXTO, MAX_CHARS)
    print(f"Voz: {VOICE} · modelo: {MODEL} · {len(TEXTO)} caracteres en {len(chunks)} trozos\n")

    audios = []
    with httpx.Client(timeout=120) as client:
        for i, c in enumerate(chunks, 1):
            print(f"  · trozo {i}/{len(chunks)} ({len(c)} car) ...", flush=True)
            audios.append(tts(client, c))

    # ── Concatenar en UN solo archivo ────────────────────────────────────────
    is_wav = audios[0][:4] == b"RIFF"
    if is_wav:
        out = OUT_DIR / f"audio_{MODEL}_{VOICE}_economia.wav"
        frames, params = [], None
        for a in audios:
            with wave.open(io.BytesIO(a), "rb") as w:
                if params is None:
                    params = w.getparams()
                frames.append(w.readframes(w.getnframes()))
        with wave.open(str(out), "wb") as w:
            w.setparams(params)
            for f in frames:
                w.writeframes(f)
    else:  # mp3 u otro: concatenar bytes
        out = OUT_DIR / f"audio_{MODEL}_{VOICE}_economia.mp3"
        out.write_bytes(b"".join(audios))

    kb = out.stat().st_size / 1024
    cost = len(TEXTO) / 1_000_000 * 13  # ~$13/1M car (aprox) — gratis si estás en la cuota
    print(f"\n✅ Listo: {out}  ({kb:.0f} KB)")
    print(f"   Caracteres: {len(TEXTO)} · costo aprox: ${cost:.4f} (o $0 con cuota gratis)")
    print("   UNA sola voz de principio a fin. Escúchalo y me dices.")


if __name__ == "__main__":
    main()
