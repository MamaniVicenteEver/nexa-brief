"""Authenticated asynchronous transport for the private media worker.

Uploads are never retried after an ambiguous connection failure: the server
may already have accepted them. Status requests are safe to retry. Outputs
are acknowledged only after they have been completely received locally.
"""
from __future__ import annotations

import asyncio
import ipaddress
import json
import os
import time
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlsplit
from uuid import UUID, uuid4

import httpx
import structlog

from src.config.settings import settings
from src.core.progress import report_step_progress

logger = structlog.get_logger(__name__)
StatusCallback = Callable[[dict[str, Any]], None]


class PrivateMediaError(RuntimeError):
    """A safe, user-facing error that does not expose tokens or media."""


class _RemoteJobFailed(PrivateMediaError):
    """The server already reported and cleaned a terminal failure."""


def _private_url(url: str) -> str:
    parts = urlsplit(url.strip())
    if parts.scheme not in {"http", "https"} or not parts.hostname or parts.username or parts.password or parts.query or parts.fragment or parts.path not in {"", "/"}:
        raise PrivateMediaError("La dirección del servicio privado no es válida.")
    try:
        address = ipaddress.ip_address(parts.hostname)
        allowed = address in ipaddress.ip_network("100.64.0.0/10") if address.version == 4 else address in ipaddress.ip_network("fd7a:115c:a1e0::/48")
        allowed = allowed or address.is_loopback
    except ValueError:
        allowed = parts.hostname.endswith(".ts.net")
    if not allowed:
        raise PrivateMediaError("La dirección del servicio debe pertenecer a Tailscale o al equipo local.")
    return url.rstrip("/")


def _http_error(code: int) -> PrivateMediaError:
    messages = {
        401: "El token del servicio privado no es válido.",
        404: "La tarea privada ya no existe o su resultado venció.",
        409: "El resultado privado todavía no está listo.",
        410: "El resultado privado venció antes de descargarse.",
        413: "El archivo supera los límites del servicio privado.",
        415: "El formato del audio no es compatible con el servicio privado.",
        422: "El servicio privado rechazó los parámetros del trabajo.",
        429: "La cola del servicio privado está llena; vuelva a intentarlo.",
        503: "El servicio privado o su cola no están disponibles.",
    }
    return PrivateMediaError(messages.get(code, f"El servicio privado respondió con error HTTP {code}."))


