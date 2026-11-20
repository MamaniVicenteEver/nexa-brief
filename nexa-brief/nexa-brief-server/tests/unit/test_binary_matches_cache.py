"""La comprobación del binario de Claude no vuelve a leer un archivo sin cambios."""

import hashlib
import os

from src.adapters.agent.infrastructure import isolated_claude


def _binario(path, contenido: bytes) -> str:
    path.write_bytes(contenido)
    os.chmod(path, 0o755)
    return hashlib.sha256(contenido).hexdigest()


def test_correct_binary_matches(tmp_path):
    ruta = tmp_path / "claude"
    esperado = _binario(ruta, b"binario de prueba")
    assert isolated_claude._binary_matches(ruta, esperado) is True


def test_wrong_hash_does_not_match(tmp_path):
    ruta = tmp_path / "claude"
    _binario(ruta, b"binario de prueba")
    assert isolated_claude._binary_matches(ruta, "0" * 64) is False


def test_unchanged_binary_is_not_hashed_again(tmp_path, monkeypatch):
    ruta = tmp_path / "claude"
    esperado = _binario(ruta, b"binario de prueba")
    llamadas = []
    original = hashlib.sha256

    def contada(*args, **kwargs):
        llamadas.append(1)
        return original(*args, **kwargs)

    monkeypatch.setattr(isolated_claude, "_EDAD_MINIMA_CACHE_NS", 0)  # el archivo es de hace un instante
    monkeypatch.setattr(isolated_claude.hashlib, "sha256", contada)
    assert isolated_claude._binary_matches(ruta, esperado) is True
    assert isolated_claude._binary_matches(ruta, esperado) is True
    assert len(llamadas) == 1


def test_changed_binary_is_hashed_again(tmp_path):
    ruta = tmp_path / "claude"
    esperado = _binario(ruta, b"version uno")
    assert isolated_claude._binary_matches(ruta, esperado) is True
    _binario(ruta, b"version dos, con mas bytes")
    assert isolated_claude._binary_matches(ruta, esperado) is False


def test_missing_binary_is_false(tmp_path):
    assert isolated_claude._binary_matches(tmp_path / "no-existe", "0" * 64) is False


def test_recent_binary_is_not_cached(tmp_path, monkeypatch):
    ruta = tmp_path / "claude"
    esperado = _binario(ruta, b"binario recien escrito")
    llamadas = []
    original = hashlib.sha256

    def contada(*args, **kwargs):
        llamadas.append(1)
        return original(*args, **kwargs)

    monkeypatch.setattr(isolated_claude.hashlib, "sha256", contada)
    assert isolated_claude._binary_matches(ruta, esperado) is True
    assert isolated_claude._binary_matches(ruta, esperado) is True
    assert len(llamadas) == 2
