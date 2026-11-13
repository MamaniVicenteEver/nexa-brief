"""Adopción explícita de promos antiguas, retirando solo copias históricas verificadas."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from src.core.promo_prompts import PROMPTS, TEMPLATES, bind_reference, reference, reference_file


def migrate(target: Path, apply: bool = False) -> dict:
    target = Path(target)
    brief = json.loads((target/'brief.json').read_text(encoding='utf-8'))
    if brief.get('template') not in TEMPLATES:
        raise ValueError('no es una de las seis promos compartidas')
    archive = PROMPTS/'history/narrativa-v2'
    history = json.loads((archive/'manifest.json').read_text(encoding='utf-8'))
    hashes = history['hashes']
    for name, digest in hashes.items():
        if Path(name).name != name or hashlib.sha256((archive/name).read_bytes()).hexdigest() != digest:
            raise ValueError('archivo histórico central alterado')
    folder = target/'work/instrucciones'
    copies = []
    nested = folder/'prompts'
    if nested.exists() and (nested.is_symlink() or not nested.is_dir()):
        raise ValueError('carpeta de prompts histórica no válida')
    if nested.is_dir() and any(p.name not in hashes for p in nested.iterdir()):
        raise ValueError('hay archivos históricos desconocidos; reconciliar antes de migrar')
    for name, digest in hashes.items():
        for path in (folder/name, nested/name):
            if path.exists():
                if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                    raise ValueError(f'variante desconocida: {path.relative_to(target)}')
                copies.append((path, digest))
    ref_path = folder/'prompts-version.json'
    previous = json.loads(ref_path.read_text(encoding='utf-8')) if ref_path.exists() else None
    if previous and 'hashes' in previous:
        selected = reference_file(ref_path)
    elif previous:
        # El manifiesto anterior de Sports tiene campos editoriales adicionales que se conservan.
        old_hashes = {x['archivo']:x['sha256'] for x in previous.get('prompts',[])}
        if old_hashes != hashes or not copies:
            raise ValueError('referencia anterior desconocida; no se sobrescribe')
        selected = reference()
    else:
        selected = reference()
    evidence_path = folder/'prompts-history.json'
    evidence = json.loads(evidence_path.read_text(encoding='utf-8')) if evidence_path.exists() else None
    if copies and evidence:
        if evidence.get('historical_hashes') != hashes:
            raise ValueError('historial anterior distinto; reconciliar antes de migrar')
    result = {'project':target.name, 'apply':apply, 'next_version':selected['version'],
              'verified_copies':len(copies), 'removed_bytes':sum(p.stat().st_size for p,_ in copies)}
    if not apply:
        return result
    if copies and evidence is None:
        evidence = {'historical_version':history['version'],
                    'shared_archive':'src/skills/nodemotion/promo/prompts/history/narrativa-v2',
                    'historical_hashes':hashes,'previous_reference':previous,
                    'retired_files':[str(p.relative_to(target)) for p,_ in copies],
                    'migrated_at':datetime.now(timezone.utc).isoformat(),
                    'note':'Las copias verificadas se conservan una vez en el archivo central. La referencia activa solo rige trabajos posteriores; no atribuye v1 al video anterior.'}
        _write_new(evidence_path, evidence)
    if previous and 'hashes' not in previous:
        # El manifiesto original está conservado íntegro antes de reemplazar la referencia operativa.
        if json.loads(ref_path.read_text(encoding='utf-8')) != previous:
            raise ValueError('la referencia cambió durante la migración')
        temporary = ref_path.with_suffix('.migration.tmp')
        if temporary.exists():
            raise ValueError('existe una migración pendiente')
        _write_new(temporary, selected)
        temporary.replace(ref_path)
    else:
        bind_reference(ref_path, selected)
    # Volver a comprobar todos los archivos antes de retirar el primero.
    for path, digest in copies:
        if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError('una copia cambió durante la migración')
    for path, _ in copies:
        path.unlink()
    if nested.is_dir() and not any(nested.iterdir()):
        nested.rmdir()
    return result


def _write_new(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Crear exclusivamente: una segunda ejecución no puede pisar evidencia existente.
    with path.open('x', encoding='utf-8') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
