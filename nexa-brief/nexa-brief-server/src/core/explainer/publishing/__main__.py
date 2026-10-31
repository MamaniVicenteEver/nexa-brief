"""Línea de comandos del paquete de publicación.

    uv run python -m src.core.explainer.publishing check [video_id …]
    uv run python -m src.core.explainer.publishing build <video_id> […]

check: valida los paquetes v2 (sin argumentos, todos). Sale con código 1 si hay errores.
build: vuelve a derivar publish.json, abre el video con la miniatura elegida y sincroniza manifest y portada.
"""

from __future__ import annotations

import argparse
import sys

from src.core.explainer.catalog import ExplainerVideo, get_video, list_videos
from src.core.explainer.publishing.checks import Issue
from src.core.explainer.publishing.service import KitError, build, review
from src.core.explainer.publishing.store import is_package, read_publish

# Lo que puede romper un video sin cortar los demás: paquete o estrategia inválidos
# (ValidationError, StrategyError, GratitudeError, OpeningError son ValueError), el kit o el disco.
_VIDEO_ERRORS = (ValueError, KitError, OSError)


def _print_issues(video_id: str, issues: list[Issue]) -> None:
    errors = sum(i.level == "error" for i in issues)
    print(f"{'✗' if errors else '✓'} {video_id}: {errors} errores, {len(issues) - errors} avisos")
    for issue in issues:
        print(f"    {'ERROR' if issue.level == 'error' else 'aviso'} · {issue.field}: {issue.message}")


def _videos(ids: list[str]) -> list[ExplainerVideo]:
    if not ids:
        return [v for v in list_videos() if is_package(read_publish(v.path))]
    videos = []
    for video_id in ids:
        video = get_video(video_id)
        if video is None:
            sys.exit(f"video no encontrado: {video_id}")
        videos.append(video)
    return videos


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m src.core.explainer.publishing")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("check").add_argument("video_ids", nargs="*")
    sub.add_parser("build").add_argument("video_ids", nargs="+")
    args = parser.parse_args(argv)

    failed = False
    for video in _videos(args.video_ids):
        try:
            if args.command == "check":
                result = review(video)
                if result is None:
                    print(f"· {video.video_id}: publish.json v1, sin paquete que validar")
                    continue
            else:
                built = build(video)
                result = built.review
                if built.opening.changed:
                    removed = ", ".join(built.opening.removed_renders) or "ninguno"
                    print(f"  {video.video_id}: apertura = miniatura elegida · renders viejos borrados: {removed}")
        except _VIDEO_ERRORS as exc:
            print(f"✗ {video.video_id}: {exc}")
            failed = True
            continue
        _print_issues(video.video_id, result.issues)
        failed = failed or bool(result.errors)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
