"""Authenticated production preparation, distinct from relocation and recording."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from src.presentation.api.security import require_internal
from src.core.explainer.editorial_preparation import EditorialPreparationService

router = APIRouter(prefix='/explainer/videos', dependencies=[Depends(require_internal)])
service = EditorialPreparationService()
class EditorialRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    regenerate: bool = False

@router.get('/{video_id}/preparation')
def status(video_id: str):
    try: return service.status(video_id)
    except FileNotFoundError as exc: raise HTTPException(404, str(exc)) from exc
    except ValueError as exc: raise HTTPException(422, str(exc)) from exc

@router.post('/{video_id}/preparation', status_code=202)
async def prepare(video_id: str, body: EditorialRequest):
    from src.presentation.api.routers.sandbox import _busy_video_ids
    current = service.latest(video_id)
    from src.core.task_ownership import task_is_owned
    if current and current['state'] in {'queued','running'} and task_is_owned('editorial-preparation', video_id):
        return service.status(video_id)
    if video_id in _busy_video_ids():
        raise HTTPException(409, 'Espera a que termine el trabajo activo del video')
    try: return await service.submit(video_id, body.regenerate)
    except FileNotFoundError as exc: raise HTTPException(404, str(exc)) from exc
    except ValueError as exc: raise HTTPException(422, str(exc)) from exc
