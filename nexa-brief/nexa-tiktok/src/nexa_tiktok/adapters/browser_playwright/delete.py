from collections.abc import Awaitable, Callable

from playwright.async_api import BrowserContext

from nexa_tiktok.adapters.browser_playwright.selectors import CONTENT_URL
from nexa_tiktok.adapters.browser_playwright.uploader import (
    TikTokUploadError,
    _detect_manual_intervention,
    _human_pause,
    _move_and_click,
)


async def delete_video(context: BrowserContext, video_id: str, before_click: Callable[[], Awaitable[None]]) -> dict:
    page = await context.new_page()
    try:
        await page.goto(CONTENT_URL, wait_until='domcontentloaded', timeout=45000)
        await page.wait_for_timeout(5000)
        await _detect_manual_intervention(page)
        link = page.locator(f'a[href*="/video/{video_id}"]').first
        if not await link.is_visible(timeout=3000):
            raise TikTokUploadError('No se encontró la fila del video en Studio.', code='video_not_found')
        row = link.locator('xpath=ancestor::*[self::tr or @role="row"][1]')
        if not await row.count():
            raise TikTokUploadError('No se pudo identificar la fila del video.', code='delete_unavailable')
        menu = row.get_by_role('button', name='Más opciones').or_(row.get_by_role('button', name='More options')).first
        await _move_and_click(page, menu)
        option = page.get_by_role('menuitem', name='Eliminar', exact=True).or_(
            page.get_by_role('menuitem', name='Delete', exact=True)).first
        await _move_and_click(page, option)
        dialog = page.get_by_role('dialog').last
        confirm = dialog.get_by_role('button', name='Eliminar', exact=True).or_(
            dialog.get_by_role('button', name='Delete', exact=True)).first
        if not await confirm.is_visible(timeout=3000):
            raise TikTokUploadError('No se encontró la confirmación de eliminación.', code='delete_unavailable')
        await _human_pause()
        await before_click()
        await _move_and_click(page, confirm)
        await page.wait_for_timeout(3000)
        if await link.is_visible():
            raise TikTokUploadError('La eliminación no se pudo confirmar.', code='delete_unknown')
        return {'id': video_id, 'deleted': True}
    finally:
        await page.close()
