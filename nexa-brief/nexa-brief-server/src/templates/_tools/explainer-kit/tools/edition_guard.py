"""Prevent legacy tools from silently acting on the original with an edition selected."""
import os
import sys


def reject_unsupported_edition():
    if os.environ.get("NEXA_EDITION") or any(arg == "--edition" or arg.startswith("--edition=") for arg in sys.argv[1:]):
        raise SystemExit("Esta herramienta aún no admite ediciones; no se modificaron archivos. Quite NEXA_EDITION/--edition solo para trabajar con el original.")
