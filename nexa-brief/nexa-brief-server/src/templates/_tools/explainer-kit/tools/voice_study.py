#!/usr/bin/env python3
"""Estudio de voz: misma muestra (intriga → clímax → duelo) con varias voces y
proveedores, y métricas objetivas para elegir. Las métricas NO reemplazan el
oído humano: sirven para descartar (acento, ritmo, monotonía, inteligibilidad).

Métricas por muestra:
  · wpm           — palabras por minuto (documental cómodo ≈ 135-165)
  · f0_mediana    — tono medio (Hz); voz madura masculina ≈ 95-130
  · f0_rango_st   — variación de tono en semitonos (desvío): más = más expresiva
  · dyn_db        — variación de energía entre frases (dB): contraste emocional
  · pausas        — silencios ≥ 0,35 s (respiración del relato)
  · wer           — error de Whisper contra el guion (inteligibilidad del español)
Uso: voice_study.py <script.json> <out_dir> [--only gen|metrics]
"""
from __future__ import annotations
import concurrent.futures as cf, json, pathlib, re, subprocess, sys, unicodedata, wave
import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).parent)); import tts

STYLE_ES = {
    "intriga": "Voz masculina madura, español latino neutro (sin ceceo). Documental íntimo, con intriga. Comenzar bajo y cercano, ritmo moderado, dejar respirar las pausas.",
    "clímax": "Subir la intensidad de forma progresiva. Energía firme y emocionada, sin gritar. Acelerar levemente y dar peso a las palabras finales.",
    "duelo": "Muy bajo, contenido, con tristeza. Ritmo lento, pausas largas antes de los datos finales. Natural, sin dramatizar.",
}
SAMPLE_IDS = ["s01", "s09", "s15"]

def sample(script):
    segs = [s for s in script["segments"] if s["id"] in SAMPLE_IDS]
    marked = []
    for s in segs:
        t = s["text"].replace(". ", ". <short pause> ", 1)
        marked.append({"text": t, "style": STYLE_ES.get(s["tone"], "Natural, documental.")})
    plain = " ".join(s["text"] for s in segs)
    return segs, marked, plain

CANDIDATES = [  # (id, proveedor, voz, modelo/método)
    ("gem38-gacrux", "annotated", "Gacrux", "gemini-3.8-flash-tts"),
    ("gem38-charon", "annotated", "Charon", "gemini-3.8-flash-tts"),
    ("gem38-orus", "annotated", "Orus", "gemini-3.8-flash-tts"),
    ("gem38-algenib", "annotated", "Algenib", "gemini-3.8-flash-tts"),
    ("gem38-iapetus", "annotated", "Iapetus", "gemini-3.8-flash-tts"),
    ("gem38-sadaltager", "annotated", "Sadaltager", "gemini-3.8-flash-tts"),
    ("gem38-schedar", "annotated", "Schedar", "gemini-3.8-flash-tts"),
    ("gem38-kore", "annotated", "Kore", "gemini-3.8-flash-tts"),
    ("gem38-sulafat", "annotated", "Sulafat", "gemini-3.8-flash-tts"),
    ("gem38lite-gacrux", "annotated", "Gacrux", "gemini-3.8-flash-lite-tts"),
    ("gem38-gacrux-director", "director", "Gacrux", "gemini-3.8-flash-tts"),
    ("novita-patient-man", "novita", "Patient_Man", None),
    ("novita-deep-voice-man", "novita", "Deep_Voice_Man", None),
]

def generate(script, out: pathlib.Path):
    segs, marked, plain = sample(script)
    def job(c):
        cid, kind, voice, model = c
        dest = out / (f"{cid}.mp3" if kind == "novita" else f"{cid}.wav")
        if dest.exists() and dest.stat().st_size > 20000: return cid, "cached"
        try:
            if kind == "annotated": tts.gemini_annotated(marked, dest, voice=voice, model=model)
            elif kind == "director": tts.gemini_director(tts.director_prompt(script, segs), dest, voice=voice, model=model)
            else: tts.novita(plain, dest, voice=voice, emotion="calm")
            return cid, "ok"
        except Exception as e:
            return cid, f"FAIL {str(e)[:200]}"
    with cf.ThreadPoolExecutor(3) as ex:
        for cid, st in ex.map(job, CANDIDATES): print(f"  {cid:24s} {st}", flush=True)

