import importlib.util
import json
import sys
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

KIT = Path(__file__).resolve().parents[2] / 'src/templates/_tools/explainer-kit'
sys.path.insert(0, str(KIT / 'tools'))
spec = importlib.util.spec_from_file_location('licencias', KIT / 'tools/licencias.py')
licencias = importlib.util.module_from_spec(spec)
spec.loader.exec_module(licencias)


def write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj), encoding='utf-8')


@pytest.fixture
def fixture(tmp_path):
    profile = tmp_path / 'profile'
    video = profile / 'sandbox/nodeeconomy/test-video'
    kit = tmp_path / 'kit'
    write(video / 'assets/config.json', {'activeId': 'test-video', 'configs': [{'id': 'test-video', 'design': 'test', 'title': 'Prueba'}]})
    write(kit / 'designs/test/design.json', {'defaults': {'fonts': {}}})
    write(kit / 'capas/catalog.json', {'assets': []})
    return video, profile, kit


def record(profile, ident, license='CC BY-SA 4.0', **extra):
    data = {'id': ident, 'name': ident, 'type': 'image', 'license': license, 'author': 'Autor',
            'license_url': 'https://example.org/licencia', 'source_url': 'https://example.org/obra',
            'attribution': 'Obra — Autor; licencia y fuente.', **extra}
    write(profile / 'resources/images' / ident / 'resource.json', data)


def storyboard(video, beats):
    write(video / 'assets/storyboard.json', {'beats': beats})


def test_by_sa_y_estado_antiguo(fixture):
    video, profile, kit = fixture
    record(profile, 'foto', usage_terms='usable: false. Adaptación prevista CC BY-SA 4.0; falta comprobar que todos los componentes y derechos del audiovisual permitan distribuir la adaptación bajo esa licencia.')
    storyboard(video, [{'use': 'common.clip', 'params': {'resource_id': 'foto', 'zoom': 1.2}}])
    data = licencias.build(video, profile, kit)
    photo = next(x for x in data['items'] if x['id'] == 'foto')
    assert photo['estado_licencia'] == 'verificada'
    assert photo['cambios'] == ['animado']
    assert data['summary']['licencia_resultante'] == 'CC BY-SA 4.0'
    assert 'Compartir igual' in photo['condiciones'][0]
    Draft202012Validator(json.loads(licencias.SCHEMA.read_text())).validate(data)
    assert 'Adaptación audiovisual bajo CC BY-SA 4.0' in licencias.markdown(data)


def test_desconocida_y_no_usado(fixture):
    video, profile, kit = fixture
    record(profile, 'desconocida', license=None, author=None)
    record(profile, 'no-usado', license=None)
    storyboard(video, [{'use': 'common.photo', 'params': {'src': 'assets/media/desconocida.jpg'}}])
    data = licencias.build(video, profile, kit)
    assert not data['summary']['apto_para_publicar']
    assert next(x for x in data['items'] if x['id'] == 'desconocida')['licencia'] is None
    assert not any(x['id'] == 'no-usado' for x in data['items'])


def test_watson_bloqueada_y_propia(fixture):
    video, profile, kit = fixture
    record(profile, 'ibm-watson-sr', license='CC0', usage_terms='usable: false. No usar hasta verificar con Smithsonian.')
    storyboard(video, [{'use': 'common.photo', 'params': {'src': 'assets/media/ibm-watson-sr.jpg'}}])
    data = licencias.build(video, profile, kit)
    assert next(x for x in data['items'] if x['id'] == 'ibm-watson-sr')['estado_licencia'] == 'bloqueada'
    assert not data['summary']['apto_para_publicar']
    assert any(x['estado_licencia'] == 'propia' for x in data['items'])
    assert not any('codigo:test' in reason for reason in data['summary']['motivos'])


