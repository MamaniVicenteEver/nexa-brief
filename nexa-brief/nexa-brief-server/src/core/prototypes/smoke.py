"""Host-side static smoke check for one isolated prototype; never runs its code."""
from __future__ import annotations

import asyncio
import json
import os
import stat
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path

from src.core.explainer.agent_context import _safe

MAX_FILE = 512 * 1024
TIMEOUT_SECONDS = 5


class _Markup(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = 0

    def handle_starttag(self, tag, attrs):
        self.tags += 1


def _read_file(path: Path) -> bytes:
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.getuid():
            raise ValueError('archivo de smoke no seguro')
        content = stream.read(MAX_FILE + 1)
    if len(content) > MAX_FILE:
        raise ValueError('archivo de smoke demasiado grande')
    return content


async def validate_smoke(sandbox: Path, category: str, template_id: str, idea_id: str,
                         templates: Path, *, timeout: float = TIMEOUT_SECONDS) -> str | None:
    """Validate the selected artifact and shared info contract, with no render/model call."""
    try:
        root = _safe(sandbox, category, template_id)
        info_data = _read_file(_safe(root, 'info.json'))
        info = json.loads(info_data)
        if not isinstance(info, dict) or info.get('reference') != f'referencias/{category}/{idea_id}':
            return 'smoke incompleto: referencia de origen inválida'
        html = _read_file(_safe(root, 'index.html')).decode('utf-8')
        parser = _Markup()
        parser.feed(html)
        parser.close()
        if not parser.tags:
            return 'smoke incompleto: index.html no contiene marcado'
        tools_dir = _safe(templates, '_tools', 'sandbox')
        if not _safe(tools_dir, 'info.py').is_file() or not _safe(tools_dir, 'costs.py').is_file():
            return 'smoke incompleto: validador de ficha no disponible'
    except (OSError, ValueError, UnicodeError, RecursionError):
        return 'smoke incompleto: archivos inválidos o no seguros'

    program = ("import json,sys; sys.path.insert(0,sys.argv[1]); "
               "from info import validate_info; print(json.dumps(validate_info(json.load(sys.stdin))[:5]))")
    with tempfile.TemporaryDirectory(prefix='nexa-smoke-validator-') as temporary:
        proc = await asyncio.create_subprocess_exec(
            sys.executable, '-I', '-c', program, str(tools_dir), cwd=temporary,
            env={'HOME': temporary, 'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8'},
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        try:
            output, _ = await asyncio.wait_for(proc.communicate(info_data), timeout=timeout)
        except (asyncio.TimeoutError, asyncio.CancelledError) as error:
            if proc.returncode is None:
                proc.kill()
            await proc.wait()
            if isinstance(error, asyncio.CancelledError):
                raise
            return 'smoke incompleto: validación excedió el tiempo'
    try:
        errors = json.loads(output)
        if proc.returncode != 0 or not isinstance(errors, list):
            raise ValueError
        if errors:
            return 'smoke incompleto: ficha info.json inválida (' + '; '.join(str(x)[:120] for x in errors[:5]) + ')'
        results = _safe(root, 'work', 'results')
        results.mkdir(parents=True, exist_ok=True)
        report = _safe(results, 'smoke.md')
        # Atomic replacement avoids following a link or mutating a shared inode.
        fd, temporary = tempfile.mkstemp(prefix='.smoke-', dir=results)
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                stream.write('# Smoke estático\n\nFicha y marcado validados por el host. '
                             'Sin ejecución JavaScript, navegador, render ni llamadas a modelos.\n')
            os.replace(temporary, report)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
    except (OSError, ValueError):
        return 'smoke incompleto: no se pudo verificar o registrar el resultado'
    return None
