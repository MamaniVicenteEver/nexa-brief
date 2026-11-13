"""Locale-specific numbers in the actual rough.counter renderer."""
from pathlib import Path
import shutil
import subprocess

import pytest


def test_counter_formats_numbers_for_the_edition_market():
    node = shutil.which("node")
    if not node:
        pytest.skip("node is required to execute the renderer")
    server = Path(__file__).resolve().parents[2]
    script = Path(__file__).with_name("rough_counter_locales.cjs")
    component = server / "src/templates/_tools/explainer-kit/designs/rough/components/extra.js"
    result = subprocess.run([node, str(script), str(component)], capture_output=True, text=True, timeout=10)
    assert result.returncode == 0, result.stderr
