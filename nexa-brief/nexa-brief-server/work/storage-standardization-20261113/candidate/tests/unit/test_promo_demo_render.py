"""La demo usa su propio camino, sin debilitar la revisión de promos creadas."""
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from src.core import data, drafts
from src.core.draft_details import DraftDetails
from src.core.drafts import Draft
from src.core.job import Job, JobInput, JobStage


@pytest.mark.asyncio
async def test_start_promo_demo_requires_prepared_details_and_preview(monkeypatch):
    @asynccontextmanager
    async def lock(_key):
        yield

    job = Job(input=JobInput(category_name='promo'), stage=JobStage.HTML_GENERATED)
    demo = Draft(draft_id='demo', template_id='promo-kinetic', niche_id='promo',
                 original=True, status='prepared', details=DraftDetails(),
                 created_at='now', updated_at='now')
    get = AsyncMock(return_value=demo)
    mark = AsyncMock(return_value=demo)
    monkeypatch.setattr(data, 'coordination', lock)
    monkeypatch.setattr(data, 'collection', lambda _: SimpleNamespace(list=lambda **kwargs: []))
    monkeypatch.setattr(drafts, 'get', get)
    monkeypatch.setattr(drafts, '_mark_rendering', mark)

    assert await drafts.start_render('demo', job) == demo
    mark.assert_awaited_once_with('demo', job)
    mark.reset_mock()
    get.return_value = demo.model_copy(update={'details': None})
    assert await drafts.start_render('demo', job) is None
    get.return_value = demo
    assert await drafts.start_render('demo', job.model_copy(update={'stage': JobStage.PENDING})) is None
    get.return_value = demo.model_copy(update={'original': False, 'name': 'Demo'})
    assert await drafts.start_render('demo', job) is None
    mark.assert_not_awaited()
