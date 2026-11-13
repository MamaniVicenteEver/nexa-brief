"""Contrato del chat con runner y pipeline controlados, sin red ni perfil real."""
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace
import pytest

from src.core.promos import service, agents

class Rows:
    def __init__(self): self.data = {}
    def get(self, key): return self.data.get(key)
    def list(self, where=None): return [v for v in self.data.values() if not where or all(v.get(k) == x for k, x in where.items())]
    async def insert(self, row): self.data[row['session_id']] = dict(row); return row
    async def update(self, key, patch):
        self.data[key] = {**self.data[key], **patch}
        return self.data[key]

class Runner:
    def available(self): return True
    async def run(self, prompt, *, cwd, log_path, timeout_seconds, scope):
        assert scope.read_only and not scope.commands
        assert scope.model == 'gpt-6.1-terra' and scope.reasoning_effort == 'high'
        assert 'No tienes acceso a búsqueda' in prompt
        return SimpleNamespace(ok=True, model=scope.model, duration_seconds=2, usage={'input_tokens': 15, 'output_tokens': 4},
            last_message='{"reply":"Propuesta","brief":{},"research":{},"guion":{},"media_plan":{}}')

@pytest.fixture
def env(monkeypatch, tmp_path):
    rows, drafts = Rows(), Rows()
    locks = {}
    @asynccontextmanager
    async def coordination(key):
        async with locks.setdefault(key, asyncio.Lock()): yield
    monkeypatch.setattr(service, 'collection', lambda name: rows if name == 'promo_chat_sessions' else drafts)
    monkeypatch.setattr(service, 'coordination', coordination)
    monkeypatch.setattr(service, 'sandbox_root', lambda: tmp_path)
    from src.core.promos import reports
    monkeypatch.setattr(reports, 'sandbox_root', lambda: tmp_path)
    monkeypatch.setattr(service, 'reference', lambda version=None: {'version': version or 'v2', 'hashes': {}})
    import sys
    from types import ModuleType
    pipeline = ModuleType('src.core.promos.pipeline')
    async def inspect_existing(_):
        return {'passed': True, 'checks': [], 'errors': [], 'warnings': []}
    pipeline.inspect_existing = inspect_existing
    async def source_context(row, project, progress):
        return [{'url': 'https://example.org/source', 'text': 'Evidencia'}, {'url': 'https://example.net/source', 'text': 'Evidencia'}]
    pipeline.source_context = source_context
    monkeypatch.setitem(sys.modules, pipeline.__name__, pipeline)
    monkeypatch.setattr(service, 'draft_fingerprint', lambda draft: str(draft))
    monkeypatch.setattr(service, 'task_is_owned', lambda *args: False)
    monkeypatch.setattr(service, 'start_owned_task', lambda kind, sid, fn: asyncio.create_task(fn()))
    monkeypatch.setattr(agents, 'compose', lambda *args, **kw: 'reglas centrales')
    return rows, drafts, tmp_path

@pytest.mark.asyncio
async def test_review_approve_and_revise(env):
    rows, drafts, tmp_path = env
    async def prepare(session, project, proposal, progress):
        await progress('media', {'usage': {'stage': 'media', 'provider': 'stock', 'model': None, 'input_tokens': None, 'cached_input_tokens': None, 'output_tokens': None, 'reasoning_tokens': None, 'total_tokens': None, 'cost_usd': None, 'seconds': 1}})
        drafts.data['draft'] = {'status': 'prepared'}
        return {'draft_id': 'draft', 'quality': {'passed': True, 'checks': [{'id': 'preview-check', 'passed': True}], 'errors': [], 'warnings': ['revisar'], 'visual_report': {'ready': True}}, 'proposal': {**proposal, 'reply': 'Propuesta definitiva', 'guion': {'version': 'revisada'}}}
    svc = service.PromoChatService(lambda _: Runner(), prepare)
    row = await svc.create('promo-sports', 'Una idea')
    await asyncio.gather(*list(svc.tasks))
    current = svc.get(row['session_id'])
    assert current['state'] == 'review' and current['revision'] == 1
    assert current['source_context'][0]['url'] == 'https://example.org/source'
    assert current['proposal']['guion']['version'] == 'revisada' and current['messages'][-1]['content'] == 'Propuesta definitiva'
    assert current['usage']['totals']['input_tokens'] == 15
    assert current['usage']['totals']['work_seconds'] == 3
    assert (tmp_path / 'nodemotion' / row['session_id'] / 'use_tokens' / 'usage.json').is_file()
    assert 'Estado: review' in (tmp_path / 'nodemotion' / row['session_id'] / 'INFORME.md').read_text()
    with pytest.raises(ValueError): await svc.approve(row['session_id'], 2)
    drafts.data['draft']['status'] = 'preview_ready'
    with pytest.raises(ValueError): await svc.approve(row['session_id'], 1)
    drafts.data['draft']['status'] = 'prepared'
    approved = await svc.approve(row['session_id'], 1)
    assert approved['state'] == 'ready' and approved['quality']['visual_report']['ready']
    assert approved['quality']['checks'][-1]['id'] == 'preview-check' and 'revisar' in approved['quality']['warnings']
    revised = await svc.send(row['session_id'], 'Otra idea')
    assert revised['revision'] == 2 and revised['draft_id'] is None and not revised['quality']['passed']
    with pytest.raises(ValueError): await svc.send(row['session_id'], 'Simultáneo')
    await asyncio.gather(*list(svc.tasks))

