import pytest
from playwright.async_api import async_playwright

from nexa_tiktok.adapters.browser_playwright import uploader


@pytest.mark.parametrize('initial', ['', 'codex-titanic-9x16-10s'])
async def test_caption_replaces_existing_text_and_waits_for_counter(initial, monkeypatch):
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        try:
            page = await browser.new_page()
            await page.set_content('''<div data-e2e="caption_container">
                <div contenteditable="true"></div><span id="counter"><span>0</span><span>/4000</span></span></div>
                <script>const e = document.querySelector('[contenteditable]');
                e.addEventListener('input', () => { document.querySelector('#counter span').textContent = e.innerText.length; });</script>''')
            editor = page.locator('[contenteditable]')
            await editor.fill(initial)
            async def fast_type(page, text):
                await page.keyboard.insert_text(text)
            monkeypatch.setattr(uploader, '_type_human', fast_type)
            await uploader._enter_caption(page, 'Prueba real #sistema')
            assert await editor.inner_text() == 'Prueba real #sistema'
            assert await page.locator('#counter').inner_text() == '20/4000'
        finally:
            await browser.close()


async def test_caption_retries_only_after_mismatch(monkeypatch):
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        try:
            page = await browser.new_page()
            await page.set_content('<div contenteditable="true">archivo</div>')
            attempts = []
            async def type_with_first_character_lost(page, text):
                attempts.append(text)
                await page.keyboard.insert_text(text[1:] if len(attempts) == 1 else text)
            async def check(locator, expected, *, require_counter):
                if ' '.join((await locator.inner_text()).split()) != expected:
                    raise uploader.TikTokUploadError('mismatch', code='caption_mismatch')
            monkeypatch.setattr(uploader, '_type_human', type_with_first_character_lost)
            monkeypatch.setattr(uploader, '_wait_caption_state', check)
            await uploader._enter_caption(page, 'Prueba')
            assert len(attempts) == 2
            assert await page.locator('[contenteditable]').inner_text() == 'Prueba'
        finally:
            await browser.close()
