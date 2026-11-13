"""Read-only technical checks. No agent, renderer or publication writer is imported."""
from __future__ import annotations
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

from src.config.settings import settings
from src.config.content_paths import resolve_content_key

class ResourceParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.resources = []
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if value and (key in {'src', 'poster'} or key == 'href' and tag == 'link'):
                self.resources.append(value)

def _references(path):
    text = path.read_text(encoding='utf-8')
    if path.suffix == '.html':
        parser = ResourceParser(); parser.feed(text)
        refs = parser.resources
    else:
        refs = []
    if path.suffix == '.json':
        payload = json.loads(text)
        resource_keys = {'src','srcAfter','poster','image','image_path','audio','gallery','components','preview_url'}
        def collect(value):
            if isinstance(value, dict):
                for key, child in value.items():
                    if key in resource_keys and isinstance(child, str) and child and '$' not in child:
                        refs.append(child)
                    else:
                        collect(child)
            elif isinstance(value, list):
                for child in value: collect(child)
        collect(payload)
    if path.suffix in {'.html', '.js', '.mjs', '.css'}:
        refs += re.findall(r'''(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["']([^"']+)["']''', text)
        refs += re.findall(r'''url\(\s*["']?([^\s)'";]+)''', text)
    return refs

def review_files(source: Path, folder: str, project: str, destination: Path, rewrite):
    issues, warnings = [], []
    resources, checked_files = 0, 0
    root = source.resolve()
    if source.is_symlink():
        return {'files_checked':0,'resources_checked':0,'issues':['Origen simbólico no permitido'],'warnings':[]}
    for path in source.rglob('*'):
        relative = path.relative_to(source)
        if path.is_symlink():
            issues.append(f'Enlace simbólico no permitido: {relative}'); continue
        if path.name in {'.env','accounts.json','users.json'} or path.name.startswith(('client_secret','credentials')) or path.suffix.lower() in {'.pem','.key','.p12','.pfx'}:
            issues.append(f'Archivo privado no permitido: {relative}'); continue
        if not path.is_file() or any(p in {'work','render','thumbnails','__pycache__','node_modules','.git'} for p in relative.parts):
            continue
        checked_files += 1
        if path.suffix not in {'.html','.js','.mjs','.css','.json'}:
            continue
        try:
            rewrite(path.read_text(), folder, project, destination.parent.name, relative_file=relative.as_posix())
            for value in _references(path):
                parsed = urlsplit(value)
                if parsed.scheme in {'http','https'} or parsed.netloc:
                    warnings.append(f'Dependencia externa no comprobada: {parsed.netloc}')
                    continue
                if parsed.scheme or value.startswith('#'): continue
                name = unquote(parsed.path)
                if not name or name == '/': continue
                if name.startswith('/api/v1/explainer/files/'):
                    resolved = resolve_content_key(name.removeprefix('/api/v1/explainer/files/'))
                elif name.startswith('/_tools/'):
                    resolved = settings.templates_dir / name.lstrip('/')
                elif name.startswith('/'):
                    # App routes/API endpoints are not filesystem dependencies.
                    continue
                else:
                    resolved = (path.parent / name).resolve()
                    shared_resolved = False
                    if path.suffix == '.json':
                        # Scene/config references are often interpreted from
                        # the document root rather than the JSON directory.
                        document_relative = (source / name).resolve()
                        if document_relative.is_relative_to(root) and document_relative.is_file():
                            resolved = document_relative
                        elif not document_relative.is_relative_to(root):
                            from posixpath import normpath
                            from src.config.content_paths import is_shared_template_key
                            key = normpath(str(Path('sandbox') / folder / project / name))
                            if is_shared_template_key(tuple(key.split('/'))):
                                resolved = resolve_content_key(key)
                                shared_resolved = True
                    if path.suffix == '.json' and not resolved.is_file():
                        # Scene src fields are relative to assets; publication
                        # image names are relative to assets/media by contract.
                        for base in (source/'assets', source/'assets/media'):
                            candidate = (base/name).resolve()
                            if candidate.is_relative_to(root) and candidate.is_file():
                                resolved = candidate; break
                    if not shared_resolved and not resolved.is_relative_to(root):
                        # A sandbox sibling engine is physically in templates,
                        # not in the selected profile. Resolve the public alias.
                        from posixpath import normpath
                        key = normpath(str(Path('sandbox') / folder / project / relative.parent / name))
                        try:
                            resolved = resolve_content_key(key)
                        except ValueError:
                            canonical = rewrite(json.dumps(value), folder, project, destination.parent.name)
                            route = json.loads(canonical)
                            prefix = '/api/v1/explainer/files/'
                            if not route.startswith(prefix): raise
                            resolved = resolve_content_key(urlsplit(route).path.removeprefix(prefix))
                if not resolved.is_file():
                    issues.append(f'Recurso ausente: {relative} → {value}')
                resources += 1
        except (ValueError, OSError, UnicodeError) as exc:
            issues.append(f'{relative}: {exc}')
    if destination.exists(): issues.append('El destino ya existe; no se sobrescribe')
    ancestor = destination.parent
    while not ancestor.exists(): ancestor = ancestor.parent
    if root.stat().st_dev != ancestor.stat().st_dev:
        issues.append('El traslado entre discos requiere migración supervisada')
    return {'files_checked': checked_files, 'resources_checked': resources,
            'issues': list(dict.fromkeys(issues)), 'warnings': warnings}

def selection_signature(draft):
    selection = {key: draft.get(key) for key in ('category','shared_categories','title','description','poster_styles','demo')}
    return hashlib.sha256(json.dumps(selection, sort_keys=True).encode()).hexdigest()
