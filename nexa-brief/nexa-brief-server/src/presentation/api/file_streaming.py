"""Streaming de archivos con soporte de HTTP Range y validadores HTTP."""

from __future__ import annotations

import re
from datetime import timezone
from email.utils import formatdate, parsedate_to_datetime
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


def _matches_etag(header: str, etag: str) -> bool:
    for candidate in header.split(","):
        candidate = candidate.strip()
        if candidate == "*" or candidate.removeprefix("W/") == etag:
            return True
    return False


def _http_date_timestamp(value: str | None) -> float | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, OverflowError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.timestamp()


def _not_modified(
    *,
    etag: str,
    last_modified_seconds: int,
    if_none_match: str | None,
    if_modified_since: str | None,
) -> bool:
    if if_none_match is not None:
        return _matches_etag(if_none_match, etag)
    since = _http_date_timestamp(if_modified_since)
    return since is not None and last_modified_seconds <= since


def serve_file_with_range(
    path: Path,
    range_header: str | None,
    media_type: str,
    *,
    if_none_match: str | None = None,
    if_modified_since: str | None = None,
    if_range: str | None = None,
    cache_control: str | None = None,
) -> Response:
    stat = path.stat()
    file_size = stat.st_size
    last_modified_seconds = int(stat.st_mtime)
    # The URL identifies the generated file; stat metadata avoids hashing a large MP4.
    etag = f'"{stat.st_mtime_ns:x}-{file_size:x}"'
    headers = {
        "Accept-Ranges": "bytes",
        "ETag": etag,
        "Last-Modified": formatdate(stat.st_mtime, usegmt=True),
    }
    if cache_control:
        headers["Cache-Control"] = cache_control

    if _not_modified(
        etag=etag,
        last_modified_seconds=last_modified_seconds,
        if_none_match=if_none_match,
        if_modified_since=if_modified_since,
    ):
        return Response(status_code=304, headers=headers)

    if range_header and if_range:
        if if_range.strip() != etag:
            if_range_date = _http_date_timestamp(if_range)
            if if_range_date is None or last_modified_seconds > if_range_date:
                # The client has a stale validator; ignore Range and send the current file.
                range_header = None

    if not range_header:
        return StreamingResponse(
            file_chunks(path, 0, file_size - 1),
            media_type=media_type,
            headers={**headers, "Content-Length": str(file_size)},
        )

    match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
    if not match or (not match.group(1) and not match.group(2)):
        raise HTTPException(status_code=416, detail="Invalid Range header", headers=headers)

    try:
        if not match.group(1):
            suffix_size = int(match.group(2))
            if suffix_size <= 0:
                raise ValueError
            start = max(0, file_size - suffix_size)
            end = file_size - 1
        else:
            start = int(match.group(1))
            end = int(match.group(2)) if match.group(2) else file_size - 1
    except ValueError:
        raise HTTPException(
            status_code=416,
            detail="Invalid Range header",
            headers={**headers, "Content-Range": f"bytes */{file_size}"},
        ) from None

    if start >= file_size or start > end:
        raise HTTPException(
            status_code=416,
            detail="Range not satisfiable",
            headers={**headers, "Content-Range": f"bytes */{file_size}"},
        )
    end = min(end, file_size - 1)
    return StreamingResponse(
        file_chunks(path, start, end),
        status_code=206,
        media_type=media_type,
        headers={
            **headers,
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(end - start + 1),
        },
    )
