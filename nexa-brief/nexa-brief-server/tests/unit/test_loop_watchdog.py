"""El vigilante registra la pila del código que bloquea el bucle y calla cuando el bucle está libre."""

import asyncio
import time

from src.core import loop_watchdog as lw


class _Captura:
    def __init__(self):
        self.eventos = []

    def warning(self, evento, **datos):
        self.eventos.append((evento, datos))

    def info(self, evento, **datos):
        self.eventos.append((evento, datos))


def _bloquear_bucle(segundos: float) -> None:
    time.sleep(segundos)


def test_logs_the_stack_of_the_code_that_blocks_the_loop(monkeypatch):
    captura = _Captura()
    monkeypatch.setattr(lw, "logger", captura)

    async def principal():
        vigilante = lw.VigilanteBucle(asyncio.get_running_loop(), umbral_s=0.3, paso_s=0.05)
        vigilante.iniciar()
        try:
            _bloquear_bucle(1.0)
            await asyncio.sleep(0.2)
        finally:
            vigilante.parar()

    asyncio.run(principal())
    bloqueos = [d for e, d in captura.eventos if e == "event_loop_bloqueado"]
    assert bloqueos, captura.eventos
    assert any("_bloquear_bucle" in x for x in bloqueos[0]["ultimas"]), bloqueos[0]
    reanudados = [d for e, d in captura.eventos if e == "event_loop_reanudado"]
    assert reanudados and reanudados[0]["segundos_bloqueado"] >= 0.3


def test_stays_silent_when_the_loop_is_free(monkeypatch):
    captura = _Captura()
    monkeypatch.setattr(lw, "logger", captura)

    async def principal():
        vigilante = lw.VigilanteBucle(asyncio.get_running_loop(), umbral_s=0.3, paso_s=0.05)
        vigilante.iniciar()
        try:
            await asyncio.sleep(0.8)
        finally:
            vigilante.parar()

    asyncio.run(principal())
    assert not [e for e, _ in captura.eventos if e == "event_loop_bloqueado"]
