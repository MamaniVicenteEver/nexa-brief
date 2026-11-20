"""Almacén de documentos: las escrituras no bloquean el bucle y conservan su orden."""

import asyncio
import time

import pytest

from src.adapters.data.json_store import JsonDocumentStore


def _almacen():
    return JsonDocumentStore("draft_jobs", "studio/draft_jobs")


def test_aput_keeps_the_loop_responsive(monkeypatch):
    def put_lento(self, key, document):
        time.sleep(0.6)  # serializar y escribir el archivo entero, en sincrono

    monkeypatch.setattr(JsonDocumentStore, "put", put_lento)

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
        await _almacen().aput("job", {"id": "1"})
        parar.set()
        await tarea
        return latidos

    assert asyncio.run(principal()) >= 5


def test_writes_run_in_call_order(monkeypatch):
    orden = []

    def put_con_retraso(self, key, document):
        if document == "primero":
            time.sleep(0.3)  # si corriera en paralelo, el segundo terminaría antes
        orden.append(document)

    monkeypatch.setattr(JsonDocumentStore, "put", put_con_retraso)

    async def principal():
        await asyncio.gather(_almacen().aput("a", "primero"), _almacen().aput("a", "segundo"))

    asyncio.run(principal())
    assert orden == ["primero", "segundo"]


def test_reads_and_deletes_go_through_the_same_queue(monkeypatch):
    monkeypatch.setattr(JsonDocumentStore, "get", lambda self, key: {"clave": key})
    monkeypatch.setattr(JsonDocumentStore, "delete", lambda self, key: key == "x")
    monkeypatch.setattr(JsonDocumentStore, "all_documents", lambda self: {"a": 1})

    assert asyncio.run(_almacen().aget("x")) == {"clave": "x"}
    assert asyncio.run(_almacen().adelete("x")) is True
    assert asyncio.run(_almacen().adelete("y")) is False
    assert asyncio.run(_almacen().aall_documents()) == {"a": 1}


def test_write_errors_reach_the_caller(monkeypatch):
    def put_falla(self, key, document):
        raise ValueError("clave no valida")

    monkeypatch.setattr(JsonDocumentStore, "put", put_falla)
    with pytest.raises(ValueError, match="clave no valida"):
        asyncio.run(_almacen().aput("a", 1))
