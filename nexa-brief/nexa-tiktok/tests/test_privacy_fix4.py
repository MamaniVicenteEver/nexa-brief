import pytest
from playwright.async_api import async_playwright

from nexa_tiktok.adapters.browser_playwright import privacy, uploader


@pytest.fixture
async def page():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        page.set_default_timeout(1200)
        yield page
        await browser.close()


async def test_editor_privacy_rerender_and_open_menu(page, monkeypatch):
    await page.set_content('''<div data-e2e="video_visibility_container"><button role="combobox">Quién puede ver esta publicación</button></div>
      <div role="listbox" hidden><div role="option">Todo el mundo</div></div>
      <script>
      const container = document.querySelector('[data-e2e]'), menu = document.querySelector('[role=listbox]');
      container.onclick = () => menu.hidden = false;
      document.querySelector('[role=option]').onclick = () => {
        container.innerHTML = '<button role="combobox">Todo el mundo</button>';
      };
      document.addEventListener('keydown', e => { if(e.key === 'Escape') menu.hidden = true });
      </script>''')
    async def no_pause(): pass
    monkeypatch.setattr(uploader, '_human_pause', no_pause)
    assert await uploader._set_privacy(page, 'public') == 'Todo el mundo'
    assert await page.locator('[role=listbox]').is_hidden()
    assert await page.locator('[role=combobox]').inner_text() == 'Todo el mundo'


async def test_exact_video_id_with_shared_prefix(page, monkeypatch, tmp_path):
    html = '''<div data-tt="components_RowLayout_FlexRow"><a href="/video/1234">wrong</a>
      <button data-tt="components_PrivacyCell_TUXButton">Solo yo</button></div>
      <div data-tt="components_RowLayout_FlexRow"><a href="/video/123?x=1">correct</a>
      <button data-tt="components_PrivacyCell_TUXButton">Todo el mundo</button></div>'''
    await page.route('**/*', lambda route: route.fulfill(body=html, content_type='text/html'))
    context = page.context
    async def reuse_page(): return page
    monkeypatch.setattr(context, 'new_page', reuse_page)
    async def before_click(): pytest.fail('No debe guardar')
    result = await privacy.edit_privacy(context, '123', 'public', shots_dir=tmp_path, before_click=before_click, dry_run=True)
    assert result['id'] == '123' and result['changed'] is False


@pytest.mark.parametrize('kind', ['video', 'photo'])
async def test_offline_dry_run_uploads_cross_privacy(page, monkeypatch, tmp_path, kind):
    """Exercise both upload orchestrators and the real privacy step against local HTML."""
    import os
    from pathlib import Path
    from unittest.mock import AsyncMock
    from nexa_tiktok.adapters.browser_playwright import photo_uploader

    html = '''<h1>Editor simulado sin conexión</h1><button role="tab">Fotos</button>
    <input type="file" accept="video/mp4"><input type="file" multiple accept="image/png">
    <div contenteditable="true" role="combobox"></div>
    <div data-e2e="video_visibility_container"><button role="combobox">Solo tú</button></div>
    <div role="listbox" hidden><div role="option">Todo el mundo</div></div>
    <p>Listo para publicar (simulación)</p>
    <script>
    const c = document.querySelector('[data-e2e]'), m = document.querySelector('[role=listbox]');
    c.onclick = () => m.hidden = false;
    document.querySelector('[role=option]').onclick = () => { c.querySelector('button').textContent = 'Todo el mundo'; };
    document.addEventListener('keydown', e => { if (e.key === 'Escape') m.hidden = true });
    </script>'''
    await page.route('**/*', lambda route: route.fulfill(body=html, content_type='text/html'))
    media = tmp_path / ('video.mp4' if kind == 'video' else 'photo.png')
    media.write_bytes(b'synthetic media')
    for name in ('_human_pause', '_dismiss_unsaved_edit_prompt', '_wait_for_editor', '_enter_caption',
                 '_expand_settings_for_comments', '_set_comments_enabled'):
        monkeypatch.setattr(uploader, name, AsyncMock())
    monkeypatch.setattr(uploader, '_dismiss_pre_publish_prompts', AsyncMock(return_value=4))
    monkeypatch.setattr(uploader, '_discard_draft', AsyncMock(return_value=True))
    async def before_click(): pytest.fail('La pasada en seco no debe publicar')
    root = Path(os.environ.get('FIX4_SHOTS_DIR', str(tmp_path / 'shots')))
    shots = root / kind
    if kind == 'video':
        result = await uploader.upload_video(page.context, media, 'Prueba', privacy='public', dry_run=True,
                                             shots_dir=shots, before_click=before_click, username='synthetic')
    else:
        result = await photo_uploader.upload_photos(page.context, [media], 'Prueba', privacy='public', dry_run=True,
                                                    shots_dir=shots, before_click=before_click, username='synthetic')
    assert result.dry_run and result.draft_discarded
    assert await page.locator('[data-e2e] button').inner_text() == 'Todo el mundo'
    assert await page.locator('[role=listbox]').is_hidden()
    assert any(shots.glob('*visibilidad.png')) if kind == 'video' else any(shots.glob('*privacidad.png'))


@pytest.mark.parametrize('rerender_option,escape_closes,update_value,success', [
    (True, True, True, True),
    (True, False, True, False),
    (False, True, True, True),
    (False, True, False, False),
    (False, False, True, False),
])
async def test_privacy_menu_confirmation_after_selection(
    page, monkeypatch, rerender_option, escape_closes, update_value, success
):
    """Review reproduction: innerHTML replaces the option while its menu remains open."""
    on_select = 'window.selections++;'
    if update_value:
        on_select += "c.innerHTML='<button role=combobox>Todo el mundo</button>';"
    if rerender_option:
        on_select += "m.innerHTML='<div role=option aria-selected=true>Todo el mundo</div>';"
    on_escape = 'm.hidden=true;' if escape_closes else ''
    await page.set_content(f'''<div data-e2e="video_visibility_container"><button role="combobox">Solo tú</button></div>
      <div id="menu" role="listbox" hidden><div role="option">Todo el mundo</div></div>
      <script>
      window.selections=0; window.escapes=0;
      const c=document.querySelector('[data-e2e]'), m=document.querySelector('#menu');
      c.onclick=()=>m.hidden=false;
      m.onclick=()=>{{{on_select}}};
      document.addEventListener('keydown', e=>{{if(e.key==='Escape'){{window.escapes++;{on_escape}}}}});
      </script>''')
    async def no_pause(): pass
    monkeypatch.setattr(uploader, '_human_pause', no_pause)
    if success:
        assert await uploader._set_privacy(page, 'public') == 'Todo el mundo'
        assert await page.locator('#menu').is_hidden()
        assert await page.locator('[data-e2e] button').inner_text() == 'Todo el mundo'
    else:
        with pytest.raises(uploader.TikTokUploadError) as failure:
            await uploader._set_privacy(page, 'public')
        assert failure.value.code == 'privacy_selection_unconfirmed'
        assert await page.locator('#menu').is_visible() == (not escape_closes)
    assert await page.evaluate('window.selections') == 1
    assert await page.evaluate('window.escapes') == 1
