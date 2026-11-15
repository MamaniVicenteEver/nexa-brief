"""Fuentes, paletas y medios reales de las plantillas restantes de letras."""
import json
from pathlib import Path

import pytest

from src.core import draft_thumbnail_assets as assets, draft_thumbnails as thumbnails
from src.core.job import Job, JobArtifacts, JobInput

ROOT = Path(__file__).resolve().parents[2] / 'src/templates/nodemotion/lyrics'
CASES = [
    ('lyrics-stylish-kinetic', 'Lilita One', 400, 'normal', '#E31D40', '#FFFFFF', '#F3C10A', None),
    ('lyrics-caution', 'Anton', 400, 'normal', '#000000', '#FFFFFF', '#C80202', None),
    ('lyrics-night-journey', 'Noto Serif Display', 800, 'normal', '#0B2B4F', '#FFF3DC', '#F0955A', 'video'),
    ('lyrics-lluvia-gris', 'Cormorant Garamond', 500, 'italic', '#0B0F12', '#DCE2E6', '#DCE2E6', 'video'),
    ('lyrics-memoria', 'Special Elite', 400, 'normal', '#1A1410', '#EADFC8', '#B9877A', 'video'),
    ('lyrics-ceniza', 'Playfair Display', 700, 'normal', '#0E0C0B', '#E6E1DA', '#E07A48', 'video'),
    ('lyrics-vacio', 'Big Shoulders Display', 800, 'normal', '#08090A', '#ECEDEE', '#ECEDEE', 'video'),
    ('lyrics-latido', 'Cormorant Garamond', 700, 'italic', '#080205', '#FFD9DE', '#FFD9DE', None),
    ('lyrics-suave', 'Anton', 400, 'normal', '#0A0A0B', '#EFEFF0', '#EFEFF0', 'image'),
    ('lyrics-triste', 'Oswald', 700, 'normal', '#07090C', '#C9D6E2', '#C9D6E2', 'image'),
    ('lyrics-resaltado', 'Lora', 700, 'normal', '#F1E6C8', '#241A0E', '#241A0E', None),
    ('lyrics-cristal', 'Big Shoulders Display', 900, 'normal', '#07040F', '#FFFFFF', '#35E0FF', 'video'),
    ('lyrics-mirada', 'Fredoka', 700, 'normal', '#0A0807', '#EDE2CF', '#EDE2CF', 'video'),
    ('lyrics-amor-impredecible', 'Bodoni Moda', 800, 'normal', '#010101', '#FFFDF8', '#FFFDF8', None),
]


@pytest.mark.parametrize('tid,family,weight,slant,bg,fg,sub,kind', CASES)
def test_original_style_and_media_for_both_options(tid, family, weight, slant, bg, fg, sub, kind):
    root = ROOT / tid
    config_path = root / 'assets/config.json'
    config = json.loads(config_path.read_text())
    designs = thumbnails._build_designs(tid, config)
    for d in designs.values():
        t, p = d['typography'], d['palette']
        assert (t['display'], t['weight'], t['slant']) == (family, weight, slant)
        assert t['font'] and assets.font_path(t['font']['url'].rsplit('/', 1)[-1]).is_file()
        assert (p['background'], p['foreground'], p['subtitle']) == (bg, fg, sub)
        assert d['background']['overlay'] == .2
        assert d['subtitle'] == 'LETRAS'
    job = Job(input=JobInput(category_name=tid), artifacts=JobArtifacts(output_dir=root, config_json_path=config_path))
    assert assets.background_kind(job) == (kind or 'none')
    if tid == 'lyrics-lluvia-gris':
        from src.config.template_manifest import resolve_template_content
        from src.core.nodemotion.shared.bundled import demo_aliases
        from src.core.nodemotion.shared.resources import digest
        logical = root / 'assets/media/street-rain.mp4'
        expected = resolve_template_content(logical)
        actual = assets.background_source(job)
        assert isinstance(expected, Path) and actual == expected
        key = demo_aliases(tid).get('assets/media/street-rain.mp4')
        assert digest(actual) == (key[:64] if key else digest(logical))


def test_nested_palettes_follow_active_config():
    config = {'palette': {'order': ['mint'], 'schemes': {'mint': {'bg': '#85E5D3', 'ink': '#FFFFFF', 'accent': '#E31D40'}}}}
    palette = thumbnails._build_designs('lyrics-stylish-kinetic', config)['A']['palette']
    assert (palette['background'], palette['foreground'], palette['subtitle']) == ('#85E5D3', '#FFFFFF', '#E31D40')
    config = {'scenes': [{'type':'path', 'palette': {'night':'#123456', 'textTop':'#ABCDEF', 'textBottom':'#FEDCBA'}}]}
    palette = thumbnails._build_designs('lyrics-night-journey', config)['B']['palette']
    assert (palette['background'], palette['foreground'], palette['subtitle']) == ('#123456', '#ABCDEF', '#FEDCBA')
