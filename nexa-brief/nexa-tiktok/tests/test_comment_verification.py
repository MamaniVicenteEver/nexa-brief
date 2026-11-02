"""A challenge appearing after text entry must stop the comment send."""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from nexa_tiktok.adapters.browser_playwright import comment, uploader


async def test_challenge_after_typing_stops_comment_before_send(tmp_path, monkeypatch):
    tab = SimpleNamespace(wait_for=AsyncMock(), click=AsyncMock())
    tab.or_ = lambda _: SimpleNamespace(last=tab)
    page = SimpleNamespace(
        url='https://www.tiktok.com/@synthetic/video/1', goto=AsyncMock(),
        wait_for_timeout=AsyncMock(), keyboard=SimpleNamespace(type=AsyncMock()),
        get_by_text=lambda *args, **kwargs: tab,
    )
    challenged = False

    async def capture(_page, _shots, number, _label):
        nonlocal challenged
        if number == 62:
            challenged = True

    async def check(_page):
        if challenged:
            raise uploader.ManualInterventionRequired('synthetic challenge')

    monkeypatch.setattr(comment, '_detect_manual_intervention', check)
    monkeypatch.setattr(comment, 'capture_step', capture)
    monkeypatch.setattr(comment, 'capture_failure', AsyncMock())
    monkeypatch.setattr(comment, '_human_pause', AsyncMock())
    monkeypatch.setattr(comment, '_wait_until_ready', AsyncMock())
    monkeypatch.setattr(comment, '_find_comment', AsyncMock(return_value=None))
    find = AsyncMock(return_value=object())
    monkeypatch.setattr(comment, 'first_visible', find)
    click = AsyncMock()
    monkeypatch.setattr(comment, '_move_and_click', click)
    before = AsyncMock()

    with pytest.raises(uploader.ManualInterventionRequired):
        await comment.post_first_comment(SimpleNamespace(pages=[page]), page.url, 'texto sintético',
                                         shots_dir=tmp_path, before_click=before, username='synthetic')
    assert find.await_count == 1  # only the input; the send button is never searched
    assert click.await_count == 1  # only the input is clicked
    before.assert_not_awaited()
