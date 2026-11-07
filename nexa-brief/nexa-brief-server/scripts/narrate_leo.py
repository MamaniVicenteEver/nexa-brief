#!/usr/bin/env python3
"""Generar narración de Leo con el perfil aprobado y limpiar los intermedios."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
import sys
import tempfile

SERVER = Path(__file__).resolve().parents[1]
PROFILE = SERVER / "src/templates/sandbox/nodeaction/_pizarra/profiles/leo.json"
NARRATE = SERVER / "src/templates/_tools/explainer-kit/tools/narrate.py"


def read_profile() -> dict:
    profile = json.loads(PROFILE.read_text())
    if profile.get("schema_version") != 1 or profile.get("id") != "leo-comparaciones-v1":
        raise ValueError("Perfil de Leo incompatible")
    if len(profile["voice"]["models"]) != 1:
        raise ValueError("Leo requiere un modelo fijo; revisar la identidad antes de cambiarlo")
    if not profile["postprocess"].get("pitch_preserved"):
        raise ValueError("El ritmo de Leo debe conservar el tono")
    return profile


def audio_duration(path: Path) -> float:
    value = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ], text=True)
    return float(value.strip())


def finish_audio(source: Path, destination: Path, tempo: float, pad_to: float | None = None) -> float:
    if not 0.5 <= tempo <= 2:
        raise ValueError("Ritmo fuera del rango permitido")
    filters = [f"atempo={tempo:g}"]
    if pad_to is not None:
        if pad_to < audio_duration(source) / tempo - 0.05:
            raise ValueError("La duración solicitada cortaría la narración; aumentar --pad-to")
        filters.append(f"apad=whole_dur={pad_to:g}")
    subprocess.run([
        "ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-i", str(source),
        "-af", ",".join(filters), "-ar", "44100", "-b:a", "192k", str(destination),
    ], check=True)
    return audio_duration(destination)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("script", type=Path)
    parser.add_argument("out", type=Path, help="MP3 final; usar un archivo nuevo o --replace")
    parser.add_argument("--dry-run", action="store_true", help="Validar sin TTS, archivos ni gasto")
    parser.add_argument("--replace", action="store_true")
    parser.add_argument("--pad-to", type=float, help="Silencio final hasta estos segundos; nunca recorta")
    args = parser.parse_args()
    profile = read_profile()
    script_path, out = args.script.resolve(), args.out.resolve()
    script = json.loads(script_path.read_text())
    voice = profile["voice"]["voice"]
    if script.get("voice", voice) != voice:
        raise ValueError(f"El guion pide otra voz; la línea Leo utiliza {voice}")
    if script.get("profile_id", profile["id"]) != profile["id"]:
        raise ValueError("El guion corresponde a otro perfil")
    if not script.get("segments") or any(not segment.get("text", "").strip() for segment in script["segments"]):
        raise ValueError("El guion debe contener segmentos con texto")
    if out.suffix.lower() != ".mp3":
        raise ValueError("La salida debe ser MP3")
    if args.pad_to is not None and args.pad_to <= 0:
        raise ValueError("--pad-to debe ser positivo")
    model = profile["voice"]["models"][0]
    report = {
        "profile_id": profile["id"], "profile": str(PROFILE), "voice": voice,
        "model": model, "tempo": profile["postprocess"]["tempo"], "pitch_preserved": True,
        "script": str(script_path), "output": str(out), "pad_to_seconds": args.pad_to,
    }
    if args.dry_run:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return
    if out.exists() and not args.replace:
        raise ValueError("La salida ya existe; usar otra ruta o --replace de forma explícita")
    out.parent.mkdir(parents=True, exist_ok=True)
    # WAV, partes de TTS y MP3 intermedios desaparecen incluso si la generación falla.
    with tempfile.TemporaryDirectory(prefix=".leo-voice-", dir=out.parent) as temporary:
        work = Path(temporary)
        raw, final = work / "raw.mp3", work / "final.mp3"
        subprocess.run([
            sys.executable, str(NARRATE), str(script_path), str(raw),
            "--design", str(PROFILE), "--voice", voice, "--model", model,
        ], check=True, cwd=SERVER)
        report["duration_seconds"] = finish_audio(raw, final, report["tempo"], args.pad_to)
        qc = raw.with_suffix(".qc.json")
        if qc.exists():
            report["tts_qc"] = json.loads(qc.read_text())
        final.replace(out)
        out.with_suffix(".profile.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        raise SystemExit(str(error))
