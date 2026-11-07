"""Shared components must not depend on a profile's production folder."""
import hashlib
import json
from pathlib import Path


TEMPLATES = Path(__file__).resolve().parents[2] / "src/templates"


def test_binary_components_have_stable_shared_sources_and_sheets():
    registry = json.loads((TEMPLATES / "_tools/explainer-kit/component-library.json").read_text())
    names = {"binary.crisisdesk", "binary.midnightrelay", "binary.y2kfield"}
    entries = [item for item in registry["components"] if item["name"] in names]
    assert {item["name"] for item in entries} == names
    assert len(entries) == len(names)
    for item in entries:
        assert item["source"].startswith("_tools/explainer-kit/component-library/sources/binary/")
        source = TEMPLATES / item["source"]
        sheet = TEMPLATES / item["source_sheet"]
        assert source.is_file() and sheet.is_file()
        assert hashlib.sha256(source.read_bytes()).hexdigest() == item["source_sha256"]
