#!/usr/bin/env python3
"""Indexa referencias históricas del perfil activo sin mover ni modificar archivos.

Sin argumentos muestra las referencias pendientes; --apply las registra en data.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core.data import collection, coordination
from src.core.execution_logs import register_execution_log
from src.core.explainer.usage import _tool
from src.core.explainer.usage_traces import record_preparation_run, record_prototype_run


async def main(apply: bool) -> None:
    layout = layout_for_settings(settings)
    root = layout.root.resolve()
    indexed = collection("execution_logs")
    for scope, directory in (("sandbox", layout.sandbox_dir), ("productions", layout.productions_dir)):
        if not directory.is_dir() or not directory.resolve().is_relative_to(root):
            continue
        for item in sorted(directory.glob("*/*")):
            if not item.is_dir() or item.is_symlink() or not item.resolve().is_relative_to(directory.resolve()):
                continue
            try:
                paths = [item / "work/usage.jsonl", item / "usage.json", _tool().ledger_path(item)]
            except ValueError:
                continue
            for path in dict.fromkeys(paths):
                if not path.is_file() or path.is_symlink() or not path.resolve().is_relative_to(root):
                    continue
                if path in (item / "work/usage.jsonl", item / "usage.json") and not path.resolve().is_relative_to(item.resolve()):
                    continue
                key = path.resolve().relative_to(root).as_posix()
                content_key = item.resolve().relative_to(root).as_posix()
                lock = "content-video-usage-" + hashlib.sha256(key.encode()).hexdigest()
                async with coordination(lock):
                    if indexed.first({"key": key}):
                        continue
                    if apply:
                        await register_execution_log(key, kind="usage_summary" if path.suffix == ".json" else "usage",
                                                     video_id=item.name, content_key=content_key)
                    print(f"{'INDEXADO' if apply else 'PENDIENTE'} {content_key} -> {key}")

    # En v3 los intentos fallidos no entraban en el ledger; sus metadatos de
    # ejecución pueden contener la medición original. Nunca reconstruir los
    # intentos marcados como registrados ni los que no tienen uso informado.
    if layout.schema_version >= 3:
        runs = collection("prototype_runs")
        for run in runs.list():
            if run.get("usage_recorded") or run.get("state") not in ("failed", "cancelled"):
                continue
            tokens = run.get("tokens")
            if not isinstance(tokens, dict) or not (run.get("claude_usage") or run.get("codex_usage")):
                continue
            if apply:
                await record_prototype_run(run, tokens, run["state"])
                await runs.update(run["run_id"], {"usage_recorded": True, "usage_trace_recovered": True})
            print(f"{'RECUPERADO' if apply else 'RECUPERABLE'} prototipo {run['run_id']}")

        # Algunas instalaciones también tienen el flujo de preparación de un
        # proyecto existente. Su colección ya conserva la medición por corrida.
        try:
            preparations = collection("sandbox_preparations")
            rows = preparations.list()
        except KeyError:
            rows = []
        for run in rows:
            if (run.get("state") in ("queued", "running") or run.get("usage_trace_recorded")
                    or not isinstance(run.get("usage"), dict) or not run["usage"]):
                continue
            if apply:
                await record_preparation_run(run, run["usage"], run.get("model") or run.get("agent") or "",
                                             ok=run.get("state") == "review")
                await preparations.update(run["run_id"], {"usage_trace_recorded": True})
            print(f"{'RECUPERADO' if apply else 'RECUPERABLE'} preparación {run['run_id']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Registrar las referencias pendientes")
    asyncio.run(main(parser.parse_args().apply))
