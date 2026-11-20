"""OpenStreetMap API de lectura: elementos y mapas por bounding box.

La API principal de OSM es de edición/lectura estructurada, no un buscador de
texto. Para búsquedas espaciales grandes debe usarse Overpass (otro proveedor
de este paquete) o un servicio de geocodificación especializado.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from typing import Any

from src.adapters.researcher_data.infrastructure.base import ResearchProvider
from src.adapters.researcher_data.models import ResearchResponse, ResearchResult


class OpenStreetMapProvider(ResearchProvider):
    name = "openstreetmap"

    @property
    def configured(self) -> bool:
        return bool(self.config.openstreetmap_api_url)

    async def search(
        self, query: str, *, page: int = 1, limit: int = 10, **filters: Any
    ) -> ResearchResponse:
        bbox = str(filters.get("bbox") or query).strip()
        return await self.map_bbox(bbox, page=page, limit=limit)

    async def map_bbox(
        self, bbox: str, *, page: int = 1, limit: int = 10
    ) -> ResearchResponse:
        _validate_bbox(bbox)
        text = await self.http.text(
            "GET",
            f"{self.config.openstreetmap_api_url.rstrip('/')}/map",
            params={"bbox": bbox},
            headers={"Accept": "application/xml"},
        )
        root = ET.fromstring(text)
        results = [self._element_result(element) for element in root]
        return ResearchResponse(
            provider=self.name,
            query=bbox,
            results=results[:limit],
            total=len(results),
            page=page,
            limit=limit,
            metadata={"bbox": bbox, "source": "map"},
        )

    async def element(
        self, element_type: str, element_id: int, *, full: bool = False
    ) -> dict[str, Any]:
        if element_type not in {"node", "way", "relation"}:
            raise ValueError("element_type debe ser node, way o relation")
        suffix = "/full" if full else ""
        return await self.http.json(
            "GET",
            f"{self.config.openstreetmap_api_url.rstrip('/')}/{element_type}/{element_id}{suffix}.json",
        )

    @staticmethod
    def _element_result(element: ET.Element) -> ResearchResult:
        element_type = element.tag
        element_id = element.attrib.get("id", "")
        tags = {
            tag.attrib.get("k", ""): tag.attrib.get("v", "")
            for tag in element.findall("tag")
        }
        lat, lon = element.attrib.get("lat"), element.attrib.get("lon")
        return ResearchResult(
            provider="openstreetmap",
            resource_id=f"{element_type}/{element_id}",
            kind="map_feature",
            title=tags.get("name", f"{element_type} {element_id}"),
            url=f"https://www.openstreetmap.org/{element_type}/{element_id}",
            metadata={"tags": tags, "lat": lat, "lon": lon},
        )


def _validate_bbox(bbox: str) -> None:
    try:
        values = [float(value) for value in bbox.split(",")]
    except ValueError as exc:
        raise ValueError("bbox debe ser min_lon,min_lat,max_lon,max_lat") from exc
    if len(values) != 4 or values[0] >= values[2] or values[1] >= values[3]:
        raise ValueError(
            "bbox debe ser min_lon,min_lat,max_lon,max_lat y estar ordenado"
        )
