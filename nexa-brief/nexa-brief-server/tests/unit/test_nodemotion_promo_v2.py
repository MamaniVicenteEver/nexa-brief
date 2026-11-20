"""Pruebas del guion y de la selección segura de medios."""
import importlib.util
from pathlib import Path

import numpy as np
import pytest

TOOLS = Path(__file__).resolve().parents[2] / 'src/templates/_tools/nodemotion/promo/tools'


def load(name):
    spec = importlib.util.spec_from_file_location('promo_v2_' + name, TOOLS / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_alignment_uses_attacks_and_bounds():
    timing = load('timing')
    attacks = np.zeros(901)
    attacks[::20] = 1
    boundaries = timing.align(attacks, 45, 90)
    assert len(boundaries) == 46
    assert boundaries[0] == 0 and boundaries[-1] == 90
    assert all(1.4 <= round(end - start, 2) <= 2.4 for start, end in zip(boundaries, boundaries[1:]))
    assert all(abs(point % 2) < .01 for point in boundaries)
    with pytest.raises(ValueError):
        timing.align(attacks, 1, 90)
    with pytest.raises(ValueError, match='pulsos'):
        timing.align(np.zeros(901), 45, 90)


def test_commons_rejects_conflicting_and_noncommercial_licenses():
    media = load('media')
    adapter = media.PromoCommonsAdapter()
    base = {'title': 'File:test.jpg', 'pageid': 123, 'imageinfo': [{
        'url': 'https://upload.wikimedia.org/test.jpg', 'width': 2000, 'height': 1800,
        'extmetadata': {'LicenseShortName': {'value': 'CC BY-SA 4.0'},
                        'Artist': {'value': 'Autor'}, 'LicenseUrl': {'value': 'https://creativecommons.org/licenses/by-sa/4.0/'},
                        'ImageDescription': {'value': 'No se puede utilizar en materiales comerciales.'}}}]}
    assert adapter._item_from_page(base) is None
    base['imageinfo'][0]['extmetadata']['LicenseShortName']['value'] = 'CC BY-NC 4.0'
    assert adapter._item_from_page(base) is None
