import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_editorial_recut_templates_are_physical_and_registered() -> None:
    manifest = json.loads((ROOT / "src/templates/templates.json").read_text(encoding="utf-8"))["templates"]
    expected = {
        "prism-echo": ("VIDEO-prism-echo", "prism-echo"),
        "noir-editorial": ("VIDEO-noir-manifesto", "noir-editorial"),
        "archive-signal": ("VIDEO-archive-signal", "archive-signal"),
        "emerald-covenant": ("VIDEO-emerald-covenant", "emerald-covenant"),
        "kinetic-scramble": ("VIDEO-kinetic-scramble", "kinetic-scramble"),
        "crimson-walk": ("VIDEO-crimson-walk", "crimson-walk"),
        "orbital-stack": ("VIDEO-orbital-stack", "orbital-stack"),
    }

    for template_id, (folder, html_id) in expected.items():
        entry = manifest[template_id]
        html_path = ROOT / "src/templates" / folder / "index.html"
        assert entry["folder"] == folder
        assert entry["index_html"] == f"{folder}/index.html"
        assert html_path.exists()
        assert f'data-template="{html_id}"' in html_path.read_text(encoding="utf-8")

    orbital_html = (ROOT / "src/templates/VIDEO-orbital-stack/index.html").read_text(encoding="utf-8")
    assert "three@0.184.0/build/three.module.js" in orbital_html
