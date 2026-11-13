"""The reviewed project type controls the destination, even for old metadata."""
import json

import pytest

from test_design_production_workflow import workflow
from src.adapters.showcase.technical_review import selection_signature
from src.core.design_production import ProductionError


def test_explicit_episode_selection_wins_over_old_main_demo_flag(workflow, monkeypatch):
    repository, source, _, draft = workflow
    (source/'manifest.json').write_text(json.dumps({'design':'existing','demo':True}))
    selected={**draft,'demo':False}
    monkeypatch.setattr(repository,'_record',lambda _: {'state':'draft','draft':selected})
    status=repository.inspect('nodepolitics','demo')
    assert status['destination']=='productions/nodeatlas/demo'
    assert status['draft']['demo'] is False


def test_manifest_main_demo_is_default_when_old_info_misclassified_it(workflow):
    repository, source, _, _ = workflow
    info=json.loads((source/'info.json').read_text())
    info['is_new_design']=False
    (source/'info.json').write_text(json.dumps(info))
    (source/'manifest.json').write_text(json.dumps({'design':'existing','demo':True}))
    status=repository.inspect('nodepolitics','demo')
    assert status['draft']['demo'] is True
    assert status['destination']=='bundled/nodepolitics/demo'


def test_project_type_changes_invalidate_selection_signature():
    assert selection_signature({'demo':True}) != selection_signature({'demo':False})


@pytest.mark.asyncio
async def test_project_type_must_be_a_boolean_not_a_truthy_string(workflow):
    repository, _, _, draft=workflow
    with pytest.raises(ProductionError,match='Selecciona demo principal'):
        await repository.save('nodepolitics','demo',{**draft,'demo':'false'})
