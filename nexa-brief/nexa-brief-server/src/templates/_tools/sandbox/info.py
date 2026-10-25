#!/usr/bin/env python3
"""Administra fichas y consumo de las plantillas del sandbox."""

from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import re
import sys
from pathlib import Path, PurePosixPath

from costs import TOKEN_FIELDS, calculate_costs

TEMPLATES_ROOT = Path(__file__).resolve().parents[2]
SANDBOX_ROOT = TEMPLATES_ROOT / "sandbox"
USAGE_SCRIPT = TEMPLATES_ROOT / "_tools" / "explainer-kit" / "tools" / "usage.py"
STATUSES = {"idea", "en progreso", "lista para revisar", "aprobada", "descartada"}


def _safe_item_path(value: str, sandbox_root: Path | None = None) -> Path:
    """Resuelve carpeta/id sin permitir salir del sandbox ni usar motores compartidos."""
    parts = PurePosixPath(value).parts
    if (
        len(parts) != 2
        or any(part in {"", ".", ".."} or part.startswith((".", "_")) for part in parts)
        or "\\" in value
    ):
        raise ValueError("Usá una ruta visible con el formato <carpeta>/<id>")
    root = (sandbox_root or SANDBOX_ROOT).resolve()
    item_dir = (root / parts[0] / parts[1]).resolve()
    if not item_dir.is_relative_to(root):
        raise ValueError("La ruta debe permanecer dentro de sandbox/")
    return item_dir


def _validate_engine(engine: str) -> str:
    """Comprueba que el motor sea una ruta relativa o un diseño del explainer-kit."""
    if not engine or engine.strip() != engine:
        raise ValueError("El motor no puede estar vacío")
    if engine.startswith("explainer-kit:"):
        if not engine.removeprefix("explainer-kit:"):
            raise ValueError("Indicá el diseño después de explainer-kit:")
        return engine
    path = PurePosixPath(engine)
    if path.is_absolute() or ".." in path.parts or "\\" in engine:
        raise ValueError("El motor debe ser relativo a sandbox/ o explainer-kit:<diseño>")
    return engine


def create_info(
    item_dir: Path,
    engine: str,
    based_on: str | None = None,
    new_design: bool = False,
    today: dt.date | None = None,
) -> Path:
    """Crea una ficha inicial sin sobrescribir una existente."""
    engine = _validate_engine(engine)
    item_dir.mkdir(parents=True, exist_ok=True)
    path = item_dir / "info.json"
    if path.exists():
        raise FileExistsError(f"No se pisa una ficha existente: {path}")
    title = item_dir.name.replace("-", " ").replace("_", " ").title()
    info = {
        "version": 1,
        "title": title,
        "summary": "Completar con un resumen de una a tres frases.",
        "engine": engine,
        "based_on": based_on,
        "is_new_design": bool(new_design),
        "status": "en progreso",
        "created_at": (today or dt.date.today()).isoformat(),
        "libraries": [],
        "inputs": [],
        "notes": [],
    }
    path.write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def load_usage_module():
    """Importa usage.py del explainer-kit por su ruta original."""
    spec = importlib.util.spec_from_file_location("sandbox_explainer_usage", USAGE_SCRIPT)
    if spec is None or spec.loader is None:
        raise ImportError(f"No se pudo cargar {USAGE_SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def add_usage(
    item_dir: Path,
    *,
    provider: str,
    model: str,
    role: str,
    input_tokens: int,
    output_tokens: int,
    cached_input_tokens: int = 0,
    reasoning_tokens: int = 0,
    note: str = "",
) -> tuple[dict, dict]:
    """Agrega una sesión usando el formato y el resumen oficiales del explainer-kit."""
    if not (item_dir / "info.json").is_file():
        raise FileNotFoundError(f"No existe la ficha {item_dir / 'info.json'}; ejecutá init primero")
    values = {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cached_input_tokens": cached_input_tokens,
        "reasoning_tokens": reasoning_tokens,
    }
    if any(value < 0 for value in values.values()):
        raise ValueError("Los tokens deben ser números no negativos")
    usage = load_usage_module()
    entry = usage.record(
        item_dir,
        provider=provider,
        model=model,
        role=role,
        step="sandbox",
        **values,
        note=note,
    )
    return entry, usage.summarize(item_dir)


def parse_codex_log(log_path: Path) -> tuple[int, str]:
    """Lee el total final y el modelo de un log de codex exec."""
    text = log_path.read_text(encoding="utf-8", errors="replace")
    patterns = (
        re.compile(r"(?im)^\s*tokens used\s*[:=]\s*([\d,_ ]+)\s*$"),
        re.compile(r"(?im)^\s*tokens used\s*\n\s*([\d,_ ]+)\s*$"),
    )
    matches = []
    for pattern in patterns:
        matches.extend(pattern.finditer(text))
    if not matches:
        raise ValueError("No encontré el bloque final 'tokens used' en el log")
    raw_count = matches[-1].group(1)
    token_count = int(re.sub(r"[,_ ]", "", raw_count))
    model_match = re.search(r"(?im)^\s*model\s*:\s*([^\s]+)", text)
    model = model_match.group(1).strip() if model_match else "codex exec"
    return token_count, model


