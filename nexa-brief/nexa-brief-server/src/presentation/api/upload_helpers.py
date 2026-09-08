"""Helpers de subida de archivos multipart — compartidos entre routers."""

from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import UploadFile


async def save_upload_to_temp(upload: UploadFile, default_suffix: str) -> Path:
    """Guarda un UploadFile en un archivo temporal y devuelve su ruta.

    El caller es responsable de borrar tmp_path.parent cuando termine
    (asset_library.register_image/register_music copian el archivo, no lo mueven).
    """
    suffix = Path(upload.filename).suffix if upload.filename else ""
    tmp_dir = Path(tempfile.mkdtemp(prefix="nb_upload_"))
    dest = tmp_dir / f"upload{suffix or default_suffix}"
    dest.write_bytes(await upload.read())
    return dest


def clean_filename_label(filename: str | None) -> str:
    """Convierte un nombre de archivo subido en una etiqueta legible de respaldo.

    Ej. "Midnight_Blade-DarkComposer.mp3" -> "Midnight Blade DarkComposer".
    Se usa SOLO cuando no vino un nombre explícito (song_name / label) — el
    nombre de archivo real suele ser más útil que dejar el campo vacío.
    """
    if not filename:
        return ""
    stem = Path(filename).stem
    return " ".join(stem.replace("_", " ").replace("-", " ").split())