def test_hash_capas_muestra_y_mezcla(fixture):
    video, profile, kit = fixture
    image = video / 'assets/media/otra.jpg'
    image.parent.mkdir(parents=True, exist_ok=True)
    image.write_bytes(b'bytes originales')
    record(profile, 'por-hash', license='CC0', hash=licencias.sha(image))
    write(profile / 'resources/sounds/efecto/resource.json', {'id': 'efecto', 'type': 'sound', 'license': 'CC0', 'name': 'Efecto'})
    write(profile / 'resources/music/tema/resource.json', {'id': 'tema', 'type': 'music', 'license': 'CC0', 'name': 'Tema'})
    write(kit / 'capas/catalog.json', {'assets': [{'id': 'ejecutivo', 'name': 'Ejecutivo', 'source': {'license': 'desconocida', 'author': None}}]})
    storyboard(video, [
        {'use': 'common.clip', 'params': {'src': 'assets/media/otra.jpg'}},
        {'use': 'common.capas', 'params': {'elenco': [{'asset': 'ejecutivo', 'zonas': {'cuerpo': '#ffffff'}}]}},
        {'use': 'test.intro', 'params': {'figura': '/_tools/explainer-kit/designs/test/samples/figura.png'}}])
    write(video / 'assets/config.json', {'design': 'test', 'soundDesign': {'planUrl': 'assets/sonidos.json'}, 'musicDesign': {'planUrl': 'assets/musica.json'}})
    write(video / 'assets/sonidos.json', {'cues': [{'asset_id': 'efecto', 'start': 1, 'duration': 2}]})
    write(video / 'assets/musica.json', {'cues': [{'music_asset_id': 'tema', 'start': 0, 'duration': 3}]})
    data = licencias.build(video, profile, kit)
    ids = {x['id'] for x in data['items']}
    assert {'por-hash', 'capas:ejecutivo', 'sample:figura.png', 'efecto', 'tema'} <= ids
    layer = next(x for x in data['items'] if x['id'] == 'capas:ejecutivo')
    assert layer['estado_licencia'] == 'desconocida' and 'recoloreado' in layer['cambios']
    assert next(x for x in data['items'] if x['id'] == 'tema')['usado_en'] == ['musicDesign: 0 s, duración 3 s']


def test_sin_storyboard_o_plan_no_publicable(fixture):
    video, profile, kit = fixture
    write(video / 'assets/config.json', {'design': 'test', 'soundDesign': {'planUrl': 'ausente.json'}})
    data = licencias.build(video, profile, kit)
    assert not data['summary']['apto_para_publicar']
    assert any('Storyboard' in reason for reason in data['summary']['motivos'])
    assert any('plan de mezcla' in reason for reason in data['summary']['motivos'])


def test_voz_mezcla_y_atribucion_nc(fixture):
    video, profile, kit = fixture
    audio = video / 'assets/song.mp3'
    audio.parent.mkdir(parents=True, exist_ok=True)
    audio.write_bytes(b'audio')
    write(video / 'assets/config.json', {'design': 'test', 'audio': {'src': 'assets/song.mp3'}, 'narration': {'provider': 'proveedor', 'model': 'modelo', 'voice': 'voz'}})
    storyboard(video, [{'use': 'common.clip', 'params': {'resource_id': 'nc'}}])
    record(profile, 'nc', license='CC BY-NC 4.0', attribution=None)
    data = licencias.build(video, profile, kit)
    voice = next(x for x in data['items'] if x['id'] == 'voz:narracion')
    assert (voice['proveedor'], voice['modelo'], voice['voz']) == ('proveedor', 'modelo', 'voz')
    assert any('no comercial' in x for x in data['summary']['motivos'])
    assert any('atribución incompleta' in x for x in data['summary']['motivos'])


def test_uso_ruta_absoluta_y_ambiguo(fixture):
    video, profile, kit = fixture
    record(profile, 'uno', license='CC0', file='original.jpg')
    original = profile / 'resources/images/uno/original.jpg'
    original.write_bytes(b'contenido')
    storyboard(video, [{'params': {'src': str(original)}}])
    data = licencias.build(video, profile, kit)
    assert any(x['id'] == 'uno' for x in data['items'])
    record(profile, 'dos', license='CC0', hash=licencias.sha(original))
    data = licencias.build(video, profile, kit)
    assert any('ficha ambigua' in x['condiciones'] for x in data['items'])


def test_apto_con_voz_documentada_y_sin_recursos_bloqueados(fixture):
    video, profile, kit = fixture
    (video / 'assets/song.mp3').write_bytes(b'voz')
    write(video / 'assets/config.json', {'design': 'test', 'audio': {'src': 'assets/song.mp3'}, 'storyboardUrl': 'assets/otro.json', 'narration': {'provider': 'ejemplo', 'model': 'm1', 'voice': 'v1', 'license': 'Licencia de uso documentada'}})
    write(video / 'assets/otro.json', {'beats': [{'use': 'common.punch', 'params': {'text': 'hola'}}]})
    data = licencias.build(video, profile, kit)
    assert data['summary']['apto_para_publicar']
    assert not data['summary']['motivos']
    assert next(x for x in data['items'] if x['id'] == 'voz:narracion')['estado_licencia'] == 'verificada'
