from types import SimpleNamespace
from copy import deepcopy

from src.core.explainer.editions.attribution import youtube_description, description_issues, publication_view
from src.core.explainer.editions.io import write
from src.core.explainer.editions.packaging import approve, approved, approval_token, prepare_package
from src.core.explainer.editions.studio import review_issues


def package():
    return {
        'schema_version': 2, 'category': 'node_tech',
        'thumbnail': {'text_only': {'lines':['TEXT'], 'highlight':'TEXT', 'pair_title':'A'},
                      'with_image': {'text':'PHOTO', 'image':'photo.jpg', 'composition':'', 'pair_title':'B'},
                      'tabloid': {'text':'IMPACT', 'image':'photo.jpg'}, 'chosen':'text_only'},
        'titles': {'youtube':[{'option':'A', 'text':'Title', 'strategy':1, 'emotion':'curiosity'}],
                   'chosen':'A', 'facebook':{'title':'Title','first_line':'First'}, 'tiktok':{'caption':'Cap'}},
        'description': {'hook':'Hook','context':'','chapters':[],'reflection':'','question':''},
        'sources':['Source — https://example.com/source'],
        'credits':['Photo — CC BY-SA — https://example.com/license'],
        'tags':{'youtube':[], 'youtube_hashtags':[], 'facebook':[], 'tiktok':[]}, 'pinned_comment':''}


def test_credits_and_sources_are_appended_once_and_keep_exact_text():
    from src.core.explainer.publishing.package import PublishPackage
    p = PublishPackage.model_validate(package())
    base = 'Native description\n\n' + p.sources[0]
    result = youtube_description(base, p, 'en-US')
    assert result.count(p.sources[0]) == 1
    assert result.count(p.credits[0]) == 1 and '\nCREDITS\n' in result
    assert youtube_description(result, p, 'en-US') == result
    assert 'CRÉDITOS' in youtube_description('Texto', p, 'pt-BR')
    original = {'youtube': {'description': base}}
    assert p.credits[0] in publication_view(original, p, 'en-US')['youtube']['description']
    assert original['youtube']['description'] == base


def test_youtube_limit_is_bytes_and_no_silent_truncation():
    assert not description_issues('a' * 5000)
    assert description_issues('á' * 2501)
    assert description_issues('photo <caption>')


def test_prepare_keeps_original_attribution(tmp_path, monkeypatch):
    root = tmp_path / 'production'; root.mkdir()
    write(root / 'publish.json', package())
    folder = tmp_path / 'rev'; write(folder / 'edition.json', {})
    m = lambda row: SimpleNamespace(model_dump=lambda: row)
    output = SimpleNamespace(text_only=m(package()['thumbnail']['text_only']),
        with_image=m({'text':'PHOTO','pair_title':'B'}), tabloid=m({'text':'IMPACT'}),
        chosen_thumbnail='text_only', kicker='', titles=[m(package()['titles']['youtube'][0])], chosen_title='A')
    pub = {'youtube': {'description':'New','tags':[], 'pinned':''}, 'facebook':{'title':'T','description':'D'},
           'tiktok':{'caption':'C', 'hashtags':[]}}
    monkeypatch.setattr('src.core.explainer.editions.packaging.opening_specs', lambda *a: {'A':{},'B':{},'C':{}})
    monkeypatch.setattr('src.core.explainer.editions.packaging.apply_package', lambda *a: None)
    result = prepare_package(SimpleNamespace(path=root, design='rough'), folder, output, pub)
    assert result.sources == package()['sources'] and result.credits == package()['credits']


def test_review_blocks_lost_attribution_and_excess_description(tmp_path):
    root = tmp_path / 'production'; root.mkdir(); write(root / 'publish.json', package())
    folder = tmp_path / 'rev'; folder.mkdir()
    partial = deepcopy(package()); partial['credits'] = []
    write(folder / 'publication.json', partial)
    write(folder / 'edition.json', {'locale':'en-US'})
    write(folder / 'publish.json', {'youtube': {'description': 'á' * 2501}})
    for name in ('script.json','config.json','storyboard.json','lyrics.json'):
        write(folder / name, {})
    (folder / 'song-with-outro.mp3').write_bytes(b'audio')
    approve(folder, note='Test')
    fields = {x['field'] for x in review_issues(root, folder)}
    assert fields == {'credits', 'youtube_description'}
    write(folder / 'publication.json', package())
    assert not approved(folder), 'Adding attribution invalidates earlier approval'


def test_approval_binds_derived_description(tmp_path, monkeypatch):
    folder=tmp_path
    write(folder / 'publication.json', package())
    write(folder / 'edition.json', {'locale':'en-US'})
    write(folder / 'publish.json', {'youtube': {'description':'Hello'}})
    for name in ('script.json','config.json','storyboard.json','lyrics.json'): write(folder / name, {})
    (folder / 'song-with-outro.mp3').write_bytes(b'audio')
    import src.core.explainer.editions.attribution as a
    original=a.youtube_description
    monkeypatch.setattr(a, 'youtube_description', lambda description, package, locale: description)
    old_token=approval_token(folder)
    from src.core.explainer.editions.packaging import _approval_token
    _approval_token.cache_clear()
    monkeypatch.setattr(a, 'youtube_description', original)
    assert approval_token(folder) != old_token


