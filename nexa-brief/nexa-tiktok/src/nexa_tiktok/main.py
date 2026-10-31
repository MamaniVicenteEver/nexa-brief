import fcntl
import hmac
import logging
import os
import re
import secrets
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException

from nexa_tiktok.adapters.browser_playwright import profiles, qr_login, session
from nexa_tiktok.adapters.browser_playwright.browser import PlaywrightBrowser
from nexa_tiktok.adapters.store_json.store import JsonStore, RestoreConflict, validate_alias
from nexa_tiktok.config import settings
from nexa_tiktok.services.jobs import Jobs


class APIError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        self.code, self.message, self.status = code, message, status


class AliasBody(BaseModel):
    alias: str


class ImportBody(AliasBody):
    cookies: list[dict[str, Any]]
    expected_username: str = Field(min_length=1, max_length=100)


class PatchBody(BaseModel):
    label: str | None = None
    notes: str | None = None


class RestoreBody(BaseModel):
    file: str
    timestamp: str


class CommentBody(BaseModel):
    text: str = Field(min_length=1, max_length=120)
    idempotency_key: str = Field(min_length=1, max_length=200)


def valid_text(value: str) -> str:
    if re.search('[\U0001f000-\U0001faff\u2600-\u27bf\u200d\u20e3\ufe0f'
                 '\u00a9\u00ae\u203c\u2049\u2122\u2139\u2194-\u21ff'
                 '\u2300-\u23ff\u2b00-\u2bff\u3030\u303d\u3297\u3299]', value):
        raise APIError('invalid_text', 'No se permiten emojis.')
    return value


def public_job(job: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in job.items() if k not in {'payload', 'idempotency_key'}}


