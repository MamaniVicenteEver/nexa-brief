"""Change a published post's visibility using the exact Studio row."""
import asyncio
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

from nexa_tiktok.adapters.browser_playwright.selectors import CONTENT_URL, PRIVACY_VALUES
from nexa_tiktok.adapters.browser_playwright.uploader import (
    TikTokUploadError, _detect_manual_intervention, capture_step, capture_failure, _secure_shots_dir,
)


def privacy_from_label(label: str) -> str | None:
    value = label.strip().casefold()
    return next((key for key, labels in PRIVACY_VALUES.items()
                 if value in {label.casefold() for label in labels}), None)


async def edit_privacy(context, video_id, privacy, *, shots_dir: Path, before_click, dry_run=False):
    if privacy not in PRIVACY_VALUES or not video_id.isdigit():
        raise TikTokUploadError('Privacidad o ID inválido.', code='invalid_privacy')
    _secure_shots_dir(shots_dir)
    page = await context.new_page()
    try:
        await page.goto(CONTENT_URL, wait_until='domcontentloaded', timeout=45000)
        await page.wait_for_function('''id => Array.from(document.querySelectorAll('a[href]')).some(a => {
            try { return new URL(a.href).pathname.split('/').filter(Boolean).slice(-2).join('/') === `video/${id}`; }
            catch { return false; }
        })''', arg=video_id, timeout=30000)
        hrefs = await page.locator('a[href*="/video/"]').evaluate_all('(links) => links.map(a => a.getAttribute("href"))')
        matching = [href for href in hrefs if re.search(r'/video/' + re.escape(video_id) + r'/?$', urlsplit(href).path)]
        if len(matching) != 1:
            raise TikTokUploadError('No se identificó una única fila del video.', code='video_not_found')
        link = page.locator(f'a[href={json.dumps(matching[0])}]')
        await link.first.wait_for(state='visible', timeout=30000)
        await _detect_manual_intervention(page)
        if await link.count() != 1:
            raise TikTokUploadError('No se identificó una única fila del video.', code='video_not_found')
        row = link.locator('xpath=ancestor::div[@data-tt="components_RowLayout_FlexRow"][1]')
        control = row.locator('button[data-tt="components_PrivacyCell_TUXButton"]')
        if await row.count() != 1 or await control.count() != 1:
            raise TikTokUploadError('No se identificó el control de privacidad.', code='privacy_control_missing')
        await capture_step(page, shots_dir, 1, 'fila-video')
        if privacy_from_label(await control.inner_text()) == privacy:
            return {'id': video_id, 'privacy': privacy, 'changed': False, 'verified': True}
        await control.click()
        menu = page.locator('[role="dialog"] [data-tt="components_Select_Container"]')
        await menu.first.wait_for(state='visible', timeout=5000)
        await capture_step(page, shots_dir, 2, 'menu-privacidad')
        options = menu.filter(has=page.get_by_text(re.compile(
            '^(?:' + '|'.join(re.escape(s) for s in PRIVACY_VALUES[privacy]) + ')$', re.I)))
        if await options.count() != 1 or not await options.first.is_visible():
            raise TikTokUploadError('No se identificó una única opción de privacidad.', code='privacy_option_missing')
        if dry_run:
            return {'id': video_id, 'privacy': privacy, 'dry_run': True}
        # Selecting the option may immediately persist the change; never click it twice.
        await before_click()
        await options.first.click(timeout=5000)
        deadline = asyncio.get_running_loop().time() + 20
        while asyncio.get_running_loop().time() < deadline:
            await _detect_manual_intervention(page)
            if privacy_from_label(await control.inner_text()) == privacy:
                await capture_step(page, shots_dir, 3, 'privacidad-confirmada')
                return {'id': video_id, 'privacy': privacy, 'changed': True, 'verified': True}
            await asyncio.sleep(1)
        raise TikTokUploadError('No se confirmó la privacidad en Studio.', code='privacy_unknown')
    except Exception as exc:
        await capture_failure(page, shots_dir, exc, after_publish_click=False)
        raise
    finally:
        await page.close()