def test_recorder_uses_the_same_attribution_shown_in_studio(tmp_path, monkeypatch):
    from src.core.explainer.editions.packaging import resolve_video
    from src.core.explainer.recorder import _copy_for
    root = tmp_path / 'production'; root.mkdir()
    folder = root / 'rev-001'; folder.mkdir()
    write(folder / 'publication.json', package())
    write(folder / 'publish.json', {'youtube': {'title':'Title', 'description':'Native', 'tags':[]}})
    write(folder / 'edition.json', {'locale':'en-US', 'revision':'rev-001', 'production_id':'web', 'source_revision':'source'})
    write(folder / 'lyrics.json', {'metadata': {'duration': 60}})
    monkeypatch.setattr('src.core.explainer.editions.packaging.active_revision', lambda *_: folder)
    monkeypatch.setattr('src.core.explainer.editions.packaging._source_revision', lambda *_: 'source')
    monkeypatch.setattr('src.core.explainer.editions.io.profile_for', lambda *_: None)
    monkeypatch.setattr('src.core.explainer.editions.packaging.replace', lambda _, **fields: SimpleNamespace(**fields))
    result = resolve_video(SimpleNamespace(path=root, video_id='web'), 'en-US', 'rev-001')
    title, description, _ = _copy_for(result, 'youtube')
    assert title == 'Title'
    assert package()['sources'][0] in description
    assert package()['credits'][0] in description


def test_translated_attribution_not_duplicated_and_missing_author_is_not_counted(tmp_path):
    from src.core.explainer.editions.attribution import represented
    source = 'Mujer con teléfono — Shixart1985 — CC BY 2.0 — https://example.org/photo.jpg'
    translated = 'Woman on phone — Shixart1985 — CC BY 2.0 — https://example.org/photo.jpg'
    assert represented(source, translated, credit=True)
    assert not represented(source, 'Woman on phone — CC BY 2.0 — https://example.org/photo.jpg', credit=True)
    assert not represented(source, 'Woman on phone — Shixart1985 — CC BY 4.0 — https://example.org/photo.jpg', credit=True)
    no_url = 'Chat — ilustración conceptual generada con OpenAI; no es una fotografía real.'
    assert represented(no_url, 'IMAGE AND MUSIC CREDITS\nChat — conceptual illustration generated with OpenAI.', credit=True)
    assert not represented(no_url, 'OpenAI produced the video.', credit=True)


def test_original_catalog_composes_without_mutating_source_and_blocks_oversize(tmp_path, monkeypatch):
    from src.core.explainer.catalog import load_video
    from src.core.explainer.recorder import _copy_for
    root = tmp_path / 'demo'; root.mkdir()
    raw = package(); raw['youtube_title'] = 'Original title'; raw['youtube_description'] = 'Original description'
    write(root / 'publish.json', raw)
    write(root / 'manifest.json', {'title':'Demo','status':'listo','design':'rough'})
    monkeypatch.setattr('src.core.explainer.catalog.narrative.recorded', lambda _: SimpleNamespace(narrative_id=None, label=None))
    monkeypatch.setattr('src.core.explainer.catalog.preview_directory', lambda _: root)
    monkeypatch.setattr('src.core.explainer.catalog.explainer_folders', lambda: {})
    monkeypatch.setattr('src.core.explainer.catalog.category_for_design', lambda _: 'node_tech')
    monkeypatch.setattr('src.core.explainer.design_options.resolve_design_options', lambda *_: {'preview_mode':'desktop', 'youtube_category_id':None})
    before=(root / 'publish.json').read_bytes()
    monkeypatch.setattr('src.core.explainer.publishing.service.review', lambda _: None)
    video=load_video(root)
    assert package()['sources'][0] in video.youtube_description and package()['credits'][0] in video.youtube_description
    assert _copy_for(video, 'youtube')[1] == video.youtube_description
    assert (root / 'publish.json').read_bytes() == before and video.publish_ready
    raw['youtube_description']='á' * 2501
    write(root / 'publish.json', raw)
    assert not load_video(root).publish_ready


def test_original_package_errors_block_publication_not_recording(tmp_path, monkeypatch):
    from src.core.explainer.catalog import ExplainerVideo
    video = ExplainerVideo(video_id='id', path=tmp_path, design='rough', category_path='node_tech', title='Title',
                           status='listo', duration_seconds=100, youtube_title='Title')
    monkeypatch.setattr('src.core.explainer.publishing.service.review', lambda _: SimpleNamespace(errors=['missing thumbnail']))
    assert video.ready and not video.publish_ready
    monkeypatch.setattr('src.core.explainer.publishing.service.review', lambda _: SimpleNamespace(errors=[]))
    assert video.publish_ready
