from pathlib import Path

from src.adapters.showcase import posters


def test_shared_atlas_component_changes_invalidate_its_poster(tmp_path):
    templates = tmp_path / 'templates'
    engine = templates / 'nodeatlas/atlas-en-movimiento/engine/tactico/components'
    engine.mkdir(parents=True)
    component = engine / 'economy.js'
    component.write_text('drawOriginal()')
    target = '/api/v1/explainer/files/bundled/nodeatlas/atlas-en-movimiento/preview/tactico/demo.html?only=money.flow'
    posters._source_cache.clear()
    before = posters.source_revision(templates, tmp_path / 'profile/sandbox', 'nodehistory/_atlas', target)
    component.write_text('drawUpdatedDollars()')
    posters._source_cache.clear()
    after = posters.source_revision(templates, tmp_path / 'profile/sandbox', 'nodehistory/_atlas', target)
    assert before != after
    posters._source_cache.clear()
