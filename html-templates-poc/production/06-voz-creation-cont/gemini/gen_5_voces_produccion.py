#!/usr/bin/env python3
"""
gemini · 5 AUDIOS PRODUCCIÓN — narración "Economía del siglo XIV" (~3 min)
=========================================================================
Genera 5 audios de PRODUCCIÓN a partir del MISMO texto ya existente, con
5 configuraciones distintas:

  01, 02, 03  →  VOZ SERENA pero cargada de EMOCIÓN y MADUREZ, como un gran
                 narrador que cuenta una historia que le importa. La MISMA voz
                 y el MISMO tono de principio a fin (NO cambia en todo el audio).
                 Se usan 3 voces distintas (una por audio) para poder elegir.

  04, 05      →  La voz CAMBIA según la escena / lo que está pasando, siguiendo
                 el arco emocional (auge → grietas → Peste Negra → renacer):
                    · 04 = cambios SUTILES   (3 voces, transiciones suaves).
                    · 05 = cambios DRAMÁTICOS (1 voz por escena, más contraste).

IMPORTANTE (free tier): el límite es 10 requests/día POR MODELO. Por eso:
  · las voces serenas se generan en UNA sola llamada (todo el texto de corrido);
  · el trabajo se reparte entre modelos para no agotar la cuota de ninguno;
  · se reintenta con backoff respetando el retryDelay del 429 (límite por minuto).

Devuelve PCM (16-bit, 24 kHz, mono) que se envuelve en WAV.
Requiere GEMINI_API_KEY en el .env de la raíz. Correr desde la raíz del repo:
    uv run python html-templates/production/06-voz-creation-cont/gemini/gen_5_voces_produccion.py
"""
import base64
import os
import time
import wave
from pathlib import Path

import httpx
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT  = SCRIPT_DIR.parents[3]
OUT_DIR    = SCRIPT_DIR / "output_produccion"; OUT_DIR.mkdir(parents=True, exist_ok=True)
load_dotenv(REPO_ROOT / ".env")
KEY = os.getenv("GEMINI_API_KEY", "").strip()

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# Modelos (cada uno tiene su propia cuota diaria en free tier):
M_NATURAL   = "gemini-2.5-pro-preview-tts"     # el más natural  -> voces serenas
M_FLASH     = "gemini-2.5-flash-preview-tts"   # rápido/barato   -> escenas dramáticas
# (gemini-3.1-flash-tts-preview es el más expresivo pero hoy ya agotó su cuota)

# Silencio (200 ms) entre segmentos para suavizar los cambios de voz.
GAP_MS      = 200
GAP_SILENCE = b"\x00\x00" * int(24000 * GAP_MS / 1000)

# --- INSTRUCCIÓN BASE para los 3 audios de VOZ SERENA (no hablada) ---
STYLE_SERENA = (
    "Narra este texto completo como un gran documental histórico. Voz {desc}, SERENA y "
    "calmada, pero cargada de EMOCIÓN genuina y MADUREZ, como un narrador experimentado que "
    "cuenta una historia que le importa de verdad. Ritmo pausado, respiración natural, pausas "
    "sentidas y énfasis suave en los momentos clave; construye tensión hacia la Peste Negra y "
    "cierra con esperanza serena. NO grites ni sobreactúes. Mantén EXACTAMENTE la misma voz, el "
    "mismo tono y la misma calma de principio a fin, sin cambiar de registro. "
    "Español latino neutro:\n\n"
)

# Instrucción para segmentos por escena (audios 04 y 05).
STYLE_ESCENA = (
    "Narra este fragmento de un documental histórico con voz madura y emoción genuina, como si "
    "contaras la historia en persona. Emoción de esta parte: {emocion} Español latino neutro. "
    "Habla solo el texto, no leas estas instrucciones:\n\n"
)

