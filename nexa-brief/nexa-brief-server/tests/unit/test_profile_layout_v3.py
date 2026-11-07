"""The public v3 shape and complete journalled migration use synthetic data."""
import json
import os
from pathlib import Path
import subprocess
import sys

from src.config.storage_profile import load_profile

PROJECT = Path(__file__).resolve().parents[3]
INIT = PROJECT / "scripts/storage-profile.py"
MIGRATE = PROJECT / "nexa-brief-server/scripts/migrate-profile-layout.py"


def run(command, tmp_path):
    return subprocess.run([sys.executable, *map(str, command)], capture_output=True,
                          text=True, timeout=60, env={"PATH": os.environ["PATH"],
                          "HOME": str(tmp_path), "XDG_CONFIG_HOME": str(tmp_path / "xdg")})


def put(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value) if not isinstance(value, str) else value)


def test_new_profile_v3_has_sections_categories_and_guides(tmp_path):
    result = run([INIT, "init", "newprofile", "--home", tmp_path], tmp_path)
    assert result.returncode == 0, result.stderr
    root = tmp_path / "profiles/newprofile"
    assert load_profile(root)["schema_version"] == 3
    for section in ("videos", "image-posts", "publicaciones", "resources", "designs", "jobs", "logs"):
        data = json.loads((root / "data/json" / f"{section}.json").read_text())
        assert not data["collections"] and not data["documents"]
    for category in ("nodetech", "nodehistory", "nodeaction", "nodepolitics", "nodeeconomy", "nodemotion"):
        for part in ("productions", "sandbox", "renders/videos", "renders/images"):
            folder = root / part / category
            assert (folder / "AGENTS.md").is_file()
            assert (folder / "CLAUDE.md").is_file()
    assert not (root / "designs").exists()
    assert not (root / "sandbox/designs").exists()
    assert "design-definitions" in (root / "AGENTS.md").read_text()
    assert not list((root / ".system/connections").iterdir())


def test_v3_migration_activation_and_rollback_preserve_files(tmp_path):
    root, templates = tmp_path / "profile", tmp_path / "templates"
    put(root / "profile.json", {"id": "testprofile", "schema_version": 1})
    put(root / "data/jobs/jobs.json", [])
    put(root / "AGENTS.md", "Instrucciones anteriores del perfil")
    put(root / "CLAUDE.md", "Instrucciones anteriores para Claude")
    put(templates / "nodetech/demo/index.html", "<html>synthetic</html>")
    put(templates / "nodetech/demo/manifest.json", {"video_id": "demo", "status": "ready"})
    put(root / "output/demo/youtube_video.mp4", "synthetic MP4 placeholder")
    original = (root / "output/demo/youtube_video.mp4").read_bytes()
    args = [MIGRATE, "--profile-dir", root, "--templates-dir", templates]
    prepared = run([*args, "--local-prepare", "--confirm-maintenance", "--confirm-templates-owned"], tmp_path)
    assert prepared.returncode == 0, prepared.stderr
    txid = next(line.split("=", 1)[1] for line in prepared.stdout.splitlines() if line.startswith("migration_id="))
    active = run([*args, "--local-activate", "--migration-id", txid, "--confirm-maintenance"], tmp_path)
    assert active.returncode == 0, active.stderr
    assert load_profile(root)["schema_version"] == 3
    assert "design-definitions" in (root / "AGENTS.md").read_text()
    assert "design-definitions" in (root / "CLAUDE.md").read_text()
    assert "renders/videos/<categoría>" in (root / "productions/nodetech/AGENTS.md").read_text()
    assert (root / "productions/nodetech/demo/index.html").is_file()
    assert all(p.parent == root / "data/json" and p.suffix == ".json"
               for p in (root / "data").rglob("*") if p.is_file())
    moved = list((root / "renders/videos").rglob("video.mp4"))
    assert len(moved) == 1 and moved[0].read_bytes() == original
    rolled = run([*args, "--local-rollback", "--migration-id", txid,
                  "--confirm-maintenance", "--confirm-no-v2-writes"], tmp_path)
    assert rolled.returncode == 0, rolled.stderr
    assert load_profile(root)["schema_version"] == 1
    assert (root / "AGENTS.md").read_text() == "Instrucciones anteriores del perfil"
    assert (root / "CLAUDE.md").read_text() == "Instrucciones anteriores para Claude"
    assert (root / "output/demo/youtube_video.mp4").read_bytes() == original


