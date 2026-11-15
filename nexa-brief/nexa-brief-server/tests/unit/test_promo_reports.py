import json
import pytest
from src.core.nodemotion.promo import reports


def test_report_is_idempotent_and_replicates_only_owned_revision(tmp_path, monkeypatch):
    monkeypatch.setattr(reports, 'sandbox_root', lambda: tmp_path)
    sid = 'a' * 32
    project = tmp_path / 'nodemotion' / sid
    content = tmp_path / 'nodemotion' / (sid + '-r1')
    content.mkdir(parents=True)
    (project / 'work').mkdir(parents=True)
    (project / 'work' / 'content.json').write_text(json.dumps({'project_id': content.name, 'revision': 1}))
    row = {'session_id': sid, 'revision': 1, 'template_id': 'promo-sports', 'provider': 'claude', 'state': 'review',
           'quality': {'passed': True, 'checks': [{'id': 'visual', 'passed': True}], 'warnings': [], 'errors': []},
           'prompt_ref': {'version': 'v1', 'hashes': {'base.md': 'abc'}},
           'source_context': [{'url':'https://example.org/source','title':'Fuente', 'text':'SECRET-LONG-DOC'}],
           'usage': {'steps': [{'stage': 'proposal', 'model':'m', 'provider':'claude', 'input_tokens': 5, 'cached_input_tokens':None, 'cost_usd':None}], 'totals': {'input_tokens':5}}}
    reports.write_report(row, project)
    text = (project / 'REPORT.md').read_text()
    assert 'Fuente' in text and 'SECRET-LONG-DOC' not in text and 'null' in text and 'factura' in text
    assert (content / 'REPORT.md').read_text() == text
    assert json.loads((content / 'use_tokens/usage.json').read_text()) == row['usage']
    assert (project / 'work/reports/1.md').read_text() == text
    before = (content / 'REPORT.md').stat().st_mtime_ns
    reports.write_report(row, project)
    assert (content / 'REPORT.md').stat().st_mtime_ns == before
    (project / 'work/content.json').write_text(json.dumps({'project_id': '../external', 'revision': 1}))
    row['state'] = 'failed'
    reports.write_report(row, project)
    assert (content / 'REPORT.md').stat().st_mtime_ns == before


def test_report_rejects_non_session_or_symlink(tmp_path, monkeypatch):
    monkeypatch.setattr(reports, 'sandbox_root', lambda: tmp_path)
    sid = 'b' * 32
    bad = tmp_path / 'nodemotion' / 'different'
    with pytest.raises(ValueError): reports.write_report({'session_id': sid, 'revision': 1}, bad)
    (tmp_path / 'nodemotion').mkdir()
    (tmp_path / 'nodemotion' / sid).symlink_to(tmp_path, target_is_directory=True)
    with pytest.raises(ValueError): reports.write_report({'session_id': sid, 'revision': 1}, tmp_path / 'nodemotion' / sid)


def test_report_template_evidence_and_review_is_bound_to_current_draft(tmp_path, monkeypatch):
    from types import SimpleNamespace
    from src.core import data
    from src.core.nodemotion.promo import readiness
    monkeypatch.setattr(reports, 'sandbox_root', lambda: tmp_path / 'sandbox')
    monkeypatch.setattr(reports, 'layout_for_settings', lambda _: SimpleNamespace(resources_dir=tmp_path/'resources'))
    sid = 'c'*32
    project = tmp_path/'sandbox/nodemotion'/sid
    target = tmp_path/'sandbox/nodemotion'/(sid+'-r1')
    (project/'work').mkdir(parents=True)
    (target/'work/research').mkdir(parents=True)
    (project/'work/content.json').write_text(json.dumps({'project_id':target.name,'revision':1}))
    (target/'brief.json').write_text(json.dumps({'name':'Auroras','duration_seconds':76}))
    (target/'media-plan.json').write_text(json.dumps({'items':[{'kind':'image','asset_id':'i1'},{'kind':'image','asset_id':'i1'}]}))
    (target/'music.json').write_text(json.dumps({'asset_id':'m1'}))
    (target/'work/research/research.json').write_text(json.dumps({'findings':[{'claim':'Dato respaldado','sources':[{'title':'Fuente A','url':'https://example.org/?token=secret','data_date':'2026','accessed_at':'2026-11-12'}]}]}))
    for folder, ident, author in [('images','i1','Ana'),('music','m1','Luis')]:
        path = tmp_path/'resources'/folder/ident
        path.mkdir(parents=True)
        (path/'resource.json').write_text(json.dumps({'id':ident,'type':'image' if folder=='images' else 'music','name':'A','author':author,'license':'CC BY','source_url':'https://example.org/source'}))
    row = {'session_id':sid,'revision':1,'template_id':'promo-dynamic','state':'review','draft_id':'d1','review_fingerprint':'hash1',
           'quality':{'passed':True,'checks':[],'errors':[],'warnings':[]},'usage':{'steps':[{'stage':'fetch-search','provider':'commons','seconds':1},{'stage':'download','provider':'commons','seconds':2}], 'totals':{}}}
    monkeypatch.setattr(data, 'collection', lambda _: SimpleNamespace(get=lambda ident: {'draft_id':ident}))
    monkeypatch.setattr(readiness, 'snapshot_fingerprint', lambda _: 'hash1')
    reports.write_report(row,project)
    text = (project/'REPORT.md').read_text()
    assert all(f'## {n}.' in text for n in range(1,8))
    assert 'Lo que no se cumplió' in text and '76 s' in text and '| commons | 1 | 1 | 3 |' in text
    assert text.count('| i1 |') == 1 and 'Ana' in text and 'Luis' in text and 'Dato respaldado' in text
    assert 'token=secret' not in text and 'pendiente de revisión documentada' in text
    review = {'draft_id':'d1','fingerprint':'hash1','criteria':{'relleno':'sin relleno','cifras':'verificadas','medios':'revisados','texto':'legible','miniaturas':'visibles','creditos':'completos'}}
    (project/'work/orchestrator-review.json').write_text(json.dumps(review))
    reports.write_report(row,project)
    assert 'Relleno: sin relleno' in (project/'REPORT.md').read_text()
    monkeypatch.setattr(readiness, 'snapshot_fingerprint', lambda _: 'changed')
    reports.write_report(row,project)
    text = (project/'REPORT.md').read_text()
    assert 'Relleno: sin relleno' not in text and 'pendiente de revisión documentada' in text
    assert row['state'] == 'review' and row.get('approved_revision') is None
