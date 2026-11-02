from __future__ import annotations

import copy
from unittest.mock import AsyncMock, MagicMock

import pytest
from cryptography.fernet import Fernet

from src.adapters.publishing.instagram_adapter import InstagramAdapter
from src.adapters.publishing.publisher_facade import PublisherFacade
from src.adapters.publishing.token_storage import TokenStorage
from src.config.exceptions import PlatformAPIError
from src.core.data import collection
from src.core.ports.channel_catalog_port import ChannelStats
from src.presentation.api.routers import publisher


@pytest.fixture
def connected_profile(tmp_path):
    storage = TokenStorage(tmp_path / "connections.json", Fernet.generate_key().decode())
    storage._data = {
        "instagram": {
            "instagram_6": {
                "name": "NODEATLAS",
                "target_id": "ig-atlas",
                "handle": "nodeatlas_es",
                "encrypted_access_token": storage.encrypt("profile-test-token"),
                "label": "Geografía",
                "notes": "Uso editorial",
                "linked_page_id": "page-atlas",
                "linked_page_name": "NodeAtlas",
                "connected_at": 123.0,
            }
        }
    }
    storage._save()
    manager = MagicMock()
    manager._storage = storage
    adapter = InstagramAdapter(manager)
    adapter._catalog_get_json = AsyncMock(
        return_value={"id": "ig-atlas", "name": "NodeAtlas", "username": "nodeatlas_es"}
    )
    adapter.list_channel_videos = AsyncMock(return_value=[])
    adapter.get_channel_stats = AsyncMock(return_value=ChannelStats(video_count=0, followers=5))
    facade = object.__new__(PublisherFacade)
    facade._token_manager = manager
    facade._adapters = {"instagram": adapter}
    return facade, storage, adapter


@pytest.mark.asyncio
async def test_sync_refreshes_case_and_handle_without_changing_identity(connected_profile):
    facade, storage, adapter = connected_profile
    await collection("channels").insert(
        {"platform": "instagram", "alias": "instagram_6", "target_id": "ig-atlas", "name": "NODEATLAS"}
    )
    original_token = storage.get_state("instagram", "instagram_6").encrypted_access_token
    adapter._catalog_get_json.return_value["username"] = "atlas_actualizado"

    first = await facade.sync_channel("instagram", "instagram_6")
    await facade.sync_channel("instagram", "instagram_6")

    accounts = storage.list_accounts()
    assert len(accounts) == 1
    account = accounts[0]
    assert (account["alias"], account["target_id"], account["name"]) == (
        "instagram_6", "ig-atlas", "NodeAtlas"
    )
    assert account["handle"] == "atlas_actualizado"
    assert account["custom_url"] == "https://www.instagram.com/atlas_actualizado"
    assert account["label"] == "Geografía"
    assert account["notes"] == "Uso editorial"
    assert account["linked_page_id"] == "page-atlas"
    assert account["linked_page_name"] == "NodeAtlas"
    assert account["connected_at"] == 123.0
    assert storage.get_state("instagram", "instagram_6").encrypted_access_token == original_token
    channel = collection("channels").first({"platform": "instagram", "alias": "instagram_6"})
    assert channel["name"] == "NodeAtlas"
    assert channel["handle"] == "atlas_actualizado"
    assert channel["stats"]["followers"] == first.stats.followers == 5
    adapter._catalog_get_json.assert_awaited_with(
        "ig-atlas",
        {"fields": "id,username,name,profile_picture_url,biography,website"},
        "instagram_6",
        "account_profile",
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("returned_id", ["another-instagram-id", None])
async def test_wrong_or_missing_remote_id_does_not_overwrite_account(connected_profile, returned_id):
    facade, storage, adapter = connected_profile
    before = storage.list_accounts()
    adapter._catalog_get_json.return_value = {"id": returned_id, "name": "NodeEconomy"}

    with pytest.raises(PlatformAPIError, match="different account ID"):
        await facade.sync_channel("instagram", "instagram_6")

    assert storage.list_accounts() == before
    adapter.list_channel_videos.assert_not_awaited()


@pytest.mark.asyncio
async def test_failed_remote_profile_preserves_saved_name(connected_profile):
    facade, storage, adapter = connected_profile
    before = storage.list_accounts()
    adapter._catalog_get_json.side_effect = PlatformAPIError(
        "Meta unavailable", platform="instagram", status_code=400
    )

    with pytest.raises(PlatformAPIError, match="Meta unavailable"):
        await facade.refresh_instagram_profile("instagram_6")

    assert storage.list_accounts() == before


@pytest.mark.asyncio
@pytest.mark.parametrize("reconnect", [True, False])
async def test_other_environment_reconnect_or_disconnect_wins_race(connected_profile, monkeypatch, reconnect):
    facade, storage, _adapter = connected_profile
    original_save = storage._save
    other = copy.copy(storage)

    def save_after_other_environment_changes(**kwargs):
        # A second writer changes the same file after the profile was fetched,
        # but before the first writer obtains the inter-process write lock.
        other._data = other._load()
        if reconnect:
            other._data["instagram"]["instagram_6"].update(
                {"target_id": "new-account-id", "name": "Another profile"}
            )
            other._save()
        else:
            other.remove_account("instagram", "instagram_6")
        return original_save(**kwargs)

    monkeypatch.setattr(storage, "_save", save_after_other_environment_changes)
    with pytest.raises(PlatformAPIError, match="connection changed"):
        await facade.refresh_instagram_profile("instagram_6")

    accounts = storage.list_accounts()
    if reconnect:
        assert accounts[0]["name"] == "Another profile"
        assert accounts[0]["target_id"] == "new-account-id"
    else:
        assert accounts == []


@pytest.mark.asyncio
async def test_public_directory_for_different_id_is_not_renamed(connected_profile):
    facade, _storage, _adapter = connected_profile
    await collection("channels").insert(
        {"platform": "instagram", "alias": "instagram_6", "target_id": "other-id", "name": "Other"}
    )
    await facade.refresh_instagram_profile("instagram_6")
    channel = collection("channels").first({"platform": "instagram", "alias": "instagram_6"})
    assert (channel["name"], channel["target_id"]) == ("Other", "other-id")


@pytest.mark.asyncio
async def test_profile_endpoint_returns_actual_name(api_client, connected_profile, monkeypatch):
    facade, _storage, _adapter = connected_profile
    monkeypatch.setattr(publisher, "_get_facade", lambda: facade)
    spawn = MagicMock()
    monkeypatch.setattr(publisher, "_spawn_channel_sync", spawn)

    response = await api_client.post("/api/v1/publish/accounts/instagram/instagram_6/refresh-profile")

    assert response.status_code == 200
    assert response.json()["name"] == "NodeAtlas"
    assert response.json()["target_id"] == "ig-atlas"
    spawn.assert_called_once_with("instagram", "instagram_6")


@pytest.mark.asyncio
async def test_profile_endpoint_rejects_wrong_id_without_starting_sync(api_client, connected_profile, monkeypatch):
    facade, storage, adapter = connected_profile
    adapter._catalog_get_json.return_value = {"id": "other-id", "name": "Wrong name"}
    monkeypatch.setattr(publisher, "_get_facade", lambda: facade)
    spawn = MagicMock()
    monkeypatch.setattr(publisher, "_spawn_channel_sync", spawn)

    response = await api_client.post("/api/v1/publish/accounts/instagram/instagram_6/refresh-profile")

    assert response.status_code == 502
    assert storage.list_accounts()[0]["name"] == "NODEATLAS"
    spawn.assert_not_called()
