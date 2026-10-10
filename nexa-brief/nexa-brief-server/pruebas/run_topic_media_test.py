"""Busca medios editoriales para temas históricos y filtra vídeos cortos."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

try:
    import run_people_media_test as base
except ModuleNotFoundError:
    from pruebas import run_people_media_test as base


TOPICS: dict[str, dict[str, object]] = {
    "primer_lenguaje_programacion": {
        "name": "Plankalkül: primer lenguaje de programación de alto nivel",
        "search_query": "Plankalkül",
        "aliases": [
            "Plankalkül",
            "Plankalkul",
            "Konrad Zuse",
            "Zuse",
            "first high-level programming language",
            "early programming language",
            "Z3 computer",
        ],
        "media_aliases": [
            "Plankalkül",
            "Plankalkul",
            "Konrad Zuse",
            "Z3",
            "Z4",
            "Z1",
            "programming language",
        ],
        "video_include_terms": [
            "Plankalkül",
            "Plankalkul",
            "Konrad Zuse",
            "first programming language",
            "first high-level language",
            "early programming language",
        ],
        "video_exclude_terms": ["tutorial", "course", "lesson"],
        "additional_searches": [
            {
                "provider": "wikipedia",
                "query": "Konrad Zuse",
                "filters": {"language": "en"},
            },
            {
                "provider": "wikimedia_commons",
                "query": "Konrad Zuse",
                "filters": {"thumbnail_width": 2000},
            },
            {
                "provider": "wikimedia_commons",
                "query": "Z3 computer",
                "filters": {"thumbnail_width": 2000},
            },
            {
                "provider": "wikimedia_commons",
                "query": "Z4 computer",
                "filters": {"thumbnail_width": 2000},
            },
            {
                "provider": "wikimedia_commons",
                "query": "Z3 (computer)",
                "filters": {"thumbnail_width": 2000},
            },
            {
                "provider": "wikimedia_commons",
                "query": "Z1 computer",
                "filters": {"thumbnail_width": 2000},
            },
            {
                "provider": "internet_archive",
                "query": "Konrad Zuse",
                "filters": {"media_type": "video"},
            },
            {
                "provider": "internet_archive",
                "query": "Zuse",
                "filters": {"media_type": "video"},
            },
        ],
        "osm_bbox": "",
        "overpass_term": "",
    },
    "caida_muro_berlin": {
        "name": "Caída del Muro de Berlín (1989)",
        "search_query": "fall of the Berlin Wall",
        "aliases": [
            "fall of the Berlin Wall",
            "Berlin Wall",
            "Mauerfall",
            "Berlin 1989",
            "November 1989",
            "Brandenburg Gate",
        ],
        "media_aliases": [
            "Berlin Wall",
            "fall of the Berlin Wall",
            "Mauerfall",
            "Berlin 1989",
            "1989",
            "Brandenburg Gate",
        ],
        "video_include_terms": [
            "Berlin Wall",
            "fall of the Berlin Wall",
            "Mauerfall",
            "Berlin 1989",
            "1989",
            "Brandenburg Gate",
        ],
        "video_exclude_terms": [
            "wall street",
            "new berlin wall",
            "russia",
            "yatsenyuk",
            "checked for private info",
            "remove - ph",
        ],
        "additional_searches": [
            {
                "provider": "wikimedia_commons",
                "query": "Berlin Wall 1989",
                "filters": {"thumbnail_width": 2000},
            },
            {
                "provider": "wikimedia_commons",
                "query": "Brandenburg Gate 1989",
                "filters": {"thumbnail_width": 2000},
            },
            {
                "provider": "wikimedia_commons",
                "query": "Mauerfall",
                "filters": {"thumbnail_width": 2000},
            },
            {
                "provider": "internet_archive",
                "query": "Berlin Wall fall 1989",
                "filters": {"media_type": "video"},
            },
            {
                "provider": "internet_archive",
                "query": "title:\"Berlin Wall\"",
                "filters": {"media_type": "video"},
            },
        ],
        "osm_bbox": "",
        "overpass_term": "",
    },
}


async def main() -> None:
    base.ROOT = Path(__file__).resolve().parent / "temas"
    base.TARGET_IMAGES = 10
    base.TARGET_VIDEOS = 4
    base.MAX_IMAGE_BYTES = 80 * 1024 * 1024
    base.MAX_VIDEO_BYTES = 60 * 1024 * 1024
    base.MIN_VIDEO_SECONDS = 10.0
    base.MAX_VIDEO_SECONDS = 60.0

    summaries = []
    for topic_key, topic in TOPICS.items():
        print(f"START {topic['name']}", flush=True)
        report = await base._run_person(topic_key, topic)
        summary = {
            "tema": report["tema"],
            "imagenes": report["obtenido"]["imagenes"],
            "videos": report["obtenido"]["videos"],
            "videos_referencias": len(report["videos_referencias"]),
            "faltantes": report["faltantes"],
            "archivo": str(base.ROOT / topic_key / "resultados.json"),
        }
        summaries.append(summary)
        print(json.dumps(summary, ensure_ascii=False), flush=True)
    print(json.dumps({"temas": summaries}, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
