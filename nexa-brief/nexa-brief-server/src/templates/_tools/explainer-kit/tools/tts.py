#!/usr/bin/env python3
"""Clientes TTS del explainer-kit (sandbox): Gemini TTS y Novita (MiniMax).

No toca nexa-explainer: solo LEE sus claves de su .env (GEMINI_API_KEY,
NOVITA_IA), o de variables de entorno si están definidas. Nunca imprime claves.

Dos formas de pedirle voz a Gemini:
  · director(): generateContent con un prompt de dirección vocal
    (AUDIO PROFILE / SCENE / DIRECTOR'S NOTES / TRANSCRIPT con [tags]) — el
    mismo patrón que ya funciona en nexa-explainer.
  · annotated(): endpoint `interactions` con un `speech_metadata.style` por
    fragmento (permite dirigir cada frase por separado).
Ambas devuelven PCM 16-bit mono 24 kHz → se guarda como WAV.
"""
from __future__ import annotations
import base64, hashlib, json, os, pathlib, re, time, wave, urllib.request, urllib.error

# claves: se leen de estos .env (en orden) o de variables de entorno; NUNCA se imprimen.
# Rutas relativas al repo (tools → explainer-kit → _tools → templates → src → nexa-brief-server),
# así funcionan en cualquier máquina; antes eran absolutas de una sola computadora y en el
# servidor el kit se quedaba sin claves ("sin claves con cuota").
_SERVER = pathlib.Path(__file__).resolve().parents[5]
ENV_FILES = [_SERVER / ".env",
             _SERVER.parents[1] / "nexa-explainer" / "nexa-explainer-server" / ".env"]
STATE = pathlib.Path(__file__).resolve().parents[1] / ".state" / "gemini-quota.json"

class QuotaError(RuntimeError):
    """cuota diaria agotada para (clave, modelo)"""

def _env_pairs():
    for f in ENV_FILES:
        if not f.exists(): continue
        for line in f.read_text().splitlines():
            m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
            if m: yield m.group(1), re.sub(r"\s+#.*$", "", m.group(2)).strip().strip('"').strip("'")

def _key(name: str) -> str:
    if os.environ.get(name): return os.environ[name]
    for k, v in _env_pairs():
        if k == name and v: return v
    raise RuntimeError(f"{name} no configurada")

def gemini_keys() -> list[tuple[str, str]]:
    """GEMINI_API_KEY, GEMINI_API_KEY1…N de todos los .env (sin repetir valores). → [(nombre, valor)]"""
    seen, out = set(), []
    pairs = [(k, v) for k, v in _env_pairs()] + [(k, v) for k, v in os.environ.items()]
    for k, v in sorted(pairs, key=lambda kv: (kv[0] != "GEMINI_API_KEY", kv[0])):
        if re.fullmatch(r"GEMINI_API_KEY\d*", k) and v and v not in seen:
            seen.add(v); out.append((f"{k}#{hashlib.sha1(v.encode()).hexdigest()[:4]}", v))   # etiqueta única, sin exponer la clave
    return out

def _state():
    try: return json.loads(STATE.read_text())
    except Exception: return {}
def _mark_exhausted(keyname, model):
    st = _state(); st.setdefault(model, {})[keyname] = time.time() + 23.5 * 3600
    STATE.parent.mkdir(exist_ok=True); STATE.write_text(json.dumps(st, indent=1))
def _available(model):
    st = _state().get(model, {}); now = time.time()
    return [(k, v) for k, v in gemini_keys() if st.get(k, 0) < now]

def with_key_rotation(model, call):
    """prueba `call(api_key)` con cada clave de Gemini disponible para `model`; si una da 429 diario,
    la marca agotada ~24 h (en .state/) y pasa a la siguiente. Si se agotan todas → QuotaError."""
    keys = _available(model)
    if not keys: raise QuotaError(f"sin claves con cuota para {model}")
    for name, val in keys:
        try:
            r = call(val); print(f"  · {model} con {name}", flush=True); return r
        except QuotaError:
            print(f"  · {name} sin cuota para {model} → siguiente clave", flush=True); _mark_exhausted(name, model)
    raise QuotaError(f"todas las claves agotadas para {model}")

LAST_USAGE: dict = {}   # usageMetadata de la última respuesta (narrate.py lo anota en el registro del video)

def _post(url: str, body: dict, headers: dict, timeout=300) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) nexa-explainer-kit/1.0", **headers}, method="POST")
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = json.loads(r.read())
                LAST_USAGE.clear(); LAST_USAGE.update(data.get("usageMetadata") or {})
                return data
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:400]
            # en el plan gratuito CADA intento cuenta para la cuota: no reintentar un 429 diario y
            # reintentar un 503 (alta demanda) una sola vez
            if e.code == 429 and "per day" in msg: raise QuotaError(f"HTTP 429 (cuota diaria): {msg[:160]}") from None
            if (e.code in (500, 503) and attempt < 1) or (e.code == 429 and attempt < 2):
                time.sleep(20 * (attempt + 1)); continue
            raise RuntimeError(f"HTTP {e.code}: {msg}") from None
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:   # red caída / DNS: reintentar
            if attempt < 3:
                time.sleep(10 * (attempt + 1)); continue
            raise RuntimeError(f"red: {e}") from None

def _save_pcm(pcm: bytes, dest: pathlib.Path, rate=24000) -> float:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(dest), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)
    return len(pcm) / (2 * rate)