def validate_info(info: object) -> list[str]:
    """Devuelve errores de forma para una ficha según CONTRATO-fase4.md."""
    if not isinstance(info, dict):
        return ["la raíz debe ser un objeto JSON"]
    errors = []
    required = {
        "version", "title", "summary", "engine", "based_on", "is_new_design",
        "status", "created_at", "libraries", "inputs", "notes",
    }
    for key in sorted(required - info.keys()):
        errors.append(f"falta {key}")
    if info.get("version") != 1 or isinstance(info.get("version"), bool):
        errors.append("version debe ser 1")
    for key in ("title", "summary"):
        if not isinstance(info.get(key), str) or not info[key].strip():
            errors.append(f"{key} debe ser un texto no vacío")
    try:
        _validate_engine(info.get("engine"))
    except (TypeError, ValueError):
        errors.append("engine debe ser una ruta relativa o explainer-kit:<diseño>")
    if info.get("based_on") is not None and not isinstance(info.get("based_on"), str):
        errors.append("based_on debe ser texto o null")
    if not isinstance(info.get("is_new_design"), bool):
        errors.append("is_new_design debe ser booleano")
    if not isinstance(info.get("status"), str) or info["status"] not in STATUSES:
        errors.append("status no es uno de los estados del contrato")
    created_at = info.get("created_at")
    try:
        if not isinstance(created_at, str):
            raise ValueError
        dt.date.fromisoformat(created_at)
    except ValueError:
        errors.append("created_at debe tener formato YYYY-MM-DD")
    libraries = info.get("libraries")
    if not isinstance(libraries, list):
        errors.append("libraries debe ser una lista")
    else:
        for index, library in enumerate(libraries):
            if not isinstance(library, dict) or any(
                not isinstance(library.get(field), str) or not library[field].strip()
                for field in ("name", "version", "purpose")
            ):
                errors.append(f"libraries[{index}] requiere name, version y purpose")
    for key in ("inputs", "notes"):
        values = info.get(key)
        if not isinstance(values, list) or any(not isinstance(value, str) for value in values):
            errors.append(f"{key} debe ser una lista de textos")

    backfill = info.get("usage_backfill")
    if backfill is not None:
        if not isinstance(backfill, dict):
            errors.append("usage_backfill debe ser un objeto")
        else:
            if backfill.get("estimated") is not True:
                errors.append("usage_backfill.estimated debe ser true")
            if not isinstance(backfill.get("source"), str) or not backfill["source"].strip():
                errors.append("usage_backfill.source debe explicar el origen")
            rows = backfill.get("by_model")
            if not isinstance(rows, list):
                errors.append("usage_backfill.by_model debe ser una lista")
            else:
                for index, row in enumerate(rows):
                    if not isinstance(row, dict):
                        errors.append(f"usage_backfill.by_model[{index}] debe ser un objeto")
                        continue
                    for key in ("provider", "model"):
                        if not isinstance(row.get(key), str) or not row[key].strip():
                            errors.append(f"usage_backfill.by_model[{index}].{key} debe ser texto")
                    for key in TOKEN_FIELDS:
                        value = row.get(key)
                        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
                            errors.append(f"usage_backfill.by_model[{index}].{key} debe ser entero no negativo")
    return errors


def validate_all(sandbox_root: Path = SANDBOX_ROOT) -> list[tuple[Path, list[str]]]:
    """Valida las fichas visibles del sandbox."""
    results = []
    for path in sorted(sandbox_root.glob("*/*/info.json")):
        if any(part.startswith((".", "_")) for part in path.relative_to(sandbox_root).parts[:2]):
            continue
        try:
            info = json.loads(path.read_text(encoding="utf-8"))
            errors = validate_info(info)
        except (OSError, json.JSONDecodeError) as error:
            errors = [f"no se pudo leer el JSON: {error}"]
        if errors:
            results.append((path, errors))
    return results


def _nonnegative(value: str) -> int:
    """Parsea un entero no negativo para argparse."""
    try:
        number = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("debe ser un entero") from error
    if number < 0:
        raise argparse.ArgumentTypeError("debe ser no negativo")
    return number


