"""Cliente HTTP compartido: timeout, User-Agent, reintentos y errores estables."""

from __future__ import annotations

import asyncio
from typing import Any

import httpx

from src.adapters.researcher_data.config import ResearcherSettings, settings
from src.adapters.researcher_data.models import ResearchProviderError


class ResearchHTTP:
    def __init__(
        self,
        *,
        provider: str,
        config: ResearcherSettings | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.provider = provider
        self.config = config or settings
        self.transport = transport

    async def _request(
        self,
        method: str,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        json_body: Any = None,
    ) -> httpx.Response:
        request_headers = {
            "User-Agent": self.config.researcher_user_agent,
            "Accept": "application/json",
        }
        request_headers.update(headers or {})
        attempts = max(0, self.config.request_max_retries) + 1
        for attempt in range(attempts):
            try:
                timeout = httpx.Timeout(self.config.request_timeout_seconds)
                async with httpx.AsyncClient(
                    timeout=timeout, transport=self.transport
                ) as client:
                    response = await client.request(
                        method,
                        url,
                        params=params,
                        headers=request_headers,
                        json=json_body,
                    )
            except httpx.HTTPError as exc:
                if attempt + 1 >= attempts:
                    raise ResearchProviderError(
                        self.provider,
                        "network",
                        f"{self.provider}: {type(exc).__name__}",
                    ) from exc
                await asyncio.sleep(self._backoff(attempt))
                continue

            if (
                response.status_code in {429, 500, 502, 503, 504}
                and attempt + 1 < attempts
            ):
                await asyncio.sleep(self._backoff(attempt, response))
                continue
            return response

        raise ResearchProviderError(
            self.provider, "network", f"{self.provider}: petición agotada"
        )

    def _backoff(self, attempt: int, response: httpx.Response | None = None) -> float:
        if response is not None:
            retry_after = response.headers.get("Retry-After")
            if retry_after and retry_after.isdigit():
                return min(float(retry_after), 10.0)
        return self.config.request_retry_backoff_seconds * (2**attempt)

    async def json(
        self,
        method: str,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        json_body: Any = None,
    ) -> Any:
        response = await self._request(
            method, url, params=params, headers=headers, json_body=json_body
        )
        self._raise_for_status(response)
        try:
            return response.json()
        except ValueError as exc:
            raise ResearchProviderError(
                self.provider,
                "bad_response",
                f"{self.provider}: la respuesta no es JSON",
            ) from exc

    async def text(
        self,
        method: str,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        json_body: Any = None,
    ) -> str:
        response = await self._request(
            method, url, params=params, headers=headers, json_body=json_body
        )
        self._raise_for_status(response)
        return response.text

    def _raise_for_status(self, response: httpx.Response) -> None:
        if response.status_code == 429:
            raise ResearchProviderError(
                self.provider, "rate_limited", f"{self.provider}: límite alcanzado"
            )
        if response.status_code == 401:
            raise ResearchProviderError(
                self.provider, "invalid_key", f"{self.provider}: credencial rechazada"
            )
        if response.status_code == 403:
            raise ResearchProviderError(
                self.provider,
                "forbidden",
                f"{self.provider}: acceso bloqueado (HTTP 403)",
            )
        if response.status_code == 404:
            raise ResearchProviderError(
                self.provider, "not_found", f"{self.provider}: recurso no encontrado"
            )
        if response.status_code >= 400:
            detail = response.text.replace("\n", " ")[:240]
            raise ResearchProviderError(
                self.provider,
                "http_error",
                f"{self.provider}: HTTP {response.status_code}{': ' + detail if detail else ''}",
            )
