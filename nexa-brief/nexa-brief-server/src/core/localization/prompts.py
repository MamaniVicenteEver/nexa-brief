"""Compose six ordered editorial sections from caller-selected public files."""
from __future__ import annotations

import json
from pathlib import Path


def compose_prompt(*, lead: Path, design: Path, identity: dict, strategies: dict,
                   story: dict, task: Path) -> str:
    def dump(value):
        return json.dumps(value, ensure_ascii=False, indent=2)
    return "\n\n".join((lead.read_text(encoding="utf-8").strip(),
                          design.read_text(encoding="utf-8").strip(),
                          "Identidad del mercado\n" + dump(identity),
                          "Estrategias editoriales\n" + dump(strategies),
                          "Historia y ficha editorial\n" + dump(story),
                          task.read_text(encoding="utf-8").strip())) + "\n"
