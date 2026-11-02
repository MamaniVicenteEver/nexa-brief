import asyncio
import logging
import os
import secrets
from typing import Any

from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from nexa_tiktok.adapters.browser_playwright.uploader import TikTokUploadError
from nexa_tiktok.config import settings
from nexa_tiktok.domain.models import Job
from nexa_tiktok.ports.browser_port import BrowserPort
from nexa_tiktok.ports.store_port import JobStore, VideoStore


# Only fixed, reviewed application messages may enter persistent logs.
_SAFE_DETAILS = frozenset({
    'El campo de descripción no recibió el foco; se detuvo antes de continuar.',
    'El comentario debe tener entre 1 y 120 caracteres.',
    'El modal de descarte no fue reconocido; no se confirmó.',
    'El modal de revisiones opcionales no ofreció un botón Cancelar reconocible.',
    'El video siguió procesándose durante diez minutos; no se envió el comentario.',
    'La comprobación conocida no ofreció un botón de continuación reconocible.',
    'La confirmación del borrador no coincide con el descarte esperado.',
    'La confirmación no ofreció un botón Descartar reconocible.',
    'La descripción debe tener entre 1 y 2200 caracteres.',
    'La descripción escrita no coincide con el texto previsto.',
    'La descripción excede el límite de 2200 caracteres.',
    'La eliminación no se pudo confirmar.',
    'La visibilidad no quedó en público.',
    'No existe el archivo de video.',
    'No se encontró el botón principal Publicar; no se hizo ningún intento.',
    'No se encontró el campo de comentarios del video.',
    'No se encontró el campo de descripción en el editor.',
    'No se encontró el control de visibilidad de la publicación.',
    'No se encontró el control para enviar el comentario.',
    'No se encontró el selector de archivo de TikTok Studio.',
    'No se encontró la confirmación de eliminación.',
    'No se encontró la fila del video en Studio.',
    'No se pudo confirmar el ajuste de comentarios.',
    'No se pudo identificar la fila del video.',
    'No se pudo localizar el control visible del comentario.',
    'No se pudo localizar el control visible para pulsarlo.',
    'No se pudo verificar que los comentarios estén activados.',
    'Privacidad no admitida.',
    'Se pulsó Publicar una vez, pero TikTok no confirmó ID ni coincidencia en Contenido; estado desconocido, no se reintentará.',
    'TikTok abrió el menú de visibilidad, pero no apareció una opción reconocida.',
    'TikTok abrió un modal no reconocido después de publicar; se detuvo.',
    'TikTok mantuvo abierto el modal de revisiones opcionales.',
    'TikTok mantuvo el aviso del borrador previo después de descartarlo.',
    'TikTok mantuvo un modal después de las opciones conocidas.',
    'TikTok mostró un iframe de verificación; se detuvo sin resolverlo.',
    'TikTok mostró un modal no reconocido antes de completar la publicación.',
    'TikTok mostró un modal no reconocido durante el ajuste de visibilidad; se detuvo.',
    'TikTok mostró un modal no reconocido durante el ajuste de comentarios; se detuvo.',
    'TikTok mostró una página de verificación; se detuvo sin resolverla.',
    'TikTok mostró una verificación/captcha; se detuvo sin resolverla.',
    'TikTok muestra los comentarios, pero no se encontró un control verificable.',
    'TikTok no confirmó la visibilidad seleccionada; se detuvo.',
    'TikTok no terminó la carga ni mostró el editor dentro del tiempo esperado.',
    'TikTok ofreció continuar un borrador previo, pero no apareció Descartar.',
    'TikTok pidió confirmar el descarte con un control no reconocido.',
    'TikTok pidió iniciar sesión al abrir el video para comentar.',
    'TikTok redirigió al login al verificar la publicación.',
    'TikTok redirigió al login; se requiere reautenticación.',
    'TikTok solo ofrece Seguidores, Amigos y Solo tú; la cuenta parece privada. No se cambió la privacidad global.',
})


