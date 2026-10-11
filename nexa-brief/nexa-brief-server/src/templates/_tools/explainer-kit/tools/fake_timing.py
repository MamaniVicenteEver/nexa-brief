#!/usr/bin/env python3
"""Tiempos sintéticos (sin voz) para previsualizar un storyboard antes de grabar la narración.

Reparte las palabras del guion a ~2,3 palabras/s (pausas en puntuación) y escribe un
lyrics.json Whisper + un mp3 en silencio de la misma duración. Sirve para revisar ritmo y
diseño; se reemplaza por narrate.py + transcribe.py cuando hay audio real.
Uso: fake_timing.py SCRIPT.json OUT_lyrics.json OUT_song.mp3 [--lead 1.2] [--wps 2.3]
"""
import argparse, json, pathlib, re, subprocess
ap = argparse.ArgumentParser(); ap.add_argument("script"); ap.add_argument("lyrics"); ap.add_argument("mp3")
ap.add_argument("--lead", type=float, default=1.2); ap.add_argument("--wps", type=float, default=2.3)
a = ap.parse_args()
sc = json.loads(pathlib.Path(a.script).read_text()); t = a.lead; segs = []
for s in sc["segments"]:
    ws = []; t0 = t
    for w in s["text"].split():
        d = 0.18 + len(w) * 0.045
        ws.append({"word": " " + w, "start": round(t, 3), "end": round(t + d, 3)}); t += d * (2.3 / a.wps) + 0.06
        if re.search(r"[.!?…]$", w): t += 0.45
        elif re.search(r"[,:;]$", w): t += 0.2
    segs.append({"start": round(t0, 3), "end": round(t, 3), "text": " " + s["text"], "words": ws}); t += 0.5
total = t + 3
pathlib.Path(a.lyrics).write_text(json.dumps({"metadata": {"fake": True, "duration": round(total, 2)}, "segments": segs}, ensure_ascii=False, indent=1))
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", f"{total:.2f}", "-b:a", "64k", a.mp3], check=True)
print(f"✓ {total:.1f} s sintéticos")
