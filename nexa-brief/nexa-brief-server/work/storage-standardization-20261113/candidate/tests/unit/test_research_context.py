import hashlib
import json

import pytest

from src.core.explainer.editions.research_context import documents, publication_sources, public_text
from src.core.explainer.editions.research_readiness import research_present, require_research
from src.core.explainer.editions.resolver import _source_revision


def _put(root, name, value):
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding='utf-8')


def test_empty_plan_credits_and_resource_sources_do_not_count(tmp_path):
    _put(tmp_path, 'PLAN.md', '# PLAN\n## 3. Investigación (hechos verificados)\n| # | hecho | fuente | ¿se usa? |\n|---|---|---|---|\n| 1 | | | |\n- **Cifras clave**:\n## 4. Título\nhttps://media.example/image.jpg\n')
    _put(tmp_path, 'publish.json', json.dumps({'sources': [], 'credits': ['Autor, CC BY, https://commons.wikimedia.org/photo']}))
    _put(tmp_path, 'research.json', json.dumps({'media': {'sources': ['https://commons.wikimedia.org/photo']}, 'facts': []}))
    assert not research_present(tmp_path)
    _put(tmp_path, 'publish.json', json.dumps({'sources': ['Foto: NASA, licencia CC BY 4.0'], 'credits': []}))
    assert not research_present(tmp_path)
    with pytest.raises(ValueError, match='Falta investigación'):
        require_research(tmp_path)


@pytest.mark.parametrize('filename,content', [
    ('research.json', '{"facts":[{"text":"El vuelo despegó en junio", "sources":["Fuente institucional"]}]}'),
    ('research.md', '# Fuentes\nUn informe institucional describe el vuelo y sus resultados.\n'),
    ('PLAN.md', '# Plan\n## 3. Investigación\n| # | hecho | fuente |\n| 1 | El vuelo partió en junio | Informe institucional |\n'),
    ('publish.json', '{"sources":["Informe oficial de la investigación"]}'),
])
def test_accepts_existing_editorial_evidence_without_media_credits(tmp_path, filename, content):
    _put(tmp_path, filename, content)
    assert research_present(tmp_path)


def test_research_context_filters_private_and_sensitive_information(tmp_path):
    _put(tmp_path, 'research.json', json.dumps({'facts':[{'text':'Dato verificado', 'url':'https://example.org/informe?token=secreto', 'password':'secreto', 'path':'/home/alfred/private'}], 'media': {'sources':['https://media.example/image']}}))
    _put(tmp_path, 'research.md', '# Investigación\nDato histórico verificable\narchivo /home/alfred/privado\nAPI_KEY: secreto\nhttps://192.168.20.12/internal\n')
    context, used = documents(tmp_path)
    value = json.dumps(context, ensure_ascii=False)
    assert used == ['research.json','research.md'] and 'Dato verificado' in value and 'Dato histórico' in value
    for forbidden in ('secreto', '/home/alfred', '192.168.20.12', 'media.example'):
        assert forbidden not in value
    assert publication_sources({'sources':['Informe https://public.example/estudio?p=42', 'token: secreto']}) == ['Informe https://public.example/estudio?p=42']
    assert 'PRIVATE KEY' not in public_text('-----BEGIN PRIVATE KEY-----')


def test_legacy_hash_unchanged_and_research_edits_change_revision(tmp_path):
    paths = ('assets/script.json','assets/storyboard.json','assets/config.json','assets/lyrics.json','publish.json','PLAN.md','BRIEF.md')
    digest = hashlib.sha256()
    for rel in paths:
        digest.update(rel.encode())
        digest.update(b'missing')
    assert _source_revision(tmp_path) == 'sha256:' + digest.hexdigest()
    _put(tmp_path, 'research.md', '# Hechos\nHechos de la investigación con una fuente.\n')
    first = _source_revision(tmp_path)
    assert first != 'sha256:' + digest.hexdigest()
    _put(tmp_path, 'research.md', '# Hechos\nInvestigación con una fuente distinta.\n')
    assert _source_revision(tmp_path) != first
    (tmp_path / 'research.md').unlink()
    assert _source_revision(tmp_path) == 'sha256:' + digest.hexdigest()


def test_oversized_research_and_symlink_are_rejected(tmp_path):
    _put(tmp_path, 'research.md', 'x' * 1_000_001)
    assert _source_revision(tmp_path).startswith('sha256:')  # Existing editions can still be listed.
    with pytest.raises(ValueError, match='1 MB'):
        documents(tmp_path)
    (tmp_path / 'research.md').unlink()
    (tmp_path / 'research.md').symlink_to('/etc/passwd')
    with pytest.raises(ValueError, match='rutas externas'):
        documents(tmp_path)
