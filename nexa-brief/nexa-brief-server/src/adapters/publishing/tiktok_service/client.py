"""Authenticated HTTP client for the local TikTok service."""
from __future__ import annotations

import asyncio
import re
import time
from typing import Any

import httpx

from src.config.exceptions import PlatformAPIError, PublisherError, VideoNotFoundError
from src.config.settings import settings


class TikTokServiceError(PlatformAPIError):
    """Safe service failure, keeping its code without exposing response bodies."""

    def __init__(self, code: str, status_code: int = 502):
        super().__init__(f"Servicio TikTok: {code}.", platform="tiktok", status_code=status_code)
        self.code = code


class TikTokServiceClient:
    def __init__(
        self, url: str | None = None, key: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.url = (url or settings.tiktok_service_url).rstrip('/')
        self.key = settings.tiktok_service_key if key is None else key
        self.transport = transport

    async def request(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            # Browser checks and Studio refresh can exceed 30 seconds. Bound
            # every phase, including the wait for the single browser worker.
            async with httpx.AsyncClient(
                base_url=self.url, headers={'X-Nexa-Tiktok-Key': self.key},
                timeout=httpx.Timeout(120, connect=5, pool=5), transport=self.transport,
            ) as client:
                response = await client.request(method, path, **kwargs)
        except httpx.HTTPError as exc:
            raise TikTokServiceError('service_unavailable') from exc
        try:
            data = response.json()
        except ValueError as exc:
            raise TikTokServiceError('invalid_response') from exc
        if response.is_error:
            error = data.get('error') if isinstance(data, dict) else None
            code = error.get('code') if isinstance(error, dict) else None
            if not isinstance(code, str) or not re.fullmatch(r'[a-z_]{1,64}', code):
                code = 'service_error'
            # Only a missing video is a VideoNotFoundError. Missing accounts,
            # jobs and QR sessions have different recovery paths.
            if response.status_code == 404 and code == 'video_not_found':
                raise VideoNotFoundError('Video inexistente en el servicio TikTok.')
            raise TikTokServiceError(code, response.status_code)
        if not isinstance(data, (dict, list)):
            raise TikTokServiceError('invalid_response')
        return data

    async def wait_job(self, job: dict[str, Any], timeout: float = 900) -> dict[str, Any]:
        deadline = time.monotonic() + timeout
        job_id = job.get('id') if isinstance(job, dict) else None
        if not isinstance(job_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', job_id):
            raise TikTokServiceError('invalid_job_response')
        while True:
            if (not isinstance(job, dict) or job.get('id') != job_id or
                    not isinstance(job.get('state'), str) or
                    job.get('state') not in {'queued', 'running', 'clicked', 'done', 'failed', 'needs_review'}):
                raise TikTokServiceError('invalid_job_response')
            if job['state'] in {'done', 'failed', 'needs_review'}:
                break
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise PublisherError(f"TikTok job {job_id} sigue en curso; consultar antes de reintentar.")
            await asyncio.sleep(min(1, remaining))
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                continue
            try:
                job = await asyncio.wait_for(self.request('GET', f"/v1/jobs/{job_id}"), timeout=remaining)
            except asyncio.TimeoutError as exc:
                raise PublisherError(f"TikTok job {job_id} sigue en curso; consultar antes de reintentar.") from exc
            except PublisherError as exc:
                raise PublisherError(f"TikTok job {job_id} no se pudo consultar; revisar antes de reintentar.") from exc
        if job['state'] != 'done':
            raise PublisherError(f"TikTok job {job_id} {job['state']}; revisar antes de reintentar.")
        result = job.get('result')
        if not isinstance(result, dict):
            raise TikTokServiceError('invalid_job_result')
        return result
