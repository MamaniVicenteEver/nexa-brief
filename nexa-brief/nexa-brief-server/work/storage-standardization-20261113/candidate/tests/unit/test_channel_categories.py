from unittest.mock import MagicMock

import pytest

from src.core import channel_categories
from src.core.categories import CategoryNode
from src.core.data import collection
from src.presentation.api.routers import channel_categories as routes


@pytest.fixture(autouse=True)
def base_categories(monkeypatch):
    monkeypatch.setattr(channel_categories, "list_categories", lambda: {
        "node_tech": CategoryNode(display_name="NodeTech"),
        "node_history": CategoryNode(display_name="NodeHistory"),
    })


@pytest.fixture
def accounts(monkeypatch):
    accounts = [
        {"platform": "instagram", "alias": "instagram_6", "target_id": "ig-atlas", "name": "NodeAtlas"},
        {"platform": "facebook", "alias": "pagina_8", "target_id": "fb-atlas", "name": "NodeAtlas"},
        {"platform": "youtube", "alias": "canal_1", "target_id": "yt-tech", "name": "NODETECH"},
    ]
    facade = MagicMock()
    facade.list_accounts.return_value = accounts
    monkeypatch.setattr(routes, "get_publisher_facade", lambda: facade)
    return accounts


@pytest.mark.asyncio
async def test_create_category_persists_only_selected_immutable_ids(api_client, accounts):
    response = await api_client.post("/api/v1/publish/account-categories", json={
        "display_name": "  NodeAtlas  ",
        "members": [{"platform": "instagram", "target_id": "ig-atlas"},
                    {"platform": "facebook", "target_id": "fb-atlas"},
                    {"platform": "instagram", "target_id": "ig-atlas"}],
    })
    assert response.status_code == 201
    data = response.json()
    assert data["display_name"] == "NodeAtlas"
    assert data["members"] == [{"platform": "instagram", "target_id": "ig-atlas"},
                               {"platform": "facebook", "target_id": "fb-atlas"}]
    result = await api_client.get("/api/v1/publish/account-categories")
    assert result.json() == [data]
    assert collection("channels").list() == []
    assert collection("published_videos").list() == []


@pytest.mark.asyncio
async def test_same_id_keeps_membership_after_profile_and_alias_rename(api_client, accounts):
    created = await api_client.post("/api/v1/publish/account-categories", json={
        "display_name": "Atlas", "members": [{"platform": "instagram", "target_id": "ig-atlas"}],
    })
    accounts[0].update({"name": "Nuevo nombre", "alias": "nuevo_alias"})
    category_id = created.json()["category_id"]
    updated = await api_client.put(f"/api/v1/publish/account-categories/{category_id}/members", json={
        "members": [{"platform": "instagram", "target_id": "ig-atlas"}],
    })
    assert updated.status_code == 200
    assert updated.json()["members"] == created.json()["members"]


@pytest.mark.asyncio
async def test_existing_category_can_be_explicitly_emptied_and_refilled(api_client, accounts):
    response = await api_client.put("/api/v1/publish/account-categories/node_tech/members", json={"members": []})
    assert response.status_code == 200
    assert response.json()["members"] == []
    updated = await api_client.put("/api/v1/publish/account-categories/node_tech/members", json={
        "members": [{"platform": "youtube", "target_id": "yt-tech"}],
    })
    assert updated.status_code == 200
    assert len(channel_categories.list_settings()) == 1
    assert channel_categories.list_settings()[0]["members"] == updated.json()["members"]


@pytest.mark.asyncio
async def test_disconnected_saved_identity_can_be_retained_but_unknown_identity_cannot(api_client, accounts):
    members = [{"platform": "instagram", "target_id": "ig-atlas"}]
    await channel_categories.set_members("node_tech", members, accounts)
    accounts.pop(0)
    response = await api_client.put("/api/v1/publish/account-categories/node_tech/members", json={"members": members})
    assert response.status_code == 200
    rejected = await api_client.put("/api/v1/publish/account-categories/node_tech/members", json={
        "members": [{"platform": "instagram", "target_id": "fake-id"}],
    })
    assert rejected.status_code == 422
    assert channel_categories.list_settings()[0]["members"] == members


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["NodeTech", " nodetech ", "NODETECH"])
async def test_create_rejects_name_of_existing_base_category(api_client, accounts, name):
    response = await api_client.post("/api/v1/publish/account-categories", json={"display_name": name})
    assert response.status_code == 409
    assert channel_categories.list_settings() == []


@pytest.mark.asyncio
async def test_duplicate_custom_name_does_not_overwrite_members(api_client, accounts):
    first = await api_client.post("/api/v1/publish/account-categories", json={
        "display_name": "Marca Atlas", "members": [{"platform": "instagram", "target_id": "ig-atlas"}],
    })
    duplicate = await api_client.post("/api/v1/publish/account-categories", json={"display_name": "  MARCA   ATLAS "})
    assert duplicate.status_code == 409
    stored = await api_client.get("/api/v1/publish/account-categories")
    assert stored.json() == [first.json()]


@pytest.mark.asyncio
@pytest.mark.parametrize("body", [
    {"display_name": "   "}, {"display_name": "x" * 81},
    {"display_name": "Atlas", "members": [{"platform": "facebook", "target_id": "ig-atlas"}]},
    {"display_name": "Atlas", "members": [{"platform": "other", "target_id": "ig-atlas"}]},
])
async def test_invalid_create_does_not_write_data(api_client, accounts, body):
    response = await api_client.post("/api/v1/publish/account-categories", json=body)
    assert response.status_code == 422
    assert channel_categories.list_settings() == []


@pytest.mark.asyncio
async def test_update_unknown_category_is_not_a_create(api_client, accounts):
    response = await api_client.put("/api/v1/publish/account-categories/nonexistent/members", json={"members": []})
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_writes_require_internal_auth_in_production(api_client, accounts, monkeypatch):
    from src.config.settings import settings
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "nexa_internal_token", "category-test-secret")
    create = await api_client.post("/api/v1/publish/account-categories", json={"display_name": "Atlas"})
    edit = await api_client.put("/api/v1/publish/account-categories/node_tech/members", json={"members": []})
    assert create.status_code in (401, 403)
    assert edit.status_code in (401, 403)
    assert channel_categories.list_settings() == []