def test_v3_migration_library_and_publication_aliases_roundtrip(tmp_path, monkeypatch):
    import hashlib
    import runpy
    from io import BytesIO
    from PIL import Image
    from src.adapters.data.json_store import JsonDataStore
    from src.adapters.data.local_file_storage import LocalFileStorage
    from src.adapters.data.local_publication_media import LocalPublicationMedia
    from src.adapters.data.section_publication_repository import SectionPublicationRepository
    from src.config.settings import settings

    root, templates = tmp_path / 'profile', tmp_path / 'templates'
    put(root / 'profile.json', {'id': 'testprofile', 'schema_version': 1})
    templates.mkdir()
    put(root / 'data/library/images.json', [
        {'asset_id': 'asset-z', 'category': 'cat', 'relative_path': 'cat/image.png'},
        {'asset_id': 'asset-a', 'category': 'cat', 'relative_path': 'cat/image.png'},
    ])
    library = root / 'data/library/files/images/cat'
    library.mkdir(parents=True)
    (library / 'image.png').write_bytes(b'synthetic-indexed')
    (library / 'orphan.png').write_bytes(b'synthetic-orphan')
    record_fixture = runpy.run_path(str(Path(__file__).parent / 'image_posts/test_repository_api.py'))['_record']
    record = record_fixture().model_dump(mode='json')
    stream = BytesIO()
    Image.new('RGB', (1080, 1350), color=(20, 40, 60)).save(stream, format='JPEG')
    jpeg = stream.getvalue()
    slide = record['technical']['slides'][0]
    slide['bytes'] = len(jpeg)
    slide['sha256'] = hashlib.sha256(jpeg).hexdigest()
    old_key = slide['storage_key']
    legacy_media = root / 'data/publicaciones' / old_key
    legacy_media.parent.mkdir(parents=True)
    legacy_media.write_bytes(jpeg)
    put(root / 'data/publicaciones/node_tech/2026/10/pub_test/record.json', record)
    put(root / 'data/publicaciones/idempotency.json', {
        'plan-key': {'publication_id': 'pub_test', 'body_hash': 'original-hash'},
    })
    args = [MIGRATE, '--profile-dir', root, '--templates-dir', templates]
    prepared = run([*args, '--local-prepare', '--confirm-maintenance', '--confirm-templates-owned'], tmp_path)
    assert prepared.returncode == 0, prepared.stderr
    txid = next(line.split('=', 1)[1] for line in prepared.stdout.splitlines() if line.startswith('migration_id='))
    active = run([*args, '--local-activate', '--migration-id', txid, '--confirm-maintenance'], tmp_path)
    assert active.returncode == 0, active.stderr
    monkeypatch.setattr(settings, 'storage_profile_dir', root)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    monkeypatch.setattr('src.core.data._store', JsonDataStore())
    storage = LocalFileStorage('images', 'library/files/images')
    resolved = storage.local_path('cat/image.png')
    assert resolved == root / 'resources/images/asset-a/image.png'
    assert resolved.read_bytes() == b'synthetic-indexed'
    assert list((root / 'resources/images').glob('legacy-*/orphan.png'))[0].read_bytes() == b'synthetic-orphan'
    repo = SectionPublicationRepository()
    assert repo.get_idempotent('plan-key', 'original-hash')['publication_id'] == 'pub_test'
    assert repo.get('pub_test')['technical']['slides'][0]['storage_key'].startswith('images/nodetech/')
    assert LocalPublicationMedia().get(old_key).read() == jpeg
    rolled = run([*args, '--local-rollback', '--migration-id', txid,
                  '--confirm-maintenance', '--confirm-no-v2-writes'], tmp_path)
    assert rolled.returncode == 0, rolled.stderr
    assert load_profile(root)['schema_version'] == 1
    assert (root / 'data/library/files/images/cat/image.png').read_bytes() == b'synthetic-indexed'
    assert (root / 'data/library/files/images/cat/orphan.png').read_bytes() == b'synthetic-orphan'
    assert (root / 'data/publicaciones' / old_key).read_bytes() == jpeg
    assert json.loads((root / 'data/publicaciones/node_tech/2026/10/pub_test/record.json').read_text())['publication_id'] == 'pub_test'
