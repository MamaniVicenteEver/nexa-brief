"""HTTP adapter shared by both NodeMotion preview entry points."""
from __future__ import annotations
import mimetypes
from pathlib import Path
from fastapi import HTTPException, Request
from starlette.responses import Response
from src.presentation.api.file_streaming import serve_file_with_range
from src.presentation.api.preview_injection import inject_preview_scripts
from src.presentation.api.preview_media import media_for_request, preview_config_json

_PREVIEW_SUFFIXES = {
    ".html", ".json", ".mp3", ".wav", ".m4a", ".ogg", ".opus", ".aac", ".mp4", ".webm", ".mov", ".jpg", ".jpeg",
    ".png", ".webp", ".gif", ".svg", ".woff", ".woff2", ".ttf", ".otf", ".css", ".js",
}
_PREVIEW_BLOCKED_DIRS = {"logs"}

def serve_project_preview(root: Path, file_path: str, request: Request, *, job=None, template_id=None) -> Response | None:
    original_file_path = file_path
    path = (root / file_path).resolve()
    from src.core.nodemotion.service import load_project, resolve_project
    try:
        project = load_project(root)
        if project is not None:
            if (not path.is_relative_to(root) or not file_path or
                Path(file_path).suffix.lower() not in _PREVIEW_SUFFIXES or
                file_path.split("/", 1)[0] in _PREVIEW_BLOCKED_DIRS):
                raise HTTPException(status_code=404, detail="Draft preview file not available")
            from src.templates._tools.nodemotion.shared.assemble import freeze_engine
            parts = file_path.split("/", 2)
            revision = None
            if len(parts) == 3 and parts[0] == "revision":
                revision, file_path = parts[1], parts[2]
                if len(revision) != 64 or any(c not in "0123456789abcdef" for c in revision):
                    raise HTTPException(status_code=404, detail="Invalid engine revision")
            if Path(file_path).suffix.lower() == ".html" and revision is None:
                engine = project["engine"]
                revision = freeze_engine(project["design_id"], engine.get("revision") if engine["policy"] == "pinned" else None)
            value = resolve_project(root, file_path, expected_revision=revision)
            if value is None:
                raise HTTPException(status_code=404, detail="Draft preview file not available")
            suffix = Path(file_path).suffix.lower()
            if suffix == ".html":
                content = value.decode("utf-8") if isinstance(value, bytes) else value.read_text(encoding="utf-8")
                if revision:
                    # Every relative request in this preview uses one immutable
                    # engine revision, including dynamic fetches and CSS assets.
                    import re
                    base = re.search(r'<base\s+href="([^"]*)">', content, flags=re.I)
                    # Anchor at the preview root even when the document itself
                    # was requested through a revision-scoped or nested URL.
                    from urllib.parse import unquote, urlsplit
                    request_path = unquote(urlsplit(str(request.url)).path)
                    preview_root = request_path[:-len(original_file_path)]
                    directory = Path(file_path).parent.as_posix()
                    route = f"{preview_root}revision/{revision}/"
                    if directory != ".":
                        route += directory + "/"
                    if base:
                        content = content[:base.start(1)] + route + base.group(1) + content[base.end(1):]
                    else:
                        content = re.sub(r"(<head\b[^>]*>)", lambda m: m.group(1) + f'<base href="{route}">',
                                         content, count=1, flags=re.I)
                content = inject_preview_scripts(content, request.query_params)
                return Response(content=content, media_type="text/html; charset=utf-8", headers={"Cache-Control": "no-cache"})
            if suffix == ".json":
                content = value.decode("utf-8") if isinstance(value, bytes) else value.read_text(encoding="utf-8")
                content = preview_config_json(content, request)
                if job is not None and template_id == "lyrics-impact" and file_path.endswith("config.json"):
                    import json
                    from src.core.nodemotion.lyrics.appearance import ensure_intro_title
                    config = json.loads(content)
                    if ensure_intro_title(config, job, template_id):
                        content = json.dumps(config, ensure_ascii=False)
                return Response(content=content, media_type="application/json", headers={"Cache-Control": "no-cache"})
            if isinstance(value, bytes):
                return Response(content=value, media_type=mimetypes.guess_type(file_path)[0] or "application/octet-stream",
                                headers={"Cache-Control": "no-cache"})
            value = media_for_request(value, request)
            response = serve_file_with_range(value, request.headers.get("range"),
                                             mimetypes.guess_type(file_path)[0] or "application/octet-stream")
            if suffix in {".js", ".css"}:
                response.headers["Cache-Control"] = "no-cache"
            return response
    except (ValueError, FileNotFoundError, KeyError):
        raise HTTPException(status_code=404, detail="Draft preview resource unavailable")
    return None
