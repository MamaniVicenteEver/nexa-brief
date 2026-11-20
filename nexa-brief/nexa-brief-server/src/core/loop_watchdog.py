"""Vigilancia del bucle de eventos de la API.

Un hilo propio comprueba cada 0,2 s que el bucle siga latiendo. Si pasan más de
`umbral_s` sin latido, registra la pila del hilo del bucle: así se ve qué código
síncrono lo tiene bloqueado. Solo observa; no cambia el comportamiento de la API.
"""

from __future__ import annotations

import asyncio
import sys
import threading
import time
import traceback

import structlog

logger = structlog.get_logger(__name__)

PASO_S = 0.2
UMBRAL_S = 1.0


class VigilanteBucle:
    def __init__(self, bucle: asyncio.AbstractEventLoop, umbral_s: float = UMBRAL_S, paso_s: float = PASO_S) -> None:
        self._bucle = bucle
        self._umbral = umbral_s
        self._paso = paso_s
        self._hilo_bucle: int | None = None
        self._ultimo_latido = time.monotonic()
        self._parar = threading.Event()
        self._hilo = threading.Thread(target=self._vigilar, name="vigilante-bucle", daemon=True)

    def iniciar(self) -> None:
        self._hilo_bucle = threading.get_ident()
        self._latir()
        self._hilo.start()
        logger.info("vigilante_bucle_iniciado", umbral_s=self._umbral)

    def parar(self) -> None:
        self._parar.set()

    def _latir(self) -> None:
        ahora = time.monotonic()
        atraso = ahora - self._ultimo_latido
        if atraso > self._umbral:
            logger.warning("event_loop_reanudado", segundos_bloqueado=round(atraso, 2))
        self._ultimo_latido = ahora
        if not self._parar.is_set():
            self._bucle.call_later(self._paso, self._latir)

    def _vigilar(self) -> None:
        avisado = False
        while not self._parar.wait(self._paso):
            atraso = time.monotonic() - self._ultimo_latido
            if atraso > self._umbral and not avisado:
                marco = sys._current_frames().get(self._hilo_bucle)
                marcos = traceback.extract_stack(marco) if marco is not None else []
                del marco
                codigo = [f"{f.filename.split('nexa-brief-server/')[-1]}:{f.lineno} {f.name}"
                          for f in marcos if "nexa-brief-server/src" in f.filename]
                ultimas = [f"{f.filename.split('/')[-1]}:{f.lineno} {f.name}" for f in marcos[-4:]]
                logger.warning("event_loop_bloqueado", segundos=round(atraso, 2),
                               codigo_proyecto=codigo[-12:], ultimas=ultimas)
                avisado = True
            elif atraso <= self._umbral:
                avisado = False


def iniciar_vigilancia() -> VigilanteBucle:
    vigilante = VigilanteBucle(asyncio.get_running_loop())
    vigilante.iniciar()
    return vigilante
