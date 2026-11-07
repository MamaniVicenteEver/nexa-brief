"""Automatic image slots skip historical/incompatible art without stopping other slots."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from test_artwork_formats import components, store_record
from test_repository_api import NOW
from src.core.image_posts.errors import ImagePostError
from src.core.image_posts.models import PostStatus


@pytest.mark.asyncio
async def test_image_autofill_skips_superseded_and_incompatible_and_continues_slots(components, monkeypatch):
    from src.core.schedule import queue_repository, slot_repository

    original = await store_record(components)
    newer = original.model_copy(
        update={
            "publication_id": "pub_successor",
            "revision": 2,
            "supersedes_publication_id": original.publication_id,
            "status": PostStatus.READY_FOR_REVIEW,
        }
    )
    await components.repository.create(newer)
    tall = original.model_copy(
        update={
            "publication_id": "pub_tall",
            "post_id": "img_tall",
            "technical": original.technical.model_copy(
                update={
                    "composition_plan": original.technical.composition_plan.model_copy(update={"format": "9:16"}),
                    "slides": [
                        original.technical.slides[0].model_copy(update={"height": 1920, "aspect_ratio": "9:16"})
                    ],
                }
            ),
        }
    )
    await components.repository.create(tall)
    good = original.model_copy(update={"publication_id": "pub_compatible", "post_id": "img_compatible"})
    await components.repository.create(good)
    slots = [SimpleNamespace(slot_id="video-slot", content_kind="video", category_id="node_tech")]
    slots += [
        SimpleNamespace(
            slot_id=f"image-slot-{index}",
            content_kind="image",
            category_id="node_tech",
            timezone="UTC",
            days=[NOW.weekday()],
            times=["09:00"],
            platform="instagram",
            account_alias="test",
        )
        for index in range(2)
    ]
    monkeypatch.setattr(slot_repository, "list_slots", lambda **_: slots)
    monkeypatch.setattr(queue_repository, "find_pending_for_slot_occurrence", lambda *_: None)
    components.service._enforce_daily_ramp = AsyncMock()
    components.service.schedule_deliveries = AsyncMock(
        side_effect=[ImagePostError("REVISION_CONFLICT", status_code=409), []]
    )

    filled = await components.service.fill_due_image_slots(NOW)

    assert filled == 1
    assert components.service.schedule_deliveries.await_count == 2
    assert [call.args[0] for call in components.service.schedule_deliveries.await_args_list] == [
        good.publication_id
    ] * 2
    assert [call.args[2][0]["slot_id"] for call in components.service.schedule_deliveries.await_args_list] == [
        "image-slot-0",
        "image-slot-1",
    ]
    assert components.service._enforce_daily_ramp.await_count == 2
    components.service.publisher.assert_not_called()


@pytest.mark.asyncio
async def test_image_autofill_does_not_hide_unexpected_programming_errors(components, monkeypatch):
    from src.core.schedule import queue_repository, slot_repository

    record = await store_record(components)
    slot = SimpleNamespace(
        slot_id="image-slot",
        content_kind="image",
        category_id="node_tech",
        timezone="UTC",
        days=[NOW.weekday()],
        times=["09:00"],
        platform="facebook",
        account_alias="test",
    )
    monkeypatch.setattr(slot_repository, "list_slots", lambda **_: [slot])
    monkeypatch.setattr(queue_repository, "find_pending_for_slot_occurrence", lambda *_: None)
    components.service._enforce_daily_ramp = AsyncMock()
    components.service.schedule_deliveries = AsyncMock(side_effect=RuntimeError("unexpected implementation failure"))
    with pytest.raises(RuntimeError, match="unexpected implementation failure"):
        await components.service.fill_due_image_slots(NOW)
    assert components.service.schedule_deliveries.call_args.args[0] == record.publication_id
