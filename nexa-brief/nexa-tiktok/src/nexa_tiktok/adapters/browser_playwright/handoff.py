"""Short-lived human control of a persistent browser profile over CDP."""
import asyncio
import contextlib
import re
from datetime import UTC, datetime
from urllib.parse import unquote, urlsplit

from starlette.websockets import WebSocket, WebSocketDisconnect

from nexa_tiktok.adapters.browser_playwright import profiles
from nexa_tiktok.adapters.browser_playwright.selectors import UPLOAD_URL

TIMEOUT_SECONDS = 600


def allowed_url(url: str, username: str) -> bool:
    parts = urlsplit(url)
    host = (parts.hostname or '').lower()
    if parts.scheme != 'https' or not (host == 'tiktok.com' or host.endswith('.tiktok.com')):
        return False
    names = re.findall(r'(?:^|/)@([^/]+)', unquote(parts.path))
    return not names or bool(username) and all(name.casefold() == username.casefold() for name in names)


async def run_viewer(websocket: WebSocket, store, job: dict) -> None:
    """The caller authenticates and validates the job before accepting the socket."""
    alias = job['alias']
    account = store.get_account(alias) or {}
    username = str((account.get('identity') or {}).get('username') or '').lstrip('@')
    if not username:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    try:
        async with asyncio.timeout(TIMEOUT_SECONDS):
            async with profiles.open_browser(alias) as context:
                latest = store.get_job(job['id'])
                if not latest or latest.get('state') != 'needs_review' or (latest.get('error') or {}).get('code') != 'human_verification_required' or latest.get('verification_resolved'):
                    return
                page = context.pages[0] if context.pages else await context.new_page()
                cdp = await context.new_cdp_session(page)
                frames: asyncio.Queue = asyncio.Queue(maxsize=1)
                stopped = asyncio.Event()

                async def intercept(route):
                    request = route.request
                    if request.is_navigation_request() and request.frame == page.main_frame and not allowed_url(request.url, username):
                        stopped.set()
                        await route.abort()
                    else:
                        await route.fallback()

                await page.route('**/*', intercept)

                def on_frame(event):
                    async def ack():
                        with contextlib.suppress(Exception):
                            await cdp.send('Page.screencastFrameAck', {'sessionId': event['sessionId']})
                    asyncio.create_task(ack())
                    if frames.full():
                        frames.get_nowait()
                    frames.put_nowait({'type': 'frame', 'data': event['data'], 'metadata': event['metadata']})

                def on_navigation(frame):
                    if frame == page.main_frame and not allowed_url(frame.url, username):
                        stopped.set()

                def on_popup(popup):
                    stopped.set()
                    asyncio.create_task(popup.close())

                page.on('framenavigated', on_navigation)
                context.on('page', on_popup)
                page.on('close', lambda *_: stopped.set())
                cdp.on('Page.screencastFrame', on_frame)
                await page.goto(UPLOAD_URL, wait_until='domcontentloaded', timeout=45000)
                await cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 65, 'everyNthFrame': 1})

                async def send_frames():
                    while True:
                        await websocket.send_json(await frames.get())

                async def receive_input():
                    while True:
                        data = await websocket.receive_json()
                        if not isinstance(data, dict):
                            continue
                        kind = data.get('type')
                        if kind == 'resolved':
                            # A shared service key authenticates the operator, not an individual identity.
                            latest = store.get_job(job['id'])
                            if latest and latest.get('state') == 'needs_review' and (latest.get('error') or {}).get('code') == 'human_verification_required':
                                latest['verification_resolved'] = {'at': datetime.now(UTC).isoformat(), 'by': 'operador autenticado', 'asserted_by_operator': True}
                                store.put_job(latest)
                            await websocket.send_json({'type': 'resolved'})
                            return
                        if kind == 'mouse':
                            event = data.get('event')
                            x, y = data.get('x'), data.get('y')
                            if event not in {'mouseMoved', 'mousePressed', 'mouseReleased'} or not all(isinstance(n, (int, float)) and not isinstance(n, bool) and 0 <= n <= 20000 for n in (x, y)):
                                continue
                            button = data.get('button', 'none')
                            if button not in {'none', 'left', 'middle', 'right'}:
                                continue
                            await cdp.send('Input.dispatchMouseEvent', {'type': event, 'x': x, 'y': y, 'button': button, 'buttons': 1 if data.get('buttons') == 1 else 0, 'clickCount': 1 if event != 'mouseMoved' else 0})
                        elif kind == 'key':
                            event, key, code = data.get('event'), data.get('key'), data.get('code')
                            if event not in {'keyDown', 'keyUp'} or not isinstance(key, str) or not isinstance(code, str) or len(key) > 40 or len(code) > 40:
                                continue
                            params = {'type': event, 'key': key, 'code': code}
                            modifiers, key_code = data.get('modifiers', 0), data.get('keyCode', 0)
                            if isinstance(modifiers, int) and 0 <= modifiers <= 15:
                                params['modifiers'] = modifiers
                            if isinstance(key_code, int) and 0 <= key_code <= 255:
                                params['windowsVirtualKeyCode'] = key_code
                            if event == 'keyDown' and len(key) == 1:
                                params['text'] = key
                            await cdp.send('Input.dispatchKeyEvent', params)

                tasks = [asyncio.create_task(send_frames()), asyncio.create_task(receive_input()), asyncio.create_task(stopped.wait())]
                try:
                    await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                finally:
                    for task in tasks:
                        task.cancel()
                    await asyncio.gather(*tasks, return_exceptions=True)
                    with contextlib.suppress(Exception):
                        await cdp.send('Page.stopScreencast')
                    await cdp.detach()
    except (TimeoutError, WebSocketDisconnect):
        pass
    finally:
        with contextlib.suppress(Exception):
            await websocket.close()