@pytest.mark.asyncio
async def test_failure_keeps_usage_and_recovery_marks_interruption(env):
    class Bad(Runner):
        async def run(self, *a, **kw):
            return SimpleNamespace(ok=False, model='real', duration_seconds=3, usage={'input_tokens': 9}, last_message='')
    svc = service.PromoChatService(lambda _: Bad())
    row = await svc.create('promo-urban', 'idea')
    await asyncio.gather(*list(svc.tasks))
    current = svc.get(row['session_id'])
    assert current['state'] == 'failed' and current['usage']['steps'][0]['input_tokens'] == 9
    env[0].data[row['session_id']]['state'] = 'running'
    await svc.recover()
    assert svc.get(row['session_id'])['stage'] == 'interrupted'

@pytest.mark.asyncio
async def test_archive_hides_session_and_history_without_deleting_data(env):
    rows, drafts, _ = env
    sid = 'a' * 32
    rows.data[sid] = {'session_id': sid, 'template_id': 'promo-urban', 'state': 'review',
                      'draft_id': 'current', 'draft_history': ['older'], 'created_at': '2026'}
    drafts.data.update(current={'status': 'prepared', 'template_id': 'promo-urban'}, older={'status': 'prepared'})
    svc = service.PromoChatService()
    await svc.archive(sid)
    assert svc.list('promo-urban') == []
    assert svc.archived_draft_ids('promo-urban') == ['current', 'older']
    assert set(drafts.data) == {'current', 'older'}
    with pytest.raises(LookupError): svc.get(sid)
    with pytest.raises(LookupError): await svc.retry(sid)
    with pytest.raises(ValueError): await svc.import_legacy('current')
    await svc.recover()  # las sesiones archivadas no interrumpen la recuperación

@pytest.mark.asyncio
async def test_archive_rejects_active_original_and_running_drafts(env, monkeypatch):
    from src.core import drafts as draft_service
    rows, drafts, _ = env
    sid = 'b' * 32
    row = {'session_id': sid, 'template_id': 'promo-kinetic', 'state': 'running',
           'draft_id': 'd', 'draft_history': [], 'created_at': '2026'}
    rows.data[sid] = row
    drafts.data['d'] = {'status': 'prepared', 'original': True}
    svc = service.PromoChatService()
    with pytest.raises(ValueError): await svc.archive(sid)
    row['state'] = 'review'
    with pytest.raises(ValueError): await svc.archive(sid)
    drafts.data['d']['original'] = False
    monkeypatch.setattr(draft_service, 'is_running', lambda _: True)
    with pytest.raises(ValueError): await svc.archive(sid)
    assert not row.get('archived_at')
    drafts.data['d']['original'] = True
    with pytest.raises(ValueError, match='demo original'): await svc.import_legacy('d')

@pytest.mark.asyncio
async def test_archive_serializes_with_import_of_historical_revision(env, monkeypatch):
    rows, drafts, _ = env
    sid = 'c' * 32
    rows.data[sid] = {'session_id': sid, 'template_id': 'promo-urban', 'state': 'review',
                      'draft_id': 'new', 'draft_history': ['old'], 'created_at': '2026'}
    drafts.data.update(new={'status': 'prepared'}, old={'status': 'prepared', 'template_id': 'promo-urban'})
    import sys
    pipeline = sys.modules['src.core.promos.pipeline']
    entered, release = asyncio.Event(), asyncio.Event()
    async def inspect(_):
        entered.set()
        await release.wait()
        return {'passed': True, 'checks': [], 'errors': [], 'warnings': []}
    monkeypatch.setattr(pipeline, 'inspect_existing', inspect)
    svc = service.PromoChatService()
    importing = asyncio.create_task(svc.import_legacy('old'))
    await entered.wait()
    archiving = asyncio.create_task(svc.archive(sid))
    await asyncio.sleep(0)
    assert not archiving.done()
    release.set()
    await importing
    with pytest.raises(ValueError, match='otra sesión'): await archiving
    assert not rows.data[sid].get('archived_at')

