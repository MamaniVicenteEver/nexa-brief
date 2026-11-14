"""Carga la copia candidata; nunca modifica el módulo de backend activo."""
import importlib.util
import json
from pathlib import Path
import sys

import pytest

spec=importlib.util.spec_from_file_location('checks_credit_candidate',Path(__file__).with_name('checks.after.py'))
checks=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=checks
spec.loader.exec_module(checks)

LINE=('Música: Undaunted (90 s, montaje v2) — Kevin MacLeod — CC BY 4.0; '
      'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Undaunted.mp3; '
      'https://creativecommons.org/licenses/by/4.0/; recortada y con fundidos.')


def missing_pinned(tmp_path,monkeypatch,pinned,credits):
    from tests.unit.test_publishing_package import PACKAGE
    from src.core.explainer.publishing.package import PublishPackage
    from src.core.explainer.publishing.strategies import active_strategies
    package=json.loads(json.dumps(PACKAGE))
    package['pinned_comment']=pinned
    package['credits']=credits
    monkeypatch.setattr(checks,'_video_numbers',lambda _: {'37','48'})
    issues=checks.check_package(PublishPackage.model_validate(package),active_strategies('node_tech'),tmp_path,400)
    return [issue.message for issue in issues if issue.field=='pinned_comment' and 'cifras que el video no dice' in issue.message]


def test_canonical_music_metadata_is_not_a_spoken_claim(tmp_path,monkeypatch):
    pinned='Dato extra: el plazo fue de 48 horas.\n'+LINE+'\n¿Quién decidió? ¿Qué otro mapa quieres ver?'
    assert missing_pinned(tmp_path,monkeypatch,pinned,[LINE])==[]


@pytest.mark.parametrize('pinned',[
    'Dato extra: hubo 999999 decisiones.\n'+LINE+'\n¿Quién decidió? ¿Qué otro mapa quieres ver?',
    'Dato extra: el plazo fue de 48 horas.\n'+LINE+'\n¿Hubo 999999 decisiones? ¿Qué otro mapa quieres ver?',
])
def test_false_fact_or_question_number_stays_blocked(tmp_path,monkeypatch,pinned):
    assert '999999' in ''.join(missing_pinned(tmp_path,monkeypatch,pinned,[LINE]))


@pytest.mark.parametrize('line,credits',[
    ('Música: hubo 999999 decisiones.',['Música: hubo 999999 decisiones.']),
    (LINE.replace('Undaunted (90 s, montaje v2)','999999'),[]),
])
def test_music_prefix_without_canonical_structured_credit_is_not_exempt(tmp_path,monkeypatch,line,credits):
    pinned='Dato extra: el plazo fue de 48 horas.\n'+line+'\n¿Quién decidió? ¿Qué otro mapa quieres ver?'
    assert '999999' in ''.join(missing_pinned(tmp_path,monkeypatch,pinned,credits))


def test_urls_are_not_claims_but_adjacent_numbers_remain():
    from src.core.explainer.publishing.numbers import digit_numbers
    for field in ('titles.youtube.A','thumbnail.text_only','pinned_comment'):
        text=checks._promised_factual_text(field,'999999 visitas. https://example.test/archive/987654',[])
        assert digit_numbers(text)=={'999999'}
