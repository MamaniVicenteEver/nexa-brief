"""Proceso local descartable para liberar Whisper tras cada operación."""
from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import threading


def _exit_if_parent_dies(parent_pid: int) -> None:
    # Una recarga/caída de la API no debe dejar un transcriptor huérfano en RAM.
    while True:
        threading.Event().wait(1)
        if os.getppid() != parent_pid:
            os._exit(1)


def main() -> None:
    if len(sys.argv) != 2:
        raise ValueError("Falta la ruta de resultado")
    parent_pid = os.getppid()
    threading.Thread(target=_exit_if_parent_dies, args=(parent_pid,), daemon=True).start()
    request = json.load(sys.stdin)
    from src.adapters.lyrics.infrastructure.faster_whisper_adapter import (
        _detect_language_sync,
        _transcribe_sync,
    )

    audio = Path(request["audio_path"])
    if request["mode"] == "transcribe":
        result = _transcribe_sync(audio, request.get("argument"))
    elif request["mode"] == "detect":
        result = _detect_language_sync(audio, request["argument"])
    else:
        raise ValueError("Operación Whisper desconocida")
    Path(sys.argv[1]).write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
