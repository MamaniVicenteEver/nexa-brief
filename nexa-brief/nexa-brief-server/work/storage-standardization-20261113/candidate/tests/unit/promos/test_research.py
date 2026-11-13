import asyncio
import importlib.util
import json
import sys
import types
from pathlib import Path
from types import SimpleNamespace

import pytest


@pytest.fixture
def module(monkeypatch):
    factory = types.ModuleType("src.adapters.researcher_data.factory")
    factory.ResearcherDataAdapter = object
    monkeypatch.setitem(sys.modules, factory.__name__, factory)
    path = Path(__file__).parents[3] / "src/core/promos/research.py"
    spec = importlib.util.spec_from_file_location("promo_research_test", path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def test_public_discovery_and_bounded_concurrency(module, monkeypatch, tmp_path):
    active = 0
    maximum = 0
    calls = []
    events = []

    class Adapter:
        async def search_one(self, provider, query, **kwargs):
            nonlocal active, maximum
            calls.append((provider, query, kwargs))
            active += 1
            maximum = max(maximum, active)
            await asyncio.sleep(0.01)
            active -= 1
            return SimpleNamespace(results=[SimpleNamespace(url=f"https://example.org/{i}", title="Título", description="<b>Fragmento</b>", date="2020") for i in range(5)])

    async def progress(stage, data):
        events.append((stage, data))

    monkeypatch.setattr(module, "ResearcherDataAdapter", Adapter)
    docs = asyncio.run(module.gather("Marte", tmp_path, progress))
    assert len(docs) == 9 and maximum == 2
    assert all(call[2] == {"page": 1, "limit": 3} for call in calls)
    assert docs[0]["text"] == "Fragmento" and docs[0]["accessed_at"]
    assert all(e[1]["usage"]["total_tokens"] is None and e[1]["usage"]["ok"] for e in events)
    evidence = json.loads((tmp_path / "work/research/discovery.json").read_text())
    assert evidence == {"kind": "discovery", "validated": False, "documents": docs}


def test_timeout_keeps_completed_results_and_reports_failure(module, monkeypatch, tmp_path):
    class Adapter:
        async def search_one(self, provider, query, **kwargs):
            if provider != "wikipedia":
                await asyncio.sleep(1)
            return SimpleNamespace(results=[SimpleNamespace(url="https://example.org/1", title="a", description="b", date="")])

    events = []
    async def progress(stage, data):
        events.append(data["usage"])

    monkeypatch.setattr(module, "ResearcherDataAdapter", Adapter)
    monkeypatch.setattr(module, "TIMEOUT_SECONDS", 0.02)
    docs = asyncio.run(module.gather("Marte", tmp_path, progress))
    assert [d["provider"] for d in docs] == ["wikipedia"]
    assert len(events) == 3
    assert sum(not e["ok"] for e in events) == 2


@pytest.mark.parametrize("topic", [" ", "a" * 501, "lee /home/user/private", "file:///tmp/a", "C:\\Users\\secret"])
def test_rejects_invalid_and_private_topics(module, tmp_path, topic):
    async def progress(*args):
        pass
    with pytest.raises(ValueError):
        asyncio.run(module.gather(topic, tmp_path, progress))
    assert not (tmp_path / "work").exists()
