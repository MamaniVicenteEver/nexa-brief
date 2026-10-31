"""Adaptadores locales de fuentes verificadas, estilos y cuentas de imagen."""

from __future__ import annotations

import hashlib
import json
from dataclasses import replace
from pathlib import Path
from typing import Any

from src.config.settings import settings
from src.core.image_posts.style import StyleSystem, parse_style
from src.core.ports.image_post_resources import VerifiedImageMaterial


class LocalImagePostResources:
    """Lee los archivos locales y expone al dominio solo datos validados."""

    def __init__(
        self,
        *,
        data_dir: Path | None = None,
        templates_dir: Path | None = None,
        skills_dir: Path | None = None,
    ) -> None:
        self.data_dir = Path(data_dir or settings.data_dir)
        self.templates_dir = Path(templates_dir or settings.templates_dir)
        self.skills_dir = Path(skills_dir or settings.skills_dir)
        self.server_dir = Path(__file__).resolve().parents[3]

    def category_exists(self, category_id: str) -> bool:
        path = self.server_dir / "niches.json"
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return category_id in data.get("categories", {})
        except (OSError, json.JSONDecodeError, AttributeError):
            return False

    def load_verified_material(
        self, source_video_id: str, category_id: str
    ) -> VerifiedImageMaterial | None:
        if not source_video_id or Path(source_video_id).name != source_video_id or source_video_id in {".", ".."}:
            return None
        from src.core.categories import top_level_of
        from src.core.explainer.catalog import find_video_dir, load_video
        video_dir = find_video_dir(source_video_id)
        video = load_video(video_dir) if video_dir else None
        if not video or not video.ready or top_level_of(video.category_path) != category_id:
            return None
        required = {
            "plan": video_dir / "PLAN.md",
            "script": video_dir / "assets" / "script.json",
            "publish": video_dir / "publish.json",
            "credits": video_dir / "assets" / "media" / "CREDITS.md",
        }
        if any(not path.is_file() for path in required.values()):
            return None
        from src.core.explainer.publishing.store import is_package
        try:
            publish = json.loads(required["publish"].read_text(encoding="utf-8"))
            script = json.loads(required["script"].read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        segments = script.get("segments") if isinstance(script, dict) else None
        if (
            not isinstance(publish, dict) or not is_package(publish)
            or not publish.get("sources") or not publish.get("credits")
            or not isinstance(segments, list) or not segments
        ):
            return None
        digest = hashlib.sha256()
        for name in ("plan", "script", "publish", "credits"):
            digest.update(required[name].read_bytes())
        return VerifiedImageMaterial(
            source_video_id=source_video_id,
            category_id=category_id,
            source_revision=digest.hexdigest(),
            plan_text=required["plan"].read_text(encoding="utf-8"),
            publish=publish,
            video_title=str(video.title or ""),
            topic=str(video.topic or ""),
        )

    def resolve_account(self, category_id: str, platform: str, account_alias: str) -> dict[str, Any]:
        row = next(
            (item for item in self._account_rows()
             if item["category_id"] == category_id and item["platform"] == platform
             and item["account_alias"] == account_alias),
            None,
        )
        if row is None:
            raise LookupError("ACCOUNT_NOT_LINKED")
        return dict(row)

    def accounts_for_category(self, category_id: str) -> list[dict[str, Any]]:
        return [dict(row) for row in self._account_rows() if row["category_id"] == category_id]

    def categories_for_account(self, platform: str, account_alias: str) -> list[str]:
        return [row["category_id"] for row in self._account_rows()
                if row["platform"] == platform and row["account_alias"] == account_alias]

    def _account_rows(self) -> list[dict[str, Any]]:
        path = self.data_dir / "image_posts" / "account_map.json"
        if not path.is_file():
            path = self.server_dir / "data" / "image_posts" / "account_map.json"
        raw = json.loads(path.read_text(encoding="utf-8"))
        if raw.get("schema_version") != 1 or not isinstance(raw.get("accounts"), list):
            raise ValueError("account_map.json debe usar schema_version 1 y accounts")
        rows = raw["accounts"]
        seen: set[tuple[str, str, str]] = set()
        for row in rows:
            key = (row["category_id"], row["platform"], row["account_alias"])
            if key in seen:
                raise ValueError(f"Cuenta duplicada en account_map.json: {key}")
            seen.add(key)
        return rows

    def get_style(self, category_id: str, style_id: str | None = None) -> StyleSystem:
        if not category_id or Path(category_id).name != category_id:
            raise ValueError(f"No hay estilo vigente para {category_id}")
        path = self.skills_dir / "image_posts" / "styles" / f"{category_id}.json"
        raw = json.loads(path.read_text(encoding="utf-8"))
        style = self._style_with_fonts(raw, path.parent)
        if style.category_id != category_id or style_id and style.style_id != style_id:
            raise ValueError("El estilo no corresponde a la categoría solicitada")
        return style

    def list_styles(self, category_id: str) -> list[dict[str, Any]]:
        if not category_id or Path(category_id).name != category_id:
            return []
        path = self.skills_dir / "image_posts" / "styles" / f"{category_id}.json"
        if not path.is_file():
            return []
        raw = json.loads(path.read_text(encoding="utf-8"))
        rows = raw.get("styles", [raw]) if isinstance(raw, dict) else raw
        return [self._style_with_fonts(row, path.parent).to_dict() for row in rows]

    @staticmethod
    def _style_with_fonts(raw: dict[str, Any], style_dir: Path) -> StyleSystem:
        style = parse_style(raw)
        fonts: dict[str, bytes] = {}
        root = style_dir.resolve()
        for asset in style.font_assets:
            path = (style_dir / asset.path).resolve()
            if root not in path.parents:
                raise ValueError("font_asset.path debe permanecer dentro del directorio de estilos")
            content = path.read_bytes()
            if hashlib.sha256(content).hexdigest() != asset.sha256:
                raise ValueError(f"hash incorrecto para la fuente {asset.path}")
            fonts[asset.path] = content
        return replace(style, font_data=fonts)
