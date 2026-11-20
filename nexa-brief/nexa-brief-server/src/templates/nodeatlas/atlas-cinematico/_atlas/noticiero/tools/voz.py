#!/usr/bin/env python3
"""voz.py · voz + transcripción + audio con cierre de un episodio noticiero. La voz es SIEMPRE la del perfil
(`noticiero/voz.json`: Gemini 3.8 Flash TTS · Charon · tono «aceleración» · ≈180 palabras/min).

    python3 <_atlas>/noticiero/tools/voz.py <carpeta-del-episodio>              # ENSAYO: solo muestra los pedidos, no gasta cuota
    python3 <_atlas>/noticiero/tools/voz.py <carpeta-del-episodio> --ejecutar   # genera song.mp3 + song.qc.json
    ...                                                       --transcribir     # además: lyrics.json (Whisper large-v3, 1,5–3 min por minuto de audio)
    ...                                                       --silencio 7.2    # además: song-outro.mp3 (= song.mp3 + silencio para el cierre)

Se pueden combinar: `--ejecutar --transcribir --silencio 7.2` (`--cierre` sigue valiendo como alias). Gasta cuota de Gemini: se ejecuta UNA vez, con el guion
final aprobado. No pasar timeout corto a la transcripción (si se corta, los tiempos quedan sintéticos).
No modifica narrate.py ni transcribe.py (herramientas del explainer-kit): solo las llama con el perfil fijo.
"""
from __future__ import annotations
import argparse, shutil, subprocess, sys
from pathlib import Path

NOTICIERO = Path(__file__).resolve().parents[1]
SERVER = Path(__file__).resolve().parents[7]            # .../nexa-brief-server
KIT = SERVER / "src" / "templates" / "_tools" / "explainer-kit" / "tools"
PY = SERVER / ".venv" / "bin" / "python"


def run(cmd):
    print("$", " ".join(str(c) for c in cmd), flush=True)
    r = subprocess.run([str(c) for c in cmd], cwd=SERVER, env={**__import__("os").environ, "PYTHONPATH": str(SERVER)})
    if r.returncode:
        sys.exit(r.returncode)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episodio")
    ap.add_argument("--ejecutar", action="store_true", help="llamar de verdad a Gemini TTS (gasta cuota)")
    ap.add_argument("--transcribir", action="store_true")
    ap.add_argument("--silencio", "--cierre", dest="cierre", type=float, default=0,
                    help="segundos de silencio al final para el cierre visual: crea song-outro.mp3 (7.2 en el noticiero)")
    a = ap.parse_args()
    ep = Path(a.episodio).resolve()
    script = ep / "assets" / "script.json"
    if not script.is_file():
        sys.exit("falta assets/script.json")
    voz = ep / "work" / "voice.json"
    if not voz.is_file():
        voz = NOTICIERO / "voz.json"          # perfil compartido (el scaffold lo copia a work/voice.json)
    py = PY if PY.is_file() else Path(sys.executable)
    song = ep / "assets" / "song"
    cmd = [py, KIT / "narrate.py", script, song, "--design", voz]
    if not a.ejecutar and not a.transcribir and not a.cierre:
        run(cmd + ["--dry"])
        print("\nEnsayo: nada generado. Para generar la voz: --ejecutar (gasta cuota de Gemini, una vez, guion final).")
        return
    if a.ejecutar:
        run(cmd)
    if a.transcribir:
        run([py, KIT / "transcribe.py", ep / "assets" / "song.mp3", script, ep / "assets" / "lyrics.json"])
    if a.cierre:
        if not shutil.which("ffmpeg"):
            sys.exit("falta ffmpeg")
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", ep / "assets" / "song.mp3", "-af", f"apad=pad_dur={a.cierre}",
             "-c:a", "libmp3lame", "-b:a", "192k", ep / "assets" / "song-outro.mp3"])
        print("song-outro.mp3 listo: config.json ya apunta a él (nuevo.py)")
    print("siguiente: python3", NOTICIERO / "tools" / "check.py", ep)


if __name__ == "__main__":
    main()
