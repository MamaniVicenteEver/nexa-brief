"""TikTok rechaza (400 "The total chunk count is invalid") si total_chunk_count
no es floor(video_size / chunk_size) con el sobrante sumado al último chunk."""

from pathlib import Path

import pytest

from src.adapters.publishing.tiktok_adapter import _chunk_plan, _read_tiktok_chunks

MB = 1024 * 1024


@pytest.mark.parametrize(
    ("size", "expected"),
    [(3 * MB, (3 * MB, 1)), (8 * MB, (8 * MB, 1)), (29_562_721, (8 * MB, 3)), (70_000_000, (8 * MB, 8))],
)
def test_chunk_plan_uses_floor(size, expected):
    assert _chunk_plan(size) == expected


def test_chunks_cover_file_exactly_and_last_absorbs_remainder(tmp_path: Path):
    size = 29_562_721
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\0" * size)
    chunks = list(_read_tiktok_chunks(video, size))
    assert len(chunks) == 3
    assert sum(len(c) for c, _, _ in chunks) == size
    assert [offset for _, offset, _ in chunks] == [0, 8 * MB, 16 * MB]
    assert len(chunks[-1][0]) == size - 16 * MB
