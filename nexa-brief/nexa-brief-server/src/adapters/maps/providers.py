"""Registro explícito de fuentes de Atlas."""
from dataclasses import dataclass
import json
from pathlib import Path

ATLAS = Path(__file__).resolve().parents[2] / 'templates/sandbox/nodehistory/_atlas'

@dataclass(frozen=True)
class Provider:
    id: str
    kind: str
    url: str | None
    ext: str
    min_zoom: int
    max_zoom: int
    tile_size: int
    license: str
    commercial_ok: bool
    attribution: str
    attribution_url: str
    requires_key: bool = False
    encoding: str | None = None
    coverage_bbox: list[float] | None = None
    notes: str = ''
    world: str | None = None
    detail: str | None = None

    def tile_url(self, z: int, x: int, y: int) -> str:
        if self.url is None or self.kind == 'vector':
            raise ValueError('El proveedor no tiene teselas raster')
        if not all(isinstance(v, int) and not isinstance(v, bool) for v in (z, x, y)) or not self.min_zoom <= z <= self.max_zoom or not (0 <= x < 2**z and 0 <= y < 2**z):
            raise ValueError('Coordenadas de tesela fuera de rango')
        return self.url.format(z=z, x=x, y=y)


def load_providers(path: Path = ATLAS / 'providers.json') -> dict[str, Provider]:
    data = json.loads(path.read_text(encoding='utf-8'))
    providers = [Provider(**entry) for entry in data]
    if len({p.id for p in providers}) != len(providers):
        raise ValueError('Identificador de proveedor duplicado')
    return {p.id: p for p in providers}
