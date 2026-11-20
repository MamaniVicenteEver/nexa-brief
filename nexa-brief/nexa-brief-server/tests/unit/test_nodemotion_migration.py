import json
import pytest
from src.core.nodemotion.shared import migration


def make_project(tmp_path, prefix='assets'):
    root = tmp_path / 'project'
    content = root / prefix
    content.mkdir(parents=True)
    base = '<base href="assets/">' if prefix else ''
    (root / 'index.html').write_text(f'<html><head>{base}</head><body></body></html>')
    (content / 'config.json').write_text(json.dumps({'media':'media/in-use.mp4'}))
    (content / 'lyrics.json').write_text('{}')
    (content / 'song.mp3').write_bytes(b'audio')
    (content / 'media').mkdir()
    (content / 'media/in-use.mp4').write_bytes(b'video')
    (content / 'media/unused.mp4').write_bytes(b'output')
    (content / 'components').mkdir()
    (content / 'components/a.js').write_bytes(b'code')
    return root


def test_inventory_preserves_dynamic_media_and_exact_html(tmp_path):
    root = make_project(tmp_path)
    html, prefix, code, media = migration._inventory(root)
    assert prefix == 'assets'
    assert html == b'<html><head></head><body></body></html>'
    assert set(media) == {'song.mp3', 'media/in-use.mp4', 'media/unused.mp4'}
    assert set(code) == {'components/a.js'}
    assert (root / 'assets/media/unused.mp4').exists()


def test_inventory_excludes_known_deliverables_without_removing_them(tmp_path):
    root = make_project(tmp_path)
    content = root / 'assets'
    (content / 'youtube_video-ig.mp4').write_bytes(b'render')
    (content / 'thumbnail.jpg').write_bytes(b'thumbnail')
    _, _, _, media = migration._inventory(root, exclude={(content / 'media/unused.mp4').resolve()})
    assert set(media) == {'song.mp3', 'media/in-use.mp4'}
    assert (content / 'youtube_video-ig.mp4').read_bytes() == b'render'
    assert (content / 'thumbnail.jpg').is_file()
    assert (content / 'media/unused.mp4').is_file()


def test_inventory_decodes_percent_encoded_media_and_keeps_fonts(tmp_path):
    root = make_project(tmp_path)
    content = root / 'assets'
    (content / 'media/in-use.mp4').rename(content / 'media/in use.mp4')
    (content / 'config.json').write_text('{"media":"media/in%20use.mp4"}')
    (content / 'type.woff2').write_bytes(b'font')
    (content / 'mark.svg').write_bytes(b'<svg/>')
    _, _, code, media = migration._inventory(root)
    assert 'media/in use.mp4' in media
    assert {'type.woff2', 'mark.svg'} <= code.keys()


def test_inventory_rejects_symlink_and_unexpected_base(tmp_path):
    root = make_project(tmp_path)
    (root / 'assets/link').symlink_to(tmp_path, target_is_directory=True)
    with pytest.raises(ValueError, match='Symlink'):
        migration._inventory(root)
    (root / 'assets/link').unlink()
    (root / 'index.html').write_text('<head><base href="elsewhere/"></head>')
    with pytest.raises(ValueError, match='base'):
        migration._inventory(root)


def test_inventory_supports_legacy_root_content(tmp_path):
    root = make_project(tmp_path, '')
    html, prefix, code, media = migration._inventory(root)
    assert prefix == ''
    assert html == (root / 'index.html').read_bytes()
    assert set(media) == {'song.mp3', 'media/in-use.mp4', 'media/unused.mp4'}


