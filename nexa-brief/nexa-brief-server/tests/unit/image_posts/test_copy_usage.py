from __future__ import annotations

from types import SimpleNamespace

import pytest

from src.adapters.ai.infrastructure.deepseek_adapter import DeepSeekAdapter
from src.adapters.data.publication_factory import build_publication_components
from src.core.image_posts.service import _BuiltImagePlan
from src.core.image_posts.strategies import copywriter
from src.core.image_posts.strategies.base import Fact, StrategyContext
from src.core.image_posts.strategies.cifra_que_frena import STRATEGY
from test_plan_render import make_plan


@pytest.mark.asyncio
async def test_deepseek_returns_reported_usage_with_json():
    usage = SimpleNamespace(
        prompt_tokens=120, prompt_cache_hit_tokens=20, completion_tokens=35,
        total_tokens=155, completion_tokens_details=SimpleNamespace(reasoning_tokens=5),
    )
    response = SimpleNamespace(
        model="deepseek-test", usage=usage,
        choices=[SimpleNamespace(message=SimpleNamespace(content='{"items": []}'))],
    )

    class Completions:
        async def create(self, **_kwargs):
            return response

    adapter = DeepSeekAdapter.__new__(DeepSeekAdapter)
    adapter._client = SimpleNamespace(chat=SimpleNamespace(completions=Completions()))
    adapter._model = "fallback-model"
    adapter._max_retries = 1
    result, measured = await adapter.complete_json_with_usage("system", "user")
    assert result == {"items": []}
    assert measured["provider"] == "deepseek"
    assert measured["model"] == "deepseek-test"
    assert measured["input_tokens"] == 120
    assert measured["output_tokens"] == 35
    assert measured["reasoning_tokens"] == 5
    assert measured["seconds"] >= 0


@pytest.mark.asyncio
async def test_copywriter_passes_usage_to_archived_publication(tmp_path, monkeypatch):
    async def measured(_role, _system, _prompt):
        return ({"items": [{"claim_id": "claim_1", "stat": "37 s",
                            "headline": "El margen fue breve", "body": "El sistema midió 37 segundos."}]},
                {"provider": "deepseek", "model": "deepseek-test", "role": "copy_draft",
                 "input_tokens": 120, "output_tokens": 35, "total_tokens": 155, "seconds": 0.42})

    monkeypatch.delenv("NEXA_IMAGE_COPY_MODEL", raising=False)
    monkeypatch.setattr("src.adapters.models.hub.text_json_with_usage", measured)
    facts = [Fact("claim_1", "El sistema midió 37 segundos.", "https://example.org", "Fuente")]
    context = StrategyContext("node_tech", "Margen", "", "@nodetech", "NodeTech")
    collector = []
    await copywriter.write(STRATEGY, facts, context, usage_out=collector)
    assert collector[0]["input_tokens"] == 120

    plan = make_plan()

    async def builder(**_request):
        return _BuiltImagePlan(plan, STRATEGY.id, {"claim_bls": "modelo"}, collector)

    components = build_publication_components(data_dir=tmp_path, plan_builder=builder)
    _, record = await components.service.create_plan({
        "category_id": "node_tech", "source_video_id": "video_test",
        "template_id": "daily_fact", "style_id": plan.style_id,
    })
    stored = components.repository.get(record.publication_id)
    assert stored.technical.ai_usage[0].input_tokens == 120
    assert stored.technical.ai_usage[0].seconds == 0.42
