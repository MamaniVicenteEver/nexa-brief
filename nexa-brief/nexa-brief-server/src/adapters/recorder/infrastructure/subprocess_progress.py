"""Run a render CLI while reading its output live, so progress can be reported mid-render.

`proc.communicate()` only returns at exit; here stdout and stderr are drained
concurrently line by line (draining both avoids the pipe-buffer deadlock),
each line goes to `parse_progress`, and any fraction it returns is reported
to the job's progress tracker.
"""

from __future__ import annotations

import asyncio
import json
import os
import signal
import queue
import re
import threading
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from src.core.progress import report_step_progress

ProgressParser = Callable[[str], float | None]

_TAIL_LINES = 40
_TAIL_CHARS = 4096
_LINE_BUFFER_BYTES = 64 * 1024
_PERCENT = re.compile(r"(\d{1,3}(?:\.\d+)?)\s?%")


@dataclass
class ProcessOutput:
    returncode: int
    stdout_tail: str
    stderr_tail: str


def parse_percent(line: str) -> float | None:
    """Generic: the last 'NN%' / 'NN.N %' on the line (CLI progress bars)."""
    matches = _PERCENT.findall(line)
    if not matches:
        return None
    value = float(matches[-1])
    return value / 100 if 0 <= value <= 100 else None


def parse_remotion_event(line: str) -> float | None:
    """render-node.mjs emits {"type": "progress", "renderedFrames", "encodedFrames", "totalFrames"}.
    Rendering and encoding run in parallel, so progress is the average of both."""
    try:
        event = json.loads(line)
    except ValueError:
        return None
    if not isinstance(event, dict) or event.get("type") != "progress" or not event.get("totalFrames"):
        return None
    total = event["totalFrames"]
    rendered = event.get("renderedFrames") or 0
    encoded = event.get("encodedFrames") or 0
    return (rendered + encoded) / (2 * total)


class _Lector:
    """Vacía una tubería en un hilo propio. Así el proceso nunca se bloquea al escribir
    aunque el bucle de eventos esté ocupado, y no hace falta que la tubería se cierre
    para saber que el proceso terminó."""

    def __init__(self, fd: int) -> None:
        self._fd = fd
        self._lineas: queue.SimpleQueue[bytes | None] = queue.SimpleQueue()
        self.cola: deque[str] = deque(maxlen=_TAIL_LINES)
        self.terminada = False
        threading.Thread(target=self._leer, name="lector-proceso", daemon=True).start()

    def _leer(self) -> None:
        buffer = b""
        try:
            while chunk := os.read(self._fd, 65536):
                # Las barras de progreso se redibujan con '\r': se parte por ambos.
                buffer = (buffer + chunk)[-_LINE_BUFFER_BYTES:]
                *lineas, buffer = re.split(rb"[\r\n]", buffer)
                for linea in lineas:
                    self._lineas.put(linea)
            if buffer.strip():
                self._lineas.put(buffer)
        except OSError:
            pass
        finally:
            os.close(self._fd)
            self._lineas.put(None)

    def procesar(self, parse_progress: ProgressParser) -> None:
        """Entrega al progreso lo que ya llegó. Corre en el bucle y nunca espera."""
        while True:
            try:
                crudo = self._lineas.get_nowait()
            except queue.Empty:
                return
            if crudo is None:
                self.terminada = True
                return
            linea = crudo.decode(errors="replace").strip()[-_TAIL_CHARS:]
            if not linea:
                continue
            self.cola.append(linea)
            fraccion = parse_progress(linea)
            if fraccion is not None:
                report_step_progress(fraccion)


async def _detener_grupo(proc: asyncio.subprocess.Process) -> None:
    """Termina el proceso y los descendientes que sigan vivos (navegadores, workers)."""
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except ProcessLookupError:
        await proc.wait()
        return
    await asyncio.sleep(0.2)
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    await proc.wait()


async def run_with_progress(
    cmd: list[str],
    *,
    cwd: Path,
    timeout: float | None,
    parse_progress: ProgressParser,
    env: dict[str, str] | None = None,
) -> ProcessOutput:
    """Corre el proceso leyendo su salida en vivo.

    Termina cuando termina el proceso principal. No espera a que se cierren las
    tuberías: un descendiente que las conserve abiertas no puede retener el render.
    Al final detiene su grupo. Lanza asyncio.TimeoutError (tras matar el grupo) si
    pasa `timeout`.
    """
    lectura_salida, escritura_salida = os.pipe()
    lectura_error, escritura_error = os.pipe()
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, cwd=str(cwd), stdout=escritura_salida, stderr=escritura_error,
            start_new_session=True, env=env,
        )
    except BaseException:
        os.close(lectura_salida)
        os.close(lectura_error)
        raise
    finally:
        os.close(escritura_salida)
        os.close(escritura_error)
    salida, errores = _Lector(lectura_salida), _Lector(lectura_error)
    loop = asyncio.get_running_loop()
    limite = None if timeout is None else loop.time() + timeout
    try:
        while proc.returncode is None:
            salida.procesar(parse_progress)
            errores.procesar(parse_progress)
            if limite is not None and loop.time() > limite:
                raise asyncio.TimeoutError()
            await asyncio.sleep(0.2)
        # El proceso principal ya terminó: lo que quedó en las tuberías se entrega en ~2 s.
        for _ in range(10):
            salida.procesar(parse_progress)
            errores.procesar(parse_progress)
            if salida.terminada and errores.terminada:
                break
            await asyncio.sleep(0.2)
    finally:
        await _detener_grupo(proc)
    return ProcessOutput(
        returncode=proc.returncode if proc.returncode is not None else -1,
        stdout_tail="\n".join(salida.cola),
        stderr_tail="\n".join(errores.cola),
    )
