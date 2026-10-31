"""Round 2 regressions; all stores, browsers and processes are synthetic."""
import asyncio
import json
import os
import subprocess
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from nexa_tiktok.adapters.store_json.store import JsonStore
from nexa_tiktok.main import create_app


@pytest.mark.parametrize('invalid', [[], 'healthy', 1])
def test_invalid_session_health_is_quarantined(tmp_path, invalid):
    store = JsonStore(tmp_path)
    store.put_account('test', {'alias': 'test', 'session_health': 'ok'})
    path = tmp_path / 'accounts/test/account.json'
    path.write_text(json.dumps({'alias': 'test', 'session_health': invalid}))
    assert store.list_accounts() == []
    assert 'accounts/test/account.json' in store.degraded


@pytest.mark.parametrize('invalid', ['yesterday', '2026-10-30T12:00:00', []])
def test_invalid_check_time_is_quarantined(tmp_path, invalid):
    store = JsonStore(tmp_path)
    path = tmp_path / 'accounts/test/account.json'
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps({'alias': 'test', 'session_checked_at': invalid}))
    assert store.list_accounts() == []
    assert 'accounts/test/account.json' in store.degraded


@pytest.mark.parametrize(('port', 'owner', 'message'), [
    ('8100', '', 'sin PID controlable'),
    ('8000', '', 'sin PID controlable'),
    ('3000', '', 'sin PID controlable'),
    ('8100', 'users:(("uvicorn",pid=123,fd=1))', 'drenaje verificable'),
])
def test_restart_preflight_refuses_unknown_owners_and_undrained_tiktok(tmp_path, port, owner, message):
    # Only ss is replaced; no real process is signalled or network accessed.
    fake_ss = tmp_path / 'ss'
    fake_ss.write_text(
        '#!/bin/bash\n'
        f'if [[ "$*" == *":{port}"* ]]; then\n'
        f"  echo 'LISTEN 0 2048 127.0.0.1:{port} 0.0.0.0:* {owner}'\n"
        'fi\n'
    )
    fake_ss.chmod(0o700)
    script = Path(__file__).resolve().parents[2] / 'scripts/dev-restart-preflight.sh'
    result = subprocess.run(['bash', str(script)], check=False, capture_output=True, text=True,
                            env={**os.environ, 'PATH': str(tmp_path) + ':' + os.environ['PATH']})
    assert result.returncode == 1
    assert message in result.stderr
    assert 'antes de detener servicios' in result.stderr


def test_health_does_not_call_recovering_supervisor_healthy(tmp_path, monkeypatch):
    store = JsonStore(tmp_path)
    store.put_account('test', {'alias': 'test'})
    monkeypatch.setattr(store, 'list_jobs', lambda: (_ for _ in ()).throw(OSError('offline')))
    app = create_app(store=store, browser=object())
    with TestClient(app) as client:
        # Health can read the store again while initial recovery still fails.
        monkeypatch.setattr(store, 'list_jobs', list)
        health = client.get('/health').json()
        assert health['worker'] == 'recovering'
        assert health['status'] == 'degraded'


async def test_worker_becomes_healthy_only_after_recovery_succeeds(tmp_path, monkeypatch):
    from nexa_tiktok.services.jobs import Jobs

    store = JsonStore(tmp_path)
    list_jobs = store.list_jobs
    monkeypatch.setattr(store, 'list_jobs', lambda: (_ for _ in ()).throw(OSError('offline')))
    jobs = Jobs(store, store, SimpleNamespace(perform=AsyncMock()))
    await jobs.start()
    try:
        assert jobs.recovering
        monkeypatch.setattr(store, 'list_jobs', list_jobs)
        async with asyncio.timeout(3):
            while jobs.recovering:
                await asyncio.sleep(.01)
        assert not jobs.task.done()
    finally:
        await jobs.stop()
