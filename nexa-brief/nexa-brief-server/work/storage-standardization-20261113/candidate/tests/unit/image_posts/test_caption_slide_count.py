import pytest

from src.core.image_posts.service import _caption_factual_text, _number_values


@pytest.mark.parametrize('actual,advertised,expected', [(6,6,set()),(8,8,set()),(6,7,{'7'}),(None,6,{'6'})])
def test_slide_count_metadata_is_only_exempt_when_it_matches_the_real_plan(actual,advertised,expected):
    text=f'Desliza las {advertised} láminas y revisa el contexto y las fuentes de cada dato.'
    assert _number_values(_caption_factual_text(text,slide_count=actual))==expected


def test_removing_slide_metadata_does_not_exempt_story_numbers():
    caption='Amazon recortó 250 puestos.\n\nDesliza las 6 láminas y revisa el contexto y las fuentes de cada dato.\n\nEn 1954 ocurrió otro hecho.'
    assert _number_values(_caption_factual_text(caption,slide_count=6))=={'250','1954'}


def test_a_modified_metadata_line_still_requires_factual_evidence():
    caption='Desliza las 6 láminas y revisa el contexto y las fuentes de cada dato. Hubo 999 despidos.'
    assert _number_values(_caption_factual_text(caption,slide_count=6))=={'6','999'}
