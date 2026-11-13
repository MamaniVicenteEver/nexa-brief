from copy import deepcopy
import pytest
from src.core.promos.credits import apply_credits


def details(text='Texto editorial'):
    return {'copies': {p: {'title': 'Título', 'description': text, 'tags': ['tag']} for p in ('youtube', 'facebook', 'instagram', 'tiktok')}, 'research': 'investigación'}


def resource(**override):
    return {'type':'image', 'author':'Ana', 'license':'CC BY 4.0', 'source_url':'https://example.org/photo',
            'license_url':'https://example.org/license', 'attribution':'Foto por Ana · CC BY 4.0', **override}


def test_complete_credits_are_idempotent_and_replace_previous_generated_block():
    original = details()
    edited = apply_credits(original, [resource(), resource()])
    assert original['copies']['youtube']['description'] == 'Texto editorial'
    for item in edited['copies'].values():
        text = item['description']
        assert text.count('https://example.org/photo') == 1 and 'https://example.org/license' in text
        assert 'Ana' in text and 'CC BY 4.0' in text
    assert apply_credits(edited, [resource()]) == edited
    changed = apply_credits(edited, [resource(source_url='https://example.org/new')])
    assert 'https://example.org/photo' not in changed['copies']['youtube']['description']
    assert changed['research'] == 'investigación' and changed['copies']['youtube']['tags'] == ['tag']


def test_existing_complete_credits_and_transformations():
    text = 'Contexto\nAna CC BY 4.0 https://example.org/photo https://example.org/license'
    assert apply_credits(details(text), [resource()])['copies']['youtube']['description'] == text
    photo_video = resource(type='video', derived_from='img', focus=[.5,.5])
    track = resource(type='music', source_url='https://example.org/music', attribution='Ana · CC BY 4.0')
    result = apply_credits(details(), [photo_video, track], music_edited=True)
    assert 'imagen animada y recortada' in result['copies']['youtube']['description']
    assert 'música recortada con fundido final' in result['copies']['tiktok']['description']


def test_rejects_missing_provenance_and_overflow_without_partial_changes():
    original = details('x'*1990)
    before = deepcopy(original)
    with pytest.raises(ValueError, match='límite'):
        apply_credits(original, [resource()])
    assert original == before
    with pytest.raises(ValueError, match='Faltan autor'):
        apply_credits(details(), [resource(author='')])
    with pytest.raises(ValueError, match='incompleto'):
        apply_credits(details('Texto\n\nCréditos de medios:\nAlgo'), [resource()])


def test_editorial_whitespace_and_shared_licenses_preserved():
    source = details('  Texto editorial  \n')
    other = resource(source_url='https://example.org/other')
    first = apply_credits(source, [resource(), other])
    description = first['copies']['youtube']['description']
    assert description.startswith('  Texto editorial  \n')
    assert description.count('https://example.org/license') == 1
    assert apply_credits(first, [resource(), other]) == first
