"""Physical engine moves retain bytes and old public routes without symlinks."""
import hashlib
import importlib.util
import json
from pathlib import Path

import pytest

from src.core.explainer.engine_locations import (
    apply_engine_move, engine_root, plan_engine_move, public_engine_file,
    rollback_engine_move, safe_root,
)


@pytest.fixture
def engine(tmp_path):
    templates = tmp_path / 'templates'
    source = templates / 'sandbox/nodehistory/_atlas'
    source.mkdir(parents=True)
    (source / 'atlas.js').write_bytes(b'export const ready = true;')
    (source / 'assets').mkdir()
    (source / 'assets/poster.webp').write_bytes(b'existing image bytes')
    return templates, source


def register(templates, name, **values):
    file = templates / '_tools/design-definitions' / name / 'design.json'
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps({'engine_id': 'nodehistory/_atlas', **values}))
    return file


def test_move_preserves_inode_image_and_old_routes(engine):
    templates, source = engine
    image = source / 'assets/poster.webp'
    inode, digest = image.stat().st_ino, hashlib.sha256(image.read_bytes()).hexdigest()
    plan = plan_engine_move(templates, 'nodehistory/_atlas', 'nodeatlas', 'atlas-cinematico')
    design = {}
    apply_engine_move(templates, plan, design)
    register(templates, 'atlas-cinematico', **design)
    target = templates / 'nodeatlas/atlas-cinematico/_atlas'
    assert not source.exists() and target.is_dir()
    assert engine_root(templates, 'nodehistory/_atlas') == target
    assert public_engine_file(templates, ('sandbox', 'nodehistory', '_atlas', 'atlas.js')) == target/'atlas.js'
    assert public_engine_file(templates, ('nodeatlas', 'atlas-cinematico', '_atlas', 'atlas.js')) == target/'atlas.js'
    assert (target/'assets/poster.webp').stat().st_ino == inode
    assert hashlib.sha256((target/'assets/poster.webp').read_bytes()).hexdigest() == digest


def test_engine_rollback_restores_physical_source(engine):
    templates, source = engine
    plan = plan_engine_move(templates, 'nodehistory/_atlas', 'nodeatlas', 'atlas-cinematico')
    apply_engine_move(templates, plan, {})
    rollback_engine_move(templates, plan)
    assert (source/'atlas.js').read_bytes() == b'export const ready = true;'
    assert not (templates/plan['target']).exists()
    rollback_engine_move(templates, plan)  # Recovery can run twice.


def test_engine_edit_requires_fresh_review(engine):
    templates, source = engine
    plan = plan_engine_move(templates, 'nodehistory/_atlas', 'nodeatlas', 'atlas-cinematico')
    (source/'atlas.js').write_text('export const changed = true;')
    with pytest.raises(ValueError, match='cambió'):
        apply_engine_move(templates, plan, {})
    assert source.is_dir() and not (templates/plan['target']).exists()


def test_existing_target_never_overwritten(engine):
    templates, source = engine
    target = templates/'nodeatlas/atlas-cinematico/_atlas'
    target.mkdir(parents=True)
    (target/'atlas.js').write_text('other version')
    with pytest.raises(ValueError, match='ya existe'):
        plan_engine_move(templates, 'nodehistory/_atlas', 'nodeatlas', 'atlas-cinematico')
    assert (target/'atlas.js').read_text() == 'other version'
    assert source.exists()


@pytest.mark.parametrize('private', ['.env', '.env.local', 'accounts.json', 'credentials.json'])
def test_private_engine_files_block_move(engine, private):
    templates, source = engine
    (source/private).write_bytes(b'')
    with pytest.raises(ValueError, match='privados'):
        plan_engine_move(templates, 'nodehistory/_atlas', 'nodeatlas', 'atlas-cinematico')
    assert source.exists()


def test_symlink_in_engine_is_rejected(engine, tmp_path):
    templates, source = engine
    (source/'escape').symlink_to(tmp_path/'outside')
    with pytest.raises(ValueError, match='enlaces'):
        plan_engine_move(templates, 'nodehistory/_atlas', 'nodeatlas', 'atlas-cinematico')


@pytest.mark.parametrize('relative', ['../private', '/tmp/private', 'category/../secret', 'category/.hidden'])
def test_engine_root_rejects_traversal(engine, relative):
    with pytest.raises(ValueError):
        safe_root(engine[0], relative)


