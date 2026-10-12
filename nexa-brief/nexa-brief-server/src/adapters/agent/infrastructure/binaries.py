"""Encuentra los CLIs de Claude Code y Codex aunque no estén en el PATH del servidor.

El servidor suele arrancar sin el PATH del shell interactivo (nvm ni el
npm prefix de ~/.zshrc se cargan), por eso se buscan también las rutas habituales de instalación.
"""

from __future__ import annotations

import glob
import os
import shutil
from pathlib import Path

_HOME = Path.home()

_CANDIDATES: dict[str, list[str]] = {
    "claude": [
        str(_HOME / ".local/bin/claude"),
        str(_HOME / ".npm-global/bin/claude"),
        str(_HOME / ".claude/local/claude"),
        str(_HOME / ".nvm/versions/node/*/bin/claude"),
        "/usr/local/bin/claude",
        str(_HOME / ".vscode/extensions/anthropic.claude-code-*/resources/native-binary/claude"),
    ],
    "codex": [
        str(_HOME / ".local/bin/codex"),
        str(_HOME / ".npm-global/bin/codex"),
        str(_HOME / ".nvm/versions/node/*/bin/codex"),
        "/usr/local/bin/codex",
        "/usr/lib/chatgpt/resources/codex",
    ],
}


def find_binary(name: str, configured: str = "") -> str | None:
    """Ruta del CLI `name` ('claude' | 'codex'), o None si no está instalado."""
    if configured:
        return configured if os.access(configured, os.X_OK) else None
    found = shutil.which(name)
    if found:
        return found
    for pattern in _CANDIDATES.get(name, []):
        # La versión más nueva primero (nvm/extensiones ordenan por versión en el nombre).
        for path in sorted(glob.glob(pattern), reverse=True):
            if os.access(path, os.X_OK):
                return path
    return None