def test_apply_verifies_then_publishes_and_is_idempotent(tmp_path, monkeypatch):
    import asyncio
    from types import SimpleNamespace
    from src.config.settings import settings
    from src.core.nodemotion.shared import execution
    from src.adapters.data import section_store, json_store
    assert json_store.Section

    profile = tmp_path / 'profile'
    production = profile / 'productions/nodemotion'
    production.mkdir(parents=True)
    root = make_project(production)
    content = root / 'assets'
    (content / 'media/unused.mp4').unlink()
    row = {'draft_id': 'one', 'template_id': 'promo-test'}
    job = {'artifacts': {'output_dir': str(root), 'music_asset_id': 'audio'}}
    monkeypatch.setattr(settings, 'storage_profile_dir', profile)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    monkeypatch.setattr(migration, 'collection', lambda name: SimpleNamespace(list=lambda: [row]))
    monkeypatch.setattr(migration, 'documents', lambda name: SimpleNamespace(get=lambda key: job))
    monkeypatch.setattr(section_store, 'Section', lambda name: SimpleNamespace(read=lambda: {'documents': {'draft_jobs': {'one': job}}}))
    monkeypatch.setattr(migration, 'registered', lambda design: True)
    monkeypatch.setattr(execution, 'registered', lambda design: True)
    monkeypatch.setattr(execution, 'available_revision', lambda design, revision: True)
    monkeypatch.setattr(execution, 'engine_revision', lambda design: 'a' * 64)
    monkeypatch.setattr(migration, 'design_manifest', lambda design: {'family': 'promo'})
    monkeypatch.setattr(execution, 'design_manifest', lambda design, revision=None: {
        'family': 'promo', 'runtime_aliases': {'components/a.js': 'runtime/a.js'}, 'runtime_assets': []})
    html = b'<html><head></head><body></body></html>'
    monkeypatch.setattr(migration, 'archive_engine', lambda design, document, code: 'a' * 64)
    monkeypatch.setattr(migration, 'assemble', lambda design, revision=None: html)
    monkeypatch.setattr(execution, 'assemble', lambda design, revision=None: html)
    monkeypatch.setattr(migration, 'runtime_assets', lambda design, revision: {'components/a.js': content / 'components/a.js'})
    monkeypatch.setattr(execution, 'resolve_runtime_asset', lambda design, name, revision=None: content / name)
    sources = {'audio': content / 'song.mp3', 'video': content / 'media/in-use.mp4'}
    monkeypatch.setattr(execution, '_resolve_ref', lambda ref: sources[ref['asset_id']])
    index = {('music', migration.digest(sources['audio'])): 'audio',
             ('video', migration.digest(sources['video'])): 'video'}
    monkeypatch.setattr(migration, '_library_index', lambda: index)
    from src.core.nodemotion.promo import approval_compatibility
    monkeypatch.setattr(approval_compatibility, 'prepare_review_compatibility', lambda *args, **kwargs: None)
    report = asyncio.run(migration.migrate(profile))
    assert report['projects'][0]['status'] == 'planned'
    assert not (root / 'project.json').exists()
    wrong = tmp_path / 'wrong.js'
    wrong.write_bytes(b'wrong')
    monkeypatch.setattr(execution, 'resolve_runtime_asset', lambda design, name, revision=None: wrong)
    report = asyncio.run(migration.migrate(profile, apply=True))
    assert report['projects'][0]['status'] == 'needs-review'
    assert not (root / 'project.json').exists()
    assert (content / 'song.mp3').read_bytes() == b'audio'
    monkeypatch.setattr(execution, 'resolve_runtime_asset', lambda design, name, revision=None: content / name)
    report = asyncio.run(migration.migrate(profile, apply=True))
    assert report['projects'][0]['status'] == 'migrated', report
    assert (root / 'index.html').is_file()
    assert (content / 'song.mp3').is_file()
    assert execution.resolve_project(root, 'index.html') == (root / 'index.html').read_bytes()
    assert execution.resolve_project(root, 'assets/lyrics.json').read_bytes() == (content / 'lyrics.json').read_bytes()
    saved = (root / 'project.json').read_bytes()
    report = asyncio.run(migration.migrate(profile, apply=True))
    assert report['projects'][0]['status'] == 'already-migrated'
    assert (root / 'project.json').read_bytes() == saved

    import sys
    calls = []
    journal = tmp_path / 'journal.json'
    monkeypatch.setitem(sys.modules, 'src.core.nodemotion.shared.retirement', SimpleNamespace(
        journal_path=lambda profile, root: journal,
        retire_project=lambda profile, root, **kwargs: calls.append(kwargs) or {'state': 'planned'},
        resume_retirement=lambda profile, root, **kwargs: calls.append(kwargs) or {'state': 'resumed'},
    ))
    report = asyncio.run(migration.migrate(profile, retire_verified=True))
    assert report['projects'][0]['retirement']['state'] == 'planned'
    assert calls[-1]['apply'] is False
    journal.write_text('{}')
    monkeypatch.setattr(migration, '_inventory', lambda root: pytest.fail('resume must use its journal'))
    report = asyncio.run(migration.migrate(profile, apply=True, retire_verified=True))
    assert report['projects'][0]['retirement']['state'] == 'resumed'
    assert calls[-1]['apply'] is True


