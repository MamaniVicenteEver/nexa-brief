"""Publisher and catalog backed by nexa-tiktok jobs."""
from urllib.parse import quote
from pathlib import Path
import hashlib
import re
from src.config.settings import settings

from src.config.exceptions import PublisherError, UnsupportedOperationError
from src.core.ports.publisher_port import PublisherPort, PublishVideoResult, VideoMetadata
from src.core.ports.channel_catalog_port import ChannelCatalogPort, ChannelStats, RemoteVideo
from .client import TikTokServiceClient


class TikTokServiceAdapter(PublisherPort, ChannelCatalogPort):
    def __init__(self, client=None):
        self.client = client or TikTokServiceClient()

    @staticmethod
    def _operation_key(value: str) -> str:
        namespace = settings.tiktok_idempotency_namespace
        return f"{namespace}:{hashlib.sha256(value.encode()).hexdigest()}" if namespace else value

    async def publish_images(self, image_paths, description, account_alias, *, idempotency_key=None, first_comment=None, privacy='public', on_job=None):
        if not idempotency_key:
            raise PublisherError('Se requiere una clave estable para publicar en TikTok.')
        data = {
            'image_paths': [await self.client.stage_media(Path(path)) for path in image_paths],
            'caption': description, 'privacy': {'friends_only': 'friends'}.get(privacy, privacy),
            'idempotency_key': self._operation_key(idempotency_key), 'first_comment': first_comment,
        }
        job = await self.client.request('POST', f'/v1/accounts/{quote(account_alias, safe="")}/photos', json=data)
        job_id = job.get('id') if isinstance(job, dict) else None
        if not isinstance(job_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', job_id):
            raise PublisherError('Respuesta de job TikTok inválida; revisar antes de reintentar.')
        if on_job is not None:
            await on_job(job_id)
        result = await self.client.wait_job(job)
        if not result.get('post_id') or not result.get('url'):
            raise PublisherError(f"TikTok job {job['id']} terminó sin identificación verificable; revisar antes de reintentar.")
        return PublishVideoResult(str(result['post_id']), result['url'], 'tiktok', account_alias, result)

    async def reconcile_images(self, job_id, account_alias):
        if not isinstance(job_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', job_id):
            raise PublisherError('Falta el ID del job TikTok; se requiere revisión manual.')
        job = await self.client.request('GET', f'/v1/jobs/{job_id}')
        if not isinstance(job, dict) or job.get('id') != job_id or job.get('state') != 'done':
            raise PublisherError('El job TikTok no está confirmado; se requiere revisión.')
        result = job.get('result')
        if not isinstance(result, dict) or not result.get('post_id') or not result.get('url'):
            raise PublisherError('El job TikTok no tiene identificación verificable; se requiere revisión.')
        return PublishVideoResult(str(result['post_id']), result['url'], 'tiktok', account_alias, result)

    async def publish(self, video_path, title, description, tags, account_alias, *, privacy='public', **kwargs):
        if kwargs.get('dry_run'):
            raise UnsupportedOperationError('El servicio TikTok no admite simulación de publicación.')
        if not kwargs.get('idempotency_key'):
            raise PublisherError('Se requiere una clave estable para publicar en TikTok.')
        caption = '\n\n'.join(x for x in (title.strip(), description.strip(), ' '.join('#' + t.lstrip('#') for t in tags)) if x)
        data = {'video_path': await self.client.stage_media(video_path), 'caption': caption, 'privacy': {'friends_only': 'friends'}.get(privacy, privacy), 'idempotency_key': self._operation_key(kwargs['idempotency_key']), 'first_comment': kwargs.get('first_comment')}
        job = await self.client.request('POST', f'/v1/accounts/{quote(account_alias, safe="")}/videos', json=data)
        result = await self.client.wait_job(job)
        if not result.get('post_id') or not result.get('url'):
            raise PublisherError(f"TikTok job {job['id']} terminó sin identificación verificable; revisar antes de reintentar.")
        return PublishVideoResult(str(result['post_id']), result['url'], 'tiktok', account_alias, result)

    async def get_video(self, video_id, account_alias):
        video = await self.client.request('GET', f'/v1/accounts/{quote(account_alias, safe="")}/videos/{quote(video_id, safe="")}')
        return VideoMetadata(str(video['id']), video.get('caption') or '', video.get('caption') or '', [], video.get('status') or 'unknown', 'tiktok', video)

    async def update_video(self, video_id, account_alias, **kwargs):
        raise UnsupportedOperationError('TikTok Studio no permite editar este video desde Nexa.')

    async def delete_video(self, video_id, account_alias):
        job = await self.client.request('DELETE', f'/v1/accounts/{quote(account_alias, safe="")}/videos/{quote(video_id, safe="")}')
        await self.client.wait_job(job)
        return True

    async def list_channel_videos(self, account_alias, *, limit=None):
        videos = await self.client.request('GET', f'/v1/accounts/{quote(account_alias, safe="")}/videos', params={'refresh': 1})
        result = [RemoteVideo(post_id=str(v['id']), url=v.get('url') or '', title=v.get('caption') or '', published_at=float(v.get('published_at') or 0), privacy=v.get('privacy') or 'unknown', views=v.get('views'), likes=v.get('likes'), comments=v.get('comments')) for v in videos]
        return result[:limit] if limit is not None else result

    async def get_channel_stats(self, account_alias):
        return ChannelStats()
