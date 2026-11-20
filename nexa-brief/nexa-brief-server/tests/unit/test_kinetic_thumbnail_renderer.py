"""Composición tipográfica de Kinetic sin navegador ni servicios externos."""
import json
from pathlib import Path
import shutil
import subprocess
import xml.etree.ElementTree as ET
import pytest

RENDERER = Path(__file__).resolve().parents[2] / 'src/core/draft_thumbnail_renderer.js'
NODE = shutil.which('node')


def render(title, option):
    script = '''const r=require(process.argv[1]); const title=process.argv[2], key=process.argv[3];
    const d={style:"promo-kinetic",maxWords:5,palette:{background:"#1C1C1D",foreground:"#BDBDB8",accent:"#A23A12"},typography:{display:"Montserrat",weight:900}};
    const x={text:title,design:d}; console.log(r.renderSvg({options:{A:x,B:x}},key,320,180,{}));'''
    return subprocess.check_output([NODE, '-e', script, str(RENDERER), title, option], text=True)


@pytest.mark.skipif(not NODE, reason='node no disponible')
@pytest.mark.parametrize('title', ['PRIMOS INFINITOS', 'NÚMEROS PRIMOS CONSTRUYEN GRANDES CIFRAS'])
def test_kinetic_a_title_is_one_or_two_complete_rows(title):
    root = ET.fromstring(render(title, 'A'))
    group = next(node for node in root.iter() if node.get('data-role') == 'title')
    rows = [node.text for node in group if node.tag.endswith('text')]
    assert 1 <= len(rows) <= 2
    assert ' '.join(rows) == title
    assert len([node for node in root.iter() if node.get('data-role') == 'title']) == 1


@pytest.mark.skipif(not NODE, reason='node no disponible')
def test_kinetic_b_still_uses_typographic_parenthesis():
    svg = render('PRIMOS INFINITOS', 'B')
    root = ET.fromstring(svg)
    assert any(node.get('data-role') == 'title' for node in root.iter())
    assert len([node for node in root.iter() if node.tag.endswith('path')]) >= 8
