from types import SimpleNamespace

import pytest

from src.adapters.agent import factory
from src.adapters.agent.infrastructure import isolated_executor
from src.core.ports.agent_port import AgentIsolationUnavailableError
from src.core.nodemotion.promo.agents import statuses


@pytest.fixture
def isolated_codex(monkeypatch):
    monkeypatch.setattr(factory, "layout_for_settings", lambda _settings: SimpleNamespace(schema_version=3))
    monkeypatch.setattr(factory.platform, "system", lambda: "Linux")
    monkeypatch.setattr(factory.platform, "release", lambda: "kernel-nuevo")
    monkeypatch.setattr(isolated_executor, "APPROVED_BUILDS", (SimpleNamespace(kernel_release="kernel-anterior"),))
    monkeypatch.setattr(isolated_executor, "IsolatedCodexRunner", lambda: SimpleNamespace(available=lambda: False))


def test_unknown_kernel_is_reported_and_stays_unavailable(isolated_codex):
    with pytest.raises(AgentIsolationUnavailableError, match="kernel actual"):
        factory.get_agent("codex")

    result = statuses(lambda provider: factory.get_agent(provider) if provider == "codex" else SimpleNamespace(available=lambda: True))
    codex = next(row for row in result["agents"] if row["provider"] == "codex")
    assert codex["available"] is False
    assert "kernel actual" in codex["unavailable_reason"]
    assert result["default_provider"] == "claude"


def test_other_unverified_failure_does_not_claim_kernel_change(isolated_codex, monkeypatch):
    monkeypatch.setattr(factory.platform, "release", lambda: "kernel-anterior")
    with pytest.raises(AgentIsolationUnavailableError, match="no está verificado para este host"):
        factory.get_agent("codex")


def test_verified_runner_still_available(isolated_codex, monkeypatch):
    runner = SimpleNamespace(available=lambda: True)
    monkeypatch.setattr(isolated_executor, "IsolatedCodexRunner", lambda: runner)
    assert factory.get_agent("codex") is runner
