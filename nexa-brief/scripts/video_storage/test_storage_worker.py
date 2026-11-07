import contextlib
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
import storage_worker as w


class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.mount = self.root / "hdd"
        self.mount.mkdir()
        (self.mount / "nexa-brief").mkdir()
        self.src = self.root / "allowed"
        self.src.mkdir()
        self.db = self.root / "local" / "queue.sqlite3"
        (self.src / "video.mp4").write_bytes(b"hello")
        (self.src / "portrait.mp4").write_bytes(b"hello")
        self.spec = {
            "job_id": "explainer:vídeo/one",
            "metadata": {"revision": "1"},
            "files": [
                {"source": str(self.src / "video.mp4"), "target": "16x9/video.mp4"},
                {"source": str(self.src / "portrait.mp4"), "target": "9x16/video.mp4"},
            ],
        }

    def guard(self, *args):
        pass

    def process(self):
        with patch.object(w, "mount_guard", self.guard):
            w.process_queue(self.db, self.mount, "UUID", [self.src])

    def status(self):
        with contextlib.closing(sqlite3.connect(self.db)) as db:
            return db.execute("select status,attempts from backups").fetchone()

    def bundle(self):
        return (
            self.mount
            / "nexa-brief"
            / "producciones"
            / ("job-" + w.hashlib.sha256(self.spec["job_id"].encode()).hexdigest())
        )

    def test_two_formats_duplicate_and_idempotence(self):
        self.assertTrue(w.enqueue(self.db, self.spec))
        self.assertFalse(w.enqueue(self.db, self.spec))
        self.process()
        self.assertEqual(self.status(), ("done", 1))
        self.assertFalse(w.enqueue(self.db, self.spec))
        manifest = json.loads((self.bundle() / "manifest.json").read_text())
        self.assertEqual(manifest["job_id"], self.spec["job_id"])
        self.assertEqual(len(manifest["files"]), 2)
        self.assertEqual(
            manifest["files"][0]["original_mtime_ns"],
            (self.src / "video.mp4").stat().st_mtime_ns,
        )
        self.assertEqual(
            manifest["files"][0]["original_mode"],
            w.stat.S_IMODE((self.src / "video.mp4").stat().st_mode),
        )
        self.assertEqual(
            os.stat(self.bundle() / "16x9/video.mp4").st_ino,
            os.stat(self.bundle() / "9x16/video.mp4").st_ino,
        )

    def test_absent_wrong_uuid(self):
        with patch.object(w.subprocess, "run", side_effect=OSError("absent")):
            with self.assertRaises(RuntimeError):
                w.mount_guard(self.mount, "UUID")

        class Result:
            stdout = f'TARGET="{self.mount}" UUID="WRONG" ID="99"'

        with patch.object(w.subprocess, "run", return_value=Result()):
            with self.assertRaises(RuntimeError):
                w.mount_guard(self.mount, "UUID")
        self.assertEqual(list((self.mount / "nexa-brief").iterdir()), [])

    def test_failed_copy_retry_and_staging_cleanup(self):
        w.enqueue(self.db, self.spec)
        with (
            patch.object(w, "mount_guard", self.guard),
            patch.object(w, "opened_source", side_effect=OSError("copy failure")),
        ):
            w.process_queue(self.db, self.mount, "UUID", [self.src])
        self.assertEqual(self.status(), ("error", 1))
        self.assertFalse(self.bundle().exists())
        self.assertEqual(
            list(
                (self.mount / "nexa-brief" / "producciones" / ".generations").iterdir()
            ),
            [],
        )
        self.process()
        self.assertEqual(self.status(), ("done", 2))

    def test_update_keeps_one_generation_and_old_on_failure(self):
        w.enqueue(self.db, self.spec)
        self.process()
        self.spec["metadata"]["revision"] = "2"
        w.enqueue(self.db, self.spec)
        with (
            patch.object(w, "mount_guard", self.guard),
            patch.object(w, "opened_source", side_effect=OSError("oops")),
        ):
            w.process_queue(self.db, self.mount, "UUID", [self.src])
        self.assertEqual(
            json.loads((self.bundle() / "manifest.json").read_text())["metadata"][
                "revision"
            ],
            "1",
        )
        self.process()
        self.assertEqual(
            json.loads((self.bundle() / "manifest.json").read_text())["metadata"][
                "revision"
            ],
            "2",
        )
        self.assertEqual(
            len(
                list(
                    (
                        self.mount / "nexa-brief" / "producciones" / ".generations"
                    ).iterdir()
                )
            ),
            1,
        )

    def test_path_escape_and_secret_rejected(self):
        outside = self.root / "outside.mp4"
        outside.write_bytes(b"x")
        (self.src / "link").symlink_to(outside)
        self.spec["files"] = [{"source": str(self.src / "link"), "target": "video.mp4"}]
        w.enqueue(self.db, self.spec)
        self.process()
        self.assertEqual(self.status()[0], "error")
        self.spec["files"][0]["target"] = "../escape"
        self.assertRaises(ValueError, w.validate_spec, self.spec)
        self.spec["files"][0]["target"] = "frames/a"
        self.assertRaises(ValueError, w.validate_spec, self.spec)
        self.spec["files"][0]["target"] = "video.mp4"
        self.spec["metadata"]["token"] = "secret"
        self.assertRaises(ValueError, w.validate_spec, self.spec)

    def test_guard_failure_before_publish_keeps_previous(self):
        w.enqueue(self.db, self.spec)
        self.process()
        self.spec["metadata"]["revision"] = "2"
        w.enqueue(self.db, self.spec)
        calls = []

        def guard(*args):
            calls.append(args)
            if len(calls) == 6:
                raise RuntimeError("mount changed")

        with patch.object(w, "mount_guard", guard):
            w.process_queue(self.db, self.mount, "UUID", [self.src])
        self.assertEqual(self.status()[0], "error")
        self.assertEqual(
            json.loads((self.bundle() / "manifest.json").read_text())["metadata"][
                "revision"
            ],
            "1",
        )
        self.assertEqual(
            len(
                list(
                    (
                        self.mount / "nexa-brief" / "producciones" / ".generations"
                    ).iterdir()
                )
            ),
            1,
        )

    def test_corrupt_destination_fails_verification_and_preserves_old(self):
        w.enqueue(self.db, self.spec)
        self.process()
        self.spec["metadata"]["revision"] = "corrupt"
        w.enqueue(self.db, self.spec)
        original = w.verify_copy

        def corrupt_then_verify(path, digest, size):
            path.write_bytes(b"corrupted on disk")
            return original(path, digest, size)

        with (
            patch.object(w, "mount_guard", self.guard),
            patch.object(w, "verify_copy", corrupt_then_verify),
        ):
            w.process_queue(self.db, self.mount, "UUID", [self.src])
        self.assertEqual(self.status()[0], "error")
        self.assertEqual(
            json.loads((self.bundle() / "manifest.json").read_text())["metadata"][
                "revision"
            ],
            "1",
        )
        self.assertEqual(
            len(
                list(
                    (
                        self.mount / "nexa-brief" / "producciones" / ".generations"
                    ).iterdir()
                )
            ),
            1,
        )
        self.process()
        self.assertEqual(self.status()[0], "done")
        self.assertEqual(
            len(
                list(
                    (
                        self.mount / "nexa-brief" / "producciones" / ".generations"
                    ).iterdir()
                )
            ),
            1,
        )
        self.assertEqual(
            json.loads((self.bundle() / "manifest.json").read_text())["metadata"][
                "revision"
            ],
            "corrupt",
        )

    def test_worker_lock_blocks_second_worker(self):
        w.enqueue(self.db, self.spec)
        with self.db.with_suffix(".lock").open("a") as lock:
            w.fcntl.flock(lock, w.fcntl.LOCK_EX | w.fcntl.LOCK_NB)
            with self.assertRaises(BlockingIOError):
                w.process_queue(self.db, self.mount, "UUID", [self.src])
        self.assertEqual(self.status()[0], "queued")

    def test_discovered_signature_rejects_updated_source(self):
        entry = self.spec["files"][0]
        st = Path(entry["source"]).stat()
        entry.update(expected_size=st.st_size, expected_mtime_ns=st.st_mtime_ns)
        Path(entry["source"]).write_bytes(b"different video")
        w.enqueue(self.db, self.spec)
        self.process()
        self.assertEqual(self.status()[0], "error")
        self.assertFalse(self.bundle().exists())

    def test_new_spec_during_processing_not_marked_done(self):
        w.enqueue(self.db, self.spec)

        def process(*args):
            updated = json.loads(json.dumps(self.spec))
            updated["metadata"]["revision"] = "2"
            w.enqueue(self.db, updated)

        with patch.object(w, "process_spec", process):
            w.process_queue(self.db, self.mount, "UUID", [self.src])
        self.assertEqual(self.status()[0], "queued")
        self.process()
        self.assertEqual(self.status()[0], "done")


if __name__ == "__main__":
    unittest.main()
