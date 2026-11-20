"""El kit registra sus videos en el perfil y `find_video` los encuentra, sin mover carpetas."""
import sys
from pathlib import Path

import pytest

from src.config.settings import settings

TOOLS = Path(__file__).resolve().parents[2] / "src/templates/_tools/explainer-kit/tools"
sys.path.insert(0, str(TOOLS))

import registro  # noqa: E402
from places import find_video  # noqa: E402


@pytest.fixture
def perfil(tmp_path, monkeypatch):
    prof = tmp_path / "profesional"
    monkeypatch.setattr(settings, "storage_profile_dir", prof)
    monkeypatch.setattr(settings, "storage_layout_version", 3)
    monkeypatch.setattr(settings, "data_dir", prof / "data")
    return prof


def _video(perfil: Path, cat: str, vid: str) -> Path:
    d = perfil / "productions" / cat / vid
    (d / "assets").mkdir(parents=True)
    (d / "manifest.json").write_text("{}")
    return d


def test_video_sin_registro_no_se_encuentra(perfil):
    _video(perfil, "nodetech", "demo-kit")
    assert find_video("demo-kit") is None


def test_registrar_hace_visible_el_video_y_es_idempotente(perfil):
    d = _video(perfil, "nodetech", "demo-kit")
    r = registro.registrar("demo-kit", d)
    assert r == {"estado": "registrado", "folder_key": "productions/nodetech/demo-kit"}
    assert find_video("demo-kit").resolve() == d.resolve()
    assert registro.registrar("demo-kit", d)["estado"] == "ya registrado"


def test_no_reasigna_un_video_a_otra_carpeta(perfil):
    registro.registrar("demo-kit", _video(perfil, "nodetech", "demo-kit"))
    otra = _video(perfil, "nodehistory", "demo-kit")
    with pytest.raises(ValueError, match="ya está registrado"):
        registro.registrar("demo-kit", otra)


def test_rechaza_carpetas_fuera_del_perfil(perfil, tmp_path):
    suelto = tmp_path / "otra" / "video-suelto"
    suelto.mkdir(parents=True)
    with pytest.raises(ValueError, match="no está en"):
        registro.folder_key(suelto)
