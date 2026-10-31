import asyncio
import logging
import secrets
from typing import Any

from nexa_tiktok.config import settings
from nexa_tiktok.domain.models import Job
from nexa_tiktok.ports.browser_port import BrowserPort
from nexa_tiktok.ports.store_port import JobStore, VideoStore


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
            if job['kind'] == 'publish':
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
            if job['kind'] == 'publish' and not result.get('post_id'):
                raise ValueError('La publicación no tiene un identificador confirmado.')
            job['result'] = result
            if job['kind'] == 'publish' and result.get('post_id'):
                videos = self.videos.get_videos(job['alias'])
                videos = [v for v in videos if v['id'] != result['post_id']]
                videos.append({'id': result['post_id'], 'caption': job['payload']['caption'],
                               'url': result.get('url'), 'status': result.get('status')})
                self.videos.put_videos(job['alias'], videos)
            elif job['kind'] == 'delete':
                videos = self.videos.get_videos(job['alias'])
                self.videos.put_videos(job['alias'], [v for v in videos if v['id'] != job['payload']['video_id']])
            job['state'] = 'done'
            job['steps'].append('confirmado')
        except Exception as exc:  # noqa: BLE001 - never replay after an uncertain browser operation
            code = 'browser_timeout' if isinstance(exc, TimeoutError) else getattr(exc, 'code', 'browser_error')
            job['state'] = 'needs_review' if job['state'] == 'clicked' else 'failed'
            job['error'] = {'code': code, 'message': 'La operación no se pudo confirmar; revisa TikTok Studio.'}
        self.store.put_job(job)
