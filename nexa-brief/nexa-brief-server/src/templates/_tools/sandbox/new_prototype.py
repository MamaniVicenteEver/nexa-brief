#!/usr/bin/env python3
"""Crea un prototipo aislado a partir de una referencia y un motor existente.

Uso (desde nexa-brief-server/):
  python src/templates/_tools/sandbox/new_prototype.py nodehistory mi-idea \
      --ref nodehistory/mapas-con-banderas --engine nodehistory/_mapas
  Para arrancar un motor nuevo, agregá --new-design; se crea un index.html vacío.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path, PurePosixPath

TOOL_DIR = Path(__file__).resolve().parent
TEMPLATES_ROOT = TOOL_DIR.parents[1]
SANDBOX_ROOT = TEMPLATES_ROOT / "sandbox"
INFO_SCRIPT = TOOL_DIR / "info.py"
_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def validate_new_prototype(
    category: str,
    prototype_id: str,
    reference: str,
    engine: str | None,
    new_design: bool,
    sandbox_root: Path = SANDBOX_ROOT,
) -> tuple[Path, Path, str]:
    """Valida nombres y rutas antes de crear archivos.

    Ejemplo: validate_new_prototype("nodehistory", "mi-idea",
    "nodehistory/mapas", "nodehistory/_mapas", False).
    """
    if not _SLUG.fullmatch(category):
        raise ValueError("La categoría debe ser un slug en minúsculas, por ejemplo nodehistory")
    if not _SLUG.fullmatch(prototype_id):
        raise ValueError("El id debe ser un slug en minúsculas, por ejemplo mi-idea")
    parts = PurePosixPath(reference).parts
    if len(parts) != 2 or any(not _SLUG.fullmatch(part) for part in parts) or "\\" in reference:
        raise ValueError("La referencia debe tener el formato <categoría>/<idea>")
    root = sandbox_root.resolve()
    reference_dir = (root / "referencias" / parts[0] / parts[1]).resolve()
    if not reference_dir.is_relative_to((root / "referencias").resolve()):
        raise ValueError("La referencia debe permanecer dentro de sandbox/referencias/")
    if not reference_dir.is_dir():
        raise FileNotFoundError(f"No existe la referencia: {reference_dir}")
    if engine:
        engine_path = PurePosixPath(engine)
        if engine_path.is_absolute() or ".." in engine_path.parts or "\\" in engine:
            raise ValueError("El motor debe ser una ruta relativa dentro de sandbox/")
        engine_value = engine
    elif new_design:
        engine_value = f"{category}/{prototype_id}/_engine"
    else:
        raise ValueError("Indicá --engine para reutilizar un motor o --new-design para crear uno")
    item_dir = (root / category / prototype_id).resolve()
    if not item_dir.is_relative_to(root):
        raise ValueError("El prototipo debe permanecer dentro de sandbox/")
    if item_dir.exists():
        raise FileExistsError(f"Ya existe el prototipo: {item_dir}")
    return item_dir, reference_dir, engine_value


def _engine_template(category: str, engine: str, sandbox_root: Path) -> Path | None:
    """Encuentra un index.html de un prototipo del mismo motor y categoría."""
    direct = (sandbox_root / engine / "index.html").resolve()
    if direct.is_relative_to(sandbox_root.resolve()) and direct.is_file():
        return direct
    for info_path in sorted((sandbox_root / category).glob("*/info.json")):
        try:
            info = json.loads(info_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        candidate = info_path.parent / "index.html"
        if info.get("engine") == engine and candidate.is_file():
            return candidate
    return None


def create_prototype(
    category: str,
    prototype_id: str,
    reference: str,
    engine: str | None = None,
    based_on: str | None = None,
    new_design: bool = False,
    sandbox_root: Path = SANDBOX_ROOT,
) -> Path:
    """Crea estructura, index inicial y ficha info.json sin pisar otro proyecto."""
    item_dir, _reference_dir, engine_value = validate_new_prototype(
        category, prototype_id, reference, engine, new_design, sandbox_root
    )
    template = None if new_design else _engine_template(category, engine_value, sandbox_root)
    if not new_design and template is None:
        raise FileNotFoundError(
            f"No encontré index.html para el motor {engine_value} en {category}/; "
            "elegí un motor con plantilla inicial o usá --new-design"
        )

    item_dir.mkdir(parents=True)
    try:
        if template:
            shutil.copy2(template, item_dir / "index.html")
        else:
            (item_dir / "index.html").write_text(
                "<!doctype html>\n<html lang=\"es\"><head><meta charset=\"utf-8\">"
                "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                "<title>Prototipo nuevo</title></head><body></body></html>\n",
                encoding="utf-8",
            )
        (item_dir / "assets").mkdir()
        work = item_dir / "work"
        for name in ("briefs", "logs", "results", "ref", "compare"):
            (work / name).mkdir(parents=True, exist_ok=True)

        effective_based_on = based_on or PurePosixPath(reference).name
        result = subprocess.run(
            [
                sys.executable,
                str(INFO_SCRIPT),
                "init",
                f"{category}/{prototype_id}",
                "--engine",
                engine_value,
                "--based-on",
                effective_based_on,
                *( ["--new-design"] if new_design else [] ),
            ],
            cwd=TEMPLATES_ROOT.parents[1],
            check=False,
            text=True,
            capture_output=True,
        )
        if result.returncode:
            raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "info.py init falló")
        info_path = item_dir / "info.json"
        info = json.loads(info_path.read_text(encoding="utf-8"))
        info["reference"] = f"referencias/{reference}"
        info_path.write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except Exception:
        shutil.rmtree(item_dir, ignore_errors=True)
        raise
    return item_dir


def main(argv: list[str] | None = None) -> int:
    """Interfaz CLI de creación de prototipos."""
    parser = argparse.ArgumentParser(description="Crear una plantilla de prototipo en sandbox/.")
    parser.add_argument("category")
    parser.add_argument("prototype_id")
    parser.add_argument("--ref", required=True, help="<categoría>/<idea> dentro de referencias/")
    parser.add_argument("--engine", help="Ruta relativa de un motor existente")
    parser.add_argument("--based-on", help="Valor de info.json basado en otra plantilla")
    parser.add_argument("--new-design", action="store_true", help="Inicializar un motor nuevo vacío")
    args = parser.parse_args(argv)
    try:
        path = create_prototype(
            args.category,
            args.prototype_id,
            args.ref,
            args.engine,
            args.based_on,
            args.new_design,
        )
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    print(f"Prototipo creado: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
