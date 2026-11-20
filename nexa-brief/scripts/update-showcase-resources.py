#!/usr/bin/env python3
"""Regenera el índice de archivos de documentación del Showcase sin copiar sus contenidos."""
import json
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'nexa-brief-server/src/templates'
kit = root / '_tools/explainer-kit'
skip = {'node_modules', 'work', 'render', 'assets', 'media', 'sprites', 'test', 'tests', 'vendor', 'dist', 'build', 'logs', '__pycache__', '_codex'}
shared = {'_engine', '_mapas', '_pizarra', '_avatar', '_player', '_atlas', '_vida'}

def list_files(base):
    if not base.is_dir() or base.is_symlink(): return []
    result = []
    for file in base.rglob('*'):
        rel = file.relative_to(base)
        if any(x.startswith('.') or x in skip for x in rel.parts): continue
        if file.is_symlink() or not file.is_file() or file.suffix.lower() not in {'.md', '.json'}: continue
        if file.name.lower() in {'package-lock.json', 'accounts.json', 'users.json'} or any(x in file.name.lower() for x in ('client_secret', 'credential', 'token')): continue
        result.append(file.relative_to(root).as_posix())
    return result

def include_file(path, result):
    try:
        candidate = root.joinpath(path)
        if candidate.is_file() and not candidate.is_symlink() and candidate.suffix.lower() in {'.md', '.json'} and candidate.resolve().is_relative_to(root.resolve()):
            result.add(candidate.relative_to(root).as_posix())
    except (OSError, ValueError): pass

# Estas instrucciones viven fuera de templates y la API no las puede servir.
# Se publica una copia identificada, renovada al regenerar el índice.
skills = root.parent / 'skills/explainer'
snapshots = kit / 'showcase/agent-documents/explainer'
shared_resources = set()
for subdir in ('produce', 'categories', 'strategies'):
    folder = skills / subdir
    if not folder.is_dir(): continue
    for source in folder.rglob('*'):
        if not source.is_file() or source.is_symlink() or source.suffix.lower() not in {'.md', '.json'}: continue
        if any(part.startswith('.') or part in skip for part in source.relative_to(folder).parts): continue
        destination = snapshots / source.relative_to(skills)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        shared_resources.add(destination.relative_to(root).as_posix())
shared_resources.update(list_files(kit / 'guides'))
for file in ('production-policy.json', 'catalog.json'):
    include_file(f'_tools/explainer-kit/{file}', shared_resources)

index = {}
for design in (kit / 'designs').iterdir():
    if not design.is_dir() or not (design / 'design.json').is_file(): continue
    resources = set(list_files(design)) | shared_resources
    for file in ('AGENTS.md', 'CATALOG.md', 'FLUJO.md'):
        include_file(f'_tools/explainer-kit/{file}', resources)
    index[f'production/{design.name}'] = sorted(resources)

sandbox = root / 'sandbox'
def items(directory, parts):
    if directory.is_symlink() or any(p.startswith(('.', '_')) for p in parts): return
    if len(parts) >= 2 and any((directory / name).is_file() for name in ('info.json', 'index.html', 'manifest.json')):
        yield directory
        return
    try:
        for child in directory.iterdir():
            if child.is_dir() and not child.is_symlink(): yield from items(child, (*parts, child.name))
    except OSError:
        return

for folder in sandbox.iterdir():
  if not folder.is_dir() or folder.name.startswith(('.', '_')) or folder.name in {'referencias', 'nuevos'}: continue
  for directory in items(folder, (folder.name,)):
    info = directory / 'info.json'
    try: data = json.loads(info.read_text()) if info.is_file() else {}
    except (ValueError, OSError): data = {}
    key = directory.relative_to(root).as_posix()
    resources = set(list_files(directory))
    engine = data.get('engine')
    if isinstance(engine, str):
        pieces = engine.split('/')
        if len(pieces) >= 2 and pieces[1] in shared and all(x and x not in ('.', '..') for x in pieces):
            resources.update(list_files(sandbox.joinpath(*pieces)))
    catalog = data.get('catalog')
    if isinstance(catalog, dict):
        base = catalog.get('base', key)
        if isinstance(base, str) and base.startswith('sandbox/'):
            for k in ('components', 'production', 'workflows', 'animations'):
                file = catalog.get(k)
                if isinstance(file, str) and not file.startswith('/') and '..' not in file.split('/'):
                    include_file(f'{base}/{file}', resources)
    index[key] = sorted(resources)

out = kit / 'showcase/agent-resources.json'
out.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n')
print(f'{len(index)} diseños indexados; {sum(map(len, index.values()))} referencias')
