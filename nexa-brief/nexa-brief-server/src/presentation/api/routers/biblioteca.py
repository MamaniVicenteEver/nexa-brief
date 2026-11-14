"""Authenticated paginated read API for the finished-content library."""
from fastapi import APIRouter, Depends, HTTPException, Query

from src.adapters.data.biblioteca_factory import build_biblioteca_service
from src.core.image_posts.models import PublicationRecord
from src.core.library.biblioteca import BibliotecaService, LibraryPage, LibraryQuery, MediaType, LibrarySort, LibraryTab
from src.presentation.api.image_post_access import ImageSession, require_image_session, require_publication_access
from src.presentation.api.security import require_internal

router = APIRouter(prefix="/biblioteca", tags=["biblioteca"], dependencies=[Depends(require_internal)])


def get_biblioteca_service(identity: ImageSession = Depends(require_image_session)):
    def visible(raw):
        try:
            require_publication_access(identity, PublicationRecord.model_validate(raw))
            return True
        except HTTPException as exc:
            if exc.status_code != 403:
                raise
            return False
    def recordings():
        from src.presentation.api.routers.explainer import get_recorder, _job_response
        return [_job_response(job).model_dump(mode="json")
                for job in get_recorder().list_jobs(active=True) if job.state.value != "done"]
    return build_biblioteca_service(recordings=recordings, image_visible=visible)


@router.get("", response_model=LibraryPage)
def list_biblioteca(
    media: MediaType = "videos", q: str = Query(default="", max_length=200),
    category: str = Query(default="", max_length=100), status: LibraryTab = "all",
    sort: LibrarySort = "newest", page: int = Query(default=1, ge=1, le=100000),
    service: BibliotecaService = Depends(get_biblioteca_service),
):
    return service.list(LibraryQuery(media=media, q=q, category=category, status=status, sort=sort, page=page))
