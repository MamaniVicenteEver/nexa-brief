import hashlib
import json
import pytest
from restore_video import restore


def test_restore_and_corrupt_bundle_never_changes_live_source(tmp_path):
    bundle = tmp_path / "bundle"
    bundle.mkdir()
    (bundle / "video.mp4").write_bytes(b"complete")
    manifest = {
        "metadata": {"job_id": "a"},
        "files": [
            {
                "target": "video.mp4",
                "bytes": 8,
                "sha256": hashlib.sha256(b"complete").hexdigest(),
                "original_mode": 0o600,
            }
        ],
    }
    (bundle / "manifest.json").write_text(json.dumps(manifest))
    destination = tmp_path / "restored"
    assert restore(bundle, destination) == 1
    assert (destination / "video.mp4").read_bytes() == b"complete"
    (bundle / "video.mp4").write_bytes(b"corrupt")
    with pytest.raises(ValueError):
        restore(bundle, tmp_path / "bad-restore")
    assert not (tmp_path / "bad-restore").exists()
    assert (destination / "video.mp4").read_bytes() == b"complete"
