"""Transcripción de letras por canción — compartida entre el pipeline y la librería.

Dos caminos llegan acá:
- el stage `lyrics_transcriber` del pipeline (necesita la letra YA, para el job);
- la librería de recursos (F1): al subir una canción se transcribe en segundo
  plano, así cuando alguien la elige en el Estudio la letra ya está lista.

Ambos pasan por `ensure_lyrics()`, que garantiza tres cosas:
1. Caché por asset_id (documents("lyrics")): una canción se transcribe una vez,
   la use quien la use.
2. Un lock por asset: si el pipeline pide la letra de una canción que se está
   transcribiendo en segundo plano, espera ese resultado en vez de lanzar un
   segundo Whisper sobre el mismo archivo.
3. Un semáforo de 1 para todo el proceso: Whisper es CPU/RAM-bound (varios
   minutos por canción, ver settings.whisper_*); dos en paralelo no terminan
   antes, solo se pisan.

Hexagonal: core no importa adapters, así que el transcriptor llega inyectado
como factory (`get_lyrics_transcriber` de adapters/lyrics/factory.py) desde el
módulo o router que llama — mismo patrón que `accounts_loader` en stats.py.
Se pasa la factory (no la instancia) para no construir el adapter si la letra
ya estaba en caché.
"""

from __future__ import annotations

import asyncio
import weakref
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import structlog

from src.config.exceptions import AssetNotFoundError
from src.core.library import asset_library
from src.core.ports.lyrics_port import LyricsTranscriptionPort

logger = structlog.get_logger(__name__)

TranscriberFactory = Callable[[], LyricsTranscriptionPort]


@dataclass
class _LoopState:
    """Primitivas asyncio de un event loop. Se guardan por loop porque Lock y
    Semaphore quedan atados al loop donde se usaron primero: los tests (y
    TestClient) crean un loop nuevo por caso y reusarlas tiraría RuntimeError."""

    semaphore: asyncio.Semaphore = field(default_factory=lambda: asyncio.Semaphore(1))
    asset_locks: dict[str, asyncio.Lock] = field(default_factory=dict)
    # Referencias fuertes a las tareas en segundo plano: asyncio solo guarda
    # referencias débiles y una tarea sin dueño puede ser recolectada a mitad.
    tasks: dict[str, asyncio.Task[None]] = field(default_factory=dict)


_states: weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, _LoopState] = weakref.WeakKeyDictionary()


def _state() -> _LoopState:
    loop = asyncio.get_running_loop()
    state = _states.get(loop)
    if state is None:
        state = _states[loop] = _LoopState()
    return state


def _asset_lock(asset_id: str) -> asyncio.Lock:
    locks = _state().asset_locks
    if asset_id not in locks:
        locks[asset_id] = asyncio.Lock()
    return locks[asset_id]


def is_queued(asset_id: str) -> bool:
    """True si hay una transcripción en segundo plano viva para *asset_id* en este proceso."""
    try:
        task = _state().tasks.get(asset_id)
    except RuntimeError:  # sin loop corriendo: no puede haber tareas
        return False
    return task is not None and not task.done()


async def _set_status(asset_id: str, status: asset_library.TranscriptionStatus, error: str = "", **extra: Any) -> bool:
    """Persiste el estado y avisa por WebSocket. False si la canción ya no existe."""
    entry = await asset_library.set_transcription_status(asset_id, status, error, **extra)
    if entry is None:
        return False
    await asset_library.publish_asset_changed(
        "music", asset_id, action="transcription", transcription_status=status
    )
    return True


