from datetime import date, datetime, timezone

import pytest
from pydantic import ValidationError

from src.adapters.data.local_image_post_resources import LocalImagePostResources
from src.core.image_posts.schedule import (
    daily_image_limit,
    delivery_idempotency_key,
    local_occurrence_to_utc,
)
from src.core.schedule.models import QueueEntry, QueueSource, ScheduleSlot
from src.presentation.api.schemas.schedule_schema import ScheduleSlotCreateRequest


def test_image_cadence_ramps_from_one_to_two_only_when_stable():
    start = datetime(2026, 10, 1, tzinfo=timezone.utc)
    assert daily_image_limit(start, datetime(2026, 10, 14, tzinfo=timezone.utc), stable=True) == 1
    assert daily_image_limit(start, datetime(2026, 10, 15, tzinfo=timezone.utc), stable=False) == 1
    assert daily_image_limit(start, datetime(2026, 10, 15, tzinfo=timezone.utc), stable=True) == 2


def test_local_slots_convert_dst_and_skip_nonexistent_time():
    assert local_occurrence_to_utc(date(2026, 3, 8), "02:30", "America/New_York") is None
    first_fold = local_occurrence_to_utc(date(2026, 11, 1), "01:30", "America/New_York")
    assert first_fold == datetime(2026, 11, 1, 5, 30, tzinfo=timezone.utc)


def test_queue_old_records_migrate_to_video_without_job_id_regression():
    entry = QueueEntry(
        entry_id="old-entry", job_id="job-old", platform="facebook", account_alias="pagina_3",
        source=QueueSource.MANUAL, created_at="2026-10-25T10:00:00+00:00",
        updated_at="2026-10-25T10:00:00+00:00",
    )
    old_json = entry.model_dump(mode="json")
    old_json.pop("content_kind")
    old_json.pop("content_id")
    old_json.pop("delivery_id")
    migrated = QueueEntry.model_validate(old_json)
    assert migrated.content_kind == "video"
    assert migrated.job_id == "job-old"


def test_image_queue_entry_does_not_require_video_job_and_slots_require_category():
    entry = QueueEntry(
        entry_id="image-entry", job_id=None, platform="instagram", account_alias="instagram_2",
        source=QueueSource.MANUAL, content_kind="carousel", content_id="pub-1", delivery_id="del-1",
        created_at="2026-10-25T10:00:00+00:00", updated_at="2026-10-25T10:00:00+00:00",
    )
    assert entry.job_id is None
    assert entry.content_kind == "carousel"
    with pytest.raises(ValidationError):
        ScheduleSlotCreateRequest(
            platform="instagram", account_alias="instagram_2", content_kind="image",
        )
    slot = ScheduleSlot(
        slot_id="slot-1", platform="instagram", account_alias="instagram_2", days=[0], times=["12:00"],
        created_at="2026-10-25T10:00:00+00:00", updated_at="2026-10-25T10:00:00+00:00",
    )
    assert slot.content_kind == "video"
    assert slot.timezone == "UTC"


def test_account_alias_never_implies_category_and_delivery_key_is_stable():
    mapping = LocalImagePostResources()
    assert mapping.resolve_account("node_economy", "facebook", "nodatech")["name"] == "NodeEconomy"
    with pytest.raises(LookupError):
        mapping.resolve_account("node_tech", "facebook", "nodatech")
    first = delivery_idempotency_key("img-1", 2, "instagram", "instagram_2", "image", "manual:req-1")
    assert first == delivery_idempotency_key("img-1", 2, "instagram", "instagram_2", "image", "manual:req-1")
    assert first != delivery_idempotency_key("img-1", 2, "facebook", "pagina_3", "image", "manual:req-1")
