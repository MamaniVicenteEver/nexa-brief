"""Scripts locales versionados por fecha: un componente editado nunca sale viejo desde la caché."""

from __future__ import annotations

import os
from pathlib import Path

from src.presentation.api.preview_injection import version_local_assets


def test_local_component_scripts_get_their_mtime(tmp_path: Path):
    (tmp_path / "components").mkdir()
    outro = tmp_path / "components" / "outro.js"
    outro.write_text("//")
    os.utime(outro, (1700000000, 1700000000))
    html = '<script src="./components/outro.js"></script><script src="https://cdn.x/lib.js"></script>' \
           '<script src="components/missing.js"></script>'
    out = version_local_assets(html, tmp_path)
    assert 'src="./components/outro.js?v=1700000000"' in out
    assert 'src="https://cdn.x/lib.js"' in out            # externos, intactos
    assert 'src="components/missing.js"' in out           # si no existe, no se toca
