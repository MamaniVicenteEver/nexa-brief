"""TikTok Studio's separate photo-post flow."""

import asyncio
from pathlib import Path

from playwright.async_api import BrowserContext

from nexa_tiktok.adapters.browser_playwright import uploader as common
from nexa_tiktok.adapters.browser_playwright.selectors import Candidate, PUBLISH_BUTTONS, first_visible

PHOTO_TABS = (Candidate('role', 'Fotos', role='tab', exact=True),
              Candidate('role', 'Photos', role='tab', exact=True))
PHOTO_FILE_INPUT = 'input[type="file"][multiple][accept*="image/"]'
PHOTO_CAPTION = '[contenteditable="true"][role="combobox"]'


async def upload_photos(context: BrowserContext, image_paths: list[Path], caption: str, *, privacy: str,
                        dry_run: bool, shots_dir: Path, before_click, username: str) -> common.UploadOutcome:
    if not 1 <= len(image_paths) <= 35 or any(not Path(path).is_file() for path in image_paths):
        raise common.TikTokUploadError('Se requieren entre 1 y 35 imágenes existentes.', code='invalid_images')
    if not caption.strip() or len(caption.strip()) > common.MAX_CAPTION_LENGTH:
        raise common.TikTokUploadError('La descripción debe tener entre 1 y 2200 caracteres.', code='invalid_caption')
    common._secure_shots_dir(shots_dir)
    page = context.pages[0] if context.pages else await context.new_page()
    clicked = False
    uploaded = False
    listener = None

    async def shot(number: int, label: str) -> None:
        if not dry_run:
            return
        await common._detect_manual_intervention(page)
        path = shots_dir / f'{number:02d}-{label}.png'
        await page.screenshot(path=str(path), full_page=True, timeout=10000)
        path.chmod(0o600)

    try:
        await page.goto(common.UPLOAD_URL, wait_until='domcontentloaded', timeout=45000)
        await common._detect_manual_intervention(page)
        await common._ensure_no_dialog(page, 'la apertura del editor')
        tab = None
        deadline = asyncio.get_running_loop().time() + 60
        while tab is None and asyncio.get_running_loop().time() < deadline:
            await common._detect_manual_intervention(page)
            tab = await first_visible(page, PHOTO_TABS, timeout_ms=500)
            if tab is None:
                await asyncio.sleep(1)
        if tab is None:
            raise common.TikTokUploadError('No se encontró la pestaña Fotos.', code='photo_tab_missing')
        await shot(1, 'carga')
        await common._move_and_click(page, tab)
        await common._human_pause()
        file_input = page.locator(PHOTO_FILE_INPUT)
        if await file_input.count() != 1:
            raise common.TikTokUploadError('No se encontró una entrada múltiple de imágenes.', code='photo_input_missing')
        await shot(2, 'pestana-fotos')
        await file_input.set_input_files([str(path) for path in image_paths])
        uploaded = True
        await common._wait_for_editor(page)
        if await page.locator(PHOTO_CAPTION).count() != 1:
            raise common.TikTokUploadError('No se encontró el editor de descripción de fotos.', code='photo_editor_missing')
        await common._dismiss_pre_publish_prompts(page, shots_dir, 3)
        await shot(3, 'fotos-cargadas')
        await common._enter_caption(page, caption.strip())
        await shot(4, 'descripcion')
        await common._set_privacy(page, privacy)
        await common._ensure_no_dialog(page, 'el ajuste de visibilidad')
        await shot(5, 'privacidad')
        await common._expand_settings_for_comments(page)
        await common._set_comments_enabled(page)
        await common._ensure_no_dialog(page, 'el ajuste de comentarios')
        await shot(6, 'ajustes')
        if dry_run:
            discarded = await common._discard_draft(page, shots_dir, 7)
            if not discarded or await page.locator(PHOTO_FILE_INPUT).count() != 1:
                raise common.TikTokUploadError('No se pudo descartar el borrador de fotos.', code='draft_cleanup_failed')
            await shot(7, 'descartado')
            return common.UploadOutcome(None, None, 'dry_run', False, True, draft_discarded=True)
        button = await first_visible(page, PUBLISH_BUTTONS, timeout_ms=700)
        if button is None:
            raise common.TikTokUploadError('No se encontró el botón Publicar.', code='publish_button_missing')
        event, response, listener = await common._capture_publication_response(page)
        await common._detect_manual_intervention(page)
        await before_click()
        clicked = True
        page._nexa_publish_clicked = True
        await common._move_and_click(page, button)
        # No confirmation or retry may make a second publish click.
        await common._ensure_no_dialog(page, 'la publicación')
        deadline = asyncio.get_running_loop().time() + common.PUBLISH_TIMEOUT_SECONDS
        while not event.is_set() and asyncio.get_running_loop().time() < deadline:
            await common._detect_manual_intervention(page)
            await asyncio.sleep(1.5)
        if not response.get('post_id'):
            raise common.TikTokUploadError('TikTok no confirmó el identificador de la publicación.',
                                           code='publish_unknown', after_publish_click=True)
        outcome = await common._inspect_content(page, caption, response['post_id'], username=username)
        await common._detect_manual_intervention(page)
        outcome.url = f"https://www.tiktok.com/@{username}/photo/{outcome.post_id}"
        outcome.publication_endpoint = response.get('endpoint')
        return outcome
    except Exception as exc:
        await common.capture_failure(page, shots_dir, exc, after_publish_click=clicked)
        if dry_run and uploaded and not clicked and not isinstance(exc, common.ManualInterventionRequired):
            try:
                await common._discard_draft(page, shots_dir, 90)
            except Exception:
                pass
        raise
    finally:
        if listener is not None:
            page.remove_listener('response', listener)