class Jobs:
    def __init__(self, store: JobStore, videos: VideoStore, browser: BrowserPort):
        self.store, self.videos, self.browser = store, videos, browser
        self.queue: asyncio.Queue[str] = asyncio.Queue()
        self.task: asyncio.Task | None = None
        self.recovering = True

    async def start(self) -> None:
        # Recovery failures must not prevent the API from starting; the
        # supervisor retries without replaying in-flight operations.
        try:
            self.recover()
        except Exception:
            logging.getLogger(__name__).exception('No se pudo recuperar la cola al iniciar')
            self.task = asyncio.create_task(self.supervise(recover_first=True))
            return
        self.recovering = False
        self.task = asyncio.create_task(self.supervise())

    def recover(self) -> None:
        for job in self.store.list_jobs():
            if job['state'] == 'clicked':
                job['state'] = 'needs_review'
                job['error'] = {'code': 'interrupted_after_click', 'message': 'Revisar en TikTok Studio; no se reintentó.'}
                job['steps'].append('interrumpido después del clic')
                self.store.put_job(job)
                self.queue.put_nowait('review:' + job['id'])
            elif job['state'] == 'running':
                job['state'] = 'needs_review'
                job['error'] = {'code': 'interrupted', 'message': 'Revisar en TikTok Studio; no se reintentó.'}
                job['steps'].append('interrumpido durante la operación')
                self.store.put_job(job)
                self.queue.put_nowait('review:' + job['id'])
            elif job['state'] == 'queued':
                job['state'] = 'queued'
                self.store.put_job(job)
                self.queue.put_nowait(job['id'])

    async def stop(self) -> None:
        if self.task:
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)

    def create(self, alias: str, kind: str, payload: dict[str, Any], key: str | None) -> dict[str, Any]:
        job = Job(id=secrets.token_urlsafe(18), alias=alias, kind=kind, payload=payload,
                  idempotency_key=key).model_dump()
        job, created = self.store.create_job(job)
        if created:
            self.queue.put_nowait(job['id'])
        return job

    async def supervise(self, *, recover_first: bool = False) -> None:
        while True:
            try:
                if recover_first:
                    self.recovering = True
                    self.recover()
                    self.recovering = False
                    recover_first = False
                await self.worker()
            except Exception:
                self.recovering = True
                logging.getLogger(__name__).exception('Worker detenido; se reiniciará')
                await asyncio.sleep(1)
                recover_first = True

    async def worker(self) -> None:
        while True:
            job_id = await self.queue.get()
            try:
                if job_id.startswith('review:'):
                    await self.reconcile(job_id[7:])
                else:
                    await self.run(job_id)
            finally:
                self.queue.task_done()

    async def reconcile(self, job_id: str) -> None:
        job = self.store.get_job(job_id)
        if not job or job['state'] != 'needs_review':
            return
        try:
            remote = await asyncio.wait_for(self.browser.sync(job['alias']), timeout=settings.nexa_tiktok_job_timeout)
            payload = job['payload']
            if job['kind'] in {'publish', 'photo'}:
                matches = [v for v in remote if v.get('caption') == payload.get('caption')]
            elif job['kind'] == 'delete':
                matches = [v for v in remote if v.get('id') == payload.get('video_id')]
            else:
                matches = []
            job['steps'].append(f"Studio consultado: {len(matches)} coincidencias; revisión manual requerida")
        except Exception:  # noqa: BLE001 - reconciliation must leave uncertain work for review
            job['steps'].append('No se pudo consultar Studio; revisión manual requerida')
        self.store.put_job(job)

    async def run(self, job_id: str) -> None:
        job = self.store.get_job(job_id)
        if not job or job['state'] != 'queued':
            return
        job['state'] = 'running'
        job['steps'].append('navegador iniciado')
        self.store.put_job(job)

        async def before_click() -> None:
            job['state'] = 'clicked'
            job['steps'].append('clic preparado')
            self.store.put_job(job)

        try:
            result = await asyncio.wait_for(
                self.browser.perform(job, before_click), timeout=settings.nexa_tiktok_job_timeout,
            )
            if job['kind'] in {'publish', 'photo'} and not result.get('post_id'):
                raise ValueError('La publicación no tiene un identificador confirmado.')
            job['result'] = result
            if job['kind'] in {'publish', 'photo'} and result.get('post_id'):
                videos = self.videos.get_videos(job['alias'])
                videos = [v for v in videos if v['id'] != result['post_id']]
                videos.append({'id': result['post_id'], 'caption': job['payload']['caption'],
                               'url': result.get('url'), 'status': result.get('status'),
                               'media_type': 'photo' if job['kind'] == 'photo' else 'video'})
                self.videos.put_videos(job['alias'], videos)
            elif job['kind'] == 'delete':
                videos = self.videos.get_videos(job['alias'])
                self.videos.put_videos(job['alias'], [v for v in videos if v['id'] != job['payload']['video_id']])
            job['state'] = 'done'
            job['steps'].append('confirmado')
        except Exception as exc:  # noqa: BLE001 - never replay after an uncertain browser operation
            code = 'browser_timeout' if isinstance(exc, (TimeoutError, PlaywrightTimeoutError)) else getattr(exc, 'code', 'browser_error')
            if job['kind'] in {'publish', 'photo', 'comment'} and job['state'] != 'clicked' and code in {'challenge_required', 'requires_reauth'}:
                code = 'human_verification_required'
                job['state'] = 'needs_review'
                job['steps'].append('verificación humana requerida; no se reintentará el job')
            else:
                job['state'] = 'needs_review' if job['state'] == 'clicked' else 'failed'
            job['error'] = {'code': code, 'message': 'La operación no se pudo confirmar; revisa TikTok Studio.'}
            # Browser/library exceptions may embed URLs, headers or credentials. Only
            # uploader messages originate from our own controlled diagnostic text.
            detail = str(exc) if isinstance(exc, TikTokUploadError) and str(exc) in _SAFE_DETAILS else f'{type(exc).__name__}: detalle externo omitido'
            try:
                log_dir = settings.nexa_tiktok_data_dir / 'logs' / job_id
                log_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
                log_dir.chmod(0o700)
                fd = os.open(log_dir / 'error.log', os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
                with os.fdopen(fd, 'w', encoding='utf-8') as log:
                    log.write(f'{code}: {detail}\n')
            except OSError:
                logging.getLogger(__name__).warning('No se pudo guardar el diagnóstico del job')
        self.store.put_job(job)
