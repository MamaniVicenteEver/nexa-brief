"""Prueba del master real: voz + efectos + música, incluida una segunda mezcla."""
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest

spec = importlib.util.spec_from_file_location('cinematic_audio', Path(__file__).with_name('cinematic_audio.py'))
audio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audio)


def cue(**values):
    return dict(music_asset_id='pista', start=.2, source_in=0, duration=1.5,
                gain_db=-24, fade_in=.1, fade_out=.2, **values)


def test_plan_rejects_outside_or_overlapping_cues():
    plan = {'version': 1, 'cues': [cue()]}
    assert audio.validate_plan(plan, 2)[0]['start'] == .2
    for change in ({'start': 1}, {'gain_db': 0}, {'start': float('nan')}, {'fade_out': 4}):
        with pytest.raises(ValueError):
            audio.validate_plan({'version': 1, 'cues': [{**cue(), **change}]}, 2)
    with pytest.raises(ValueError, match='superponen'):
        audio.validate_plan({'version': 1, 'cues': [cue(), cue()]}, 2)


@pytest.mark.asyncio
async def test_remix_preserves_voice_effects_and_sum(tmp_path, monkeypatch):
    from src.adapters.sound_effects.ffmpeg_mixer import _command
    import src.config.profile_layout as layouts
    profile = tmp_path / 'perfil'
    project = profile / 'productions/nodeatlas/prueba'
    (project / 'assets').mkdir(parents=True)
    (profile / 'profile.json').write_text(json.dumps({'id': 'perfil', 'schema_version': 3}))
    monkeypatch.setattr(layouts, 'layout_for_settings', lambda _: SimpleNamespace(root=profile, resources_dir=profile/'resources'))
    for name, hz, gain in [('voice', 440, .25), ('effects', 720, .03), ('music', 115, .3)]:
        await _command('ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i', f'sine=frequency={hz}:duration=2:sample_rate=48000',
                       '-af', f'volume={gain}', '-ac', '2', '-c:a', 'pcm_f32le', str(project/'assets'/f'{name}.wav'))
    meta = dict(name='Pista de prueba', author='Prueba', source_url='https://example.invalid/source', license='CC0',
                license_url='https://creativecommons.org/publicdomain/zero/1.0/', attribution='Prueba CC0', hash='test')
    monkeypatch.setattr(audio, 'resolve_music', lambda *_: (project/'assets/music.wav', meta))
    config_path = project/'assets/config.json'
    config_path.write_text(json.dumps({'activeId':'prueba','configs':[{'id':'prueba','audio':
        {'src':'assets/voice.wav','narrationSrc':'assets/voice.wav'},'soundDesign':{'effectsSrc':'assets/effects.wav'}}]}))
    (project/'publish.json').write_text(json.dumps({'schema_version':2,'credits':[],
        'pinned_comment':'Dato extra: un dato verificado. ¿Qué decisión cambiarías? ¿Qué otro mapa quieres ver?'}))
    plan = {'version':1,'cues':[cue()]}
    first = await audio.render(project, plan, profile, apply=True)
    second = await audio.render(project, plan, profile, apply=True)
    assert first['reused'] is False
    assert second['reused'] is True
    assert first['plan_hash'] == second['plan_hash']
    assert first['master'] == second['master']
    async def samples(path):
        return np.frombuffer(await _command('ffmpeg','-v','error','-i',str(path),'-ar','48000','-ac','2','-f','f32le','-'),dtype='<f4')
    voice = await samples(project/'assets/voice.wav')
    effects = await samples(project/'assets/effects.wav')
    music = await samples(second['music_stem'])
    master = await samples(second['master'])
    assert len(master) == len(voice) == len(effects) == len(music)
    assert float(np.max(np.abs(master - voice - effects - music))) < 4e-7
    assert float(np.max(np.abs(music[round(.5*96000):round(1*96000)]))) > 1e-5
    # El relleno de duración nunca debe ocultar un bus truncado antes del final.
    assert float(np.max(np.abs(music[round(1.5*96000):round(1.6*96000)]))) > 1e-5
    assert float(np.max(np.abs(music[:round(.19*96000)]))) < 1e-6
    raw = json.loads(config_path.read_text())['configs'][0]
    assert raw['audio']['narrationSrc'] == 'assets/voice.wav'
    assert raw['soundDesign']['effectsSrc'] == 'assets/effects.wav'
    assert raw['musicDesign']['effectsUnchanged'] is True
    # Un archivo de salida dañado se vuelve a construir aunque el plan no cambie.
    Path(second['playback']).write_bytes(b'corrupto')
    repaired = await audio.render(project, plan, profile, apply=True)
    assert repaired['plan_hash'] == first['plan_hash']
    assert repaired['reused'] is False
    # Un stem modificado tiene otra identidad; la caché anterior no se utiliza.
    await _command('ffmpeg','-y','-v','error','-f','lavfi','-i','sine=frequency=880:duration=2:sample_rate=48000',
                   '-af','volume=.02','-ac','2','-c:a','pcm_f32le',str(project/'assets/effects.wav'))
    third = await audio.render(project, plan, profile, apply=True)
    assert third['plan_hash'] != first['plan_hash']
    assert third['reused'] is False


