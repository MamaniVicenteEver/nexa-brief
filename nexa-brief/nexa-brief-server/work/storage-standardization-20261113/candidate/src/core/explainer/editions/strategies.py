"""Strategy + native market layer, without implicit Spanish fallback."""
from copy import deepcopy
from pathlib import Path
import re
from pydantic import Field
from typing import Literal
from src.core.editions.schemas import Layer
from src.core.editions.formats import SRC, read_json
from src.core.markets import normalize_locale

STRATEGIES_DIR = SRC / "skills/explainer/strategies"


def _source(path):
    return path.relative_to(SRC).as_posix() if path.is_relative_to(SRC) else str(path)


class StrategyMarket(Layer):
    schema_: Literal["nexa.strategy-market/1"] = Field(alias="schema")
    strategy_id: str
    piece: str
    locale: str
    status: Literal["draft", "approved"]
    intent: str
    templates: dict[str, str]
    examples: list[str]
    conventions: list[str]
    sounds_false: list[str]
    overrides: dict = {}
    variants: dict[str, dict] = {}


def merge(base, overlay):
    result = deepcopy(base)
    for key, value in overlay.items():
        result[key] = merge(result.get(key, {}), value) if isinstance(value, dict) else deepcopy(value)
    return result


def resolve_strategy(piece: str, strategy_id: str, locale: str, *, root: Path | None = None, variant: str | None = None) -> dict:
    locale = normalize_locale(locale)
    for identifier in (piece, strategy_id):
        if not isinstance(identifier, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", identifier):
            raise ValueError("Invalid strategy identifier")
    folder = (root or STRATEGIES_DIR) / piece
    universal = read_json(folder / f"{strategy_id}.json")
    if locale == "es-419":
        return {"id": strategy_id, "piece": piece, "locale": locale, "universal": universal,
                "market": None, "effective": deepcopy(universal), "source": _source(folder / f"{strategy_id}.json")}
    path = folder / "markets" / locale / f"{strategy_id}.json"
    if not path.is_file():
        raise ValueError(f"Missing market strategy layer: {piece}/{strategy_id} for {locale}: {path}")
    layer = StrategyMarket.model_validate(read_json(path))
    if (layer.strategy_id, layer.piece, layer.locale) != (strategy_id, piece, locale):
        raise ValueError(f"Market strategy identity mismatch: {path}")
    effective = merge(universal, layer.overrides)
    effective["native_instructions"] = layer.model_dump(exclude={"schema_", "overrides"})
    if variant:
        effective["native_instructions"]["format_variant"] = layer.variants.get(variant, {})
    return {"id": strategy_id, "piece": piece, "locale": locale, "universal": universal,
            "market": layer.model_dump(by_alias=True), "effective": effective, "source": _source(path)}