@pytest.mark.asyncio
async def test_promo_demo_cannot_be_deleted_through_draft_api(monkeypatch):
    from fastapi import HTTPException
    from src.presentation.api.routers import drafts as router
    async def get(_): return SimpleNamespace(original=True, template_id='promo-kinetic')
    monkeypatch.setattr(router.drafts, 'get', get)
    with pytest.raises(HTTPException) as exc:
        await router.delete_draft('demo')
    assert exc.value.status_code == 409

@pytest.mark.asyncio
async def test_import_legacy_and_detect_changes(env, monkeypatch):
    import sys
    from types import ModuleType
    rows, drafts, _ = env
    drafts.data['old'] = {'draft_id': 'old', 'template_id': 'promo-sports', 'status': 'prepared', 'details': {'title': 'original'}}
    module = ModuleType('src.core.promos.pipeline')
    async def inspect_existing(draft_id):
        return {'passed': True, 'checks': [], 'errors': [], 'warnings': []}
    module.inspect_existing = inspect_existing
    monkeypatch.setitem(sys.modules, module.__name__, module)
    svc = service.PromoChatService(lambda _: Runner())
    row = await svc.import_legacy('old')
    assert (await svc.import_legacy('old'))['session_id'] == row['session_id']
    drafts.data['old']['details'] = {'title': 'modificado'}
    with pytest.raises(ValueError, match='cambió'):
        await svc.approve(row['session_id'], 1)
    drafts.data['old']['details'] = {'title': 'original'}
    assert (await svc.approve(row['session_id'], 1))['approved_revision'] == 1
    drafts.data['old']['details'] = {'title': 'segunda versión'}
    assert svc.get(row['session_id'])['state'] == 'review'
    refreshed = await svc.import_legacy('old')
    assert refreshed['revision'] == 2 and refreshed['approved_revision'] is None
    assert (await svc.approve(row['session_id'], 2))['state'] == 'ready'


def test_cli_auto_and_usage(monkeypatch, capsys):
    import importlib.util
    from pathlib import Path
    path = Path(__file__).resolve().parents[2] / 'src/templates/_tools/nodemotion-promo/chat.py'
    spec = importlib.util.spec_from_file_location('promo_chat_cli', path)
    cli = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cli)
    calls = []
    def fake(method, path, payload=None):
        calls.append((method, path, payload))
        if path == '/agents': return {'default_provider': 'claude'}
        return {'session_id': 'id', 'usage': {'steps': [], 'totals': {}}}
    monkeypatch.setattr(cli, 'call', fake)
    assert cli.main(['create', '--template', 'promo-sports', '--message', 'idea']) == 0
    assert calls[-1][2]['provider'] == 'claude'
    assert cli.main(['retry', '--id', 'id']) == 0
    assert calls[-1] == ('POST', '/sessions/id/retry', {})
    assert cli.main(['usage', '--id', 'id']) == 0
    assert 'totals' in capsys.readouterr().out


def test_unknown_usage_does_not_invent_totals():
    from src.core.promos.usage import summarize
    result = summarize([{'model': 'm', 'input_tokens': 5, 'output_tokens': 1, 'seconds': 2},
                        {'model': 'm', 'input_tokens': None, 'output_tokens': None, 'seconds': 1},
                        {'model': None, 'seconds': 3}])['totals']
    assert result['input_tokens'] is None and result['known_input_tokens'] == 5
    assert result['unknown_model_attempts'] == 1 and result['work_seconds'] == 6


@pytest.mark.asyncio
async def test_cancel_marks_interrupted(env):
    entered = asyncio.Event()
    class Waiting(Runner):
        async def run(self, *args, **kwargs):
            entered.set()
            await asyncio.Event().wait()
    svc = service.PromoChatService(lambda _: Waiting())
    row = await svc.create('promo-sports', 'idea')
    task = next(iter(svc.tasks))
    await entered.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    current = svc.get(row['session_id'])
    assert current['state'] == 'failed' and current['stage'] == 'interrupted'
    assert current['usage']['steps'][-1]['ok'] is False

