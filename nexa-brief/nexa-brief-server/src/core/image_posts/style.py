"""Carga de estilos versionados para las categorías iniciales."""
from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import json
from pathlib import PurePosixPath
import re
from typing import Any, Mapping


class StyleError(ValueError):
    """El estilo o sus recursos no cumplen el contrato."""


def _strict_object(raw: Any, name: str, allowed: set[str], required: set[str]) -> Mapping[str, Any]:
    if not isinstance(raw, Mapping):
        raise StyleError(f"{name} debe ser un objeto")
    unknown = set(raw) - allowed
    missing = required - set(raw)
    if unknown:
        raise StyleError(f"{name} contiene campos desconocidos: {sorted(unknown)}")
    if missing:
        raise StyleError(f"{name} no contiene campos requeridos: {sorted(missing)}")
    return raw


@dataclass(frozen=True)
class FontAsset:
    family: str
    weight: int
    style: str
    path: str
    sha256: str
    license: str
    license_url: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "family": self.family,
            "weight": self.weight,
            "style": self.style,
            "path": self.path,
            "sha256": self.sha256,
            "license": self.license,
            "license_url": self.license_url,
        }


@dataclass(frozen=True)
class StyleSystem:
    style_id: str
    category_id: str
    version: str
    design_id: str
    palette: dict[str, str]
    fonts: dict[str, Any]
    textures: tuple[dict[str, Any], ...]
    grid: dict[str, int]
    composition: dict[str, Any]
    tone: dict[str, Any]
    font_data: dict[str, bytes] = field(default_factory=dict, repr=False, compare=False)
    brand: dict[str, str] = field(default_factory=dict)  # nombre del canal y @cuenta

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": 1,
            "style_id": self.style_id,
            "category_id": self.category_id,
            "version": self.version,
            "design_id": self.design_id,
            "palette": self.palette,
            "fonts": self.fonts,
            "textures": list(self.textures),
            "grid": self.grid,
            "composition": self.composition,
            "tone": self.tone,
            **({"brand": self.brand} if self.brand else {}),
        }

    @property
    def font_assets(self) -> tuple[FontAsset, ...]:
        return tuple(FontAsset(**asset) for asset in self.fonts["font_assets"])

    def font_bytes(self) -> dict[str, bytes]:
        expected = {asset.path: asset.sha256 for asset in self.font_assets}
        for name, digest in expected.items():
            data = self.font_data.get(name)
            if data is None or hashlib.sha256(data).hexdigest() != digest:
                raise StyleError(f"falta la fuente verificada {name}")
        return dict(self.font_data)


def _brand(raw: Any) -> dict[str, str]:
    """Marca opcional del canal: {"name": "NodeTech", "handle": "@nodetech_es"}."""
    if raw is None:
        return {}
    data = _strict_object(raw, "brand", {"name", "handle"}, {"name", "handle"})
    if any(not isinstance(value, str) or not value.strip() for value in data.values()):
        raise StyleError("brand.name y brand.handle deben ser texto")
    return {"name": data["name"].strip(), "handle": data["handle"].strip()}


def parse_style(raw: Mapping[str, Any], font_data: Mapping[str, bytes] | None = None) -> StyleSystem:
    data = _strict_object(
        raw,
        "StyleSystem",
        {
            "schema_version",
            "style_id",
            "category_id",
            "version",
            "design_id",
            "palette",
            "fonts",
            "textures",
            "grid",
            "composition",
            "tone",
            "brand",
        },
        {
            "schema_version",
            "style_id",
            "category_id",
            "version",
            "design_id",
            "palette",
            "fonts",
            "textures",
            "grid",
            "composition",
            "tone",
        },
    )
    if data["schema_version"] != 1:
        raise StyleError("schema_version debe ser 1")
    palette = _strict_object(data["palette"], "palette", {"bg", "bg2", "ink", "muted", "accent", "accentInk"}, {"bg", "bg2", "ink", "muted", "accent", "accentInk"})
    for name, color in palette.items():
        if not isinstance(color, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
            raise StyleError(f"palette.{name} debe ser un color hex")
    fonts = _strict_object(data["fonts"], "fonts", {"headline", "body", "mono", "decorative", "font_assets"}, {"headline", "body", "mono", "decorative", "font_assets"})
    font_assets = fonts["font_assets"]
    if not isinstance(font_assets, list) or not font_assets:
        raise StyleError("fonts.font_assets debe incluir recursos locales hashados")
    normalized_fonts = dict(fonts)
    normalized_assets = []
    for item in font_assets:
        item_data = _strict_object(
            item,
            "font_asset",
            {"family", "weight", "style", "path", "sha256", "license", "license_url"},
            {"family", "weight", "style", "path", "sha256", "license", "license_url"},
        )
        if not isinstance(item_data["weight"], int) or not 100 <= item_data["weight"] <= 900:
            raise StyleError("font_asset.weight debe estar entre 100 y 900")
        if not re.fullmatch(r"[a-f0-9]{64}", str(item_data["sha256"])):
            raise StyleError("font_asset.sha256 debe ser SHA-256 hexadecimal")
        path = PurePosixPath(str(item_data["path"]))
        if path.is_absolute() or ".." in path.parts or "\\" in str(item_data["path"]):
            raise StyleError("font_asset.path debe ser relativo y no puede salir del estilo")
        normalized_assets.append(FontAsset(**item_data).to_dict())
    normalized_fonts["font_assets"] = normalized_assets
    textures = data["textures"]
    if not isinstance(textures, list):
        raise StyleError("textures debe ser una lista")
    grid = _strict_object(data["grid"], "grid", {"margin_px", "columns", "gutter_px", "safe_bottom_px"}, {"margin_px", "columns", "gutter_px", "safe_bottom_px"})
    if any(not isinstance(value, int) or value < 0 for value in grid.values()):
        raise StyleError("grid debe usar enteros no negativos")
    composition = _strict_object(
        data["composition"],
        "composition",
        {"allowed_components", "photo_filter", "contrast_min", "headline_lines_max", "body_lines_max"},
        {"allowed_components", "photo_filter", "contrast_min", "headline_lines_max", "body_lines_max"},
    )
    allowed = composition["allowed_components"]
    if not isinstance(allowed, list) or not allowed or any(not isinstance(name, str) for name in allowed):
        raise StyleError("composition.allowed_components debe ser una lista no vacía")
    tone = _strict_object(data["tone"], "tone", {"language", "voice", "rules"}, {"language", "voice", "rules"})
    if not isinstance(tone["rules"], list) or any(not isinstance(rule, str) for rule in tone["rules"]):
        raise StyleError("tone.rules debe ser una lista de textos")
    return StyleSystem(
        style_id=str(data["style_id"]),
        category_id=str(data["category_id"]),
        version=str(data["version"]),
        design_id=str(data["design_id"]),
        palette=dict(palette),
        fonts=normalized_fonts,
        textures=tuple(textures),
        grid=dict(grid),
        composition=dict(composition),
        tone=dict(tone),
        brand=_brand(data.get("brand")),
        font_data=dict(font_data or {}),
    )


def style_hash(style: StyleSystem | Mapping[str, Any]) -> str:
    data = style.to_dict() if isinstance(style, StyleSystem) else style
    canonical = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()
