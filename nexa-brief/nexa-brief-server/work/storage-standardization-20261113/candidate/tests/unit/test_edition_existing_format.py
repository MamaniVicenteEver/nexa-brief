import json
import shutil
from pathlib import Path
import pytest
from src.core.explainer.editions.resolver import build_edition
from src.core.editions.formats import validate_storyboard, select_format

DEMO = Path(__file__).resolve().parents[2] / 'src/templates/nodetech/lo-que-le-contas-a-la-ia-no-es-privado-tus-chats'

@pytest.fixture
def production(tmp_path):
    p = tmp_path/'episode'
    (p/'assets').mkdir(parents=True)
    for name in ('config.json','script.json','storyboard.json'):
        shutil.copyfile(DEMO/'assets'/name,p/'assets'/name)
    s = json.loads((p/'assets/script.json').read_text())
    s.pop('format_id',None)
    (p/'assets/script.json').write_text(json.dumps(s))
    return p

@pytest.mark.parametrize('duration',[199.226122,221.456327,244.17,504.34])
def test_localize_existing_uses_recorded_duration_not_creation_policy(production,duration):
    (production/'assets/lyrics.json').write_text(json.dumps({'metadata':{'duration':duration},'segments':[]}))
    ed=build_edition(production,'en',preserve_source_format=True)
    assert (ed.format_id,ed.duration_seconds)==('documental-existente',duration)
    assert ed.provenance['duration_seconds']=='assets/lyrics.json:metadata.duration'
    assert ed.provenance['format_id']=='existing source without declared format'
    storyboard={'beats':[{'use':'rough.photo','params':{'src':'assets/media/photo.jpg'}}]}
    assert validate_storyboard(storyboard,ed.format_id,ed.design_id,localizable=ed.localizable)==[]


def test_explicit_overrides_and_default_selection_remain_unchanged(production):
    (production/'assets/lyrics.json').write_text(json.dumps({'metadata':{'duration':199.2}}))
    assert select_format(239)=='animado-corto'
    assert select_format(240)=='documental-largo'
    ed=build_edition(production,'en',preserve_source_format=True,duration_seconds=180)
    assert (ed.format_id,ed.duration_seconds)==('animado-corto',180)
    ed=build_edition(production,'en',preserve_source_format=True,format_id='animado-corto')
    assert (ed.format_id,ed.duration_seconds)==('animado-corto',180)
    ed=build_edition(production,'en',preserve_source_format=True,account={'duration_seconds':180},episode={'duration_seconds':600})
    assert (ed.format_id,ed.duration_seconds)==('documental-largo',600)
    with pytest.raises(ValueError,match='requires'):
        build_edition(production,'en',preserve_source_format=True,format_id='documental-largo',duration_seconds=244)


def test_original_without_duration_fails_instead_of_fake_600_seconds(production):
    cfg_path=production/'assets/config.json'
    cfg=json.loads(cfg_path.read_text())
    cfg['configs'][0].pop('outro',None)
    cfg_path.write_text(json.dumps(cfg))
    script_path=production/'assets/script.json'
    script=json.loads(script_path.read_text())
    script.pop('target_minutes',None)
    script_path.write_text(json.dumps(script))
    with pytest.raises(ValueError,match='duración'):
        build_edition(production,'en',preserve_source_format=True)


def test_declared_source_format_keeps_recorded_duration_and_overrides_take_precedence(production):
    (production/'assets/lyrics.json').write_text(json.dumps({'metadata':{'duration':199.2}}))
    path=production/'assets/script.json'
    script=json.loads(path.read_text())
    script['format_id']='animado-corto'
    path.write_text(json.dumps(script))
    ed=build_edition(production,'en',preserve_source_format=True)
    assert (ed.format_id,ed.duration_seconds)==('animado-corto',199.2)
    assert ed.provenance['format_id']=='assets/script.json:format_id'
    assert ed.provenance['duration_seconds']=='assets/lyrics.json:metadata.duration'
    ed=build_edition(production,'en',preserve_source_format=True,account={'format_id':'documental-largo','duration_seconds':600})
    assert (ed.format_id,ed.duration_seconds)==('documental-largo',600)