def load_pcm(path: pathlib.Path, sr=16000):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(sr), "-f", "s16le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768, sr

def f0_track(x, sr, fmin=60, fmax=400, hop=0.01, win=0.04):
    """YIN simplificado: devuelve f0 por cuadro (0 = sordo)."""
    H, N = int(hop * sr), int(win * sr); out = []
    tmin, tmax = int(sr / fmax), int(sr / fmin)
    for i in range(0, len(x) - N - tmax, H):
        f = x[i:i + N + tmax]
        if np.sqrt(np.mean(f[:N] ** 2)) < 0.01: out.append(0); continue
        d = np.array([np.sum((f[:N] - f[t:t + N]) ** 2) for t in range(tmin, tmax)])
        cmnd = d / (np.cumsum(d) / np.arange(1, len(d) + 1) + 1e-9)
        k = np.argmin(cmnd)
        out.append(sr / (k + tmin) if cmnd[k] < 0.25 else 0)
    return np.array(out)

def norm(s):
    s = unicodedata.normalize("NFD", s.lower()); s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9ñ ]+", " ", s).split()

def wer(ref, hyp):
    r, h = norm(ref), norm(hyp); d = np.arange(len(h) + 1)
    for i in range(1, len(r) + 1):
        prev, d = d, np.zeros(len(h) + 1, int); d[0] = i
        for j in range(1, len(h) + 1): d[j] = min(prev[j] + 1, d[j - 1] + 1, prev[j - 1] + (r[i - 1] != h[j - 1]))
    return d[-1] / max(1, len(r))

def metrics(script, out: pathlib.Path):
    from faster_whisper import WhisperModel
    model = WhisperModel("large-v3", device="cpu", compute_type="int8")
    segs, _, plain = sample(script); nwords = len(plain.split()); rows = []
    for f in sorted(list(out.glob("*.wav")) + list(out.glob("*.mp3"))):
        if f.name.startswith("_"): continue
        x, sr = load_pcm(f); dur = len(x) / sr
        f0 = f0_track(x, sr); v = f0[f0 > 0]
        st = 12 * np.log2(v / np.median(v)) if len(v) else np.array([0])
        rms = np.array([np.sqrt(np.mean(x[i:i + sr // 2] ** 2)) for i in range(0, len(x) - sr // 2, sr // 2)])
        rms_db = 20 * np.log10(rms[rms > 0.005] + 1e-9)
        sil = subprocess.run(["ffmpeg", "-i", str(f), "-af", "silencedetect=n=-38dB:d=0.35", "-f", "null", "-"], capture_output=True, text=True).stderr.count("silence_end")
        segs_w, _ = model.transcribe(str(f), language="es", beam_size=5)
        hyp = " ".join(s.text for s in segs_w)
        rows.append({"id": f.stem, "dur_s": round(dur, 1), "wpm": round(nwords / dur * 60), "f0_mediana": round(float(np.median(v)) if len(v) else 0),
                     "f0_rango_st": round(float(np.std(st)), 2), "dyn_db": round(float(np.std(rms_db)), 2), "pausas": sil,
                     "wer": round(wer(plain, hyp), 3), "transcripcion": hyp.strip()})
        print(f"  {f.stem:24s} {rows[-1]['dur_s']:5}s wpm={rows[-1]['wpm']:3} f0={rows[-1]['f0_mediana']:3} rango={rows[-1]['f0_rango_st']:4} dyn={rows[-1]['dyn_db']:4} pausas={sil:2} wer={rows[-1]['wer']}", flush=True)
    (out / "metrics.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False))
    return rows

if __name__ == "__main__":
    script = json.loads(pathlib.Path(sys.argv[1]).read_text()); out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
    only = sys.argv[3].split("=")[1] if len(sys.argv) > 3 and sys.argv[3].startswith("--only") else (sys.argv[4] if len(sys.argv) > 4 else None)
    if only != "metrics": print("generando…"); generate(script, out)
    if only != "gen": print("métricas…"); metrics(script, out)
