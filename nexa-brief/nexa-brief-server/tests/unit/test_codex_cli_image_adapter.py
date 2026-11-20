import json
from pathlib import Path

import pytest
from PIL import Image

from src.adapters.image_gen.codex_cli_image_adapter import CodexCLIImageAdapter, _usage


class FakeRunner:
    def __init__(self, home: Path):
        self.home = home
        self.cmd = None
        self.env = None

    def run(self, cmd, prompt, cwd, env, timeout):
        self.cmd, self.env = cmd, env
        folder = self.home / "generated_images" / "11111111-2222-3333-4444-555555555555"
        folder.mkdir(parents=True)
        Image.new("RGB", (500, 500), "#2455a4").save(folder / "sample.png")
        events = [
            {"type": "thread.started", "thread_id": folder.name},
            {"type": "turn.completed", "usage": {"input_tokens": 120, "cached_input_tokens": 40,
                                                 "output_tokens": 20, "reasoning_output_tokens": 6}},
        ]
        return 0, "\n".join(json.dumps(e) for e in events), 1.25


def test_generate_uses_chatgpt_and_collects_image(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "must-not-pass")
    monkeypatch.setenv("CODEX_API_KEY", "must-not-pass")
    monkeypatch.setenv("OPENAI_BASE_URL", "must-not-pass")
    home = tmp_path / "codex"
    runner = FakeRunner(home)
    adapter = CodexCLIImageAdapter(model="sol-high", output_root=tmp_path / "out",
                                   codex_home=home, runner=runner)
    result = adapter.generate("test-cover", "A cobalt sphere", "640x360")
    assert Image.open(result.path).size == (640, 360)
    assert result.model == "sol-high"
    assert result.tokens == {"input_tokens": 120, "cached_input_tokens": 40,
                             "output_tokens": 20, "reasoning_tokens": 6}
    assert all(key not in runner.env for key in ("OPENAI_API_KEY", "CODEX_API_KEY", "OPENAI_BASE_URL"))
    assert 'forced_login_method="chatgpt"' in runner.cmd
    ledger = json.loads((tmp_path / "out" / "usage.jsonl").read_text().splitlines()[0])
    assert ledger["billing"] == "suscripción" and ledger["input_tokens"] == 120


def test_references_are_attached_and_untrusted_task_rejected(tmp_path):
    home = tmp_path / "codex"
    runner = FakeRunner(home)
    adapter = CodexCLIImageAdapter(output_root=tmp_path / "out", codex_home=home, runner=runner)
    reference = tmp_path / "ref.png"
    Image.new("RGB", (10, 10)).save(reference)
    adapter.generate("reference", "Use reference", "256x256", (reference,))
    assert "-i" in runner.cmd
    with pytest.raises(ValueError):
        adapter.generate("../escape", "prompt", "256x256")
    with pytest.raises(ValueError):
        adapter.generate("valid", "prompt", "bad-size")


def test_usage_sums_turns_and_ignores_non_json():
    events = '\n'.join(('noise', '{"type":"thread.started","thread_id":"abc"}',
                        '{"type":"turn.completed","usage":{"input_tokens":4,"output_tokens":2}}',
                        '{"type":"turn.completed","usage":{"input_tokens":3,"reasoning_output_tokens":1}}'))
    assert _usage(events) == ("abc", {"input_tokens": 7, "cached_input_tokens": 0,
                                      "output_tokens": 2, "reasoning_tokens": 1}, "")
