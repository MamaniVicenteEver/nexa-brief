"""Operaciones sobre el paquete de un video: revisar y reconstruir.

`review` es de solo lectura (la usa la API para mostrar el paquete y lo que
falta). `build` vuelve a derivar publish.json desde el paquete, pone la miniatura
elegida como apertura del video (opening.py) y, si cambió, sincroniza manifest.json
y la portada con el kit.
"""

from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass, field

from src.core.explainer.catalog import KIT_DIR, ExplainerVideo
from src.core.explainer.publishing.checks import Issue, check_package
from src.core.explainer.publishing.opening import OpeningResult, apply_opening
from src.core.explainer.publishing.package import SCHEMA_VERSION, PublishPackage
from src.core.explainer.publishing.store import load_package, save_package
from src.core.explainer.publishing.strategies import ActiveStrategies, active_strategies

KIT_CLI = KIT_DIR / "tools" / "kit.py"


class KitError(RuntimeError):
    """Un paso de explainer-kit (manifest, poster) falló."""


@dataclass
class PackageReview:
    package: PublishPackage
    strategies: ActiveStrategies
    issues: list[Issue] = field(default_factory=list)

    @property
    def errors(self) -> list[Issue]:
        return [i for i in self.issues if i.level == "error"]


def review(video: ExplainerVideo) -> PackageReview | None:
    """El paquete v2 del video y sus problemas; None si publish.json todavía es v1 (o no existe)."""
    package = load_package(video.path)
    if package is None:
        return None
    strategies = active_strategies(package.category)
    return PackageReview(package, strategies, check_package(package, strategies, video.path, video.duration_seconds))


@dataclass
class BuildResult:
    review: PackageReview
    opening: OpeningResult


def _kit(*args: str) -> None:
    try:
        subprocess.run([sys.executable, str(KIT_CLI), *args], check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or "").strip()[-2000:]
        raise KitError(f"kit.py {' '.join(args)} falló (código {exc.returncode}): {detail}") from exc


def build(video: ExplainerVideo) -> BuildResult:
    """Deriva publish.json del paquete, abre el video con la miniatura elegida y sincroniza manifest y portada."""
    package = load_package(video.path)
    if package is None:
        raise ValueError(f"{video.video_id}: publish.json no es un paquete v{SCHEMA_VERSION}; no hay nada que construir")
    strategies = active_strategies(package.category)
    save_package(video.path, package, strategies)
    opening = apply_opening(video.path, package)
    # manifest.json copia título y textos de publicación (kit.py manifest); la
    # portada de la web es un cuadro del cartel de apertura (kit.py poster).
    _kit("manifest", video.video_id)
    if opening.changed or not (video.path / "render" / "poster.jpg").exists():
        _kit("poster", video.video_id)
    issues = check_package(package, strategies, video.path, video.duration_seconds)
    return BuildResult(review=PackageReview(package, strategies, issues), opening=opening)