# ---------------------------------------------------------------------------
# TEXTO YA EXISTENTE, partido en 6 ESCENAS (mismo texto del test de economía).
# ---------------------------------------------------------------------------
AUGE = (
    "Europa, siglo catorce. El continente despierta a una era de comercio como jamás se había visto. "
    "Los caminos se llenan de mercaderes, y las grandes ferias de Champaña laten con oro, seda y "
    "especias traídas desde el otro extremo del mundo. En el corazón de todo, tres ciudades italianas, "
    "Florencia, Venecia y Génova, se convierten en el centro financiero del mundo conocido. "
    "Es la época en que nace la banca moderna. Las casas Bardi y Peruzzi prestan fortunas a reyes, a "
    "nobles y hasta al mismísimo Papa. Se inventan la letra de cambio, el crédito, la contabilidad por "
    "partida doble. Por primera vez en la historia, el dinero viaja más rápido que los ejércitos. "
    "Europa parecía, sencillamente, imparable."
)
GREMIOS = (
    "En las ciudades, los gremios lo controlaban todo. En Florencia, el Arte de la Lana transformaba la "
    "lana inglesa en los paños más finos de Europa; en Flandes, telares enteros trabajaban sin descanso. "
    "Artesanos, tejedores y comerciantes tejían, sin saberlo, la primera economía verdaderamente "
    "internacional de la historia."
)
GRIETAS = (
    "Pero bajo tanta prosperidad, algo comenzaba a agrietarse. Entre mil trescientos quince y mil "
    "trescientos diecisiete, la Gran Hambruna vació los campos: lluvias interminables pudrieron las "
    "cosechas, y millones pasaron hambre. Y cuando el rey de Inglaterra se negó a pagar sus enormes "
    "deudas, los bancos más poderosos de Florencia cayeron, uno tras otro."
)
PESTE = (
    "Y entonces, llegó la muerte. Año mil trescientos cuarenta y ocho. La Peste Negra cruzó el "
    "continente como una sombra silenciosa. En apenas tres años, murió un tercio de toda Europa. Pueblos "
    "enteros quedaron vacíos. Los mercados, en silencio. Las rutas, abandonadas. La economía que parecía "
    "eterna se detuvo de golpe."
)
RENACER = (
    "Y sin embargo, de aquella tragedia nació un mundo nuevo. Con tan pocos trabajadores vivos, la mano "
    "de obra pasó a valer oro. Los salarios subieron, los campesinos exigieron libertad, y el viejo "
    "orden feudal empezó a desmoronarse para siempre. De las cenizas del siglo catorce nacería, siglos "
    "más tarde, la economía moderna que hoy conocemos."
)
MORALEJA = (
    "Lo que el siglo catorce le enseñó al mundo es que ninguna riqueza es eterna. Que hasta las crisis "
    "más terribles también siembran el futuro. Porque la economía, al final, no es solo dinero: es la "
    "historia de cómo los seres humanos caen, se reinventan, y vuelven a empezar."
)
TEXTO_COMPLETO = " ".join([AUGE, GREMIOS, GRIETAS, PESTE, RENACER, MORALEJA])

# ---------------------------------------------------------------------------
# Definición de los 5 audios. Cada uno = lista de segmentos (voz, prompt+texto).
# Un solo segmento = una sola voz constante. Varios = la voz cambia.
# ---------------------------------------------------------------------------
def serena(voice, desc):
    return [(voice, STYLE_SERENA.format(desc=desc) + TEXTO_COMPLETO)]


def esc(voice, emocion, *textos):
    return (voice, STYLE_ESCENA.format(emocion=emocion) + " ".join(textos))


AUDIOS = [
    # --- 3 voces serenas constantes (1 llamada cada una) ---
    dict(nombre="01_serena_Charon", model=M_NATURAL,
         segs=serena("Charon", "grave, profunda y de documental")),
    dict(nombre="02_serena_Gacrux", model=M_NATURAL,
         segs=serena("Gacrux", "madura, cálida y de gran experiencia")),
    dict(nombre="03_serena_Vindemiatrix", model=M_NATURAL,
         segs=serena("Vindemiatrix", "suave, gentil y envolvente")),

    # --- 04 · cambios SUTILES: 3 voces, escenas agrupadas por voz ---
    dict(nombre="04_escenas_sutil", model=M_NATURAL, segs=[
        esc("Sulafat",
            "empieza con asombro y calidez esperanzadora al abrir la historia y pasa a un "
            "orgullo tranquilo por lo que se estaba construyendo.",
            AUGE, GREMIOS),
        esc("Charon",
            "el tono se oscurece: tensión contenida y presagio, y luego gravedad solemne y "
            "conmovedora en el clímax de la Peste Negra, con pausas largas.",
            GRIETAS, PESTE),
        esc("Vindemiatrix",
            "de la tristeza nace la esperanza que se levanta poco a poco, y cierra reflexiva, "
            "serena y sabia, con calidez final.",
            RENACER, MORALEJA),
    ]),

    # --- 05 · cambios DRAMÁTICOS: una voz distinta por escena ---
    dict(nombre="05_escenas_dramatico", model=M_FLASH, segs=[
        esc("Sadachbia", "asombro y energía positiva que va creciendo; abre una gran historia.", AUGE),
        esc("Iapetus",   "tono informativo y firme, con orgullo tranquilo.", GREMIOS),
        esc("Orus",      "tensión que crece, preocupación, presagio de que algo va mal.", GRIETAS),
        esc("Charon",    "clímax trágico: voz grave, solemne y conmovedora, pausas largas, dolor contenido.", PESTE),
        esc("Sulafat",   "la esperanza se levanta, con dignidad y fuerza renovada.", RENACER),
        esc("Gacrux",    "reflexiva, serena y sabia; conclusión emotiva con calidez final.", MORALEJA),
    ]),
]


