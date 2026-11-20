"""Los renders no dependen de las tuberias: el proceso principal basta para terminar."""

import asyncio
import sys
import time

import pytest

from src.adapters.recorder.infrastructure import subprocess_progress as sp


def _python(codigo: str) -> list[str]:
    return [sys.executable, "-c", codigo]


def test_reports_progress_and_keeps_the_output_tail(monkeypatch, tmp_path):
    reportes: list[float] = []
    monkeypatch.setattr(sp, "report_step_progress", reportes.append)
    codigo = "for p in (10, 50, 100):\n    print(f'avance {p}%', flush=True)\n"
    salida = asyncio.run(sp.run_with_progress(_python(codigo), cwd=tmp_path, timeout=30,
                                              parse_progress=sp.parse_percent))
    assert salida.returncode == 0
    assert reportes == [0.1, 0.5, 1.0]
    assert "avance 100%" in salida.stdout_tail


def test_returns_when_the_main_process_exits_even_if_a_child_keeps_the_pipes(tmp_path):
    codigo = "import subprocess\nsubprocess.Popen(['sleep', '60'])\nprint('listo', flush=True)\n"
    inicio = time.monotonic()
    salida = asyncio.run(sp.run_with_progress(_python(codigo), cwd=tmp_path, timeout=120,
                                              parse_progress=lambda _: None))
    assert salida.returncode == 0
    assert time.monotonic() - inicio < 15
    assert "listo" in salida.stdout_tail


def test_timeout_kills_the_process_group(tmp_path):
    inicio = time.monotonic()
    with pytest.raises(asyncio.TimeoutError):
        asyncio.run(sp.run_with_progress(_python("import time\ntime.sleep(60)"), cwd=tmp_path,
                                         timeout=1, parse_progress=lambda _: None))
    assert time.monotonic() - inicio < 15
