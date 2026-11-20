"""La IA de textos pasa al respaldo solo cuando Codex agota la cuota o el límite."""

import asyncio

import pytest

from src.adapters.ai.factory import QuotaFallbackAI


class _Fake:
    def __init__(self, name, *, error=None, result=None):
        self.name = name
        self.error = error
        self.result = result
        self.calls = 0

    async def complete_json(self, system_prompt, user_prompt):
        self.calls += 1
        if self.error:
            raise self.error
        return self.result

    async def complete_text(self, system_prompt, user_prompt):
        self.calls += 1
        if self.error:
            raise self.error
        return self.result


def test_quota_error_moves_the_same_call_to_the_fallback():
    primary = _Fake("codex", error=RuntimeError("codex terminó con código 1: age limit. Visit settings"))
    fallback = _Fake("claude", result={"ok": True})
    ai = QuotaFallbackAI(primary, fallback)
    assert asyncio.run(ai.complete_json("s", "u")) == {"ok": True}
    assert primary.calls == 1 and fallback.calls == 1


def test_other_errors_are_not_masked_by_the_fallback():
    primary = _Fake("codex", error=ValueError("JSON inválido del modelo"))
    fallback = _Fake("claude", result={"ok": True})
    ai = QuotaFallbackAI(primary, fallback)
    with pytest.raises(ValueError):
        asyncio.run(ai.complete_json("s", "u"))
    assert fallback.calls == 0


def test_success_never_calls_the_fallback():
    primary = _Fake("codex", result="texto")
    fallback = _Fake("claude", result="otro")
    ai = QuotaFallbackAI(primary, fallback)
    assert asyncio.run(ai.complete_text("s", "u")) == "texto"
    assert fallback.calls == 0
