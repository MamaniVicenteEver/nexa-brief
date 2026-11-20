"""Investigaciones de los videos: registro único, copia a la librería y lectura para la pantalla."""

import asyncio
import json
from pathlib import Path

from src.core.data import collection
from src.core.library import research_library as rl


def _write(path: Path, text: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


def _research_json(topic: str = "PULSO, club de running", researched_at: str = "2026-11-13") -> str:
    return json.dumps(
        {
            "topic": topic,
            "researched_at": researched_at,
            "findings": [
                {
                    "id": "F1",
                    "strength": 3,
                    "recency": "2022",
                    "claim": "Hecho uno",
                    "sources": [
                        {"title": "A", "url": "https://a.example/1", "data_date": "2022-05-15", "accessed_at": "2026-11-13"},
                        {"title": "B", "url": "https://b.example/2", "data_date": "", "accessed_at": "2026-11-13"},
                    ],
                }
            ],
            "discarded": [{"claim": "Descartado", "reason": "Sin fuente primaria"}],
        },
        ensure_ascii=False,
    )


def _roots(profile: Path):
    return [("production", profile / "productions"), ("sandbox", profile / "sandbox")]


def _sync(profile: Path):
    return asyncio.run(
        rl.sync(roots=_roots(profile), profile_root=profile, resources_dir=profile / "resources")
    )


def test_revision_suffix_is_split_from_the_base_id():
    assert rl.revision_of("promo-r2") == ("promo", "r2")
    assert rl.revision_of("promo") == ("promo", "")


def test_build_record_reads_structured_research_and_counts(tmp_path):
    folder = tmp_path / "sandbox" / "nodemotion" / "promo-r1" / "work" / "research"
    _write(folder / "research.json", _research_json())
    _write(folder / "research.md", "# PULSO, club de running\n")
    _write(folder / "medios" / "foto.jpg", "imagen")

    [found] = rl.discover([("sandbox", tmp_path / "sandbox")])
    record = rl.build_record(found, tmp_path)

    assert record["topic"] == "PULSO, club de running"
    assert record["researched_at"] == "2026-11-13"
    assert record["group"] == "promo" and record["revision"] == "r1"
    assert record["main"] == "research.json"
    assert record["counts"]["findings"] == 1
    assert record["counts"]["sources"] == 2
    assert record["counts"]["discarded"] == 1
    assert record["counts"]["images"] == 1
    assert record["origins"][0]["path"] == "sandbox/nodemotion/promo-r1/work/research"
    assert record["images"][0]["path"] == "medios/foto.jpg"


def test_markdown_only_folder_uses_its_heading_and_empty_folders_are_skipped(tmp_path):
    atlas = tmp_path / "productions" / "nodeatlas" / "atlas" / "work" / "research"
    _write(atlas / "HECHOS.md", "# Hechos verificados · Atlas en Movimiento\n\nTexto.\n")
    _write(atlas / "ACCESOS.md", "# Accesos\n")
    _write(tmp_path / "sandbox" / "nodemotion" / "sin-datos" / "work" / "research" / "input.json", "{}")

    found = rl.discover(_roots(tmp_path))
    records = [rl.build_record(folder, tmp_path) for folder in found]

    assert [r for r in records if r is not None][0]["topic"] == "Hechos verificados · Atlas en Movimiento"
    assert records.count(None) == 1  # la carpeta que solo tiene input.json no es una investigación


def test_sync_registers_once_copies_files_and_is_idempotent(tmp_path):
    _write(tmp_path / "sandbox" / "nodemotion" / "promo" / "work" / "research" / "research.json", _research_json())
    _write(tmp_path / "productions" / "nodeatlas" / "atlas" / "work" / "research" / "HECHOS.md", "# Atlas\n")

    first = _sync(tmp_path)
    second = _sync(tmp_path)

    assert (first.created, first.merged) == (2, 0)
    assert (second.created, second.merged) == (0, 2)
    assert len(collection(rl.COLLECTION).list()) == 2
    for record in collection(rl.COLLECTION).list():
        copied = tmp_path / "resources" / "research" / record["research_id"] / record["main"]
        assert copied.is_file()


def test_same_content_in_two_folders_is_one_record_with_two_origins(tmp_path):
    body = _research_json()
    _write(tmp_path / "sandbox" / "nodemotion" / "tema" / "work" / "research" / "research.json", body)
    _write(tmp_path / "sandbox" / "nodemotion" / "tema-r1" / "work" / "research" / "research.json", body)

    report = _sync(tmp_path)

    [record] = collection(rl.COLLECTION).list()
    assert (report.created, report.merged) == (1, 1)
    assert {origin["video_id"] for origin in record["origins"]} == {"tema", "tema-r1"}


def test_list_groups_versions_and_filters_by_text_and_category(tmp_path):
    _write(
        tmp_path / "sandbox" / "nodemotion" / "pulso" / "work" / "research" / "research.json",
        _research_json(researched_at="2026-11-10"),
    )
    _write(
        tmp_path / "sandbox" / "nodemotion" / "pulso-r1" / "work" / "research" / "research.json",
        _research_json(topic="PULSO, club de running (v2)", researched_at="2026-11-12"),
    )
    _write(
        tmp_path / "productions" / "nodeatlas" / "atlas" / "work" / "research" / "HECHOS.md",
        "# Atlas en Movimiento\n",
    )
    _sync(tmp_path)

    cards, total = rl.list_cards()
    assert total == 2
    pulso = next(card for card in cards if card["topic"].startswith("PULSO"))
    assert pulso["version_count"] == 2
    assert pulso["revision"] == "r1"  # la versión más nueva es la que se muestra

    text_cards, text_total = rl.list_cards(q="running")
    assert text_total == 1 and text_cards[0]["topic"].startswith("PULSO")

    category_cards, _ = rl.list_cards(category="nodeatlas")
    assert [card["origin_category"] for card in category_cards] == ["nodeatlas"]
    assert rl.categories() == ["nodeatlas", "nodemotion"]


def test_file_location_serves_only_registered_files(tmp_path):
    _write(tmp_path / "sandbox" / "nodemotion" / "promo" / "work" / "research" / "research.json", _research_json())
    _sync(tmp_path)
    [record] = collection(rl.COLLECTION).list()
    resources = tmp_path / "resources"

    assert rl.file_location(record["research_id"], "research.json", resources) is not None
    assert rl.file_location(record["research_id"], "../../../secret.txt", resources) is None
    assert rl.file_location(record["research_id"], "no-registrado.json", resources) is None
    assert rl.file_location("../etc", "research.json", resources) is None


def test_root_research_json_with_scope_and_source_ids_is_readable(tmp_path):
    payload = {
        "consulted_on": "2026-11-14",
        "scope": "Prueba de un minuto: usos cotidianos de auriculares y router. Sin cifras de rendimiento.",
        "sources": [
            {"id": "S1", "publisher": "Fabricante", "title": "Guía", "url": "https://f.example/g", "consulted_on": "2026-11-14"}
        ],
        "findings": [{"claim": "Hecho", "sources": ["S1"], "strength": 2, "recency": "2025"}],
        "discarded": [],
    }
    _write(tmp_path / "productions" / "nodeactualidad" / "prueba" / "research.json", json.dumps(payload, ensure_ascii=False))
    _sync(tmp_path)

    [record] = collection(rl.COLLECTION).list()
    detail = rl.read_detail(record["research_id"], tmp_path / "resources")

    assert record["topic"].startswith("Prueba de un minuto")
    assert record["researched_at"] == "2026-11-14"
    assert record["counts"]["sources"] == 1
    assert detail["findings"][0]["sources"][0]["url"] == "https://f.example/g"
    assert detail["summary"].startswith("Prueba de un minuto")


def test_resync_refreshes_derived_fields_and_keeps_usage_and_licenses(tmp_path):
    folder = tmp_path / "sandbox" / "nodemotion" / "promo" / "work" / "research"
    _write(folder / "research.json", _research_json())
    _write(folder / "medios" / "foto.jpg", "x")
    _sync(tmp_path)
    store = collection(rl.COLLECTION)
    [record] = store.list()
    asyncio.run(
        store.update(
            record["research_id"],
            {
                "topic": "Tema viejo",
                "used_by": [{"video_id": "v1", "at": "2026-11-15"}],
                "images": [
                    {"path": "medios/foto.jpg", "source_url": "https://c.example/f", "license": "CC BY 4.0", "credit": "Autor"}
                ],
            },
        )
    )

    report = _sync(tmp_path)
    [after] = store.list()

    assert report.merged == 1
    assert after["topic"] == "PULSO, club de running"
    assert after["used_by"] == [{"video_id": "v1", "at": "2026-11-15"}]
    assert after["images"][0]["license"] == "CC BY 4.0" and after["images"][0]["credit"] == "Autor"


def test_read_detail_returns_findings_summary_and_versions(tmp_path):
    _write(tmp_path / "sandbox" / "nodemotion" / "promo" / "work" / "research" / "research.json", _research_json())
    _write(tmp_path / "sandbox" / "nodemotion" / "promo" / "work" / "research" / "research.md", "# PULSO\n")
    _sync(tmp_path)
    [record] = collection(rl.COLLECTION).list()

    detail = rl.read_detail(record["research_id"], tmp_path / "resources")

    assert detail["findings"][0]["claim"] == "Hecho uno"
    assert detail["findings"][0]["sources"][0]["url"] == "https://a.example/1"
    assert detail["discarded"] == [{"claim": "Descartado", "reason": "Sin fuente primaria"}]
    assert detail["summary"].startswith("# PULSO")
    assert len(detail["versions"]) == 1
    assert rl.read_detail("0000000000000000-no", tmp_path / "resources") is None
