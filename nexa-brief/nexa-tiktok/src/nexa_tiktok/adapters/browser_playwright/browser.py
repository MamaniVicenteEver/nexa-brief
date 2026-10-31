from collections.abc import Awaitable, Callable
from dataclasses import asdict
from pathlib import Path
from typing import Any

from nexa_tiktok.adapters.browser_playwright import catalog, comment, delete, session, uploader
from nexa_tiktok.adapters.browser_playwright.profiles import open_browser
from nexa_tiktok.config import settings


class PlaywrightBrowser:
    async def check(self, alias: str) -> dict[str, Any] | None:
        return await session.check_session(alias)

    async def sync(self, alias: str) -> list[dict[str, Any]]:
        async with open_browser(alias) as context:
            page = await context.new_page()
            await session.verify_page(page, context)
            await page.close()
            return await catalog.list_studio(context)

    async def perform(self, job: dict[str, Any], before_click: Callable[[], Awaitable[None]]) -> dict[str, Any]:
        alias, payload = job['alias'], job['payload']
        async with open_browser(alias) as context:
            page = await context.new_page()
            identity = await session.verify_page(page, context)
            shots = settings.nexa_tiktok_data_dir / 'logs' / job['id']
            if job['kind'] == 'publish':
                outcome = await uploader.upload_video(context, Path(payload['video_path']), payload['caption'],
                                                       privacy=payload['privacy'], dry_run=False, shots_dir=shots,
                                                       before_click=before_click, username=str(identity['username']))
                result = asdict(outcome)
                if payload.get('first_comment'):
                    if not outcome.post_id:
                        raise uploader.TikTokUploadError('No se identificó el video para comentar.', code='publish_unknown')
                    url = outcome.url or f"https://www.tiktok.com/@{identity['username']}/video/{outcome.post_id}"
                    result['comment'] = asdict(await comment.post_first_comment(
                        context, url, payload['first_comment'], shots_dir=shots, before_click=before_click, username=str(identity['username'])))
                    if not result['comment']['verified']:
                        raise uploader.TikTokUploadError('No se confirmó el comentario.', code='comment_unknown')
                return result
            if job['kind'] == 'comment':
                url = f"https://www.tiktok.com/@{identity['username']}/video/{payload['video_id']}"
                outcome = await comment.post_first_comment(context, url, payload['text'], shots_dir=shots,
                                                           before_click=before_click, username=str(identity['username']))
                if not outcome.verified:
                    raise uploader.TikTokUploadError('No se confirmó el comentario.', code='comment_unknown')
                return asdict(outcome)
            return await delete.delete_video(context, payload['video_id'], before_click)