def test_reports_unmatched_productions_and_missing_job_output(tmp_path, monkeypatch):
    import asyncio
    from types import SimpleNamespace
    from src.config.settings import settings
    from src.adapters.data import section_store, json_store
    assert json_store.Section

    profile = tmp_path / 'profile'
    base = profile / 'productions/nodemotion'
    extra = base / 'lyrics/lyrics-test'
    extra.mkdir(parents=True)
    (extra / 'index.html').write_text('<html></html>')
    missing = base / 'missing-job'
    monkeypatch.setattr(settings, 'storage_profile_dir', profile)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    monkeypatch.setattr(migration, 'collection', lambda name: SimpleNamespace(list=lambda: (
        [{'job_id': 'job', 'output_dir': str(missing)}] if name == 'jobs' else [])))
    monkeypatch.setattr(section_store, 'Section', lambda name: SimpleNamespace(read=lambda: {'documents': {}}))
    monkeypatch.setattr(migration, '_library_index', lambda: {})
    report = asyncio.run(migration.migrate(profile))
    by_root = {row['root']: row for row in report['projects']}
    assert by_root[str(extra)]['status'] == 'needs-review'
    assert by_root[str(missing)]['job_ids'] == ['job']
    assert (extra / 'index.html').is_file()


def test_library_index_excludes_paths_outside_durable_resources(tmp_path, monkeypatch):
    from types import SimpleNamespace
    from src.config.settings import settings
    profile = tmp_path / 'profile'
    durable = profile / 'resources/music/song.mp3'
    durable.parent.mkdir(parents=True)
    durable.write_bytes(b'durable')
    transient = profile / 'productions/nodemotion/old/song.mp3'
    transient.parent.mkdir(parents=True)
    transient.write_bytes(b'transient')
    monkeypatch.setattr(settings, 'storage_profile_dir', profile)
    library = migration.asset_library
    monkeypatch.setattr(library, 'list_music', lambda: [SimpleNamespace(asset_id='durable'), SimpleNamespace(asset_id='old')])
    monkeypatch.setattr(library, 'list_images', lambda: [])
    monkeypatch.setattr(library, 'list_videos', lambda: [])
    monkeypatch.setattr(library, 'resolve_asset_entry_path', lambda kind, entry, *, from_collection: (
        {'durable': durable, 'old': transient}[entry.asset_id] if from_collection else pytest.fail('snapshot provenance lost')))
    index = migration._library_index()
    assert index == {('music', migration.digest(durable)): 'durable'}


def test_unrepresentable_referenced_static_dependency_requires_review(tmp_path):
    root = make_project(tmp_path)
    content = root / 'assets'
    (content / 'custom.wasm').write_bytes(b'wasm')
    (content / 'components/a.js').write_text('load("custom%2Ewasm")')
    html, _, code, _ = migration._inventory(root)
    assert migration._unsupported_runtime(content, html, code) == ['custom.wasm']


