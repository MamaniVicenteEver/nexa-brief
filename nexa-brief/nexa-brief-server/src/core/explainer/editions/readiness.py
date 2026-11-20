"""Host-only prerequisite checks. No model, media generation or quota request."""
from __future__ import annotations

import importlib.util
import os
from pathlib import Path
import shutil

from src.core.explainer.catalog import KIT_DIR


def tool_issues(edition):
    issues = []
    def missing(field, message):
        issues.append({"level": "error", "field": field, "message": message})
    for binary in ("ffmpeg", "ffprobe"):
        if not shutil.which(binary):
            missing(binary, f"Falta {binary} en el servidor para preparar el audio.")
    if importlib.util.find_spec("faster_whisper") is None:
        missing("transcription", "El módulo de transcripción no está instalado en el servidor.")
    try:
        from playwright.sync_api import sync_playwright
        # Resolve the installed executable, without starting a browser or rendering.
        with sync_playwright() as playwright:
            executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or playwright.chromium.executable_path
            if not Path(executable).is_file():
                missing("thumbnails", "Falta el navegador del servidor para capturar las tres miniaturas.")
    except Exception:
        missing("thumbnails", "El capturador de miniaturas no está disponible en el servidor.")
    try:
        spec = importlib.util.spec_from_file_location("nexa_edition_tts_readiness", KIT_DIR / "tools/tts.py")
        tts = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(tts)
        # Use the adapter's resolver. Credentials never enter the result or prompts.
        if not any(tts._available(model) for model in edition.voice.models):
            missing("voice", "No hay una configuración de voz disponible con cuota local para esta edición.")
    except Exception:
        missing("voice", "No se pudo verificar la configuración de voz del servidor.")
    return issues