def test_host_only_applies_declared_imperio_plan(tmp_path, monkeypatch):
    import src.config.profile_layout as layouts
    (tmp_path/'assets').mkdir()
    (tmp_path/'work').mkdir()
    cfg = tmp_path/'assets/config.json'
    cfg.write_text(json.dumps({'design':'imperio'}))
    async def forbidden(*args, **kw):
        raise AssertionError('no debe mezclar')
    monkeypatch.setattr(audio, 'render', forbidden)
    assert audio.apply_declared_plan(tmp_path) is None
    (tmp_path/'work/music-plan.json').write_text('{"version":1,"cues":[]}')
    cfg.write_text(json.dumps({'design':'rough'}))
    assert audio.apply_declared_plan(tmp_path) is None
    cfg.write_text(json.dumps({'design':'imperio'}))
    calls=[]
    async def recorded(*args, **kwargs):
        calls.append((args, kwargs))
        return {'reused':True}
    monkeypatch.setattr(audio, 'render', recorded)
    monkeypatch.setattr(layouts,'layout_for_settings',lambda _:SimpleNamespace(root=tmp_path))
    # El wrapper de lock valida pertenencia; este test comprueba el routing del host.
    monkeypatch.setattr(audio,'run_locked',lambda project,plan,profile,apply: __import__('asyncio').run(audio.render(project,plan,profile,apply=apply)))
    assert audio.apply_declared_plan(tmp_path) == {'reused':True}
    assert calls[0][0][0] == tmp_path
    assert calls[0][1]['apply'] is True
    monkeypatch.setattr(audio, 'render', forbidden)
    with pytest.raises(ValueError,match='Música de fondo.*no debe mezclar'):
        audio.apply_declared_plan(tmp_path)


def test_manifest_audio_failure_prevents_finalization(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location('kit_for_music_test',Path(__file__).with_name('kit.py'))
    kit = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(kit)
    import cinematic_audio as host_audio
    monkeypatch.setattr(kit,'vdir',lambda _:tmp_path)
    monkeypatch.setattr(kit,'design_of',lambda _:'imperio')
    called=[]
    def fail(project):
        called.append(project)
        raise ValueError('Música de fondo: recurso inválido')
    monkeypatch.setattr(host_audio,'apply_declared_plan',fail)
    with pytest.raises(ValueError,match='recurso inválido'):
        kit.cmd_manifest(SimpleNamespace(id='prueba'))
    assert called == [tmp_path]
    assert not (tmp_path/'manifest.json').exists()


def test_auto_selects_only_licensed_instrumental_candidate(tmp_path, monkeypatch):
    import src.core.library.asset_library as library
    monkeypatch.setattr(library,'list_music',lambda:[SimpleNamespace(asset_id=x) for x in ['bad','b','a']])
    def resolve(asset_id, root):
        if asset_id == 'bad':
            raise ValueError('sin licencia')
        return tmp_path/'music.mp3', {'name':'Tema', 'description':'Música cinematográfica', 'tags':['instrumental','epic']}
    monkeypatch.setattr(audio,'resolve_music',resolve)
    assert audio.choose_auto_music(tmp_path,'cinematic') == 'a'
    monkeypatch.setattr(library,'list_music',lambda:[SimpleNamespace(asset_id='a',duration_seconds=8),
                                                   SimpleNamespace(asset_id='b',duration_seconds=120)])
    assert audio.choose_auto_music(tmp_path,'cinematic',required_seconds=60) == 'b'
    with pytest.raises(ValueError,match='No hay música instrumental'):
        audio.choose_auto_music(tmp_path,'reflective')
    monkeypatch.setattr(library,'list_music',lambda:[])
    with pytest.raises(ValueError,match='No hay música instrumental'):
        audio.choose_auto_music(tmp_path,'cinematic')


def test_public_credit_is_idempotent_and_overlength_does_not_write(tmp_path):
    meta = {'name':'Undaunted','author':'Kevin MacLeod','license':'CC BY 4.0',
            'source_url':'https://incompetech.com/music/?isrc=test',
            'download_url':'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Undaunted.mp3',
            'license_url':'https://creativecommons.org/licenses/by/4.0/'}
    path=tmp_path/'publish.json'
    original={'schema_version':2,'credits':['Crédito documental existente'],
              'pinned_comment':'Dato extra: el plazo fue de 48 horas. ¿Qué decisión cambiarías? ¿Qué otro mapa quieres ver?'}
    path.write_text(json.dumps(original))
    result=audio.prepare_public_credit(tmp_path,{'track':meta})
    pinned=result['data']['pinned_comment']
    assert result['placement']=='pinned_comment'
    assert meta['download_url'] in pinned and meta['license_url'] in pinned
    assert pinned.count('?')==2 and pinned.endswith('?')
    assert pinned.startswith('Dato extra:')
    assert 'Crédito documental existente' in result['data']['credits']
    path.write_text(json.dumps(result['data']))
    again=audio.prepare_public_credit(tmp_path,{'track':meta})
    assert again['data']==result['data']
    # save_package es la derivación editorial usada por publishing build.
    # Aunque brief_caption quite URLs de la descripción, conserva el comentario.
    from tests.unit.test_publishing_package import PACKAGE
    from src.core.explainer.publishing.store import load_package, save_package
    from src.core.explainer.publishing.strategies import active_strategies
    package=json.loads(json.dumps(PACKAGE))
    package['pinned_comment']=pinned
    package['credits']=result['data']['credits']
    path.write_text(json.dumps(package))
    rebuilt=save_package(tmp_path,load_package(tmp_path),active_strategies('node_tech'))
    assert meta['download_url'] in rebuilt['pinned_comment']
    assert meta['license_url'] in rebuilt['pinned_comment']
    assert rebuilt['pinned_comment']==pinned
    original['pinned_comment']='Dato extra: '+('dato '*60)+'¿Qué decisión cambiarías? ¿Qué otro mapa quieres ver?'
    path.write_text(json.dumps(original)); before=path.read_bytes()
    with pytest.raises(ValueError,match='máximo 420'):
        audio.prepare_public_credit(tmp_path,{'track':meta})
    assert path.read_bytes()==before
