#!/usr/bin/env python3
"""Read only the non-secret profile selection from the project environment file."""
import re
import shlex
import sys
from pathlib import Path


def profile_from_file(path: Path) -> str:
    if not path.is_file():
        return ""
    found = []
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^\s*(?:export\s+)?NEXA_PROFILE_DIR\s*=\s*(.*)$", line)
        if match:
            values = shlex.split(match.group(1), comments=True)
            if len(values) != 1:
                raise ValueError("NEXA_PROFILE_DIR debe tener un único valor absoluto")
            found.append(values[0])
    if len(found) > 1:
        raise ValueError("NEXA_PROFILE_DIR está duplicada")
    if found and not Path(found[0]).is_absolute():
        raise ValueError("NEXA_PROFILE_DIR debe ser absoluta")
    return found[0] if found else ""


if __name__ == "__main__":
    try:
        print(profile_from_file(Path(sys.argv[1])))
    except (OSError, ValueError, IndexError) as exc:
        print(f"Selección de perfil inválida: {exc}", file=sys.stderr)
        sys.exit(1)
