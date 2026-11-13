"""Relevancia de medios con catálogos simulados, sin descargas."""
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import pytest
from jsonschema import Draft202012Validator

BASE = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('promo_media_test', BASE / 'src/templates/_tools/nodemotion-promo/media.py')
media = importlib.util.module_from_spec(spec)
spec.loader.exec_module(media)


def test_required_terms_normalizes_and_ignores_query_and_author():
    assert media.matches_required_terms({'name':'Vista de Valparaíso', 'query':'turismo'}, ['valparaiso'])
    assert media.matches_required_terms({'source_url':'https://site.example/Valpara%C3%ADso'}, ['VALPARAISO'])
    assert not media.matches_required_terms({'name':'Medellín','author':'Valparaíso','query':'Valparaíso'}, ['valparaiso'])
    assert not media.matches_required_terms({'name':'Valparaisopolis'}, ['valparaiso'])
    assert not media.matches_required_terms({'name':'Valparaíso', 'description':'Valparaíso','query':'Valparaíso'}, ['valparaiso'])
    assert media.matches_required_terms({'name':'Medellín'}, None)
    assert media.matches_required_terms({'keywords':['Chile','Valparaíso']}, ['santiago','VALPARAISO'])


def test_schema_terms_limits():
    schema = json.loads((BASE/'src/skills/nodemotion/promo/schemas/media-plan.json').read_text())
    validator = Draft202012Validator(schema)
    base = {'scene': 1, 'slot':'city','kind':'image','query':'ciudad'}
    assert validator.is_valid({'items':[dict(base, required_terms=['Valparaíso'])]})
    for terms in ([], ['  '], ['x'*61], ['a']*9):
        assert not validator.is_valid({'items':[dict(base, required_terms=terms)]})

@pytest.mark.asyncio
async def test_candidates_filtered_before_registration_and_reuse_rechecked(tmp_path, monkeypatch):
    root = tmp_path
    target = root/'project'
    (target/'assets').mkdir(parents=True)
    (target/'assets/lyrics.json').write_text(json.dumps({'segments':[{'id':1,'start':0,'end':2}]}))
    plan = {'items':[{'scene':1,'slot':'city','kind':'image','query':'Valparaíso Chile','required_terms':['valparaiso'],'asset_id':'wrong'}]}
    (target/'media-plan.json').write_text(json.dumps(plan))
    read = lambda path: json.loads(path.read_text())
    def write(path, value): path.write_text(json.dumps(value))
    monkeypatch.setattr(media, 'find', lambda *args, **kwargs: None)
    item = lambda title, ident: SimpleNamespace(title=title, description='', keywords=[], source_url='https://example.org/item/'+ident,
        provider_id=ident, width=1200, height=800, duration_seconds=None, author='Photographer')
    class Provider:
        name='fake'; kinds={'image'}; configured=True
        async def search(self, *args, **kwargs): return [item('Medellín', 'bad'), item('Puerto de Valparaíso', 'good')]
    monkeypatch.setattr(media, 'build_providers', lambda: {'fake': Provider()})
    calls = []
    async def register(root, target, project_id, kind, candidate, query, write_json, validate):
        calls.append(candidate.provider_id)
        return {'id':candidate.provider_id, 'name':candidate.title, 'source_url':candidate.source_url}, False
    monkeypatch.setattr(media, 'register', register)
    result = await media.fetch(root,target,'project',read,write,lambda *_:None)
    saved = read(target/'media-plan.json')['items'][0]
    assert result == 0 and calls == ['good'] and saved['asset_id'] == 'good'
    assert saved['required_terms'] == ['valparaiso']


def test_find_skips_cached_records_with_no_real_anchor(tmp_path, monkeypatch):
    root = tmp_path
    for ident, name in [('old', 'Medellín'), ('right', 'Puerto de Valparaíso')]:
        folder = root/'resources/images'/ident
        folder.mkdir(parents=True)
        (folder/'image.jpg').write_bytes(b'x')
        (folder/'resource.json').write_text(json.dumps({'id':ident, 'name':name, 'description':'', 'query':'ciudad', 'file':'image.jpg', 'source_url':'https://example.org/'+ident}))
    monkeypatch.setattr(media.lib, 'resolve_asset_path', lambda kind, ident: root/'resources/images'/ident/'image.jpg')
    assert media.find(root, 'image', ident='old', required_terms=['Valparaíso']) is None
    assert media.find(root, 'image', query='ciudad', required_terms=['Valparaíso'])[1]['id'] == 'right'
