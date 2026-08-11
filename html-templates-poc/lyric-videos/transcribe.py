"""
transcribe.py — transcribe un audio a JSON con timestamps por palabra
(usa faster-whisper). Ver README.md en esta misma carpeta para el detalle
completo de uso y de por qué están afinados así los parámetros.

Uso rápido:
    .venv/bin/python transcribe.py "cancion.mp3"
    .venv/bin/python transcribe.py "cancion.mp3" --name kevin-kaarl
    .venv/bin/python transcribe.py "cancion.mp3" -o salida-custom.json
"""

import argparse
import json
import re
import unicodedata
from pathlib import Path

from faster_whisper import WhisperModel

# ==========================
# POR QUÉ LOS PARÁMETROS ESTÁN AFINADOS ASÍ (no son los default de faster-whisper)
# ==========================
# 1) temperature en escalera [0.0..1.0] en vez de fija en 0.0: si un pasaje
#    difícil (voz con eco/ad-libs sobre instrumental fuerte) falla al intento
#    más determinista, se reintenta a temperaturas más altas en vez de
#    descartar el tramo.
# 2) condition_on_previous_text=False: en pistas largas, arrastrar el texto
#    previo como contexto puede hacer que un error en un tramo se propague
#    (repetición/deriva) y degrade el resto de la transcripción.
# 3) vad_filter=False: CONFIRMADO como la causa de un corte real (una canción
#    se transcribía solo hasta 185s de 251s). El VAD de Silero está afinado
#    para VOZ HABLADA, no para voz CANTADA sobre una base instrumental fuerte
#    con reverb/ad-libs — clasificaba tramos con voz real (no_speech_prob tan
#    bajo como 0.04-0.21) como silencio y los descartaba antes de que Whisper
#    los viera, incluso con el VAD ya relajado. Para música es más fiable
#    dejar que el propio modelo decida (sin pre-filtro).
# 4) compression_ratio_threshold / log_prob_threshold / no_speech_threshold
#    relajados: más tolerantes con coros/ad-libs repetidos y voz baja/con
#    reverb, que si no se descartan como "alucinación" o "silencio".
# ==========================

DEFAULT_MODEL = "large-v3"          # tiny / base / small / medium / large-v3
DEFAULT_DEVICE = "cpu"
DEFAULT_COMPUTE_TYPE = "float32"     # máxima precisión en CPU (más lento que int8)


def slugify(text):
    """'𝙆𝙚𝙫𝙞𝙣 𝙆𝙖𝙖𝙧𝙡 𝘾𝙤𝙡𝙖𝙥𝙨𝙤 𝙇𝙚𝙩𝙧𝙖' -> 'kevin-kaarl-colapso-letra'
    (normaliza unicode estilizado, incluidas fuentes 'fancy' de redes sociales)."""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return re.sub(r"-{2,}", "-", text).strip("-") or "audio"


def parse_args():
    p = argparse.ArgumentParser(
        description="Transcribe un audio a JSON con timestamps por palabra (faster-whisper)."
    )
    p.add_argument("audio", help="Ruta al archivo de audio (mp3/wav/m4a/...)")
    p.add_argument(
        "-n", "--name",
        help="Nombre corto para el archivo de salida -> lyrics-<name>.json "
             "(ej: --name kevin-kaarl). Si se omite, se genera del nombre del archivo."
    )
    p.add_argument(
        "-o", "--output",
        help="Ruta de salida explícita. Si se da, ignora --name y el default lyrics-<slug>.json."
    )
    p.add_argument("--model", default=DEFAULT_MODEL, help=f"Tamaño del modelo (default: {DEFAULT_MODEL})")
    p.add_argument("--device", default=DEFAULT_DEVICE, help=f"cpu o cuda (default: {DEFAULT_DEVICE})")
    p.add_argument("--compute-type", default=DEFAULT_COMPUTE_TYPE, dest="compute_type",
                   help=f"float32 (más preciso) / int8 (más rápido) (default: {DEFAULT_COMPUTE_TYPE})")
    p.add_argument("--vad", action="store_true",
                   help="Reactiva el filtro VAD (úsalo solo para voz HABLADA, no cantada)")
    p.add_argument("--language", default="es", help="Código de idioma (default: es)")
    return p.parse_args()


def main():
    args = parse_args()
    audio_path = Path(args.audio)
    if not audio_path.exists():
        raise SystemExit(f"No se encontró el archivo de audio: {audio_path}")

    slug = args.name or slugify(audio_path.stem)
    output_path = Path(args.output) if args.output else Path(f"lyrics-{slug}.json")

    print(f"Archivo:     {audio_path.name}")
    print(f"Salida:      {output_path}")
    print(f"Modelo:      {args.model} ({args.device}, {args.compute_type})")
    print("Cargando modelo...")

    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)

    print("Transcribiendo (float32 + sin VAD es más lento, pero cubre toda la pista)...")

    segments, info = model.transcribe(
        str(audio_path),
        language=args.language,
        task="transcribe",
        beam_size=8,
        best_of=8,
        patience=1.0,
        temperature=[0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
        word_timestamps=True,
        vad_filter=args.vad,
        condition_on_previous_text=False,
        compression_ratio_threshold=2.6,
        log_prob_threshold=-1.8,
        no_speech_threshold=0.2,
        log_progress=True,
    )

    segments = list(segments)

    result = {
        "metadata": {
            "file": audio_path.name,
            "name": slug,
            "language": info.language,
            "language_probability": info.language_probability,
            "model": args.model,
            "device": args.device,
            "compute_type": args.compute_type,
            "vad_filter": args.vad,
            "audio_duration_sec": info.duration,
        },
        "segments": [],
    }

    for segment in segments:
        words = []
        if segment.words:
            for w in segment.words:
                words.append({
                    "word": w.word,
                    "start": w.start,
                    "end": w.end,
                    "probability": getattr(w, "probability", None),
                })

        result["segments"].append({
            "id": segment.id,
            "seek": getattr(segment, "seek", None),
            "start": segment.start,
            "end": segment.end,
            "text": segment.text,
            "avg_logprob": getattr(segment, "avg_logprob", None),
            "compression_ratio": getattr(segment, "compression_ratio", None),
            "no_speech_prob": getattr(segment, "no_speech_prob", None),
            "temperature": getattr(segment, "temperature", None),
            "words": words,
        })

    with output_path.open("w", encoding="utf8") as f:
        json.dump(result, f, ensure_ascii=False, indent=4)

    print()
    print("===================================")
    print("JSON generado correctamente")
    print(output_path.resolve())
    print("===================================")
    print(f"Duración del audio:         {info.duration:.1f}s")
    if result["segments"]:
        last_end = result["segments"][-1]["end"]
        gap = info.duration - last_end
        words_total = sum(len(s["words"]) for s in result["segments"])
        print(f"Último segmento termina en: {last_end:.1f}s")
        print(f"Hueco sin transcribir:      {gap:.1f}s")
        print(f"Total de segmentos:         {len(result['segments'])}")
        print(f"Total de palabras:          {words_total}")
        if gap > 5:
            print("AVISO: sigue quedando un hueco al final sin letra detectada.")
            print("       Probá con --vad (si es voz hablada) o revisá el tramo manualmente.")
        else:
            print("Cobertura completa (hueco final < 5s).")
    else:
        print("AVISO: no se detectó ningún segmento.")
    print("===================================")


if __name__ == "__main__":
    main()
