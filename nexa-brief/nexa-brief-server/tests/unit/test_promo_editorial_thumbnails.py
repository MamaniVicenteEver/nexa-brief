"""Contrato de la primera promo: dos titulares cortos y el medio original."""
import json
from pathlib import Path

from src.core import draft_thumbnails as thumbs, draft_thumbnail_assets as assets
from src.core.draft_details import DraftDetails
from src.core.job import Job, JobArtifacts, JobInput

ROOT = Path(__file__).resolve().parents[2] / 'src/templates/nodemotion/commercial/promo-editorial'


def editorial_job():
    return Job(input=JobInput(category_name='promo-editorial'), artifacts=JobArtifacts(
        output_dir=ROOT, config_json_path=ROOT/'assets/config.json',
    ))


def test_editorial_defaults_follow_actual_promo_and_do_not_use_the_music_title():
    manifest = thumbs.preview_manifest(editorial_job(), DraftDetails(song_name='Nombre del audio'))
    for option in ('A', 'B'):
        item = manifest['options'][option]
        assert item['text'] == 'Gran Final'
        d = item['design']
        assert d['style'] == 'promo-editorial' and d['subtitle'] == ''
        assert (d['palette']['background'], d['palette']['foreground'], d['palette']['accent']) == ('#ECECEA', '#050505', '#FBFBFB')
        assert (d['typography']['display'], d['typography']['weight']) == ('Archivo', 900)
        assert d['background']['sourceKind'] == 'video'
        assert d['background']['overlay'] == .2
    assert manifest['options']['B']['design']['maxWords'] == 2


def test_editorial_b_never_exceeds_a_and_keeps_independent_background():
    manifest = thumbs.preview_manifest(editorial_job(), DraftDetails(), options={
        'A': {'text':'La final', 'design':{}},
        'B': {'text':'El momento de ser campeones', 'design':{'styleVersion':5,'background':{'time':4,'x':1}}},
    })
    assert manifest['options']['B']['text'] == 'El momento'
    assert manifest['options']['B']['design']['maxWords'] == 2
    assert manifest['options']['B']['design']['background']['time'] == 4
    assert manifest['options']['B']['design']['background']['x'] == 1
    assert manifest['options']['A']['design']['background']['time'] == 12


def test_editorial_retains_original_video_as_alternative_to_user_image(tmp_path):
    job = editorial_job()
    image = tmp_path/'custom.jpg'
    image.write_bytes(b'image')
    job.artifacts.image_path = image
    assert assets.background_source(job) == image
    from src.config.template_manifest import resolve_template_content
    from src.core.nodemotion.shared.bundled import demo_aliases
    from src.core.nodemotion.shared.resources import digest
    logical = ROOT / 'assets/media/stadium.mp4'
    expected = resolve_template_content(logical)
    actual = assets.background_source(job, 'video')
    assert isinstance(expected, Path) and actual == expected
    key = demo_aliases('promo-editorial').get('assets/media/stadium.mp4')
    assert digest(actual) == (key[:64] if key else digest(logical))


def test_editorial_renderer_keeps_copy_short_and_never_adds_lyrics_labels():
    import subprocess
    import xml.etree.ElementTree as ET
    manifest = thumbs.preview_manifest(editorial_job(), DraftDetails())
    manifest['options']['B']['text'] = 'Gran Final palabras que sobran'
    script = "const fs=require('fs'),vm=require('vm');const c={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),c);const m=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(['A','B'].map(k=>c.module.exports.renderSvg(m,k))));"
    result = subprocess.run(['node','-e',script,str(thumbs.RENDERER_PATH)],input=json.dumps(manifest),text=True,capture_output=True,check=True,timeout=10)
    for svg in json.loads(result.stdout):
        root = ET.fromstring(svg)
        texts = [node for node in root.iter() if node.tag.endswith('text')]
        title = next(node for node in texts if node.attrib.get('data-role') == 'title')
        assert len(' '.join(title.itertext()).split()) <= 2
        assert len(list(title)) <= 2
        assert [node.attrib.get('data-role') for node in texts] == ['title', 'brand']
        assert not any(node.tag.endswith('script') for node in root.iter())
