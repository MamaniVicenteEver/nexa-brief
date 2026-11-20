"""Conservative evidence-presence gate for adapting an existing episode.

Presence is not verification. Media credits never count as research sources.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from .io import safe

_PLACEHOLDERS = re.compile(r"^(?:n/?a|none|ningun[oa]s?|sin\s+fuentes?|pendiente(?:s)?|por\s+(?:definir|completar|verificar)|tbd|todo|[-–—.\s]+)$", re.I)
_HEADING = re.compile(r"^(#{1,6})\s+(?:\d+[.)]?\s*)?(?:investigaci[oó]n|research|fuentes?|sources?|referencias?|evidencia)\b", re.I)
_ANY_HEADING = re.compile(r"^(#{1,6})\s+")
_DATA_KEYS = {"facts", "fact", "claims", "claim", "findings", "finding", "sources", "source", "references", "reference", "hechos", "hecho", "hallazgos", "hallazgo", "fuentes", "fuente", "evidence", "evidencia"}


def _meaningful(value):
    if not isinstance(value, str):
        return False
    text = value.strip().strip('`*_ ').strip()
    return bool(text and not _PLACEHOLDERS.fullmatch(text))


def _nonempty_research(value):
    if isinstance(value, str):
        return _meaningful(value)
    if isinstance(value, list):
        return any(_nonempty_research(v) for v in value)
    if isinstance(value, dict):
        # Restrict searches to factual/evidence keys. A title, status, URL of a
        # licensed image or an empty template is not an investigation.
        for key, val in value.items():
            if str(key).casefold() in _DATA_KEYS and _meaningful_structure(val):
                return True
        return any(_nonempty_research(v) for k, v in value.items()
                   if str(k).casefold() not in {"media", "medios", "assets", "resources", "recursos", "credits", "créditos", "licenses", "licencias"}
                   and isinstance(v, (dict, list)))
    return False


def _meaningful_structure(value):
    if isinstance(value, str):
        return _meaningful(value)
    if isinstance(value, list):
        return any(_meaningful_structure(v) for v in value)
    if isinstance(value, dict):
        return any(_meaningful_structure(v) for k, v in value.items()
                   if str(k).casefold() not in {"license", "licencia", "credit", "credits", "créditos", "author", "autor", "status", "estado", "type", "tipo"})
    return False


def _sections(text):
    active, level = False, 0
    for line in text.splitlines():
        heading = _ANY_HEADING.match(line)
        if heading:
            if active and len(heading.group(1)) <= level:
                active = False
            selected = _HEADING.match(line)
            if selected:
                active, level = True, len(selected.group(1))
            continue
        if active:
            yield line


def _editorial_source(value):
    if isinstance(value, list):
        return any(_editorial_source(item) for item in value)
    if isinstance(value, dict):
        keys = {str(key).casefold() for key in value}
        if keys & {"license", "licencia", "credit", "credits", "author", "autor"} and not keys & {"claim", "fact", "hecho", "hallazgo"}:
            return False
        return _meaningful_structure(value)
    if isinstance(value, str):
        if not _meaningful(value):
            return False
        if re.search(r"(?i)\b(?:cc\s*by(?:-sa)?|licencia|license|creative commons)\b", value) and re.search(r"(?i)\b(?:imagen|image|photo|foto|fotograf[ií]a|autor|author|cr[eé]dito|credit)\b", value):
            return False
        return True
    return False


def _plan_has_research(text):
    for line in _sections(text):
        line = line.strip()
        if line.startswith('|'):
            cells = [c.strip() for c in line.strip('|').split('|')]
            if len(cells) >= 3 and _meaningful(cells[1]) and _meaningful(cells[2]):
                if not all(set(c) <= set('-: ') for c in cells) and cells[1].casefold() not in {'hecho', 'fuente', 'hecho (fecha, cifra, nombre exacto)'}:
                    return True
        # List form: require actual content after a named label, not a blank
        # PLAN template such as '**Cifras clave** (...):'.
        elif line.startswith(('-', '*')) and ':' in line:
            content = line.split(':', 1)[1].strip()
            if len(content) >= 12 and _meaningful(content):
                return True
    return False


def _read_text(path: Path):
    if not path.is_file() or path.stat().st_size > 1_000_000:
        return ''
    return path.read_text(encoding='utf-8')


def research_present(production: Path) -> bool:
    """Return whether a source research trace exists, without network access."""
    for rel in ('research.json', 'assets/research.json'):
        text = _read_text(safe(production, rel))
        if text:
            try:
                if _nonempty_research(json.loads(text)):
                    return True
            except json.JSONDecodeError:
                pass
    for rel in ('research.md', 'assets/research.md'):
        text = _read_text(safe(production, rel))
        # A standalone research document need not use a specific heading.
        if any(len(line.strip()) >= 20 and _meaningful(line) for line in text.splitlines()
               if line.strip() and not line.lstrip().startswith(('#', '|---', '>'))):
            return True
    if _plan_has_research(_read_text(safe(production, 'PLAN.md'))):
        return True
    text = _read_text(safe(production, 'publish.json'))
    if text:
        try:
            package = json.loads(text)
            if isinstance(package, dict) and _editorial_source(package.get('sources', [])):
                return True
        except json.JSONDecodeError:
            pass
    return False


def require_research(production: Path):
    if not research_present(production):
        raise ValueError('Falta investigación o fuentes editoriales del original. Completa research.json, research.md, la investigación de PLAN.md o las fuentes de publicación antes de crear otra edición.')