def build_parser() -> argparse.ArgumentParser:
    """Declara los subcomandos públicos de la herramienta."""
    parser = argparse.ArgumentParser(description="Fichas y tokens de las plantillas sandbox.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    init = subparsers.add_parser("init", help="crear info.json sin pisar una ficha existente")
    init.add_argument("item")
    init.add_argument("--engine", required=True)
    init.add_argument("--based-on")
    init.add_argument("--new-design", action="store_true")

    usage = subparsers.add_parser("add-usage", help="registrar una sesión de uso")
    usage.add_argument("item")
    usage.add_argument("--provider", required=True)
    usage.add_argument("--model", required=True)
    usage.add_argument("--role", required=True)
    usage.add_argument("--in", dest="input_tokens", type=_nonnegative, required=True)
    usage.add_argument("--out", dest="output_tokens", type=_nonnegative, required=True)
    usage.add_argument("--cached", dest="cached_input_tokens", type=_nonnegative, default=0)
    usage.add_argument("--reasoning", dest="reasoning_tokens", type=_nonnegative, default=0)
    usage.add_argument("--note", default="")

    from_log = subparsers.add_parser("from-codex-log", help="registrar el total final de un log codex exec")
    from_log.add_argument("item")
    from_log.add_argument("log", type=Path)

    show = subparsers.add_parser("show", help="ver tokens, base y pronóstico")
    show.add_argument("item")

    subparsers.add_parser("validate", help="validar todos los info.json del sandbox")
    return parser


def _run_init(args: argparse.Namespace) -> int:
    """Crea la ficha inicial solicitada."""
    path = create_info(
        _safe_item_path(args.item), args.engine, args.based_on, args.new_design
    )
    print(f"Ficha creada: {path}")
    return 0


def _run_add_usage(args: argparse.Namespace) -> int:
    """Registra tokens ingresados y muestra el resumen acumulado."""
    entry, summary = add_usage(
        _safe_item_path(args.item),
        provider=args.provider,
        model=args.model,
        role=args.role,
        input_tokens=args.input_tokens,
        output_tokens=args.output_tokens,
        cached_input_tokens=args.cached_input_tokens,
        reasoning_tokens=args.reasoning_tokens,
        note=args.note,
    )
    totals = summary["totals"]
    print(
        f"Uso agregado: {entry['provider']}:{entry['model']} · "
        f"entrada reportada {totals['input_tokens']:,} · salida {totals['output_tokens']:,} · "
        f"razonamiento {totals['reasoning_tokens']:,}"
    )
    return 0


def _run_from_codex_log(args: argparse.Namespace) -> int:
    """Registra el total de tokens que informa el pie de un log de Codex."""
    token_count, model = parse_codex_log(args.log)
    entry, _ = add_usage(
        _safe_item_path(args.item),
        provider="codex",
        model=model,
        role="agente",
        input_tokens=token_count,
        output_tokens=0,
        note=(
            "Total combinado informado por codex exec; el log no separa "
            "entrada, salida ni razonamiento."
        ),
    )
    print(f"Uso de Codex agregado: {entry['model']} · {token_count:,} tokens totales")
    return 0


def _show_costs(item: str) -> int:
    """Imprime tokens, base de comparación y pronóstico."""
    item_dir = _safe_item_path(item)
    folder, item_id = item_dir.relative_to(SANDBOX_ROOT.resolve()).parts
    result = calculate_costs(SANDBOX_ROOT, folder, item_id)
    print(f"{result['info'].get('title') or item_id} · {folder}/{item_id}")
    for row in result["totals_by_model"]:
        print(
            f"  {row['provider']}:{row['model']} · total {row['total_tokens']:,} · "
            f"entrada nueva {row['fresh_input_tokens']:,} · caché {row['cached_input_tokens']:,} · "
            f"salida {row['output_tokens']:,} · razonamiento {row['reasoning_tokens']:,}"
        )
    print(
        f"Total: {result['total_tokens']:,} tokens · entrada nueva "
        f"{result['fresh_input_tokens']:,} · caché {result['cached_tokens']:,}"
    )
    if result["estimated"]:
        print("Consumo estimado por usage_backfill.")
    if result["baseline"]:
        baseline = result["baseline"]
        print(f"Base {baseline['id']}: {baseline['total_tokens']:,} tokens")
        ratio = result["ratio_vs_baseline"]
        if ratio is None:
            print("Esta plantilla es la línea base.")
        else:
            print(f"Comparación: {ratio:.1%} ({result['verdict']})")
        forecast = result["forecast_next"]
        print(
            f"Próxima plantilla: {forecast['min']:,.0f}–{forecast['max']:,.0f} "
            f"tokens · {forecast['basis']}"
        )
    else:
        print(f"Sin línea base para engine {result['info'].get('engine')}.")
    return 0


def _run_validate() -> int:
    """Valida las fichas y devuelve estado no cero si encuentra errores."""
    errors = validate_all()
    if errors:
        for path, messages in errors:
            for message in messages:
                print(f"{path}: {message}", file=sys.stderr)
        print(f"{len(errors)} ficha(s) inválida(s).", file=sys.stderr)
        return 1
    count = sum(
        1
        for path in SANDBOX_ROOT.glob("*/*/info.json")
        if not any(
            part.startswith((".", "_"))
            for part in path.relative_to(SANDBOX_ROOT).parts[:2]
        )
    )
    print(f"Validación correcta: {count} ficha(s).")
    return 0


def main(argv: list[str] | None = None) -> int:
    """Ejecuta el subcomando solicitado."""
    args = build_parser().parse_args(argv)
    try:
        handlers = {
            "init": lambda: _run_init(args),
            "add-usage": lambda: _run_add_usage(args),
            "from-codex-log": lambda: _run_from_codex_log(args),
            "show": lambda: _show_costs(args.item),
            "validate": _run_validate,
        }
        return handlers[args.command]()
    except (OSError, ValueError, ImportError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
