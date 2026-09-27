"""Streaming de archivos con soporte de HTTP Range — compartido entre routers.

Extraído de `videos.py` (donde nació sirviendo videos finales) para que
`library.py` lo reuse también al servir binarios de assets ya archivados.
"""

from __future__ import annotations

import re
from pathlib import Path

from fastapi import HTTPException
from starlette.responses import Response, StreamingResponse

_CHUNK_SIZE = 1024 * 1024


async def file_chunks(path: Path, start: int, end: int):
    with open(path, "rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            data = f.read(min(_CHUNK_SIZE, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


def serve_file_with_range(path: Path, range_header: str | None, media_type: str) -> Response:
    file_size = path.stat().st_size
    if range_header is None:
        return StreamingResponse(
            file_chunks(path, 0, file_size - 1),
            media_type=media_type,
            headers={"Accept-Ranges": "bytes", "Content-Length": str(file_size)},
        )
    match = re.match(r"bytes=(\d*)-(\d*)", range_header)
    if not match or (not match.group(1) and not match.group(2)):
        raise HTTPException(status_code=416, detail="Invalid Range header")
    start = int(match.group(1)) if match.group(1) else 0
    end = int(match.group(2)) if match.group(2) else file_size - 1
    if start >= file_size or end >= file_size or start > end:
        raise HTTPException(
            status_code=416,
            detail="Range not satisfiable",
            headers={"Content-Range": f"bytes */{file_size}"},
        )
    return StreamingResponse(
        file_chunks(path, start, end),
        status_code=206,
        media_type=media_type,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(end - start + 1),
        },
    )
