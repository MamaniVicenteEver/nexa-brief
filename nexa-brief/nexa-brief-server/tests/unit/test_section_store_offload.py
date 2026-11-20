"""Escribir el almacen no bloquea el bucle de eventos: la copia y la escritura van en un hilo."""

import asyncio
import time

from src.adapters.data import runtime_paths, section_store
from src.adapters.data.section_store import Section


def test_mutate_async_keeps_the_loop_responsive(tmp_path, monkeypatch):
    monkeypatch.setattr(section_store, "assert_profile_path", lambda _p: None)
    monkeypatch.setattr(runtime_paths, "assert_profile_path", lambda _p: None)
    seccion = Section("sonda", data_dir=tmp_path)

    def cambio_lento(data):
        time.sleep(0.6)  # trabajo sincrono pesado dentro del cambio
        data["collections"]["x"] = [{"id": "1"}]

    async def principal():
        latidos = 0
        parar = asyncio.Event()

        async def latir():
            nonlocal latidos
            while not parar.is_set():
                latidos += 1
                await asyncio.sleep(0.05)

        tarea = asyncio.create_task(latir())
        await asyncio.sleep(0)
        await seccion.mutate_async(cambio_lento)
        parar.set()
        await tarea
        return latidos

    latidos = asyncio.run(principal())
    assert latidos >= 5, latidos
    assert Section("sonda", data_dir=tmp_path).read()["collections"]["x"] == [{"id": "1"}]