def create_app(store: JsonStore | None = None, browser: Any = None) -> FastAPI:
    store = store or JsonStore(settings.nexa_tiktok_data_dir)
    browser = browser or PlaywrightBrowser()
    jobs = Jobs(store, store, browser)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if not settings.nexa_tiktok_key and settings.app_env != 'development':
            raise RuntimeError('NEXA_TIKTOK_KEY es obligatoria fuera de development.')
        if not settings.nexa_tiktok_key:
            logging.getLogger(__name__).warning('NEXA_TIKTOK_KEY no configurada: acceso local sin autenticación en development.')
        fd = os.open(store.root / '.service.lock', os.O_CREAT | os.O_RDWR, 0o600)
        try:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise RuntimeError('Ya hay un servicio usando este directorio de datos.') from exc
            await jobs.start()
            yield
        finally:
            for current in list(qr_login._sessions.values()):
                await qr_login.cancel_qr_login(current.session_id)
            await jobs.stop()
            profiles.stop_display()
            fcntl.flock(fd, fcntl.LOCK_UN)
            os.close(fd)

    app = FastAPI(lifespan=lifespan)
    app.state.store, app.state.browser, app.state.jobs = store, browser, jobs

    @app.middleware('http')
    async def auth(request: Request, call_next):
        if request.url.path != '/health':
            key = settings.nexa_tiktok_key
            provided = request.headers.get('X-Nexa-Tiktok-Key', '')
            if (not key and settings.app_env != 'development') or (key and not hmac.compare_digest(key.encode(), provided.encode())):
                return JSONResponse({'error': {'code': 'unauthorized', 'message': 'Clave inválida.'}}, status_code=401)
        if request.url.path == '/v1/sessions/import':
            chunks = []
            size = 0
            async for chunk in request.stream():
                size += len(chunk)
                if size > 256 * 1024:
                    return JSONResponse({'error': {'code': 'body_too_large', 'message': 'Máximo 256 KB.'}}, status_code=413)
                chunks.append(chunk)
            body = b''.join(chunks)
            async def receive():
                return {'type': 'http.request', 'body': body, 'more_body': False}
            request._receive = receive
        return await call_next(request)

    @app.exception_handler(APIError)
    async def api_error(request: Request, exc: APIError):
        return JSONResponse({'error': {'code': exc.code, 'message': exc.message}}, status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse({'error': {'code': 'invalid_request', 'message': 'Datos de entrada inválidos.'}}, status_code=422)

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return JSONResponse({'error': {'code': 'http_error', 'message': str(exc.detail)}}, status_code=exc.status_code)

    def account(alias: str) -> dict[str, Any]:
        try:
            validate_alias(alias)
        except ValueError as exc:
            raise APIError('invalid_alias', 'Alias inválido.', 422) from exc
        value = store.get_account(alias)
        if value is None:
            raise APIError('account_not_found', 'Cuenta inexistente.', 404)
        return value

    @app.get('/health')
    async def health():
        try:
            accounts = store.list_accounts()
            all_jobs = store.list_jobs()
            backups = store.list_backups()
            store_status = 'degraded' if store.degraded else 'ok'
        except Exception:  # noqa: BLE001 - health must remain available when the store fails
            accounts, all_jobs, backups, store_status = [], [], [], 'down'
        worker = 'ok' if jobs.task and not jobs.task.done() else 'down'
        if worker == 'ok' and jobs.recovering:
            worker = 'recovering'
        xvfb = 'ok' if profiles._xvfb and profiles._xvfb.poll() is None else 'down'
        return {'status': 'ok' if worker == 'ok' and store_status == 'ok' else 'degraded',
                'worker': worker, 'store': store_status, 'xvfb': xvfb,
                'accounts': [{'alias': a['alias'], 'session': a.get('session_health', 'unknown'),
                              'checked_at': a.get('session_checked_at')} for a in accounts],
                'last_backup_at': max((item['timestamp'] for item in backups), default=None),
                'needs_review': sum(j.get('state') == 'needs_review' for j in all_jobs)}

    @app.get('/v1/backups')
    async def backups_list():
        return store.list_backups()

    @app.post('/v1/backups/restore')
    async def backup_restore(body: RestoreBody):
        try:
            store.restore_backup(body.file, body.timestamp)
        except RestoreConflict as exc:
            raise APIError('restore_conflict', 'El archivo actual es legible; no se sobrescribió.', 409) from exc
        except (ValueError, OSError) as exc:
            raise APIError('invalid_backup', 'No se pudo restaurar el respaldo.', 400) from exc
        return {'restored': True}


    @app.get('/v1/accounts')
    async def accounts():
        return store.list_accounts()

    @app.get('/v1/accounts/{alias}')
    async def get_account(alias: str):
        return account(alias)

    @app.patch('/v1/accounts/{alias}')
    async def patch_account(alias: str, body: PatchBody):
        value = account(alias)
        for key, item in body.model_dump(exclude_none=True).items():
            value[key] = valid_text(item)
        store.put_account(alias, value)
        return value

    @app.delete('/v1/accounts/{alias}')
    async def delete_account(alias: str):
        account(alias)
        async with profiles.BROWSER_SEMAPHORE:
            store.delete_account(alias)
        return {'deleted': True}

    @app.post('/v1/accounts/{alias}/check')
    async def check_account(alias: str):
        account(alias)
        health = 'unknown'
        try:
            identity = await browser.check(alias)
            health = 'ok' if identity else 'expired'
        except Exception as exc:
            raise APIError('check_failed', 'No se pudo comprobar la sesión.', 409) from exc
        finally:
            value = account(alias)
            value['session_health'] = health
            value['session_checked_at'] = datetime.now(UTC).isoformat()
            store.put_account(alias, value)
        if not identity:
            raise APIError('requires_reauth', 'La sesión requiere reconexión.', 409)
        return {'identity': identity}

    @app.post('/v1/sessions/qr', status_code=202)
    async def qr(body: AliasBody):
        try:
            validate_alias(body.alias)
        except ValueError as exc:
            raise APIError('invalid_alias', 'Alias inválido.', 422) from exc
        if not settings.nexa_tiktok_encryption_key:
            raise APIError('encryption_key_required', 'Configura NEXA_TIKTOK_ENCRYPTION_KEY.', 503)
        return {'session_id': qr_login.start_qr_login(body.alias)}

    @app.get('/v1/sessions/{session_id}')
    async def get_session(session_id: str):
        return await qr_login.get_qr_login(session_id)

    @app.post('/v1/sessions/{session_id}/cancel')
    async def cancel_session(session_id: str):
        if not await qr_login.cancel_qr_login(session_id):
            raise APIError('session_not_active', 'Sesión inexistente o terminada.', 404)
        return {'state': 'cancelled'}

    @app.post('/v1/sessions/import')
    async def import_session(body: ImportBody):
        try:
            validate_alias(body.alias)
            session.normalize_cookies(body.cookies)
            identity = await session.import_session(body.alias, body.cookies, body.expected_username)
            return {'identity': identity}
        except ValueError as exc:
            raise APIError('invalid_cookies', 'Cookies o alias inválidos.', 422) from exc
        except Exception as exc:
            raise APIError('import_failed', 'No se pudo verificar la sesión importada.', 409) from exc

    @app.post('/v1/accounts/{alias}/videos', status_code=202)
    async def publish(alias: str, request: Request):
        account(alias)
        content_type = request.headers.get('content-type', '')
        uploaded = None
        if content_type.startswith('multipart/form-data'):
            form = await request.form()
            data = dict(form)
            uploaded = data.pop('file', None) or data.pop('video', None)
        else:
            try:
                data = await request.json()
            except Exception as exc:
                raise APIError('invalid_request', 'JSON inválido.', 422) from exc
        if not isinstance(data, dict):
            raise APIError('invalid_request', 'Se requiere un objeto.', 422)
        caption = data.get('caption', '')
        privacy = data.get('privacy', 'public')
        key = data.get('idempotency_key')
        first = data.get('first_comment')
        if not isinstance(caption, str) or not 1 <= len(caption.strip()) <= 2200:
            raise APIError('invalid_caption', 'La descripción debe tener entre 1 y 2200 caracteres.', 422)
        if not isinstance(privacy, str) or privacy not in {'public', 'friends', 'private'}:
            raise APIError('invalid_privacy', 'Visibilidad inválida.', 422)
        if not isinstance(key, str) or not 1 <= len(key) <= 200:
            raise APIError('invalid_idempotency_key', 'La clave de idempotencia es obligatoria.', 422)
        valid_text(caption)
        if first is not None:
            if not isinstance(first, str) or not 1 <= len(first.strip()) <= 120:
                raise APIError('invalid_comment', 'Comentario inválido.', 422)
            valid_text(first)
        path = data.get('video_path')
        if uploaded and hasattr(uploaded, 'read'):
            dest = store.root / 'uploads'
            dest.mkdir(parents=True, exist_ok=True, mode=0o700)
            path = str(dest / (secrets.token_hex(16) + '.mp4'))
            with open(path, 'wb') as file:  # noqa: ASYNC230 - existing streamed upload
                os.chmod(path, 0o600)
                while chunk := await uploaded.read(1024 * 1024):
                    file.write(chunk)
        if not isinstance(path, str) or not Path(path).is_file():
            raise APIError('video_missing', 'No existe el archivo de video.', 422)
        job = jobs.create(alias, 'publish', {'video_path': str(Path(path).absolute()), 'caption': caption,
                                            'privacy': privacy, 'first_comment': first}, key)
        return public_job(job)

    @app.get('/v1/accounts/{alias}/videos')
    async def videos(alias: str, refresh: bool = False):
        account(alias)
        if refresh:
            try:
                remote = await browser.sync(alias)
                existing = {v['id']: v for v in store.get_videos(alias)}
                for video in remote:
                    existing[video['id']] = {**existing.get(video['id'], {}), **video}
                store.put_videos(alias, list(existing.values()))
            except Exception as exc:
                raise APIError('sync_failed', 'No se pudo sincronizar TikTok Studio.', 502) from exc
        return store.get_videos(alias)

    @app.get('/v1/accounts/{alias}/videos/{video_id}')
    async def get_video(alias: str, video_id: str):
        account(alias)
        for video in store.get_videos(alias):
            if video['id'] == video_id:
                return video
        raise APIError('video_not_found', 'Video inexistente.', 404)

    @app.delete('/v1/accounts/{alias}/videos/{video_id}', status_code=202)
    async def delete_video(alias: str, video_id: str):
        account(alias)
        if not video_id.isdigit():
            raise APIError('invalid_video_id', 'ID de video inválido.', 422)
        return public_job(jobs.create(alias, 'delete', {'video_id': video_id}, None))

    @app.post('/v1/accounts/{alias}/videos/{video_id}/comments', status_code=202)
    async def post_comment(alias: str, video_id: str, body: CommentBody):
        account(alias)
        if not video_id.isdigit():
            raise APIError('invalid_video_id', 'ID de video inválido.', 422)
        valid_text(body.text)
        return public_job(jobs.create(alias, 'comment', {'video_id': video_id, 'text': body.text}, body.idempotency_key))

    @app.get('/v1/jobs')
    async def list_jobs():
        return [public_job(job) for job in store.list_jobs() if job.get('state') == 'needs_review']

    @app.get('/v1/jobs/{job_id}')
    async def get_job(job_id: str):
        try:
            job = store.get_job(job_id)
        except ValueError:
            job = None
        if not job:
            raise APIError('job_not_found', 'Job inexistente.', 404)
        return public_job(job)

    return app


app = create_app()
