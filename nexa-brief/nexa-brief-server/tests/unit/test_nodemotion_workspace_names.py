import json

import pytest

from src.core.nodemotion.shared.workspace_names import apply_workspace_names, plan_workspace_names


def test_plan_and_apply_preserve_bytes_and_history(tmp_path):
    project = tmp_path / "session"
    (project / "work/instrucciones").mkdir(parents=True)
    (project / "work/instrucciones/prompts-history.json").write_text(
        json.dumps({"retired_files": ["work/instrucciones/base.md"]})
    )
    script = b"{\"lines\": [\"hola\"]}\n"
    (project / "work/guion.json").write_bytes(script)
    (project / "INFORME.md").write_bytes(b"original report\n")
    (project / "work/results").mkdir()
    (project / "work/results/temporary.json").write_text("not JSON")
    plan = plan_workspace_names(tmp_path)
    assert not plan["blocked"]
    apply_workspace_names(plan)
    assert (project / "work/script.json").read_bytes() == script
    assert (project / "REPORT.md").read_bytes() == b"original report\n"
    history = project / "work/instructions/prompts-history.json"
    assert json.loads(history.read_text())["retired_files"] == ["work/instrucciones/base.md"]
    assert not (project / "work/guion.json").exists()


def test_collision_and_operational_reference_are_blocked(tmp_path):
    project = tmp_path / "session"
    (project / "work").mkdir(parents=True)
    (project / "work/guion.json").write_text("{}")
    (project / "work/script.json").write_text("{}")
    assert plan_workspace_names(tmp_path)["blocked"]
    (project / "work/script.json").unlink()
    (project / "state.json").write_text(json.dumps({"path": "work/guion.json"}))
    result = plan_workspace_names(tmp_path)
    assert result["blocked"] and not result["projects"]


def test_apply_refuses_changed_content_and_symlinks(tmp_path):
    project = tmp_path / "session"
    (project / "work").mkdir(parents=True)
    script = project / "work/guion.json"
    script.write_text("{}")
    plan = plan_workspace_names(tmp_path)
    script.write_text("{\"updated\": true}")
    with pytest.raises(ValueError, match="changed"):
        apply_workspace_names(plan)
    script.unlink()
    script.symlink_to(tmp_path / "outside")
    assert plan_workspace_names(tmp_path)["blocked"]
