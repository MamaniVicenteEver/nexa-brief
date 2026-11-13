"""Preparación determinista de una escena nativa: sin modelos, voz ni grabación."""

from __future__ import annotations
from copy import deepcopy
from src.core.showcase.ports import ShowcaseInvalid


def prepare_scene(
    service, design_id: str, *, estilo: str, scene: dict, config: dict, format: str
) -> dict:
    style = service.style(design_id, estilo, format)
    catalog = service.catalog(design_id, estilo, format)
    known = {entry.name for entry in catalog.entries if not entry.name.startswith("common.")}
    result = deepcopy(scene)
    news = style["tokens"].get("family") == "atlas-news"
    collection = "layers" if "layers" in style["tokens"] else "items"
    targets = style["tokens"].get("targets", {}) if news else {collection: None}
    for target, allowed in targets.items():
        rows = result.get(target, [])
        if not isinstance(rows, list) or len(rows) > 10000:
            raise ShowcaseInvalid("La escena necesita una lista de componentes válida")
        for row in rows:
            if not isinstance(row, dict) or not isinstance(row.get("type"), str):
                raise ShowcaseInvalid("Cada componente necesita un tipo")
            name = "map.layer." + row["type"] if collection == "layers" else row["type"]
            if (news and row["type"] not in allowed) or (not news and name not in known):
                raise ShowcaseInvalid("Componente desconocido: " + row["type"])
    result["estilo"] = estilo
    if news or collection == "layers":
        result["estiloRevision"] = style["tokens"]["revision"]
    cfg = deepcopy(config)
    cases = cfg.setdefault("configs", [{}])
    if not isinstance(cases, list) or len(cases) != 1 or not isinstance(cases[0], dict):
        raise ShowcaseInvalid("La preparación admite una configuración por episodio")
    cases[0].update({"estilo": estilo, "sceneUrl": "assets/scene.json"})
    cases[0].setdefault("lyricsUrl", "assets/lyrics.json")
    cases[0].setdefault("audio", {"src": "assets/song.mp3"})
    return {
        "schema_version": 1,
        "design_id": design_id,
        "estilo": estilo,
        "style_revision": style["revision"],
        "scene": result,
        "config": cfg,
        "files": {"assets/scene.json": result, "assets/config.json": cfg},
        "guide_url": f"/api/v1/showcase/designs/{design_id}/production-guide?estilo={estilo}",
        "state": "prepared",
        "recorded": False,
    }
