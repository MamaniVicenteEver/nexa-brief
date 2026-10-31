import asyncio
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from playwright.async_api import BrowserContext

from nexa_tiktok.adapters.browser_playwright.selectors import CONTENT_URL
from nexa_tiktok.adapters.browser_playwright.uploader import _detect_manual_intervention


def parse_catalog(payload: Any) -> list[dict[str, Any]] | None:
    """Recognize Studio item lists; do not treat an unrelated JSON response as empty content."""
    if not isinstance(payload, dict):
        return None
    for key, value in payload.items():
        if key.lower() in {'item_list', 'itemlist', 'aweme_list', 'video_list', 'videos'} and isinstance(value, list):
            result = []
            for item in value:
                if not isinstance(item, dict):
                    continue
                video_id = item.get('item_id') or item.get('aweme_id') or item.get('video_id') or item.get('id')
                if not video_id:
                    continue
                parts = urlsplit(str(item.get('share_url') or ''))
                host = parts.hostname or ''
                url = None
                if parts.scheme == 'https' and (host == 'tiktok.com' or host.endswith('.tiktok.com')):
                    url = urlunsplit((parts.scheme, parts.netloc, parts.path, '', ''))
                result.append({'id': str(video_id), 'caption': str(item.get('desc') or item.get('description') or ''),
                               'status': str(item.get('status') or ''), 'url': url})
            return result
        if isinstance(value, dict):
            found = parse_catalog(value)
            if found is not None:
                return found
    return None


async def list_studio(context: BrowserContext) -> list[dict[str, Any]]:
    page = await context.new_page()
    pending: set[asyncio.Task] = set()
    batches: list[list[dict[str, Any]]] = []

    async def read(response: Any) -> None:
        try:
            host = urlsplit(response.url).hostname or ''
            if not (host == 'tiktok.com' or host.endswith('.tiktok.com')) or response.status != 200:
                return
            if 'json' not in (await response.header_value('content-type') or '').lower():
                return
            result = parse_catalog(await response.json())
            if result is not None:
                batches.append(result)
        except Exception:
            pass

    def on_response(response: Any) -> None:
        task = asyncio.create_task(read(response))
        pending.add(task)
        task.add_done_callback(pending.discard)

    page.on('response', on_response)
    try:
        await page.goto(CONTENT_URL, wait_until='domcontentloaded', timeout=45000)
        if '/login' in page.url.lower():
            raise RuntimeError('La sesión requiere reconexión.')
        await page.wait_for_timeout(8000)
        await _detect_manual_intervention(page)
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
        if not batches:
            raise RuntimeError('No se reconoció la respuesta JSON de contenido de TikTok Studio.')
        return list({item['id']: item for batch in batches for item in batch}.values())
    finally:
        page.remove_listener('response', on_response)
        for task in pending:
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
        await page.close()