def gemini_director(prompt: str, dest: pathlib.Path, voice="Gacrux", model="gemini-3.8-flash-tts", api_key=None) -> float:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
    d = _post(url, body, {"x-goog-api-key": api_key or _key("GEMINI_API_KEY")})
    cand = (d.get("candidates") or [{}])[0]
    if "content" not in cand:   # p. ej. finishReason OTHER / MAX_TOKENS / bloqueo: informar, no KeyError
        raise RuntimeError(f"Gemini sin audio: finishReason={cand.get('finishReason')} · {json.dumps(d.get('promptFeedback') or cand)[:300]}")
    parts = cand["content"]["parts"]
    pcm = b"".join(base64.b64decode(p["inlineData"]["data"]) for p in parts if "inlineData" in p)
    if not pcm: raise RuntimeError("Gemini no devolvió audio")
    return _save_pcm(pcm, dest)

def gemini_annotated(chunks: list[dict], dest: pathlib.Path, voice="Gacrux", model="gemini-3.8-flash-tts", api_key=None) -> float:
    """chunks = [{text, style}] → endpoint interactions con speech_metadata por fragmento."""
    body = {"model": model,
            "input": [{"type": "user_input", "content": [
                {"type": "text", "text": c["text"], "annotations": [{"type": "speech_metadata", "style": c["style"]}]} for c in chunks]}],
            "response_format": {"type": "audio", "mime_type": "audio/wav", "sample_rate": 24000},
            "generation_config": {"speech_config": [{"voice": voice}]}}
    d = _post("https://generativelanguage.googleapis.com/v1beta/interactions", body, {"x-goog-api-key": api_key or _key("GEMINI_API_KEY")})
    # la respuesta trae el audio en base64 en algún nodo `data`: lo buscamos sin asumir la forma exacta
    found = []
    def walk(x):
        if isinstance(x, dict):
            for k, v in x.items():
                if k in ("data", "audio") and isinstance(v, str) and len(v) > 1000: found.append(v)
                else: walk(v)
        elif isinstance(x, list):
            for v in x: walk(v)
    walk(d)
    if not found: raise RuntimeError(f"interactions sin audio: {json.dumps(d)[:400]}")
    raw = base64.b64decode(found[0])
    if raw[:4] == b"RIFF":
        dest.parent.mkdir(parents=True, exist_ok=True); dest.write_bytes(raw)
        with wave.open(str(dest)) as w: return w.getnframes() / w.getframerate()
    return _save_pcm(raw, dest)

def novita(text: str, dest: pathlib.Path, voice="Patient_Man", emotion="calm", speed=0.95) -> float:
    body = {"text": text,
            "voice_setting": {"voice_id": voice, "vol": 1.0, "pitch": 0, "speed": speed, "emotion": emotion},
            "audio_setting": {"format": "mp3", "bitrate": 128000, "sample_rate": 32000, "channel": 1},
            "language_boost": "Spanish", "stream": False, "output_format": "hex"}
    d = _post("https://api.novita.ai/v3/minimax-speech-2.8-turbo", body, {"Authorization": f"Bearer {_key('NOVITA_IA')}"})
    if d.get("base_resp", {}).get("status_code", 0) != 0: raise RuntimeError(f"Novita: {d.get('base_resp')}")
    dest.parent.mkdir(parents=True, exist_ok=True); dest.write_bytes(bytes.fromhex(d["data"]["audio"]))
    return 0.0

# ---------- dirección vocal ----------
TAG_BY_TONE = {
    "intriga": "intrigued, low and close", "suspenso": "suspenseful, hushed", "explicativo": "clear and warm",
    "asombro": "with quiet awe", "tensión": "tense, controlled", "tensión creciente": "building intensity",
    "descubrimiento": "curious, rising", "complicidad": "confidential, slight smile", "aceleración": "picking up pace",
    "clímax": "building intensity, strong but not shouting", "peso": "grave, slow", "silencio": "quietly",
    "curiosidad": "thoughtful", "revelación": "revealing, emphatic", "dolor contenido": "with contained sorrow, slow",
    "duelo": "very quietly, grieving, long pauses", "reparación": "measured, a little hope", "cierre": "firm and warm",
    "urgencia": "urgent, fast but clear", "alivio": "relieved, breath out", "reflexivo": "reflectively",
    "cercano": "warmly, close", "alarma": "urgently, like a breaking-news alert", "admiración": "with admiration",
}

def director_prompt(script: dict, segs: list[dict]) -> str:
    lines = "\n\n".join(f"[{TAG_BY_TONE.get(s['tone'], 'naturally')}] {s['text']}" for s in segs)
    return ("GENERATE SPEECH AUDIO ONLY.\nDo not read section titles or bracketed delivery notes aloud.\n\n"
            "AUDIO PROFILE\nOne mature, close, natural Latin American Spanish documentary narrator. Neutral Latin American accent "
            "(no Castilian ceceo). Do not imitate a real person.\n\n"
            f"SCENE\nA short documentary for social media: {script['title'].title()}.\n\n"
            f"DIRECTOR'S NOTES\n{script['voice_direction']} Aim for 130 Spanish words per minute, unhurried. "
            "Natural human breathing, clear diction, let short pauses breathe between sentences and ideas. "
            "Numbers read naturally in Spanish.\n\n"
            f"TRANSCRIPT BEGINS\n{lines}\nTRANSCRIPT ENDS")
