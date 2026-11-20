import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from src.core.prototypes import preparation
from src.core.ports.agent_port import AgentRunResult


def make_project(tmp_path):
    project = tmp_path / 'sandbox' / 'nodehistory' / 'demo'
    project.mkdir(parents=True)
    (project / 'index.html').write_text('<html></html>')
    (project / 'info.json').write_text(json.dumps({'title': 'Example', 'engine': 'nodehistory/_atlas',
                                                    'usage_backfill': {'source': '/sensitive/path'}}))
    return project


def test_context_contains_only_project_editorial_data(tmp_path):
    project = make_project(tmp_path)
    context = preparation._context(project)
    assert 'Example' in context['info.json']
    assert 'usage_backfill' not in context['info.json']
    assert '/sensitive/path' not in context['info.json']


def test_proposal_requires_a_title_description_and_explicit_missing(tmp_path):
    result = tmp_path / 'proposal.json'
    result.write_text('{"title": "Title"}')
    with pytest.raises(ValueError, match='description'):
        preparation._validate_proposal(result)
    result.write_text(json.dumps({'title': 'Title', 'description': 'Draft', 'missing': ['Review audio']}))
    assert preparation._validate_proposal(result)['missing'] == ['Review audio']


@pytest.mark.asyncio
async def test_agent_receives_only_a_dedicated_workspace_and_proposal_requires_review(tmp_path, monkeypatch):
    project = make_project(tmp_path)
    monkeypatch.setattr(preparation, 'sandbox_root', lambda: tmp_path / 'sandbox')
    rows = {}
    class Collection:
        async def update(self, run_id, patch): rows.setdefault(run_id, {}).update(patch)
    class Agent:
        async def run(self, prompt, *, cwd, log_path, timeout_seconds, scope):
            assert cwd.is_relative_to(project / 'work' / 'preparation')
            assert Path(scope.writable_dir) == cwd
            assert not (cwd / 'accounts.json').exists()
            assert scope.output_schema == cwd / 'schema.json'
            assert 'Example' in prompt
            return AgentRunResult(exit_code=0, last_message=json.dumps({'title': 'Draft', 'description': 'Text', 'missing': ['Check audio']}), duration_seconds=1)
    service = preparation.PreparationService(agent_getter=lambda _: Agent())
    monkeypatch.setattr(service, '_rows', lambda: Collection())
    record = {'run_id': '123', 'folder': 'nodehistory', 'project_id': 'demo', 'agent': 'codex', 'log_path': str(tmp_path / 'agent.log')}
    await service._run(record)
    assert rows['123']['state'] == 'review'
    assert rows['123']['proposal']['missing'] == ['Check audio']
    assert not (project / 'manifest.json').exists()
    assert project.is_dir()


def test_rejects_project_path_traversal(tmp_path, monkeypatch):
    make_project(tmp_path)
    monkeypatch.setattr(preparation, 'sandbox_root', lambda: tmp_path / 'sandbox')
    with pytest.raises(ValueError):
        preparation._project('..', 'demo')


@pytest.mark.asyncio
async def test_submit_is_idempotent_and_enables_showcase(tmp_path, monkeypatch):
    from contextlib import asynccontextmanager
    from src.adapters.showcase.filesystem import FilesystemShowcaseAdapter
    project = make_project(tmp_path)
    monkeypatch.setattr(preparation, 'sandbox_root', lambda: tmp_path / 'sandbox')
    rows = []
    class Collection:
        def list(self, where=None):
            return [r.copy() for r in rows if not where or all(r.get(k) == v for k, v in where.items())]
        async def insert(self, row): rows.append(row.copy())
        async def update(self, key, patch):
            next(r for r in rows if r['run_id'] == key).update(patch)
    @asynccontextmanager
    async def lock(_):
        yield
    class Projects:
        visible = []
        def _shared_ids(self): return set()
        def _item(self, folder, project_id, shared): return {'managed': True}
        def set_visible(self, folder, project_id, value): self.visible.append((folder, project_id, value))
    projects = Projects()
    monkeypatch.setattr(FilesystemShowcaseAdapter, 'from_settings', lambda: SimpleNamespace(projects=projects))
    monkeypatch.setattr(preparation, 'coordination', lock)
    monkeypatch.setattr(preparation, 'register_execution_log', lambda *a, **k: log())
    async def log():
        return SimpleNamespace(log_id='log1', path=tmp_path / 'agent.log')
    service = preparation.PreparationService(agent_getter=lambda _: SimpleNamespace(available=lambda: True))
    monkeypatch.setattr(service, '_rows', lambda: Collection())
    monkeypatch.setattr(service, 'start', lambda: None)
    one = await service.submit('nodehistory', 'demo')
    two = await service.submit('nodehistory', 'demo')
    assert one['run_id'] == two['run_id'] and len(rows) == 1
    assert projects.visible == [('nodehistory', 'demo', True)]
    assert project.is_dir()



@pytest.mark.asyncio
async def test_json_store_registers_preparation_coordination(tmp_path, monkeypatch):
    from src.adapters.data.json_store import JsonDataStore
    from src.config.settings import settings
    monkeypatch.setattr(settings, 'storage_profile_dir', tmp_path)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    monkeypatch.setattr(settings, 'data_dir', tmp_path / 'data')
    async with JsonDataStore().coordination('sandbox-preparations'):
        assert True
