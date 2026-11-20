"""La verificación de Codex no repite el hash de sus binarios en cada consulta."""

import os

from src.adapters.agent.infrastructure import isolated_executor as ie
from src.core.ports.agent_port import AgentIsolationUnavailableError


def _binario(path, contenido: bytes):
    path.write_bytes(contenido)
    os.chmod(path, 0o755)


def _verificacion_falsa(llamadas, verificado=True):
    def falsa(binary):
        llamadas.append(binary)
        if not verificado:
            raise AgentIsolationUnavailableError("no verificado")
        return object()
    return falsa


def _preparar(monkeypatch, llamadas, verificado=True, edad_ns=0):
    monkeypatch.setattr(ie, "APPROVED_BUILDS", ())
    monkeypatch.setattr(ie, "_EDAD_MINIMA_CACHE_NS", edad_ns)
    monkeypatch.setattr(ie, "_verified_build", _verificacion_falsa(llamadas, verificado))
    ie._CODEX_VERIFICADO.clear()


def test_verified_result_is_cached_while_files_are_unchanged(tmp_path, monkeypatch):
    ruta = tmp_path / "codex"
    _binario(ruta, b"codex de prueba")
    llamadas = []
    _preparar(monkeypatch, llamadas)
    runner = ie.IsolatedCodexRunner(binary=str(ruta))
    assert runner.available() is True
    assert runner.available() is True
    assert len(llamadas) == 1


def test_changed_binary_is_verified_again(tmp_path, monkeypatch):
    ruta = tmp_path / "codex"
    _binario(ruta, b"version uno")
    llamadas = []
    _preparar(monkeypatch, llamadas)
    runner = ie.IsolatedCodexRunner(binary=str(ruta))
    assert runner.available() is True
    _binario(ruta, b"version dos, con mas bytes")
    assert runner.available() is True
    assert len(llamadas) == 2


def test_recent_binary_is_not_cached(tmp_path, monkeypatch):
    ruta = tmp_path / "codex"
    _binario(ruta, b"recien escrito")
    llamadas = []
    _preparar(monkeypatch, llamadas, edad_ns=2_000_000_000)
    runner = ie.IsolatedCodexRunner(binary=str(ruta))
    runner.available()
    runner.available()
    assert len(llamadas) == 2


def test_unverified_binary_is_reported_unavailable(tmp_path, monkeypatch):
    ruta = tmp_path / "codex"
    _binario(ruta, b"no aprobado")
    llamadas = []
    _preparar(monkeypatch, llamadas, verificado=False)
    assert ie.IsolatedCodexRunner(binary=str(ruta)).available() is False
    assert ie._CODEX_VERIFICADO == {}
