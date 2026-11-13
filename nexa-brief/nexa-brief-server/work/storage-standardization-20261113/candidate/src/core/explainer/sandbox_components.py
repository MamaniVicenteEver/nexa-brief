"""Catálogo ligero de prototipos y sus componentes declarados."""
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote

from src.core.explainer import sandbox_info


@lru_cache(maxsize=1024)
def _read(path: str, stamp: int, size: int) -> tuple[dict, list[dict]]:
    directory = Path(path)
    return sandbox_info._read_info(directory) or {}, sandbox_info.load_declared_components(directory / "info.json")


def list_components(root: Path) -> list[dict]:
    result = []
    if not root.is_dir():
        return result
    def visit(directory: Path, parts: tuple[str, ...]) -> None:
        try:
            if directory.is_symlink() or not directory.resolve().is_relative_to(root.resolve()):
                return
            children = [p for p in directory.iterdir() if p.is_dir() and not p.name.startswith(('.', '_')) and not p.is_symlink()]
            is_item = (directory / 'info.json').is_file() or (directory / 'index.html').is_file() or (directory / 'manifest.json').is_file()
            if len(parts) >= 2 and is_item:
                info_path = directory / 'info.json'
                stat = info_path.stat() if info_path.is_file() else directory.stat()
                info, components = _read(str(directory), stat.st_mtime_ns, stat.st_size)
                poster = directory / 'render' / 'poster.jpg'
                path = '/'.join(('sandbox', *parts))
                result.append(dict(id=parts[-1], folder=parts[0], subcategory='/'.join(parts[1:-1]) or None,
                    path=path, title=info.get('title') if isinstance(info.get('title'), str) else parts[-1],
                    status=info.get('status') if isinstance(info.get('status'), str) else None,
                    summary=info.get('summary') if isinstance(info.get('summary'), str) else None,
                    design=info.get('design') if isinstance(info.get('design'), str) else None,
                    has_index=(directory / 'index.html').is_file(),
                    updated_at=datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat().replace('+00:00', 'Z'),
                    thumbnail_url='/api/v1/explainer/files/' + '/'.join(quote(p, safe='') for p in (*path.split('/'), 'render', 'poster.jpg')) if poster.is_file() else None,
                    components=components, has_components=bool(components)))
                return
            for child in children:
                visit(child, (*parts, child.name))
        except (OSError, ValueError, TypeError, OverflowError):
            return
    for folder in root.iterdir():
        if folder.is_dir() and not folder.name.startswith(('.', '_')) and folder.name not in {'referencias', 'nuevos', 'designs'}:
            visit(folder, (folder.name,))
    return sorted(result, key=lambda item: item['updated_at'], reverse=True)