def test_shared_kit_already_in_repository_has_no_move(engine):
    templates, _ = engine
    assert plan_engine_move(templates, 'explainer-kit:dinero', 'nodeeconomy', 'dinero') is None
    assert engine_root(templates, 'explainer-kit:dinero') == templates/'_tools/explainer-kit'


@pytest.mark.parametrize('tail', ['.env', 'work/data.json', 'assets/secret.key', 'test/private.json', 'accounts.json'])
def test_legacy_alias_never_exposes_private_files(engine, tail):
    templates, _ = engine
    register(templates, 'atlas-cinematico', engine_root='nodeatlas/atlas-cinematico/_atlas',
             legacy_engine_roots=['sandbox/nodehistory/_atlas'])
    assert public_engine_file(templates, ('sandbox','nodehistory','_atlas',*tail.split('/'))) is None


def test_ambiguous_aliases_fail_closed(engine):
    templates, _ = engine
    for name in ('one', 'two'):
        register(templates, name, engine_root=f'nodeatlas/{name}/_atlas',
                 legacy_engine_roots=['sandbox/nodehistory/_atlas'])
    with pytest.raises(ValueError, match='ubicación'):
        engine_root(templates, 'nodehistory/_atlas')
    with pytest.raises(ValueError, match='ambiguo'):
        public_engine_file(templates, ('sandbox','nodehistory','_atlas','atlas.js'))


def test_cannot_rollback_after_engine_has_changed(engine):
    templates, source = engine
    plan = plan_engine_move(templates, 'nodehistory/_atlas', 'nodeatlas', 'atlas-cinematico')
    apply_engine_move(templates, plan, {})
    (templates/plan['target']/'atlas.js').write_text('changed after the move')
    with pytest.raises(ValueError, match='recuperación manual'):
        rollback_engine_move(templates, plan)
    assert not source.exists()


def test_sandbox_catalog_can_reuse_a_moved_shared_engine(engine, tmp_path):
    from types import SimpleNamespace
    from src.adapters.showcase.legacy_catalogs import _catalog_base, _source_url
    templates, _ = engine
    plan = plan_engine_move(templates, 'nodehistory/_atlas', 'nodeatlas', 'atlas-cinematico')
    design = {}
    apply_engine_move(templates, plan, design)
    register(templates, 'atlas-cinematico', **design)
    adapter = SimpleNamespace(templates=templates, sandbox=tmp_path/'profile/sandbox', schema_version=3)
    root, relative = _catalog_base(adapter, adapter.sandbox, 'nodeatlas/new-test',
                                   {'base':'sandbox/nodehistory/_atlas'})
    assert root == templates and relative == 'nodeatlas/atlas-cinematico/_atlas'
    expected='/api/v1/explainer/files/bundled/nodeatlas/atlas-cinematico/_atlas/atlas.js'
    assert _source_url(adapter, root, relative+'/atlas.js') == expected
    assert _source_url(adapter, templates/'sandbox', 'nodehistory/_atlas/atlas.js') == expected


def test_content_resolver_serves_current_and_old_engine_routes(engine, tmp_path, monkeypatch):
    from src.config.settings import settings
    from src.config.content_paths import resolve_content_key
    templates, _ = engine
    plan = plan_engine_move(templates, 'nodehistory/_atlas', 'nodeatlas', 'atlas-cinematico')
    design = {}
    apply_engine_move(templates, plan, design)
    register(templates, 'atlas-cinematico', **design)
    monkeypatch.setattr(settings, 'templates_dir', templates)
    monkeypatch.setattr(settings, 'storage_profile_dir', tmp_path/'profile')
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    target=templates/'nodeatlas/atlas-cinematico/_atlas/atlas.js'
    assert resolve_content_key('sandbox/nodehistory/_atlas/atlas.js') == target
    assert resolve_content_key('bundled/sandbox/nodehistory/_atlas/atlas.js') == target
    assert resolve_content_key('bundled/nodeatlas/atlas-cinematico/_atlas/atlas.js') == target
    with pytest.raises(ValueError):
        resolve_content_key('bundled/nodeatlas/atlas-cinematico/_atlas/work/private.json')


def test_definition_root_cannot_be_a_symbolic_link(engine, tmp_path):
    templates, _ = engine
    tools=templates/'_tools'
    tools.mkdir()
    outside=tmp_path/'outside-definitions'
    outside.mkdir()
    (tools/'design-definitions').symlink_to(outside)
    with pytest.raises(ValueError,match='enlaces simbólicos'):
        engine_root(templates,'nodehistory/_atlas')
