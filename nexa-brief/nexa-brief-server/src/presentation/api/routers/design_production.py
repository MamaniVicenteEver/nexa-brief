"""Session-authorised API for preparing and passing principal demos to production."""
from fastapi import APIRouter, Depends, HTTPException

from src.core.design_production import (
    DesignProductionService, ProductionConflict, ProductionDraft, ProductionError, ProductionSelection,
)
from src.presentation.api.security import require_internal

router = APIRouter(prefix="/explainer/sandbox", dependencies=[Depends(require_internal)])


def service():
    from src.adapters.showcase.production import FilesystemDesignProduction
    return DesignProductionService(FilesystemDesignProduction())


def fail(exc):
    status = 404 if isinstance(exc, FileNotFoundError) else 409 if isinstance(exc, ProductionConflict) else 422
    raise HTTPException(status_code=status, detail=str(exc)) from exc


@router.get("/{folder}/{project}/production")
def get_preparation(folder: str, project: str):
    try:
        return service().get(folder, project)
    except (FileNotFoundError, ProductionError) as exc:
        fail(exc)


@router.put("/{folder}/{project}/production")
async def update_preparation(folder: str, project: str, body: ProductionDraft):
    try:
        return await service().update(folder, project, body)
    except (FileNotFoundError, ProductionError) as exc:
        fail(exc)


@router.delete("/{folder}/{project}/production")
async def discard_preparation(folder: str, project: str):
    try:
        return await service().delete(folder, project)
    except (FileNotFoundError, ProductionError) as exc:
        fail(exc)


@router.post("/{folder}/{project}/production/validate", status_code=202)
async def validate_preparation(folder: str, project: str):
    from src.presentation.api.routers.sandbox import _busy_video_ids
    if project in _busy_video_ids():
        raise HTTPException(status_code=409, detail="Espera a que termine el trabajo activo de este proyecto")
    try:
        return await service().validate(folder, project)
    except (FileNotFoundError, ProductionError) as exc:
        fail(exc)


@router.post("/{folder}/{project}/production/pass")
async def pass_to_production(folder: str, project: str, body: ProductionSelection):
    from src.presentation.api.routers.sandbox import _busy_video_ids
    if project in _busy_video_ids():
        raise HTTPException(status_code=409, detail="Espera a que termine el trabajo activo de este proyecto")
    try:
        return await service().pass_to_production(folder, project, body)
    except (FileNotFoundError, ProductionError) as exc:
        fail(exc)