def test_register_real_new_resource_and_reuse_exact_hash(tmp_path, monkeypatch):
    import asyncio
    from src.config.settings import settings
    from src.core import data
    profile = tmp_path / 'profile'
    profile.mkdir()
    monkeypatch.setattr(settings, 'storage_profile_dir', profile)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    monkeypatch.setattr(settings, 'data_dir', profile / 'data')
    monkeypatch.setattr(data, '_store', None)
    source = tmp_path / 'legacy.mp3'
    source.write_bytes(b'legacy-derived-exact-bytes')
    sha = migration.digest(source)
    identifier = asyncio.run(migration._register('music', source, sha, 'draft'))
    target = migration.asset_library.resolve_music_path(identifier)
    assert target.read_bytes() == source.read_bytes()
    assert target.resolve().is_relative_to((profile / 'resources').resolve())
    assert migration._library_index()[('music', sha)] == identifier
    assert source.is_file()


def test_orphan_name_identity_migrates_without_creating_drafts_and_skips_other_families(tmp_path, monkeypatch):
    import asyncio
    from types import SimpleNamespace
    from src.config.settings import settings
    from src.core.nodemotion.shared import execution
    from src.adapters.data import section_store, json_store
    assert json_store.Section
    profile = tmp_path / 'profile'
    base = profile / 'productions/nodemotion'
    base.mkdir(parents=True)
    (base / 'index.html').write_text('<html>category navigation</html>')
    root = make_project(base)
    content = root / 'assets'
    raw = b'<html><head><base href="assets/"></head><body><script>const NAME = "promo-test";</script></body></html>'
    (root / 'index.html').write_bytes(raw)
    html = raw.replace(b'<base href="assets/">', b'')
    for name in ('commercial', 'image/sample', 'video/sample'):
        path = base / name
        path.mkdir(parents=True)
        (path / 'index.html').write_text('<html></html>')
    foreign = base / 'foreign-draft'
    foreign.mkdir()
    (foreign / 'index.html').write_text('<html>image design</html>')
    foreign_job = {'artifacts': {'output_dir': str(foreign)}}
    sandbox = profile / 'sandbox/nodemotion/custom'
    sandbox.mkdir(parents=True)
    (sandbox / 'index.html').write_text('<html>unique prototype</html>')
    monkeypatch.setattr(settings, 'storage_profile_dir', profile)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    # Only reads are exposed: accidental insert/update/put would fail the test.
    monkeypatch.setattr(migration, 'collection', lambda name: SimpleNamespace(list=lambda: (
        [{'draft_id': 'foreign', 'template_id': 'subject-spotlight'}] if name == 'drafts' else [])))
    monkeypatch.setattr(migration, 'documents', lambda name: pytest.fail('orphan must not access draft documents'))
    monkeypatch.setattr(section_store, 'Section', lambda name: SimpleNamespace(read=lambda: {
        'documents': {'draft_jobs': {'foreign': foreign_job}}}))
    monkeypatch.setattr(migration, 'design_ids', lambda: ())
    monkeypatch.setattr(migration, 'registered', lambda design: design == 'promo-test')
    monkeypatch.setattr(execution, 'registered', lambda design: design == 'promo-test')
    monkeypatch.setattr(execution, 'available_revision', lambda design, revision: True)
    monkeypatch.setattr(execution, 'engine_revision', lambda design: 'a' * 64)
    monkeypatch.setattr(migration, 'design_manifest', lambda design: {'family': 'promo'})
    monkeypatch.setattr(execution, 'design_manifest', lambda design, revision=None: {
        'family': 'promo', 'runtime_aliases': {'components/a.js': 'runtime/a.js'}, 'runtime_assets': []})
    monkeypatch.setattr(migration, 'archive_engine', lambda design, document, code: 'a' * 64)
    monkeypatch.setattr(migration, 'assemble', lambda design, revision=None: html)
    monkeypatch.setattr(execution, 'assemble', lambda design, revision=None: html)
    monkeypatch.setattr(migration, 'runtime_assets', lambda design, revision: {'components/a.js': content / 'components/a.js'})
    monkeypatch.setattr(execution, 'resolve_runtime_asset', lambda design, name, revision=None: content / name)
    sources = {'song': content / 'song.mp3', 'clip': content / 'media/in-use.mp4',
               'extra': content / 'media/unused.mp4'}
    monkeypatch.setattr(execution, '_resolve_ref', lambda ref: sources[ref['asset_id']])
    index = {('music' if name == 'song' else 'video', migration.digest(path)): name
             for name, path in sources.items()}
    monkeypatch.setattr(migration, '_library_index', lambda: index)
    report = asyncio.run(migration.migrate(profile, apply=True))
    orphan = next(item for item in report['projects'] if item.get('root') == str(root))
    assert orphan['source'] == 'orphan' and orphan['identity_evidence'] == 'explicit-metadata'
    assert orphan['status'] == 'migrated', orphan
    assert 'draft_id' not in orphan
    assert not any(item.get('root') in {str(base), str(foreign)} for item in report['projects'])
    assert execution.resolve_project(root, 'index.html') == raw
    assert execution.resolve_project(root, 'assets/media/unused.mp4').read_bytes() == b'output'
    assert not any(item.get('root', '').startswith(str(base / category)) for item in report['projects']
                   for category in ('image', 'video', 'commercial'))
    assert any(item.get('root') == str(sandbox) and item['status'] == 'needs-review' for item in report['projects'])
    assert (sandbox / 'index.html').read_text() == '<html>unique prototype</html>'


