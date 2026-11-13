"""Public editorial research only; never forward private project paths or secrets."""
from __future__ import annotations

import ipaddress
import json
import re
from urllib.parse import urlsplit
from pathlib import Path
from .io import safe

_LIMIT = 16_000
_FILES = ('research.json', 'research.md', 'assets/research.json', 'assets/research.md')
_ALLOWED = {'facts','fact','claims','claim','findings','finding','sources','source','references','reference',
            'hechos','hecho','hallazgos','hallazgo','fuentes','fuente','evidence','evidencia',
            'title','titulo','título','text','texto','description','descripción','summary','resumen','url',
            'date','fecha','discarded','descartados','reason','motivo','content','contenido'}
_BLOCKED = re.compile(r'(?i)(?:\b(?:api[_ -]?key|password|contrase[nñ]a|credential|credencial|secret|secreto|authorization|bearer|access[_ -]?token|refresh[_ -]?token)\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|\btoken\s*[:=]|\b(?:sk-|ghp_|github_pat_)[A-Za-z0-9_-]{12,})')
_PATH = re.compile(r'(?i)(?:file://|(?:^|\s)/(?:home|root|tmp|etc|mnt|media|var|opt|srv)/|\b(?:assets|src|work|languages)/|(?:\.\./)+|[A-Za-z]:\\)')
_URL = re.compile(r'https?://[^\s<>\]"\')]+', re.I)


def _public_url(match):
    value = match.group(0)
    try:
        parts = urlsplit(value)
        host = (parts.hostname or '').lower()
        if not host or '.' not in host or host.endswith(('.local', '.internal', '.lan')) or parts.username or parts.password:
            return '[enlace privado omitido]'
        try:
            addr = ipaddress.ip_address(host)
            if not addr.is_global:
                return '[enlace privado omitido]'
        except ValueError:
            pass
        if _BLOCKED.search(parts.query) or re.search(r'(?i)(?:^|&)(?:key|token|auth|sig|signature|session|code)=', parts.query):
            return '[enlace privado omitido]'
        return value
    except ValueError:
        return '[enlace privado omitido]'


def public_text(value: str, *, limit: int = 6000) -> str:
    out = []
    for line in value.splitlines():
        if _BLOCKED.search(line) or _PATH.search(line):
            continue
        out.append(_URL.sub(_public_url, line))
    return '\n'.join(out).strip()[:limit]


def _filtered(value, *, depth=0):
    if depth > 8:
        return None
    if isinstance(value, str):
        return public_text(value, limit=1200) or None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return value
    if isinstance(value, list):
        return [v for x in value[:60] if (v := _filtered(x, depth=depth+1)) not in (None, '', [], {})]
    if isinstance(value, dict):
        return {str(k): v for k, x in list(value.items())[:80] if str(k).casefold() in _ALLOWED
                and (v := _filtered(x, depth=depth+1)) not in (None, '', [], {})}
    return None


def documents(production: Path):
    result, used = {}, []
    for rel in _FILES:
        path = safe(production, rel)
        if not path.is_file():
            continue
        if path.stat().st_size > 1_000_000:
            raise ValueError('El documento de investigación supera 1 MB; reduce su tamaño antes de generar')
        text = path.read_text(encoding='utf-8')
        if rel.endswith('.json'):
            try:
                content = _filtered(json.loads(text))
            except json.JSONDecodeError as exc:
                raise ValueError('research.json no es JSON válido') from exc
            rendered = json.dumps(content, ensure_ascii=False, separators=(',', ':')) if content else ''
        else:
            rendered = public_text(text, limit=_LIMIT)
        remaining = _LIMIT - sum(len(v) for v in result.values())
        if rendered and remaining > 0:
            result[f"documento_{len(result) + 1}"] = rendered[:remaining]
            used.append(rel)
    return result, used


def publication_sources(raw: dict):
    values = raw.get('sources', []) if isinstance(raw, dict) else []
    if not isinstance(values, list):
        values = [values]
    result = []
    for item in values[:30]:
        if isinstance(item, dict):
            item = _filtered(item)
            item = json.dumps(item, ensure_ascii=False) if item else ''
        if isinstance(item, str):
            item = public_text(item, limit=700)
            if item:
                result.append(item)
    return result
