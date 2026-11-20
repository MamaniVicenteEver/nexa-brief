"""El catálogo de producción nunca rescata proyectos de la sección Sandbox."""
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from src.core import categories
from src.core.explainer import sandbox
from src.presentation.api.routers import explainer, showcase, templates
from src.presentation.api.schemas.explainer_schema import ExplainerVideoResponse


def category(name):
    return SimpleNamespace(display_name=name, topic="", status="active",
                           engine="explainer_kit", niches=[], children={})


def video(video_id="production-demo", path="node_atlas", demo=True):
    return ExplainerVideoResponse(
        video_id=video_id, design="atlas-cinematico", category_id=path,
        category_name="NodeAtlas", category_path=path, title=video_id,
        status="en preparación", ready=False, publish_ready=False, demo=demo,
        preview_url=f"/api/v1/explainer/videos/{video_id}/preview",
    )


@pytest.fixture
def catalog_sources(monkeypatch):
    monkeypatch.setattr(categories, "list_categories", lambda: {
        "node_atlas": category("NodeAtlas"),
        "node_economy": category("NodeEconomy"),
    })
    monkeypatch.setattr(templates, "list_templates", AsyncMock(return_value=[]))
    list_sandbox = Mock(side_effect=AssertionError("Production must not list Sandbox"))
    list_showcase = Mock(side_effect=AssertionError("No fallback from design to Sandbox"))
    monkeypatch.setattr(sandbox, "list_sandbox", list_sandbox)
    monkeypatch.setattr(showcase, "get_showcase_service", list_showcase)
    return list_sandbox, list_showcase


@pytest.mark.asyncio
async def test_catalog_keeps_only_production_demos_and_counts_them(monkeypatch, catalog_sources):
    monkeypatch.setattr(explainer, "list_explainer_videos", AsyncMock(return_value=[
        video(), video("production-episode", demo=False),
    ]))
    catalog = await templates.get_template_catalog()
    atlas, economy = catalog.categories
    assert [item.video_id for item in atlas.demo_videos] == ["production-demo"]
    assert atlas.demo_video_count == atlas.total_item_count == 1
    assert economy.total_item_count == 0
    assert catalog.summary.demo_count == catalog.summary.total_card_count == 1
    assert catalog.summary.categories_with_items == 1
    assert all(section.sandbox_demos == [] and section.sandbox_demo_count == 0
               for section in catalog.categories)
    for source in catalog_sources:
        source.assert_not_called()


@pytest.mark.asyncio
async def test_registered_design_without_production_demo_does_not_fallback(monkeypatch, catalog_sources):
    monkeypatch.setattr(explainer, "list_explainer_videos", AsyncMock(return_value=[]))
    catalog = await templates.get_template_catalog()
    assert len(catalog.categories) == 2
    assert catalog.summary.demo_count == catalog.summary.total_card_count == 0
    assert catalog.summary.categories_with_items == 0
    assert all(section.demo_videos == [] and section.sandbox_demos == []
               for section in catalog.categories)
    for source in catalog_sources:
        source.assert_not_called()


@pytest.mark.asyncio
async def test_production_demo_in_child_category_is_still_visible(monkeypatch, catalog_sources):
    monkeypatch.setattr(explainer, "list_explainer_videos", AsyncMock(return_value=[
        video("child-demo", path="node_atlas/bolivia"),
    ]))
    catalog = await templates.get_template_catalog()
    assert [item.video_id for item in catalog.categories[0].demo_videos] == ["child-demo"]
    assert catalog.summary.total_card_count == 1


@pytest.mark.asyncio
async def test_production_demo_references_keep_one_card_per_category_and_same_identity(monkeypatch, catalog_sources):
    shared_demo = video().model_copy(update={
        "category_paths": ["node_atlas", "node_atlas", "node_economy", "node_economy"],
    })
    monkeypatch.setattr(explainer, "list_explainer_videos", AsyncMock(return_value=[shared_demo]))
    catalog = await templates.get_template_catalog()
    atlas, economy = catalog.categories
    assert [item.video_id for item in atlas.demo_videos] == ["production-demo"]
    assert [item.video_id for item in economy.demo_videos] == ["production-demo"]
    assert atlas.demo_videos[0].preview_url == economy.demo_videos[0].preview_url
    assert atlas.demo_video_count == economy.demo_video_count == 1
    assert atlas.total_item_count == economy.total_item_count == 1
    assert atlas.sandbox_demos == economy.sandbox_demos == []
    for source in catalog_sources:
        source.assert_not_called()