class PrivateMediaClient:
    def __init__(self, *, url: str | None = None, token: str | None = None, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self.url = _private_url(url if url is not None else settings.nexa_private_media_url)
        self._token = token if token is not None else settings.nexa_private_media_token.get_secret_value()
        if not self._token and settings.nexa_private_media_token_file:
            try:
                self._token = settings.nexa_private_media_token_file.read_text(encoding="utf-8").strip()
            except OSError as exc:
                raise PrivateMediaError("No se pudo leer el archivo de credenciales del servicio privado.") from exc
        if not self._token:
            raise PrivateMediaError("Falta el token del servicio privado en la configuración de Nexa.")
        self._transport = transport

    def _http(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.url,
            headers={"Authorization": f"Bearer {self._token}"},
            timeout=httpx.Timeout(connect=10, read=120, write=120, pool=10),
            follow_redirects=False,
            trust_env=False,
            transport=self._transport,
        )

    async def transcribe(self, audio_path: Path, *, model: str, language: str | None) -> dict[str, Any]:
        def progress(status: dict[str, Any]) -> None:
            try:
                if status.get("phase") == "transcribing":
                    report_step_progress(min(0.99, max(0.0, float(status.get("progress") or 0) / 100)))
            except (ValueError, TypeError):
                pass

        async with self._http() as client:
            job_id = await self._submit(client, "/v1/transcriptions", "file", audio_path, {"model": model, "language": language or ""})
            await self._wait_or_cancel(client, job_id, settings.nexa_private_media_timeout_seconds, progress)
            data = await self._download(client, job_id)
            try:
                result = json.loads(data)
            except (ValueError, UnicodeDecodeError) as exc:
                raise PrivateMediaError("La transcripción recibida no contiene un JSON válido.") from exc
            if not isinstance(result, dict):
                raise PrivateMediaError("La transcripción recibida tiene un formato inválido.")
            await self._ack(client, job_id)
            return result

    async def render(self, package_path: Path, dest_path: Path, *, quality: str, resolution: str | None, timeout: float, on_status: StatusCallback | None = None) -> None:
        async with self._http() as client:
            job_id = await self._submit(client, "/v1/renders", "package", package_path, {"quality": quality, "resolution": resolution or ""})
            await self._wait_or_cancel(client, job_id, timeout, on_status)
            temp = dest_path.parent / f".{dest_path.name}.{uuid4().hex}.part"
            try:
                await self._download(client, job_id, temp)
                if not temp.is_file() or temp.stat().st_size == 0:
                    raise PrivateMediaError("El video descargado está vacío.")
                os.replace(temp, dest_path)
                await self._ack(client, job_id)
            finally:
                temp.unlink(missing_ok=True)

    async def _submit(self, client: httpx.AsyncClient, endpoint: str, field: str, path: Path, data: dict[str, str]) -> str:
        if not path.is_file():
            raise PrivateMediaError("No se encontró el archivo que se enviará al servicio privado.")
        for attempt in range(3):
            try:
                with path.open("rb") as source:
                    response = await client.post(endpoint, data=data, files={field: (path.name, source)})
            except httpx.TransportError as exc:
                raise PrivateMediaError("Se interrumpió el envío al VPS; no se volvió a enviar automáticamente porque pudo haber sido aceptado.") from exc
            if response.status_code == 429 and attempt < 2:
                logger.info("private_media_queue_full", attempt=attempt + 1)
                await asyncio.sleep(2 ** (attempt + 1))
                continue
            if response.status_code != 202:
                raise _http_error(response.status_code)
            try:
                job_id = response.json()["id"]
                UUID(hex=job_id)
            except (KeyError, ValueError, TypeError) as exc:
                raise PrivateMediaError("El VPS devolvió una respuesta de tarea inválida.") from exc
            logger.info("private_media_job_submitted", job_id=job_id, kind=field)
            return job_id
        raise _http_error(429)

    async def _wait_or_cancel(self, client: httpx.AsyncClient, job_id: str, timeout: float, on_status: StatusCallback | None) -> None:
        try:
            await self._wait(client, job_id, timeout, on_status)
        except _RemoteJobFailed:
            raise
        except (PrivateMediaError, asyncio.CancelledError):
            # Best effort: if the worker cannot be reached, it enforces its own
            # limits and cleanup. Shield the cancellation request from a caller
            # cancelling the enclosing task.
            try:
                await asyncio.shield(asyncio.wait_for(self._cancel(client, job_id), timeout=8))
            except (Exception, asyncio.CancelledError):
                logger.warning("private_media_cancel_unconfirmed", job_id=job_id)
            raise

    async def _cancel(self, client: httpx.AsyncClient, job_id: str) -> None:
        response = await client.post(f"/v1/jobs/{job_id}/cancel")
        if response.status_code not in {202, 204, 404, 409}:
            logger.warning("private_media_cancel_unconfirmed", job_id=job_id, status=response.status_code)

    async def _wait(self, client: httpx.AsyncClient, job_id: str, timeout: float, on_status: StatusCallback | None) -> None:
        deadline = time.monotonic() + timeout
        last_phase = None
        failures = 0
        while time.monotonic() < deadline:
            try:
                response = await client.get(f"/v1/jobs/{job_id}")
            except httpx.TransportError as exc:
                failures += 1
                if failures >= 5:
                    raise PrivateMediaError("Se perdió la conexión con el VPS durante el seguimiento.") from exc
                await asyncio.sleep(min(5, failures))
                continue
            failures = 0
            if response.status_code != 200:
                raise _http_error(response.status_code)
            try:
                status = response.json()
                state, phase = status["state"], status.get("phase")
            except (ValueError, KeyError, TypeError) as exc:
                raise PrivateMediaError("El VPS devolvió un estado de tarea inválido.") from exc
            if phase != last_phase:
                logger.info("private_media_job_state", job_id=job_id, state=state, phase=phase)
                last_phase = phase
            if on_status:
                on_status(status)
            if state == "succeeded":
                return
            if state == "failed":
                await self._ack(client, job_id)
                raise _RemoteJobFailed("La tarea falló en el VPS. Consulta el registro de Nexa con el identificador de tarea.")
            if state in {"cancelled", "cancel_requested"}:
                raise PrivateMediaError("La tarea del VPS fue cancelada.")
            if state not in {"queued", "running"}:
                raise PrivateMediaError("El VPS devolvió un estado de tarea desconocido.")
            await asyncio.sleep(min(2.0, max(0.0, deadline - time.monotonic())))
        raise PrivateMediaError("La tarea del VPS excedió el tiempo de espera configurado.")

    async def _download(self, client: httpx.AsyncClient, job_id: str, destination: Path | None = None) -> bytes:
        data = bytearray()
        output = None
        try:
            if destination:
                output = destination.open("xb")
                os.chmod(destination, 0o600)
            async with client.stream("GET", f"/v1/jobs/{job_id}/result") as response:
                if response.status_code != 200:
                    raise _http_error(response.status_code)
                received = 0
                async for chunk in response.aiter_bytes():
                    received += len(chunk)
                    if output:
                        output.write(chunk)
                    else:
                        if received > 64 * 1024 * 1024:
                            raise PrivateMediaError("El JSON recibido del VPS supera el tamaño permitido.")
                        data.extend(chunk)
                expected = response.headers.get("content-length")
                if expected is not None and int(expected) != received:
                    raise PrivateMediaError("La descarga del VPS quedó incompleta.")
        except httpx.TransportError as exc:
            raise PrivateMediaError("La descarga del VPS se interrumpió; el resultado permanecerá unos minutos para recuperación.") from exc
        finally:
            if output:
                output.close()
        return bytes(data)

    async def _ack(self, client: httpx.AsyncClient, job_id: str) -> None:
        try:
            response = await client.post(f"/v1/jobs/{job_id}/ack")
            if response.status_code != 204:
                logger.warning("private_media_ack_failed", job_id=job_id, status=response.status_code)
        except httpx.TransportError:
            logger.warning("private_media_ack_failed", job_id=job_id, status="connection_error")
