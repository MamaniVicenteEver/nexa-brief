from unittest.mock import AsyncMock, MagicMock
import json

import httpx
import pytest

from src.adapters.publishing.youtube_adapter import YouTubeAdapter
from src.core.explainer.design_options import resolve_design_options


def test_design_options_and_episode_overrides(tmp_path):
    root = tmp_path / "designs"
    (root / "cara-a-cara").mkdir(parents=True)
    (root / "cara-a-cara" / "options.json").write_text(json.dumps({
        "preview_mode": "mobile", "youtube_category_id": "27",
    }))
    assert resolve_design_options("other", {}, root=root) == {
        "preview_mode": "desktop", "youtube_category_id": None,
    }
    assert resolve_design_options("cara-a-cara", {}, root=root) == {
        "preview_mode": "mobile", "youtube_category_id": "27",
    }
    assert resolve_design_options("cara-a-cara", {
        "preview_mode": "desktop", "youtube_category_id": None,
    }, root=root) == {"preview_mode": "desktop", "youtube_category_id": None}
    with pytest.raises(ValueError):
        resolve_design_options("cara-a-cara", {"youtube_category_id": "music"}, root=root)


@pytest.mark.asyncio
@pytest.mark.parametrize("category", [None, "27"])
async def test_youtube_upload_category_is_optional_or_explicit(category):
    adapter = YouTubeAdapter(MagicMock())
    client = MagicMock()
    client.__aenter__.return_value = client
    client.__aexit__.return_value = False
    client.post = AsyncMock(return_value=httpx.Response(200, headers={"Location": "https://example.invalid/session"}))
    adapter._make_client = MagicMock(return_value=client)
    await adapter._init_resumable_session(
        token="test", title="Title", description="Description", tags=[],
        privacy="private", file_size=100, category_id=category,
    )
    snippet = client.post.call_args.kwargs["json"]["snippet"]
    if category is None:
        assert "categoryId" not in snippet
    else:
        assert snippet["categoryId"] == category