def test_orphan_identity_rejects_conflicts_and_accepts_exact_engine_hash(tmp_path, monkeypatch):
    import hashlib
    root = tmp_path / 'legacy'
    root.mkdir()
    html = b'<html><head></head><body>exact</body></html>'
    (root / 'index.html').write_bytes(html)
    monkeypatch.setattr(migration, 'registered', lambda design: design in {'promo-one', 'promo-two'})
    sha = hashlib.sha256(html).hexdigest()
    assert migration._orphan_identity(root, {sha: ['promo-one']}) == ('promo-one', 'exact-engine-html')
    assert migration._orphan_identity(root, {sha: ['promo-one', 'promo-two']})[0] is None
    (root / 'manifest.json').write_text('{"template_id":"promo-one"}')
    (root / 'index.html').write_text('<script>const NAME = "promo-two";</script>')
    assert migration._orphan_identity(root, {}) == (None, 'Conflicting or unregistered explicit design identity')


def test_legacy_demo_inventory_preserves_named_urls_and_unbased_html(tmp_path):
    root = tmp_path / 'demo'
    assets = root / 'assets'
    assets.mkdir(parents=True)
    (root / 'publish.json').write_text('{"template_id":"lyrics-romantic"}')
    (root / 'index.html').write_bytes(b'<html><head></head><body>assets/config.json</body></html>')
    (assets / 'config.json').write_text(json.dumps({'activeId': 'default', 'configs': [{
        'id': 'default', 'audio': {'src': 'assets/Bruses%20Audio.mp3'},
        'lyricsUrl': 'assets/custom-lyrics.json', 'bg': {'src': 'assets/cover.jpg'}}]}))
    (assets / 'Bruses Audio.mp3').write_bytes(b'audio')
    (assets / 'cover.jpg').write_bytes(b'image')
    (assets / 'custom-lyrics.json').write_text('{"words": []}')
    (root / 'components').mkdir()
    (root / 'components/runtime.js').write_bytes(b'runtime')
    urls = migration._demo_data_urls(root, 'lyrics-romantic')
    assert urls == {'config': 'assets/config.json', 'timing': 'assets/custom-lyrics.json',
                    'audio': 'assets/Bruses Audio.mp3', 'background': 'assets/cover.jpg'}
    html, prefix, code, media = migration._inventory(root, data_urls=urls)
    assert prefix == 'assets' and html == (root / 'index.html').read_bytes()
    assert code['components/runtime.js'].read_bytes() == b'runtime'
    assert media[urls['audio']].read_bytes() == b'audio'
    assert media[urls['background']].read_bytes() == b'image'
    assert migration._unsupported_runtime(root, html, code, data_urls=urls) == []


