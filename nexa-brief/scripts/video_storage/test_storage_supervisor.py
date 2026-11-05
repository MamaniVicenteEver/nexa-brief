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
