"""Chat de preparación de promociones; no inicia render."""
from fastapi import APIRouter, HTTPException, Query
from src.core.promos.models import CreateSession, SendMessage, ApproveSession
from src.core.promos.service import PromoChatService

router = APIRouter(prefix='/promos', tags=['promos'])
service = PromoChatService()


def _error(exc):
    raise HTTPException(status_code=404 if isinstance(exc, LookupError) else 409 if 'revisión' in str(exc) or 'borrador' in str(exc) else 400, detail=str(exc)) from exc

@router.get('/agents')
def get_agents():
    return service.agents()

@router.get('/sessions')
def list_sessions(template_id: str = Query(...)):
    try:
        return {'sessions': service.list(template_id), 'archived_draft_ids': service.archived_draft_ids(template_id)}
    except ValueError as exc:
        _error(exc)

@router.post('/sessions')
async def create_session(body: CreateSession):
    try:
        return await service.create(body.template_id, body.message, body.provider)
    except ValueError as exc:
        _error(exc)

@router.get('/sessions/{session_id}')
def get_session(session_id: str):
    try:
        return service.get(session_id)
    except (ValueError, LookupError) as exc:
        _error(exc)

@router.delete('/sessions/{session_id}', status_code=204)
async def delete_session(session_id: str):
    try:
        await service.archive(session_id)
    except (ValueError, LookupError) as exc:
        _error(exc)

@router.get('/sessions/{session_id}/content')
def get_session_content(session_id: str):
    from src.core.promos.content import read_content
    try:
        return read_content(service, session_id)
    except (ValueError, LookupError) as exc:
        _error(exc)

@router.post('/sessions/{session_id}/messages')
async def send_message(session_id: str, body: SendMessage):
    try:
        return await service.send(session_id, body.message)
    except (ValueError, LookupError) as exc:
        _error(exc)

@router.post('/sessions/{session_id}/approve')
async def approve_session(session_id: str, body: ApproveSession):
    try:
        return await service.approve(session_id, body.revision)
    except (ValueError, LookupError) as exc:
        _error(exc)

@router.post('/sessions/from-draft/{draft_id}')
async def import_draft(draft_id: str):
    try:
        return await service.import_legacy(draft_id)
    except (ValueError, LookupError) as exc:
        _error(exc)

@router.post('/sessions/{session_id}/retry')
async def retry_session(session_id: str):
    try:
        return await service.retry(session_id)
    except (ValueError, LookupError) as exc:
        _error(exc)