def test_legacy_demo_requires_matching_identity_and_safe_active_paths(tmp_path):
    root = tmp_path / 'demo'
    assets = root / 'assets'
    assets.mkdir(parents=True)
    (root / 'publish.json').write_text('{"template_id":"lyrics-other"}')
    with pytest.raises(ValueError, match='identity'):
        migration._demo_data_urls(root, 'lyrics-romantic')
    (root / 'publish.json').write_text('{"template_id":"lyrics-romantic"}')
    (assets / 'config.json').write_text(json.dumps({'activeId': 'default', 'configs': [{
        'id': 'default', 'audio': {'src': 'assets/%2e%2e/outside.mp3'},
        'lyricsUrl': 'assets/lyrics.json'}]}))
    with pytest.raises(ValueError, match='Invalid demo resource'):
        migration._demo_data_urls(root, 'lyrics-romantic')


def test_demo_without_publish_requires_exact_authoritative_html(tmp_path, monkeypatch):
    import hashlib
    root = tmp_path / 'demo'
    assets = root / 'assets'
    assets.mkdir(parents=True)
    html = b'<html><head></head><body>authoritative</body></html>'
    (root / 'index.html').write_bytes(html)
    (assets / 'config.json').write_text(json.dumps({'activeId': 'default', 'configs': [{
        'id': 'default', 'audio': {'src': 'assets/song.mp3'}, 'lyricsUrl': 'assets/lyrics.json'}]}))
    (assets / 'song.mp3').write_bytes(b'audio')
    (assets / 'lyrics.json').write_text('{}')
    monkeypatch.setattr(migration, 'design_manifest', lambda design: {'source_sha256': hashlib.sha256(html).hexdigest()})
    monkeypatch.setattr(migration, 'assemble', lambda design: html)
    assert migration._demo_data_urls(root, 'lyrics-mirada', identity_evidence='exact-engine-html')['audio'] == 'assets/song.mp3'
    with pytest.raises(ValueError, match='identity'):
        migration._demo_data_urls(root, 'lyrics-mirada')
    (root / 'index.html').write_bytes(html + b'changed')
    with pytest.raises(ValueError, match='identity'):
        migration._demo_data_urls(root, 'lyrics-mirada', identity_evidence='exact-engine-html')


def test_entry_path_resolution_preserves_production_and_bundled_provenance(tmp_path, monkeypatch):
    from types import SimpleNamespace
    from src.core.library import asset_library as library
    from src.core import content_registry
    from src.core.nodemotion.shared import bundled
    stored = tmp_path / 'stored.mp3'
    production = tmp_path / 'production.mp3'
    shared = tmp_path / 'shared.mp3'
    entry = library.MusicLibraryEntry(asset_id='track', category='nodemotion',
                                      relative_path='track/song.mp3', source='production')
    monkeypatch.setattr(library, '_storage', lambda kind: SimpleNamespace(local_path=lambda key: stored))
    monkeypatch.setattr(content_registry, 'resolve_resource', lambda asset_id: production)
    monkeypatch.setattr(bundled, 'resolve_bundled_key', lambda key: shared)
    assert library.resolve_asset_entry_path('music', entry, from_collection=True) == stored
    assert library.resolve_asset_entry_path('music', entry, from_collection=False) == production
    entry.bundled_key = 'fixed-key'
    with pytest.raises(ValueError, match='bundled'):
        library.resolve_asset_entry_path('music', entry, from_collection=True)
    entry.source = 'template'
    assert library.resolve_asset_entry_path('music', entry, from_collection=True) == shared
    with pytest.raises(ValueError, match='entry'):
        library.resolve_asset_entry_path('image', entry, from_collection=True)


