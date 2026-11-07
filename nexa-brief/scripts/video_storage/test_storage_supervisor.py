import fcntl
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

import storage_supervisor as supervisor


class SupervisorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def orphan(self, name, marker=True):
        p = self.root / name
        p.mkdir()
        (p / "frame_0001.jpg").write_bytes(b"capture")
        (p / ".owner.lock").touch()
        if marker:
            (p / ".owner.json").write_text(
                json.dumps(
                    {
                        "version": 1,
                        "namespace": "promo",
                        "id": "a" * 8
                        + "-"
                        + "a" * 4
                        + "-"
                        + "a" * 4
                        + "-"
                        + "a" * 4
                        + "-"
                        + "a" * 12,
                        "created_at": time.time() - 1000,
                    }
                )
            )
        return p

    def test_only_owned_unlocked_old_scratch_is_removed(self):
        stale = self.orphan("_promo_job_stale")
        active = self.orphan("_promo_job_active")
        unowned = self.orphan("_promo_job_unknown", False)
        with (active / ".owner.lock").open("r+") as f:
            fcntl.flock(f, fcntl.LOCK_EX)
            self.assertEqual(supervisor.reap_workspaces([self.root]), 1)
            self.assertFalse(stale.exists())
            self.assertTrue(active.exists())
            self.assertTrue(unowned.exists())

    def test_activation_persists_and_hdd_error_does_not_fail_video(self):
        profile = self.root / "profile"
        (profile / "output").mkdir(parents=True)
        templates = self.root / "templates"
        templates.mkdir()
        config = {
            "profile": str(profile),
            "templates": str(templates),
            "mount": str(self.root / "absent"),
            "uuid": "UUID",
        }
        with (
            patch.object(supervisor, "discover", return_value=([], [])),
            patch.object(
                supervisor, "process_pending", side_effect=RuntimeError("absent")
            ),
        ):
            first = supervisor.cycle(config)
            second = supervisor.cycle(config)
        self.assertEqual(first["active_since"], second["active_since"])
        self.assertEqual(second["worker_error"], "RuntimeError")
        self.assertFalse((self.root / "absent").exists())
        self.assertTrue((profile / "data/video_backups/status.json").is_file())


if __name__ == "__main__":
    unittest.main()


def test_v2_queue_in_runtime_and_old_queue_flagged(tmp_path, monkeypatch):
    import json
    from unittest.mock import patch
    profile = tmp_path / "profile"
    profile.mkdir()
    (profile / "profile.json").write_text(json.dumps({"schema_version": 2, "id": "demo"}))
    old = profile / "data/video_backups/queue.sqlite3"
    old.parent.mkdir(parents=True)
    old.write_bytes(b"old untouched")
    templates = tmp_path / "templates"
    templates.mkdir()
    config = {"profile": str(profile), "templates": str(templates), "mount": str(tmp_path / "absent"), "uuid": "fake"}
    with patch.object(supervisor, "discover", return_value=([], [])), patch.object(supervisor, "process_pending") as pending:
        status = supervisor.cycle(config)
    assert (profile / ".system/runtime/video_backups/queue.sqlite3").is_file()
    assert old.read_bytes() == b"old untouched"
    assert {"kind": "legacy_queue", "error": "requires explicit migration"} in status["errors"]
    assert pending.call_args.args[0] == profile / ".system/runtime/video_backups"


def test_v3_runtime_queue_is_not_legacy_and_preserves_existing_work(tmp_path):
    profile = tmp_path / 'profile'
    runtime = profile / '.system/runtime/video_backups'
    runtime.mkdir(parents=True)
    (profile / 'profile.json').write_text(json.dumps({'schema_version': 3}))
    (runtime / 'activation.json').write_text(json.dumps({'started_at': '2025-01-02T00:00:00Z'}))
    source = profile / 'renders' / 'video.mp4'
    source.parent.mkdir(parents=True)
    source.write_bytes(b'synthetic')
    assert supervisor.enqueue_spec(runtime / 'queue.sqlite3', {
        'job_id': 'existing', 'metadata': {},
        'files': [{'source': str(source), 'target': 'video.mp4'}],
    })
    templates = tmp_path / 'templates'
    templates.mkdir()
    config = {'profile': str(profile), 'templates': str(templates),
              'mount': str(tmp_path / 'absent'), 'uuid': 'fake'}
    with patch.object(supervisor, 'discover', return_value=([], [])) as discover, \
         patch.object(supervisor, 'process_pending') as pending:
        status = supervisor.cycle(config)
        assert status['active_since'] == '2025-01-02T00:00:00Z'
        assert status['counts']['queued'] == 1
        assert not any(error['kind'] == 'legacy_queue' for error in status['errors'])
        assert pending.call_args.args[0] == runtime
        assert discover.call_args.args[3] == '2025-01-02T00:00:00Z'
        legacy = profile / 'data/video_backups/queue.sqlite3'
        legacy.parent.mkdir(parents=True)
        legacy.write_bytes(b'legacy left untouched')
        status = supervisor.cycle(config)
        assert {'kind': 'legacy_queue', 'error': 'requires explicit migration'} in status['errors']
        assert status['counts']['queued'] == 1
        assert legacy.read_bytes() == b'legacy left untouched'
