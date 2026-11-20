"""TITANES documentary media, supports and anti-slide guardrails."""
from pathlib import Path
import sys

import pytest

TOOLS = Path(__file__).resolve().parents[2] / 'src/templates/_tools/explainer-kit/tools'
sys.path.insert(0, str(TOOLS))
import media_relevance
import style_media_policy
import visual_support
import check_storyboard

CONFIG = {'design': 'titanes', 'quality_policy_version': 5}
CATALOG = {
    'titanes.introv1': {'params': {'figura': {'type': 'image'}, 'src': {'type': 'string'}}},
    'titanes.introv2': {'params': {'figura': {'type': 'image'}, 'src': {'type': 'string'}}},
    'titanes.foto': {'params': {'src': {'type': 'string'}}},
    'common.capas': {'params': {'figura': {'type': 'image'}}},
}


def beat(i, use, start=0, duration=4, **params):
    return {'i': i, 'use': use, 'layer': 'main', 't0': start, 't1': start + duration,
            'b': {'params': params}}


def test_real_media_is_scoped_and_reviews_are_required(tmp_path):
    beats = [beat(0, 'titanes.foto', src='photo.jpg', figura='illustration.png'),
             beat(1, 'titanes.introv1', 4, src='intro.jpg', figura='illustration.png'),
             beat(2, 'titanes.introv2', 8, src='intro2.jpg'),
             beat(3, 'titanes.introv1', 12, figura='illustration.png'),
             beat(4, 'common.capas', 16, figura='illustration.png')]
    errors, warnings = [], []
    entries, report = media_relevance.check(tmp_path, {'design': 'titanes'}, beats, CATALOG, errors, warnings)
    assert [x['source'] for x in entries] == ['photo.jpg', 'intro.jpg', 'intro2.jpg']
    assert report['required'] and report['media_beats'] == 3
    assert sum('falta shows' in x for x in errors) == 3
    assert sum('falta query' in x for x in errors) == 3
    assert sum('falta media_review' in x for x in errors) == 3
    for b in beats[:3]:
        b['b'].update(shows='sujeto real', query='consulta concreta', media_review='Revisión visual pertinente')
    errors = []
    _, report = media_relevance.check(tmp_path, CONFIG, beats, CATALOG, errors, [])
    assert not errors and report['reviewed'] == 3


@pytest.mark.parametrize('duration,valid', [(3.9, False), (4, True), (10, True), (10.1, False)])
def test_photo_duration_boundaries(duration, valid):
    errors = []
    report = style_media_policy.check(CONFIG, [beat(0, 'titanes.foto', duration=duration, src='a.jpg')], CATALOG, [], 30, errors)
    assert bool(errors) != valid
    assert report['media'][0]['duration'] == duration


def test_duration_is_interrupted_by_next_main_and_outro():
    errors = []
    beats = [beat(0, 'titanes.introv2', duration=10, src='a.jpg'), beat(1, 'common.capas', 3)]
    report = style_media_policy.check(CONFIG, beats, CATALOG, [], 30, errors)
    assert report['media'][0]['duration'] == 3 and any('3.00s' in x for x in errors)
    errors = []
    report = style_media_policy.check({**CONFIG, 'outro': {'start': 2}}, beats[:1], CATALOG, [], 30, errors)
    assert report['media'][0]['duration'] == 2 and errors


def test_video_is_not_counted_as_photo():
    errors = []
    report = style_media_policy.check(CONFIG, [beat(0, 'titanes.foto', duration=8, src='a.mp4')], CATALOG, [], 30, errors)
    assert report['media'][0]['kind'] == 'video' and not errors


def test_supports_by_third_and_reuse():
    beats = [beat(0, 'titanes.foto', 0, src='dir/a.jpg'),
             beat(1, 'common.capas', 30), beat(2, 'titanes.plantilla', 60, figura='person.png'),
             beat(3, 'titanes.introv1', 70, src='dir/./a.jpg'),
             beat(4, 'titanes.introv2', 80, src='dir/a.jpg')]
    errors = []
    result = visual_support.check(CONFIG, beats, CATALOG, 90, {}, errors, [])
    assert result['preferred_thirds'] == [True, True, True]
    assert any('3 usos' in x for x in errors)
    assert result['assets'] == 1
    errors = []
    beats[2]['b']['params'].pop('figura')
    result = visual_support.check(CONFIG, beats[:3], CATALOG, 90, {}, errors, [])
    assert result['preferred_thirds'] == [True, True, False]
    assert any('tercio 3' in x for x in errors)


def test_text_only_threshold_streak_and_documentary_exemptions():
    def card(i, use='titanes.titular', **params): return beat(i, use, i * 4, **params)
    beats = [card(i, 'common.capas') for i in range(25)]
    beats[2] = card(2, variante='titular')
    beats[8] = card(8, 'titanes.duelo', lados=[{'nombre': 'A'}, {'nombre': 'B'}])
    beats[14] = card(14, 'titanes.introv1')
    beats[18] = card(18, variante='documento')
    beats[19] = card(19, variante='cita')
    beats[20] = card(20, 'titanes.duelo', lados=[{'metrica': 0}])
    beats[21] = card(21, 'titanes.introv1', figura='person.png')
    beats[22] = card(22, 'titanes.introv1', src='photo.jpg')
    errors = []
    result = visual_support.check(CONFIG, beats, CATALOG, 100, {}, errors, [])
    assert result['text_only_beats'] == 3 and not any('solo texto' in x for x in errors)
    beats[3] = card(3)
    beats[4] = card(4)
    errors = []
    visual_support.check(CONFIG, beats, CATALOG, 100, {}, errors, [])
    assert any('máximo 12%' in x for x in errors)
    assert any('#2–#4' in x for x in errors)


def test_quality_uses_actual_photos_and_one_custom_component(tmp_path):
    component = tmp_path / 'assets/components/one.js'
    component.parent.mkdir(parents=True)
    component.write_text('K.register({name: "titanes.own"})')
    beats = [beat(0, 'titanes.introv1', src='a.jpg'), beat(1, 'titanes.own', 4),
             beat(2, 'common.capas', 160), beat(3, 'common.capas', 320)]
    errors = []
    result = check_storyboard.quality_check(tmp_path, CONFIG, {'target_minutes': 9}, beats, [], 540, errors, CATALOG, [])
    assert result['custom_components_used'] == 1 and result['media_per_min'] > 0
    assert not any('componentes propios usados' in x or 'tramos de video' in x for x in errors)
