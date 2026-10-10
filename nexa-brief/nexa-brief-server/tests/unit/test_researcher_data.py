"""Pruebas offline de researcher_data: ningún test consume APIs reales."""

from __future__ import annotations

import httpx

from src.adapters.researcher_data.config import ResearcherSettings
from src.adapters.researcher_data.factory import ResearcherDataAdapter
from src.adapters.researcher_data.infrastructure.commons import WikimediaCommonsProvider
from src.adapters.researcher_data.infrastructure.openverse import OpenverseProvider
from src.adapters.researcher_data.infrastructure.wikipedia import WikipediaProvider
from src.adapters.researcher_data.models import ResearchResponse, ResearchResult


def _transport(routes: dict[str, object]) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        body = routes.get(request.url.path)
        if body is None:
            return httpx.Response(404, request=request)
        return (
            httpx.Response(200, json=body, request=request)
            if isinstance(body, dict)
            else httpx.Response(200, text=str(body), request=request)
        )

    return httpx.MockTransport(handler)


def _config(**values: str) -> ResearcherSettings:
    defaults = {
        "RESEARCHER_USER_AGENT": "test-agent",
        "RESEARCHER_REQUEST_MAX_RETRIES": "0",
        "WIKIPEDIA_API_URL": "https://test.local/w/api.php",
        "WIKIMEDIA_COMMONS_API_URL": "https://test.local/commons.php",
        "OPENVERSE_API_URL": "https://test.local/openverse/v1",
    }
    defaults.update(values)
    return ResearcherSettings(**defaults)


async def test_wikipedia_search_normalizes_results_and_pagination():
    transport = _transport(
        {
            "/w/api.php": {
                "query": {
                    "search": [
                        {
                            "pageid": 42,
                            "title": "Ada Lovelace",
                            "snippet": "matemática",
                            "wordcount": 20,
                        }
                    ],
                    "searchinfo": {"totalhits": 1},
                }
            }
        }
    )
    provider = WikipediaProvider(config=_config(), transport=transport)
    response = await provider.search("Ada Lovelace", language="en", limit=5)
    assert response.results[0].resource_id == "42"
    assert response.results[0].url.endswith("/Ada_Lovelace")
    assert response.total == 1


async def test_commons_search_detects_media_and_keeps_license():
    transport = _transport(
        {
            "/commons.php": {
                "query": {
                    "pages": [
                        {
                            "pageid": 7,
                            "title": "File:Mountain.jpg",
                            "imageinfo": [
                                {
                                    "mime": "image/jpeg",
                                    "url": "https://upload.wikimedia.org/mountain.jpg",
                                    "thumburl": "https://upload.wikimedia.org/thumb.jpg",
                                    "extmetadata": {
                                        "LicenseShortName": {"value": "CC BY-SA 4.0"}
                                    },
                                }
                            ],
                        }
                    ]
                }
            }
        }
    )
    provider = WikimediaCommonsProvider(config=_config(), transport=transport)
    [item] = (await provider.search("mountain")).results
    assert item.kind == "image"
    assert item.title == "Mountain.jpg"
    assert item.license == "CC BY-SA 4.0"


async def test_openverse_accepts_optional_token_and_normalizes_image():
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(
            200,
            json={
                "result_count": 1,
                "page_count": 1,
                "results": [
                    {
                        "id": "abc",
                        "title": "Open image",
                        "url": "https://cdn.example/image.jpg",
                        "thumbnail": "https://cdn.example/thumb.jpg",
                        "creator": "Ana",
                        "license": "cc0",
                    }
                ],
            },
            request=request,
        )

    provider = OpenverseProvider(
        config=_config(OPENVERSE_API_TOKEN="token"),
        transport=httpx.MockTransport(handler),
    )
    [item] = (await provider.search("mountain", media_type="image")).results
    assert item.media_url.endswith("image.jpg")
    assert calls[0].headers["Authorization"] == "Bearer token"
    assert calls[0].url.path.endswith("/images/")


class _FakeProvider:
    name = "fake"

    async def search(
        self, query: str, *, page: int = 1, limit: int = 10, **filters: object
    ) -> ResearchResponse:
        return ResearchResponse(
            provider=self.name,
            query=query,
            results=[
                ResearchResult(
                    provider=self.name,
                    resource_id="1",
                    title=query,
                    url="https://example.com/1",
                )
            ],
            page=page,
            limit=limit,
        )


async def test_aggregator_reports_unknown_provider_and_caches_success():
    fake = _FakeProvider()
    adapter = ResearcherDataAdapter(providers=[fake])
    first = await adapter.search("ocean", providers=["fake", "missing"])
    second = await adapter.search("ocean", providers=["fake"])
    assert [item.resource_id for item in first.results] == ["1"]
    assert first.provider_errors[0].code == "unknown_provider"
    assert second.results[0].title == "ocean"