async def ensure_lyrics(
    asset_id: str,
    audio_path: Path,
    transcriber_factory: TranscriberFactory,
    *,
    language: str | None = None,
    force: bool = False,
) -> tuple[dict[str, Any], bool]:
    """Devuelve (letra, cache_hit). Transcribe solo si no hay caché (o *force*).

    Con *force* la letra vieja sigue disponible hasta que la nueva la reemplaza:
    un reintento que falla no deja a la canción sin letra.
    Si Whisper falla, marca la canción como "failed" y re-lanza la excepción
    (el pipeline tiene que enterarse; la tarea en segundo plano la loguea).
    """
    async with _asset_lock(asset_id):
        if not force:
            cached = asset_library.get_lyrics_cache(asset_id)
            if cached is not None:
                return cached, True

        async with _state().semaphore:
            await _set_status(asset_id, "running")
            logger.info("lyrics_transcription_start", asset_id=asset_id, language=language, force=force)
            try:
                lyrics_json = await transcriber_factory().transcribe(audio_path, language=language)
            except Exception as exc:
                logger.error("lyrics_transcription_failed", asset_id=asset_id, error=str(exc))
                await _set_status(asset_id, "failed", str(exc)[:500] or exc.__class__.__name__)
                raise

        await asset_library.save_lyrics_cache(asset_id, lyrics_json)
        # Si el usuario no indicó idioma, guardamos el que detectó Whisper: le
        # sirve al buscador y a los próximos jobs con esta canción.
        extra: dict[str, Any] = {}
        detected = (lyrics_json.get("metadata") or {}).get("language")
        if detected and not language:
            extra["language"] = detected
        await _set_status(asset_id, "done", **extra)
        logger.info("lyrics_transcription_done", asset_id=asset_id)
        return lyrics_json, False


async def _run_background(asset_id: str, transcriber_factory: TranscriberFactory, force: bool) -> None:
    try:
        entry = asset_library.get_music_entry(asset_id)
        path = asset_library.resolve_music_path(asset_id)
        if not path.exists():
            await _set_status(asset_id, "failed", "El archivo de audio ya no existe en disco.")
            return
        _, cache_hit = await ensure_lyrics(
            asset_id, path, transcriber_factory, language=entry.language or None, force=force
        )
        if cache_hit:
            # Otro camino (ej. el pipeline) la transcribió mientras esperábamos
            # el turno: solo falta sacarla de "pending".
            await _set_status(asset_id, "done")
    except AssetNotFoundError:
        # La borraron antes de que le tocara el turno: nada que hacer.
        logger.info("lyrics_transcription_skipped_deleted", asset_id=asset_id)
    except Exception:
        # ensure_lyrics ya dejó el estado en "failed" con el error; acá solo
        # evitamos el "Task exception was never retrieved" de asyncio.
        pass
    finally:
        tasks = _state().tasks
        if tasks.get(asset_id) is asyncio.current_task():
            tasks.pop(asset_id, None)


async def enqueue(
    asset_id: str, transcriber_factory: TranscriberFactory, *, force: bool = False
) -> asset_library.MusicLibraryEntry:
    """Encola la transcripción en segundo plano y vuelve enseguida (status "pending").

    Idempotente: si ya hay una en curso para este asset, no lanza otra. Sin
    *force*, una canción que ya tiene letra no se vuelve a transcribir.
    """
    entry = asset_library.get_music_entry(asset_id)
    if is_queued(asset_id):
        return entry
    if not force and asset_library.get_lyrics_cache(asset_id) is not None:
        if entry.transcription_status != "done":
            await _set_status(asset_id, "done")
            entry = asset_library.get_music_entry(asset_id)
        return entry

    await _set_status(asset_id, "pending")
    _state().tasks[asset_id] = asyncio.create_task(
        _run_background(asset_id, transcriber_factory, force), name=f"lyrics-transcription-{asset_id}"
    )
    return asset_library.get_music_entry(asset_id)


async def mark_interrupted() -> int:
    """Marca como "failed" las canciones que quedaron "pending"/"running" sin
    tarea viva — pasa cuando el servidor se reinicia a mitad de una
    transcripción (las tareas viven en memoria). Así la UI muestra "reintentar"
    en vez de un spinner eterno. Devuelve cuántas corrigió."""
    fixed = 0
    for entry in asset_library.list_music():
        if entry.transcription_status in ("pending", "running") and not is_queued(entry.asset_id):
            await _set_status(
                entry.asset_id, "failed", "Transcripción interrumpida (el servidor se reinició)."
            )
            fixed += 1
    if fixed:
        logger.info("lyrics_transcription_marked_interrupted", count=fixed)
    return fixed
