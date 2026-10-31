"""Lee y escribe `publish.json`.

v1 (hoy en la mayoría de los videos): campos planos (youtube_title, …).
v2: el paquete completo (package.py) + esos mismos campos planos, derivados acá
al guardar. Así el catálogo, el grabador, el publicador y `kit.py manifest`
siguen leyendo lo de siempre, y la única fuente de verdad es el paquete.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.core.explainer.publishing.description import (
    gratitude_text,
    gratitude_variant,
    render_facebook,
    render_youtube,
)
from src.core.explainer.publishing.package import SCHEMA_VERSION, PublishPackage
from src.core.explainer.publishing.strategies import ActiveStrategies
from src.core.explainer import narrative

PUBLISH_FILE = "publish.json"
# Campos planos de v1 que save_package deriva del paquete (compat_fields).
COMPAT_KEYS = frozenset({
    "youtube_title",
    "youtube_title_alternatives",
    "youtube_description",
    "youtube_tags",
    "facebook_title",
    "facebook_description",
    "tiktok_caption",
    "tiktok_hashtags",
    "thumbnail_text",
    "gratitude_used",
})


def read_publish(video_dir: Path) -> dict[str, Any]:
    path = video_dir / PUBLISH_FILE
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def is_package(data: dict[str, Any]) -> bool:
    return data.get("schema_version") == SCHEMA_VERSION


def load_package(video_dir: Path) -> PublishPackage | None:
    """El paquete v2 del video, o None si su publish.json todavía es v1 (o no existe)."""
    data = read_publish(video_dir)
    if not is_package(data):
        return None
    # Los campos planos se derivan al guardar: no son parte del paquete.
    return PublishPackage.model_validate({k: v for k, v in data.items() if k not in COMPAT_KEYS})


def compat_fields(video_id: str, package: PublishPackage, strategies: ActiveStrategies) -> dict[str, Any]:
    """Los campos planos de v1, derivados del paquete (los que leen grabador y publicador)."""
    variant = gratitude_variant(video_id, package, strategies.gratitude)
    titles = package.titles
    chosen = titles.youtube_chosen
    return {
        "youtube_title": chosen.text,
        "youtube_title_alternatives": [t.text for t in titles.youtube if t.option != chosen.option],
        "youtube_description": render_youtube(
            package, gratitude_text(variant, package, strategies.gratitude), strategies.description
        ),
        "youtube_tags": list(package.tags.youtube),
        "facebook_title": titles.facebook.title,
        "facebook_description": render_facebook(package),
        "tiktok_caption": titles.tiktok.caption,
        "tiktok_hashtags": list(package.tags.tiktok),
        "thumbnail_text": package.thumbnail.chosen_text,
        "gratitude_used": variant,
    }


def save_package(video_dir: Path, package: PublishPackage, strategies: ActiveStrategies) -> dict[str, Any]:
    """Escribe el paquete v2 con sus campos derivados; devuelve lo escrito."""
    previous = load_package(video_dir)
    package = package.model_copy(update={"strategies_used": narrative.stamp_publish(video_dir, strategies.ids())})
    package_data = package.model_dump(mode="json")
    if package.thumbnail.tabloid is None:
        package_data["thumbnail"].pop("tabloid", None)  # Los paquetes viejos conservan su forma A/B.
    data = {**package_data, **compat_fields(video_dir.name, package, strategies)}
    if previous is not None and previous.thumbnail != package.thumbnail:
        for option in ("A", "B", "C"):
            for suffix in ("jpg", "webp", "sha256"):
                (video_dir / "render" / f"thumbnail-{option}.{suffix}").unlink(missing_ok=True)
    (video_dir / PUBLISH_FILE).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return data
