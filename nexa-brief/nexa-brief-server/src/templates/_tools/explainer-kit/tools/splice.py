#!/usr/bin/env python3
"""Cirugía de audio: quita tramos de una narración (alucinaciones del TTS: frases repetidas o
inventadas) usando los tiempos por palabra de Whisper, con fundido corto para que no se note.

Regenerar cuesta cuota y puede introducir errores nuevos; si la frase correcta YA está en el
audio (el modelo repitió o metió algo antes), cortar es más seguro.

Uso: splice.py IN.wav OUT.wav --cut 81.02-84.70 [--cut …] [--fade 0.02]
"""
import argparse, wave
import numpy as np

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("src"); ap.add_argument("dst")
    ap.add_argument("--cut", action="append", default=[]); ap.add_argument("--fade", type=float, default=0.02)
    a = ap.parse_args()
    with wave.open(a.src) as w: sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32)
    cuts = sorted(tuple(map(float, c.split("-"))) for c in a.cut)
    keep, pos = [], 0
    for s, e in cuts: keep.append((pos, int(s * sr))); pos = int(e * sr)
    keep.append((pos, len(x)))
    n = int(a.fade * sr); out = x[keep[0][0]:keep[0][1]].copy()
    for s, e in keep[1:]:
        seg = x[s:e].copy()
        if len(out) > n and len(seg) > n:          # fundido cruzado en la unión
            r = np.linspace(0, 1, n); out[-n:] = out[-n:] * (1 - r) + seg[:n] * r; seg = seg[n:]
        out = np.concatenate([out, seg])
    with wave.open(a.dst, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(np.clip(out, -32768, 32767).astype(np.int16).tobytes())
    print(f"✓ {a.dst}: {len(x) / sr:.2f}s → {len(out) / sr:.2f}s ({len(cuts)} cortes)")

if __name__ == "__main__":
    main()
