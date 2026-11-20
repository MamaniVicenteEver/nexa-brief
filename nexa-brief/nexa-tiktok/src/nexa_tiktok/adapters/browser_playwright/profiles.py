import asyncio
import fcntl
import os
import select
import shutil
import subprocess
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from importlib.metadata import version
from pathlib import Path

from playwright.async_api import BrowserContext, async_playwright

from nexa_tiktok.adapters.store_json.store import JsonStore, validate_alias
from nexa_tiktok.config import settings

BROWSER_SEMAPHORE = asyncio.Semaphore(1)
_xvfb: subprocess.Popen | None = None
_display: str | None = None


def profile_dir(alias: str) -> Path:
    return settings.nexa_tiktok_data_dir.absolute() / 'accounts' / validate_alias(alias) / 'profile'


def state_path(alias: str) -> Path:
    return settings.nexa_tiktok_data_dir.absolute() / 'accounts' / validate_alias(alias) / 'state.enc'


def ensure_profile(alias: str, *, replace: bool = False) -> Path:
    path = profile_dir(alias)
    if path.is_symlink():
        raise RuntimeError('El perfil no puede ser un enlace simbólico.')
    if replace and path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    path.chmod(0o700)
    return path


def start_display() -> str:
    global _xvfb, _display
    if _xvfb and _xvfb.poll() is None and _display:
        return _display
    binary = shutil.which('Xvfb')
    if not binary:
        raise RuntimeError('Xvfb no está instalado.')
    read_fd, write_fd = os.pipe()
    try:
        _xvfb = subprocess.Popen([binary, '-displayfd', str(write_fd), '-screen', '0', '1440x900x24',
                                  '-nolisten', 'tcp'], pass_fds=(write_fd,), stdout=subprocess.DEVNULL,
                                 stderr=subprocess.DEVNULL)
        os.close(write_fd)
        write_fd = -1
        if not select.select([read_fd], [], [], 10)[0]:
            raise RuntimeError('Xvfb no respondió en diez segundos.')
        display_number = os.read(read_fd, 32).decode().strip()
        if not display_number.isdigit():
            raise RuntimeError('No se pudo iniciar Xvfb.')
        _display = ':' + display_number
        return _display
    except BaseException:
        stop_display()
        raise
    finally:
        os.close(read_fd)
        if write_fd >= 0:
            os.close(write_fd)


def stop_display() -> None:
    global _xvfb, _display
    if _xvfb:
        _xvfb.terminate()
        try:
            _xvfb.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _xvfb.kill()
            _xvfb.wait()
    _xvfb = None
    _display = None


@asynccontextmanager
async def open_browser(alias: str, *, replace_profile: bool = False,
                       on_queued: Callable[[], None] | None = None,
                       on_acquired: Callable[[], None] | None = None) -> AsyncIterator[BrowserContext]:
    validate_alias(alias)
    if BROWSER_SEMAPHORE.locked() and on_queued:
        on_queued()
    async with BROWSER_SEMAPHORE:
        if on_acquired:
            on_acquired()
        root = settings.nexa_tiktok_data_dir.absolute()
        lock_dir = root / 'locks'
        lock_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd = os.open(lock_dir / f'{alias}.lock', os.O_CREAT | os.O_RDWR, 0o600)
        try:
            # A cancelled to_thread(flock) can acquire a lock after its fd has
            # been closed/reused. Nonblocking polling keeps ownership here.
            while True:
                try:
                    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    await asyncio.sleep(0.1)
            account = JsonStore(root).get_account(alias)
            async with async_playwright() as playwright:
                revision = Path(playwright.chromium.executable_path).parent.parent.name.removeprefix('chromium-')
                if version('playwright') != '1.64.1' or revision != '1248':
                    raise RuntimeError('Se requiere Playwright 1.64.1 y Chromium 1248 para este servicio.')
                if account and (account.get('playwright_version') != '1.64.1' or
                                account.get('chromium_revision') != '1248'):
                    raise RuntimeError('La versión del perfil no coincide con Playwright 1.64.1 / Chromium 1248.')
                path = ensure_profile(alias, replace=replace_profile)
                env = dict(os.environ, DISPLAY=start_display())
                context = await playwright.chromium.launch_persistent_context(
                    str(path), headless=False, locale='es-ES', timezone_id='UTC',
                    viewport={'width': 1440, 'height': 900}, env=env)
                try:
                    yield context
                finally:
                    await context.close()
        finally:
            fcntl.flock(fd, fcntl.LOCK_UN)
            os.close(fd)


async def promote_profile(staging_alias: str, alias: str) -> None:
    """Replace a verified profile only after the new browser is closed."""
    source, target = profile_dir(staging_alias), profile_dir(alias)
    source_state, target_state = state_path(staging_alias), state_path(alias)
    async with BROWSER_SEMAPHORE:
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        backup = target.parent / 'profile.previous'
        if backup.exists():
            raise RuntimeError('Existe un perfil anterior pendiente de revisión.')
        if target.exists():
            target.rename(backup)
        try:
            source.rename(target)
            source_state.replace(target_state)
        except Exception:
            if target.exists():
                shutil.rmtree(target)
            if backup.exists():
                backup.rename(target)
            raise
        if backup.exists():
            shutil.rmtree(backup)
        shutil.rmtree(source.parent, ignore_errors=True)