def test_library_index_reads_each_collection_once_for_twenty_resources(tmp_path, monkeypatch):
    from src.config.settings import settings
    from src.core import data
    from src.core.library import asset_library as library
    from src.adapters.data.section_store import Section
    profile = tmp_path / 'profile'
    profile.mkdir()
    monkeypatch.setattr(settings, 'storage_profile_dir', profile)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    monkeypatch.setattr(settings, 'data_dir', profile / 'data')
    monkeypatch.setattr(data, '_store', None)
    entries = []
    for number in range(20):
        identifier = f'asset-{number}'
        relative = f'{identifier}/track.mp3'
        path = profile / 'resources/music' / relative
        path.parent.mkdir(parents=True)
        path.write_bytes(f'audio-{number}'.encode())
        entries.append(library.MusicLibraryEntry(asset_id=identifier, category='nodemotion',
                       relative_path=relative, source='upload').model_dump())
    path = profile / 'data/json/resources.json'
    Section.write_path(path, {'schema_version': 1, 'revision': 0,
                              'collections': {'music_assets': entries}, 'documents': {}})
    original_read = Section.read
    calls = []
    def counted(section):
        calls.append(section)
        return original_read(section)
    monkeypatch.setattr(Section, 'read', counted)
    index = migration._library_index()
    assert len(index) == 20
    assert len(calls) <= 3
    assert all(migration.digest(profile / 'resources/music' / entry['relative_path']) in
               {key[1] for key in index} for entry in entries)
    from src.core.nodemotion.shared import resources
    calls.clear()
    with resources.library_resolution_snapshot():
        for (kind, sha), asset_id in index.items():
            assert resources._resolve_ref({'kind': kind, 'asset_id': asset_id, 'sha256': sha}).is_file()
    assert len(calls) <= 6


def test_progress_logging_is_structured_redacted_and_stderr_only(capsys):
    migration._log_progress(2, 20, 'promo-editorial', 'already-migrated')
    captured = capsys.readouterr()
    assert captured.out == ''
    assert json.loads(captured.err) == {'event': 'nodemotion_migration_project', 'index': 2,
                                        'total': 20, 'design_id': 'promo-editorial',
                                        'status': 'already-migrated'}
    migration._log_progress(3, 20, 'promo-private title', 'private content')
    captured = capsys.readouterr()
    assert 'private' not in captured.err
    assert json.loads(captured.err)['design_id'] == 'unknown'


def _snapshot_environment(tmp_path, monkeypatch):
    from src.config.settings import settings
    from src.core import data
    from src.core.library import asset_library as library
    from src.adapters.data.section_store import Section
    profile = tmp_path / 'snapshot-profile'
    profile.mkdir()
    monkeypatch.setattr(settings, 'storage_profile_dir', profile)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    monkeypatch.setattr(settings, 'data_dir', profile / 'data')
    monkeypatch.setattr(data, '_store', None)
    target = profile / 'resources/music/one/song.mp3'
    target.parent.mkdir(parents=True)
    target.write_bytes(b'snapshot-audio')
    entry = library.MusicLibraryEntry(asset_id='one', category='nodemotion',
                                      relative_path='one/song.mp3', source='upload').model_dump()
    Section.write_path(profile / 'data/json/resources.json', {'schema_version': 1, 'revision': 0,
                       'collections': {'music_assets': [entry]}, 'documents': {}})
    return profile, target, entry, Section


def test_snapshot_nested_scopes_reject_concurrent_metadata_change_and_reset(tmp_path, monkeypatch):
    from src.core.nodemotion.shared import resources
    profile, target, _, Section = _snapshot_environment(tmp_path, monkeypatch)
    ref = {'kind': 'music', 'asset_id': 'one', 'sha256': resources.digest(target)}
    with pytest.raises(ValueError, match='Library entry changed'):
        with resources.library_resolution_snapshot():
            with resources.library_resolution_snapshot():
                assert resources._resolve_ref(ref) == target
            Section('resources').mutate(lambda section: section['collections']['music_assets'][0].update(description='updated'))
    assert resources._LIBRARY_SNAPSHOT.get() is None
    assert resources._resolve_ref(ref) == target
    assert profile.is_dir()