def tts(client, model, text, voice, max_retries=6):
    """Un segmento de texto → PCM crudo. Reintenta en 429 respetando retryDelay."""
    body = {
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }
    headers = {"x-goog-api-key": KEY, "Content-Type": "application/json"}
    for intento in range(max_retries):
        r = client.post(ENDPOINT.format(model=model), json=body, headers=headers)
        if r.status_code == 429:
            wait = _retry_delay(r) + 2
            if intento < max_retries - 1:
                print(f"        · 429 (límite por minuto). Espero {wait:.0f}s y reintento "
                      f"({intento + 1}/{max_retries - 1}) ...", flush=True)
                time.sleep(wait)
                continue
            raise RuntimeError(f"429 tras {max_retries} intentos (cuota diaria del modelo agotada): "
                               f"{r.text[:160]}")
        if r.status_code != 200:
            raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
        j = r.json()
        try:
            b64 = j["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
        except (KeyError, IndexError):
            raise RuntimeError(f"sin audio: {str(j)[:300]}")
        return base64.b64decode(b64)


def _retry_delay(resp):
    """Segundos de espera sugeridos por el 429 (retryDelay); por defecto 20s."""
    try:
        for d in resp.json().get("error", {}).get("details", []):
            if d.get("@type", "").endswith("RetryInfo"):
                return float(str(d.get("retryDelay", "20s")).rstrip("s"))
    except Exception:
        pass
    return 20.0


def save_wav(pcm, path):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
        w.writeframes(pcm)
    return len(pcm) / 2 / 24000  # duración en segundos


def main():
    if not KEY:
        raise SystemExit(f"✖ Falta GEMINI_API_KEY en {REPO_ROOT / '.env'}")

    print(f"Texto: {len(TEXTO_COMPLETO)} caracteres · 5 audios\n")

    results = []
    with httpx.Client(timeout=300) as client:
        for a in AUDIOS:
            nombre, model, segs = a["nombre"], a["model"], a["segs"]
            voces = " → ".join(dict.fromkeys(v for v, _ in segs))
            tipo = "voz constante" if len(segs) == 1 else "voz cambia"
            print(f"[{nombre}]  {model.split('-preview')[0]} · {tipo}: {voces}")
            try:
                pcm = b""
                for i, (voice, text) in enumerate(segs):
                    if len(segs) > 1:
                        print(f"    · segmento {i + 1}/{len(segs)} → {voice} ...", flush=True)
                    if pcm:
                        pcm += GAP_SILENCE
                    pcm += tts(client, model, text, voice)
                out = OUT_DIR / f"{nombre}.wav"
                dur = save_wav(pcm, out)
                print(f"    ✔ {out.name}  ({dur:.0f}s)\n")
                results.append((nombre, "OK", dur, voces))
            except Exception as e:
                print(f"    ✖ falló: {e}\n")
                results.append((nombre, "FALLÓ", 0, str(e)[:70]))

    print("=" * 92)
    for nombre, st, dur, extra in results:
        print(f"{nombre:24} {st:7} {(str(int(dur)) + 's') if dur else '-':>5}   {extra}")
    print("=" * 92)
    print(f"Audios en: {OUT_DIR}")


if __name__ == "__main__":
    main()
