import pytest

from src.adapters.showcase.guides import ensure_design_guides
from src.core.showcase.ports import ShowcaseInvalid


def test_design_guides_preserve_owner_changes_and_identity_on_move(tmp_path):
    root = tmp_path / "profile"
    source = root / "sandbox/designs/nodeaction/vida"
    assert len(ensure_design_guides(root, "nodeaction", source, "vida")) == 10
    customized = root / "designs/AGENTS.md"
    customized.write_text("Instrucciones personalizadas")
    assert ensure_design_guides(root, "nodeaction", source, "vida") == []
    assert customized.read_text() == "Instrucciones personalizadas"
    target = root / "designs/nodeaction/vida"
    source.rename(target)
    assert "`vida`" in (target / "AGENTS.md").read_text()
    assert "catalog/<entry_id>" in (target / "CLAUDE.md").read_text()
    assert "Consulta `design.json`" in (target / "AGENTS.md").read_text()


def test_design_guides_reject_foreign_paths_and_symlinks(tmp_path):
    root, other = tmp_path / "profile", tmp_path / "other"
    other.mkdir()
    with pytest.raises(ShowcaseInvalid):
        ensure_design_guides(root, "nodeaction", other, "vida")
    (root / "sandbox").mkdir(parents=True)
    (root / "sandbox/designs").symlink_to(other, target_is_directory=True)
    with pytest.raises(ShowcaseInvalid):
        ensure_design_guides(root, "nodeaction", root / "sandbox/designs/nodeaction/vida", "vida")
    assert list(other.iterdir()) == []
