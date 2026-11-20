"""Pruebas aisladas de las herramientas iniciales de promos."""
import json
import os
from pathlib import Path
import subprocess
import sys

import pytest

SERVER = Path(__file__).resolve().parents[2]
CLI = SERVER / 'src/templates/_tools/nodemotion-promo/promo.py'


@pytest.fixture
def workspace(tmp_path):
    root = tmp_path / 'perfil'
    root.mkdir()
    (root / 'profile.json').write_text(json.dumps({'id':'test', 'schema_version':3}))
    brief = tmp_path / 'brief.json'
    brief.write_text(json.dumps({'template':'promo-editorial','topic':'test','duration_seconds':90,
                                 'tone':'test','language':'es','audience':'test','name':'test','texts':{}}))
    return root, brief


def invoke(root, *args):
    return subprocess.run([sys.executable, str(CLI), *map(str, args)],
                          env={**os.environ, 'NEXA_PROFILE_DIR':str(root)}, text=True, capture_output=True)


def test_new_is_resumable_and_rejects_changed_brief(workspace):
    root, brief = workspace
    args = ('new','--id','ensayo','--brief',brief)
    assert invoke(root,*args).returncode == 0
    assert invoke(root,*args).returncode == 0
    content = json.loads(brief.read_text())
    content['topic'] = 'distinto'
    brief.write_text(json.dumps(content))
    assert invoke(root,*args).returncode == 2
    assert json.loads((root/'sandbox/nodemotion/ensayo/brief.json').read_text())['topic'] == 'test'


def test_no_path_escape_and_incomplete_check_fails(workspace):
    root, brief = workspace
    assert invoke(root,'new','--id','../escape','--brief',brief).returncode == 2
    assert invoke(root,'new','--id','ensayo','--brief',brief).returncode == 0
    result = invoke(root,'check','--id','ensayo')
    assert result.returncode == 1
    assert json.loads(result.stdout)['ready'] is False


def test_check_rejects_numeric_segment_without_existing_fact(workspace):
    root, brief = workspace
    assert invoke(root, 'new', '--id', 'ensayo', '--brief', brief).returncode == 0
    target = root / 'sandbox/nodemotion/ensayo'
    (target / 'work/research').mkdir(parents=True)
    (target / 'work/research/research.json').write_text(json.dumps({'findings': [{'id': 'titulo'}]}))
    (target / 'work/guion.json').write_text(json.dumps({'segments': [{'lines': ['29 LIGAS'], 'facts': ['otro']}]}))
    result = invoke(root, 'check', '--id', 'ensayo')
    assert result.returncode == 1
    assert any('cifra sin fact existente' in error for error in json.loads(result.stdout)['errors'])
    assert any('desconocidos' in error for error in json.loads(result.stdout)['errors'])


def test_research_rejects_duplicate_source(workspace, tmp_path):
    root, brief = workspace
    assert invoke(root,'new','--id','ensayo','--brief',brief).returncode == 0
    source = {'title':'uno','url':'https://example.org','accessed_at':'2026-11-11','data_date':'2026-01-01'}
    path = tmp_path/'research.json'
    path.write_text(json.dumps({'topic':'test','findings':[{'claim':'test','sources':[source,source]}]}))
    assert invoke(root,'research','--id','ensayo','--input',path).returncode == 2
    assert not (root/'sandbox/nodemotion/ensayo/work/research/research.json').exists()


def test_usage_preserves_reported_total_without_fabricating_breakdown(workspace):
    root, brief = workspace
    assert invoke(root, 'new', '--id', 'ensayo', '--brief', brief).returncode == 0
    ledger = root / 'sandbox/nodemotion/ensayo/logs/usage.jsonl'
    ledger.parent.mkdir(parents=True)
    entry = {'ts': '2026-11-11T23:00:00Z', 'provider': 'codex', 'model': 'gpt-6.1-terra',
             'role': 'producer', 'step': 'trabajo', 'input_tokens': None,
             'cached_input_tokens': None, 'output_tokens': None, 'seconds': None,
             'ok': True, 'billing': 'desconocido', 'reported_total_tokens': 141620}
    ledger.write_text(json.dumps(entry) + '\n')
    result = invoke(root, 'usage', '--id', 'ensayo')
    assert result.returncode == 0, result.stderr
    summary = json.loads(result.stdout)
    assert summary['reported_total_tokens'] == 141620
    assert summary['steps']['trabajo']['reported_total_tokens'] == 141620
    assert summary['tokens']['input_tokens'] is None
    assert summary['unknown_token_entries'] == 1


def test_research_allows_source_with_only_year_without_inventing_a_day(workspace, tmp_path):
    root, brief = workspace
    assert invoke(root, 'new', '--id', 'ensayo', '--brief', brief).returncode == 0
    sources = [
        {'title': 'A', 'url': 'https://example.org/a', 'accessed_at': '2026-11-11', 'data_date': '1899'},
        {'title': 'B', 'url': 'https://example.net/b', 'accessed_at': '2026-11-11', 'data_date': '1899-11-29'},
    ]
    research = tmp_path / 'research.json'
    research.write_text(json.dumps({'topic': 'test', 'findings': [{'claim': '1899', 'sources': sources}]}))
    assert invoke(root, 'research', '--id', 'ensayo', '--input', research).returncode == 0
    assert '(dato: 1899; consulta:' in (root / 'sandbox/nodemotion/ensayo/work/research/research.md').read_text()
    sources[0]['data_date'] = '1899-99-99'
    research.write_text(json.dumps({'topic': 'test', 'findings': [{'claim': '1899', 'sources': sources}]}))
    assert invoke(root, 'research', '--id', 'ensayo', '--input', research).returncode == 2


@pytest.mark.parametrize('ident', ['promo-editorial', 'promo-dynamic', 'promo-kinetic',
                                   'promo-sports', 'promo-trendy', 'promo-urban'])
def test_contract_matches_catalog_and_active_config(ident):
    catalog = json.loads((SERVER / 'src/templates/templates.json').read_text())['templates']
    contract = json.loads((SERVER / f'src/skills/nodemotion/promo/templates/{ident}.json').read_text())
    wrapper = json.loads((SERVER / f'src/templates/nodemotion/commercial/{ident}/assets/config.json').read_text())
    active = next(config for config in wrapper['configs'] if config['id'] == wrapper['activeId'])
    assert contract['inputs'] == catalog[ident]['inputs']
    assert contract['default_brand'] == active.get('brand', {})
    assert contract['default_media'] == [{'id': item['id'], 'type': item['type']} for item in active.get('media', [])]
    assert contract['default_scenes'] == active.get('scenes', [])
