from copy import deepcopy
import json
from pathlib import Path

import pytest

from src.adapters.showcase.atlas_catalog import atlas_engine_catalog
from src.core.showcase.ports import ShowcaseInvalid


def source(tmp_path, rows):
    path = tmp_path / 'nodeatlas/atlas-en-movimiento/engine/tactico/components.json'
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps({'components': rows}))
    return path


def test_new_component_is_discovered_from_same_runtime_registry(tmp_path):
    path = source(tmp_path, [{'name':'space.satellite','summary':'Satélite','params':{'count':{'default':2}},
                              'demo':{'type':'space.satellite','count':2}}])
    catalog={'entries':[],'revision':'unchanged'}
    result=atlas_engine_catalog(tmp_path,catalog)
    assert result['entries'][0]['id']=='space.satellite'
    assert result['entries'][0]['example']['type']=='space.satellite'
    assert catalog['entries']==[]
    assert len(list(tmp_path.rglob('components.json')))==1
    path.write_text(json.dumps({'components':[{'name':'territory.zone','demo':{'type':'territory.zone'}}]}))
    assert atlas_engine_catalog(tmp_path,catalog)['entries'][0]['id']=='territory.zone'


def test_preset_uses_original_type_and_runtime_schema(tmp_path):
    source(tmp_path,[{'name':'money.flow','params':{'currencySymbol':{'type':'string'}},
                      'demo':{'type':'money.flow','count':7}}])
    catalog={'entries':[{'id':'money.flow.ucrania','name':'money.flow.ucrania','kind':'component','data':{'native_name':'money.flow'},
                         'example':{'type':'money.flow.ucrania','count':10},'params':{}}]}
    original=deepcopy(catalog)
    result=atlas_engine_catalog(tmp_path,catalog)
    assert len(result['entries'])==1
    assert result['entries'][0]['name']=='money.flow'
    assert result['entries'][0]['example']=={'type':'money.flow','count':10}
    assert 'currencySymbol' in result['entries'][0]['params']
    assert catalog==original


def test_sprite_cards_are_preserved(tmp_path):
    source(tmp_path,[{'name':'money.flow','demo':{'type':'money.flow'}}])
    sprite={'id':'sprite-tank','name':'tank','kind':'component','data':{'native_name':'tank'}}
    result=atlas_engine_catalog(tmp_path,{'entries':[sprite]})
    assert result['entries'][0]==sprite
    assert result['entries'][1]['id']=='money.flow'


def test_duplicate_or_incomplete_registry_is_rejected(tmp_path):
    path=source(tmp_path,[{'name':'money.flow'},{'name':'money.flow'}])
    with pytest.raises(ShowcaseInvalid,match='duplicado'):
        atlas_engine_catalog(tmp_path,{'entries':[]})
    path.write_text(json.dumps({'components':[{'name':'money.flow'}]}))
    with pytest.raises(ShowcaseInvalid,match='demostración'):
        atlas_engine_catalog(tmp_path,{'entries':[]})