@pytest.mark.asyncio
async def test_reimport_refreshes_quality_and_preserves_valid_approval(env, monkeypatch):
    import sys
    from types import ModuleType
    rows, drafts, _ = env
    drafts.data['demo'] = {'draft_id': 'demo', 'template_id': 'promo-dynamic', 'status': 'prepared'}
    gate = {'passed': False}
    module = ModuleType('src.core.promos.pipeline')
    async def inspect_existing(_):
        return {'passed': gate['passed'], 'checks': [{'id': 'preview', 'label': 'preview', 'passed': gate['passed']}],
                'errors': [] if gate['passed'] else ['preview'], 'warnings': []}
    module.inspect_existing = inspect_existing
    monkeypatch.setitem(sys.modules, module.__name__, module)
    svc = service.PromoChatService(lambda _: Runner())
    row = await svc.import_legacy('demo')
    rows.data[row['session_id']]['quality'].update(
        checks=[{'id': 'preview', 'label': 'preview', 'passed': False}, {'id': 'preview-check', 'label': 'visual', 'passed': True}],
        visual_report={'ready': True}, evidence_report={'documents': 2})
    gate['passed'] = True
    refreshed = await svc.import_legacy('demo')
    assert refreshed['revision'] == 1 and refreshed['quality']['passed']
    assert refreshed['quality']['visual_report']['ready'] and refreshed['quality']['evidence_report']['documents'] == 2
    assert any(check['id'] == 'preview-check' for check in refreshed['quality']['checks'])
    await svc.approve(row['session_id'], 1)
    unchanged = await svc.import_legacy('demo')
    assert unchanged['state'] == 'ready' and unchanged['approved_revision'] == 1
    gate['passed'] = False
    revoked = await svc.import_legacy('demo')
    assert revoked['state'] == 'review' and revoked['approved_revision'] is None
    assert revoked['reviewed_fingerprint'] is None and not revoked['quality']['passed']
    assert revoked['quality']['visual_report']['ready']


@pytest.mark.asyncio
async def test_import_preserves_only_verified_prompt_provenance(env, monkeypatch):
    import sys
    from types import ModuleType
    rows, drafts, _ = env
    module = ModuleType('src.core.promos.pipeline')
    async def inspect_existing(_):
        return {'passed': True, 'checks': [], 'errors': [], 'warnings': []}
    module.inspect_existing = inspect_existing
    monkeypatch.setitem(sys.modules, module.__name__, module)
    svc = service.PromoChatService(lambda _: Runner())
    drafts.data['v1'] = {'draft_id':'v1', 'template_id':'promo-sports', 'status':'prepared',
                         'details':{'promo_prompt_reference':{'version':'v1','hashes':{}}}}
    known = await svc.import_legacy('v1')
    assert known['source_prompt_ref']['version'] == 'v1' and known['prompt_ref']['version'] == 'v1'
    drafts.data['unknown'] = {'draft_id':'unknown', 'template_id':'promo-sports', 'status':'prepared', 'details':{}}
    unknown = await svc.import_legacy('unknown')
    assert unknown['source_prompt_ref'] is None and unknown['prompt_ref']['version'] == 'v2'
    drafts.data['bad'] = {'draft_id':'bad', 'template_id':'promo-sports', 'status':'prepared',
                           'details':{'promo_prompt_reference':{'version':'v1','hashes':{'alterado':'x'}}}}
    with pytest.raises(ValueError, match='referencia de prompts'):
        await svc.import_legacy('bad')


@pytest.mark.asyncio
async def test_retry_uses_saved_proposal_and_context_without_model(env, monkeypatch):
    rows, drafts, _ = env
    calls = []
    async def prepare(session, project, proposal, progress):
        calls.append((session.get('resume_host'), proposal))
        key = 'draft-' + str(len(calls))
        drafts.data[key] = {'status': 'prepared'}
        return {'draft_id': key, 'quality': {'passed': True, 'checks': [], 'errors': [], 'warnings': []}}
    svc = service.PromoChatService(lambda _: Runner(), prepare)
    row = await svc.create('promo-sports', 'idea')
    await asyncio.gather(*list(svc.tasks))
    before = svc.get(row['session_id'])
    old_usage = before['usage']
    async def forbidden(*args, **kwargs):
        raise AssertionError('Una reanudación no debe generar ni buscar')
    monkeypatch.setattr(agents, 'run', forbidden)
    import sys
    monkeypatch.setattr(sys.modules['src.core.promos.pipeline'], 'source_context', forbidden)
    queued = await svc.retry(row['session_id'])
    assert queued['resume_host'] and queued['revision'] == 1 and queued['draft_id'] == 'draft-1'
    await asyncio.gather(*list(svc.tasks))
    final = svc.get(row['session_id'])
    assert final['state'] == 'review' and final['revision'] == 1 and final['draft_id'] == 'draft-2'
    assert final['draft_history'] == ['draft-1'] and final['usage'] == old_usage
    assert calls[-1] == (True, before['proposal'])
    rows.data[row['session_id']]['state'] = 'ready'
    with pytest.raises(ValueError): await svc.retry(row['session_id'])
    rows.data[row['session_id']]['state'] = 'failed'
    rows.data[row['session_id']]['source_context'] = []
    with pytest.raises(ValueError, match='corrección'): await svc.retry(row['session_id'])
