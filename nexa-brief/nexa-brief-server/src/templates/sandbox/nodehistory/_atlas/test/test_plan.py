import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
SERVER = HERE.parents[6]
sys.path.insert(0, str(SERVER))
sys.path.insert(0, str(SERVER / 'src/templates/_tools/atlas'))
from plan import plan, footprint
from src.adapters.maps.providers import load_providers, ATLAS


def test_synthetic_scene_is_deterministic_and_limits_coverage(tmp_path):
    scene = {'duration': 2, 'look': 'satelite-etiquetado', 'camera': [
        {'t': 0, 'focus': [-97.74, 30.27], 'zoom': 9, 'pitch': 50},
        {'t': 1, 'focus': [-97.7, 30.3], 'zoom': 10, 'dur': 1}]}
    path = tmp_path / 'scene.json'; path.write_text(json.dumps(scene))
    providers=load_providers(); result=plan(path,providers,step=.5)
    assert result == plan(path,providers,step=.5)
    assert {'gibs-bluemarble','terrain-land','usgs-imagery'} <= result.keys()
    assert {9,10,11}.issubset({z for z,x,y in result['terrain-land']})
    for z,x,y in result['usgs-imagery']:
        assert 0 <= z <= 16 and 0 <= x < 2**z and 0 <= y < 2**z
    scene['camera'][0]['focus'] = [10, 40]; scene['camera'][1]['focus']=[11,40]
    path.write_text(json.dumps(scene)); assert not plan(path,providers,step=1).get('usgs-imagery')


def test_projected_footprint_finite_near_horizon():
    for pitch in [0,60,85]:
        bounds=footprint({'lon':179,'lat':40,'zoom':7,'pitch':pitch,'bearing':35},2.6)
        assert bounds[0] < bounds[2] and bounds[1] < bounds[3]
        assert all(abs(v) < 2 for v in bounds)


def test_reference_plan_contains_original_warm_tiles():
    scene=ATLAS.parent / 'atlas-cinematico/assets/scene.json'
    warm={tuple(x) for x in json.loads((HERE.parent/'warm-z6.json').read_text())}
    assert len(warm)==65
    assert warm <= plan(scene,load_providers())['gibs-bluemarble']


def test_voice_anchor_uses_proto_timer(tmp_path):
    assets=tmp_path/'assets'; assets.mkdir()
    (assets/'config.json').write_text(json.dumps({'configs':[{'lyricsUrl':'words.json'}]}))
    (tmp_path/'words.json').write_text(json.dumps({'segments':[{'words':[{'word':'Austin','start':1,'end':1.5}]}]}))
    scene={'duration':2,'camera':[{'t':0,'focus':[-97,30],'zoom':5},{'t':'@Austin:end','focus':[-96,30],'zoom':6,'dur':.5}]}
    scene_path=assets/'scene.json';scene_path.write_text(json.dumps(scene))
    assert plan(scene_path,load_providers(),step=.5)['terrain-land']


def test_variants_resolve_defaults_and_explicit_selection(tmp_path):
    from plan import samples
    assets = tmp_path / 'assets'; assets.mkdir()
    (tmp_path / 'info.json').write_text(json.dumps({'components': [
        {'name':'atlas.short','label':'Short','summary':'Short','group':'length','default':True},
        {'name':'atlas.long','label':'Long','summary':'Long','group':'length'}]}))
    scene = {'duration':{'$by':'length','short':2,'long':4},'camera':[
        {'t':0,'center':[0,30],'span':120},
        {'t':1,'center':[10,30],'span':60,'dur':1}]}
    scene_path = assets/'scene.json'; scene_path.write_text(json.dumps(scene))
    assert len(samples(scene_path,1)) == 3
    assert len(samples(scene_path,1,'c=atlas.long')) == 5


def test_plan_uses_actual_portrait_viewport(tmp_path):
    from plan import samples
    scene_path=tmp_path/'scene.json'
    scene_path.write_text(json.dumps({'duration':1,'camera':[{'t':0,'center':[0,30],'span':100}]}))
    landscape=samples(scene_path,1,width=1920,height=1080)[0]
    portrait=samples(scene_path,1,width=1080,height=1920)[0]
    assert portrait['viewport'] == {'width':1080,'height':1920}
    assert portrait['pose']['zoom'] < landscape['pose']['zoom']
    assert footprint(portrait['pose'],2.6,1080,1920) != footprint(portrait['pose'],2.6)


def test_plan_rejects_unresolved_duration(tmp_path):
    import subprocess
    from plan import samples
    scene_path=tmp_path/'scene.json'
    scene_path.write_text(json.dumps({'duration':{'$by':'missing','x':2},'camera':[{'t':0,'center':[0,30]}]}))
    try:
        samples(scene_path,1)
    except subprocess.CalledProcessError:
        pass
    else:
        raise AssertionError('An unresolved duration must not silently produce one sample')