def test_snapshot_rejects_deleted_entry_and_newly_registered_fallback(tmp_path, monkeypatch):
    from src.core.nodemotion.shared import resources
    from src.core.library import asset_library as library
    _, target, entry, Section = _snapshot_environment(tmp_path, monkeypatch)
    with pytest.raises(ValueError, match='Library entry changed'):
        with resources.library_resolution_snapshot():
            assert resources._asset('music', 'one') == target
            Section('resources').mutate(lambda section: section['collections']['music_assets'].clear())
    with pytest.raises(FileNotFoundError):
        resources._asset('music', 'one')
    monkeypatch.setattr(library, 'resolve_music_path', lambda asset_id: target)
    with pytest.raises(ValueError, match='Library entry changed'):
        with resources.library_resolution_snapshot():
            assert resources._asset('music', 'one') == target  # normal fallback for absent ID
            Section('resources').mutate(lambda section: section['collections']['music_assets'].append(entry))
    assert resources._LIBRARY_SNAPSHOT.get() is None


def test_snapshot_rejects_profile_switch_and_continues_checking_file_hash(tmp_path, monkeypatch):
    from src.config.settings import settings
    from src.core.nodemotion.shared import resources
    profile, target, _, _ = _snapshot_environment(tmp_path, monkeypatch)
    with pytest.raises(ValueError, match='profile or data store changed'):
        with resources.library_resolution_snapshot():
            monkeypatch.setattr(settings, 'storage_profile_dir', tmp_path / 'other')
    monkeypatch.setattr(settings, 'storage_profile_dir', profile)
    ref = {'kind': 'music', 'asset_id': 'one', 'sha256': resources.digest(target)}
    with pytest.raises(ValueError, match='Resource revision'):
        with resources.library_resolution_snapshot():
            assert resources._resolve_ref(ref) == target
            target.write_bytes(b'different audio')
            resources._resolve_ref(ref)
    assert resources._LIBRARY_SNAPSHOT.get() is None


def test_source_metadata_is_detached_current_and_snapshot_tracked(tmp_path, monkeypatch):
    from src.core.nodemotion.shared import resources
    _, _, _, Section = _snapshot_environment(tmp_path, monkeypatch)
    assert resources.source_metadata('music', 'one')['description'] == ''
    with pytest.raises(ValueError, match='Library entry changed'):
        with resources.library_resolution_snapshot():
            captured = resources.source_metadata('music', 'one')
            captured['description'] = 'local mutation'
            assert resources.source_metadata('music', 'one')['description'] == ''
            Section('resources').mutate(lambda section: section['collections']['music_assets'][0].update(description='new'))
    assert resources.source_metadata('music', 'one')['description'] == 'new'
    with pytest.raises(ValueError, match='Invalid resource'):
        resources.source_metadata('sound', 'one')


def test_source_metadata_fallback_tracks_absence_during_snapshot(tmp_path, monkeypatch):
    from src.core.nodemotion.shared import resources
    from src.core.library import asset_library
    _, _, entry, Section = _snapshot_environment(tmp_path, monkeypatch)
    fallback = asset_library.MusicLibraryEntry(asset_id='production', category='production',
                  source='production', relative_path='productions/example.mp3')
    monkeypatch.setattr(asset_library, 'get_entry', lambda kind, asset_id: fallback)
    with pytest.raises(ValueError, match='Library entry changed'):
        with resources.library_resolution_snapshot():
            assert resources.source_metadata('music', 'production')['source'] == 'production'
            inserted = {**entry, 'asset_id': 'production'}
            Section('resources').mutate(lambda section: section['collections']['music_assets'].append(inserted))
    assert resources._LIBRARY_SNAPSHOT.get() is None
