import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/check_agent_docs.py'
spec = importlib.util.spec_from_file_location('check_agent_docs', SCRIPT)
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


def test_finds_broken_router_skill_claude_and_links(tmp_path, monkeypatch):
    root = tmp_path
    base = root / 'nexa-brief-server/src/skills'
    base.mkdir(parents=True)
    for name in ('README.md', 'CALIDAD.md', 'ORQUESTACION.md', 'PLANTILLA-BRIEF.md', 'PLANTILLA-INFORME.md'):
        (base / name).write_text('')
    router = root / 'AGENTS.md'
    router.write_text('[faltante](no-existe.md)\n`ruta/no-existe.md`\n')
    skill = root / 'SKILL.md'
    skill.write_text('Sin instrucciones comunes')
    claude = root / 'CLAUDE.md'
    claude.write_text('contenido propio')
    monkeypatch.setattr(checker, 'inventory', lambda *_: ([router], [skill], [claude], []))
    errors, count = checker.check(root)
    assert count == 3
    assert any('router sin enlace' in e for e in errors)
    assert any('enlace inexistente' in e for e in errors)
    assert any('ruta citada inexistente' in e for e in errors)
    assert any('falta enlace estándar a CALIDAD.md' in e for e in errors)
    assert any('CLAUDE.md debe contener' in e for e in errors)


def test_accepts_relative_links_and_generated_examples(tmp_path, monkeypatch):
    base = tmp_path / 'nexa-brief-server/src/skills'
    base.mkdir(parents=True)
    names = ('README.md', 'CALIDAD.md', 'ORQUESTACION.md', 'PLANTILLA-BRIEF.md', 'PLANTILLA-INFORME.md')
    for name in names:
        (base / name).write_text('')
    router = tmp_path / 'AGENTS.md'
    router.write_text('[índice](nexa-brief-server/src/skills/README.md)\n')
    skill = base / 'SKILL.md'
    skill.write_text(' '.join(f'[{n}]({n})' for n in names[1:]) + ' si orquestas; como `INFORME.md`\n## Específico de esta skill\n`work/resultado.md`\n')
    claude = tmp_path / 'CLAUDE.md'
    claude.write_text('@AGENTS.md\n')
    monkeypatch.setattr(checker, 'inventory', lambda *_: ([router], [skill], [claude], []))
    assert checker.check(tmp_path)[0] == []
