"""CLI: python -m src.adapters.image_gen.cli generate|edit|remove-bg."""

from __future__ import annotations

import argparse
import json
import os
import shutil
from dataclasses import replace
from pathlib import Path

from src.adapters.image_gen.codex_cli_image_adapter import CodexCLIImageAdapter
from src.adapters.image_gen.presets import PRESETS
from src.core.ports.image_generation_port import ImageGenerationResult


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Imágenes con Codex CLI + ChatGPT local")
    parser.add_argument("action", choices=("generate", "edit", "remove-bg", "variations"))
    parser.add_argument("--task", required=True, help="Identificador del encargo")
    parser.add_argument("--model", choices=PRESETS, default="luna-xhigh")
    parser.add_argument("--prompt", default="", help="Brief para generate o instrucciones para edit")
    parser.add_argument("--size", default="1024x1024")
    parser.add_argument("--ref", action="append", default=[], type=Path)
    parser.add_argument("--image", type=Path)
    parser.add_argument("--n", type=int, default=2)
    parser.add_argument("--out", type=Path, help="Ruta final PNG; se conserva la salida interna")
    parser.add_argument("--output-root", type=Path)
    parser.add_argument("--timeout", type=float, default=240)
    return parser


def _export(result: ImageGenerationResult, target: Path | None) -> ImageGenerationResult:
    if target is None:
        return result
    if target.suffix.lower() != ".png":
        raise ValueError("--out debe terminar en .png")
    target = target.resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(result.path, target)
    return replace(result, path=target)


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.action in ("generate", "edit") and not args.prompt:
        raise SystemExit("--prompt es obligatorio para generate/edit")
    if args.action != "generate" and args.image is None:
        raise SystemExit("--image es obligatorio para edit/remove-bg/variations")
    adapter = CodexCLIImageAdapter(model=args.model, output_root=args.output_root,
                                   timeout=args.timeout,
                                   codex_home=Path(os.environ["CODEX_HOME"]) if "CODEX_HOME" in os.environ else None)
    if args.action == "generate":
        results = [adapter.generate(args.task, args.prompt, args.size, args.ref)]
    elif args.action == "edit":
        results = [adapter.edit(args.image, args.prompt, task=args.task)]
    elif args.action == "remove-bg":
        results = [adapter.remove_background(args.image, task=args.task)]
    else:
        results = adapter.variations(args.image, args.n)
    if args.out and len(results) != 1:
        raise SystemExit("--out solo se admite con una imagen")
    for result in results:
        result = _export(result, args.out)
        print(json.dumps({"path": str(result.path), "model": result.model,
                          "tokens": result.tokens, "seconds": round(result.seconds, 2),
                          "notes": result.notes}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
