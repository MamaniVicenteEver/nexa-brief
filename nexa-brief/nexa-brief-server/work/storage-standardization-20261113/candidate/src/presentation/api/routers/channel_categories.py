"""Manage the categories displayed in Canales using the shared DataStore."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from src.adapters.publishing.factory import get_publisher_facade
from src.core import channel_categories
from src.core.realtime.event_bus import get_event_bus
from src.core.realtime.events import RealtimeEvent
from src.presentation.api.security import require_internal

router = APIRouter()


class AccountIdentity(BaseModel):
    platform: Literal["youtube", "tiktok", "facebook", "instagram"]
    target_id: str = Field(min_length=1, max_length=256)


class CategoryMembersRequest(BaseModel):
    members: list[AccountIdentity] = Field(default_factory=list, max_length=500)


class CreateCategoryRequest(CategoryMembersRequest):
    display_name: str = Field(min_length=1, max_length=80)


class ChannelCategoryResponse(CategoryMembersRequest):
    category_id: str
    display_name: str


@router.get("/account-categories", response_model=list[ChannelCategoryResponse])
async def list_channel_categories():
    return channel_categories.list_settings()


async def _saved(record: dict) -> dict:
    await get_event_bus().publish(
        RealtimeEvent(type="channel_categories_changed", data={"category_id": record["category_id"]})
    )
    return record


@router.post("/account-categories", response_model=ChannelCategoryResponse, status_code=201,
             dependencies=[Depends(require_internal)])
async def create_channel_category(body: CreateCategoryRequest):
    try:
        record = await channel_categories.create_category(
            body.display_name, [member.model_dump() for member in body.members],
            get_publisher_facade().list_accounts(),
        )
    except channel_categories.CategoryConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return await _saved(record)


@router.put("/account-categories/{category_id}/members", response_model=ChannelCategoryResponse,
            dependencies=[Depends(require_internal)])
async def update_channel_category_members(category_id: str, body: CategoryMembersRequest):
    try:
        record = await channel_categories.set_members(
            category_id, [member.model_dump() for member in body.members],
            get_publisher_facade().list_accounts(),
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="No se encontró la categoría.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return await _saved(record)
