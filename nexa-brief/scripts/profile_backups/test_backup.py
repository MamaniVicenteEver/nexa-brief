"""No real profiles or disks: mount guards and real Restic recovery on tiny fixtures."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("daily_backup", Path(__file__).with_name("backup.py"))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="nexa-full-backup-test-")
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.home = self.base / "home"
        self.source = self.home / "inputs"
        self.source.mkdir(parents=True)
        (self.source / "document.txt").write_text("original fixture")
        self.disk = self.base / "disk"
        self.disk.mkdir()
        self.key = self.home / "test-password"
        self.key.write_text("test-only-not-a-real-key")
        self.key.chmod(0o600)
        self.binary = Path(os.environ.get("TEST_RESTIC_BIN", str(Path.home()/".local/bin/restic")))
        self.config = {"home": str(self.home), "sources": [str(self.source)], "mount": str(self.disk),
                       "uuid": "synthetic-uuid", "repository": "nexa-brief/repository", "host": "fixture",
                       "restic": str(self.binary), "password_file": str(self.key), "minimum_free_bytes": 0}

    def test_absent_mount_never_writes_repository_or_cache(self):
        with self.assertRaisesRegex(RuntimeError, "HDD mount"):
            backup.run(self.config)
        self.assertEqual(list(self.disk.iterdir()), [])

    def test_wrong_volume_stops_before_starting_restic(self):
        with patch.object(backup, "mount_guard", side_effect=RuntimeError("HDD mount/UUID mismatch")), \
             patch.object(backup.subprocess, "run") as command:
            with self.assertRaisesRegex(RuntimeError, "UUID"):
                backup.run(self.config)
        command.assert_not_called()
        self.assertEqual(list(self.disk.iterdir()), [])

    def test_destination_symlink_cannot_redirect_to_ssd(self):
        ssd = self.base / "ssd"
        ssd.mkdir()
        (self.disk / "nexa-brief").symlink_to(ssd, target_is_directory=True)
        with patch.object(backup, "mount_guard"):
            with self.assertRaisesRegex(backup.BackupFailure, "symlinks"):
                backup.run(self.config)
        self.assertEqual(list(ssd.iterdir()), [])

    def test_private_key_and_explicit_sources_required(self):
        self.key.chmod(0o644)
        with self.assertRaisesRegex(backup.BackupFailure, "private"):
            backup.run(self.config)
        self.key.chmod(0o600)
        self.config["sources"] = [str(self.home)]
        with self.assertRaisesRegex(backup.BackupFailure, "explicitly"):
            backup.run(self.config)

    def test_runtime_activity_is_excluded_but_asset_changes_are_detected(self):
        runtime = self.source / ".system/runtime"
        runtime.mkdir(parents=True)
        (runtime / "lock").write_text("first")
        before = backup.source_fingerprint([self.source], self.key)
        (runtime / "lock").write_text("changed")
        self.assertEqual(before, backup.source_fingerprint([self.source], self.key))
        (self.source / "document.txt").write_text("changed")
        self.assertNotEqual(before, backup.source_fingerprint([self.source], self.key))

    def restic(self, *args):
        return subprocess.run([str(self.binary), "--repo", str(self.disk/"nexa-brief/repository"),
                               "--password-file", str(self.key), "--cache-dir", str(self.base/"restore-cache"),
                               *args], capture_output=True, text=True, check=True).stdout

    def test_real_incremental_backup_skip_changes_and_restore(self):
        if not self.binary.is_file():
            self.skipTest("Real Restic binary not installed")
        with patch.object(backup, "mount_guard"):
            first = backup.run(self.config)
            self.assertEqual(first["status"], "verified")
            second = backup.run(self.config)
            self.assertEqual(second["status"], "unchanged")
            self.assertEqual(second["snapshot_id"], first["snapshot_id"])
            (self.source / "document.txt").write_text("updated fixture")
            third = backup.run(self.config)
            self.assertEqual(third["status"], "verified")
            self.assertNotEqual(third["snapshot_id"], first["snapshot_id"])
        snapshots = json.loads(self.restic("snapshots", "--json", "--tag", "nexa-full,verified"))
        self.assertEqual(len(snapshots), 2)
        restored = self.base / "restored"
        self.restic("restore", third["snapshot_id"], "--target", str(restored))
        self.assertEqual((restored/"inputs/document.txt").read_text(), "updated fixture")

    def test_changing_source_does_not_publish_a_verified_snapshot(self):
        if not self.binary.is_file():
            self.skipTest("Real Restic binary not installed")
        with patch.object(backup, "mount_guard"), \
             patch.object(backup, "source_fingerprint", side_effect=["before", "after"]):
            with self.assertRaisesRegex(backup.BackupFailure, "Sources changed"):
                backup.run(self.config)
        self.assertEqual(json.loads(self.restic("snapshots", "--json", "--tag", "nexa-full,verified")), [])

    def test_stable_retry_verifies_an_existing_pending_backup(self):
        if not self.binary.is_file():
            self.skipTest("Real Restic binary not installed")
        with patch.object(backup, "mount_guard"), \
             patch.object(backup, "source_fingerprint", side_effect=["before", "after"]):
            with self.assertRaisesRegex(backup.BackupFailure, "Sources changed"):
                backup.run(self.config)
        with patch.object(backup, "mount_guard"):
            retry = backup.run(self.config)
        self.assertEqual(retry["status"], "verified")
        self.assertTrue(retry["snapshot_id"])
        snapshots = json.loads(self.restic("snapshots", "--json", "--tag", "nexa-full,verified"))
        self.assertEqual([s["id"] for s in snapshots], [retry["snapshot_id"]])
        restored = self.base / "retried-restore"
        self.restic("restore", retry["snapshot_id"], "--target", str(restored))
        self.assertEqual((restored / "inputs/document.txt").read_text(), "original fixture")

    def test_running_state_replaces_a_previous_failure_before_work_starts(self):
        state = self.home / "backup-state"
        state.mkdir()
        (state / "status.json").write_text(json.dumps({"status": "blocked"}))
        config = dict(self.config, state_dir=str(state))
        config_path = self.home / "backup-config.json"
        config_path.write_text(json.dumps(config))

        def running(_config):
            observed = json.loads((state / "status.json").read_text())
            self.assertEqual(observed["status"], "running")
            self.assertIn("started_at", observed)
            return {"status": "verified", "snapshot_id": "fixture-snapshot"}

        with patch.object(backup.sys, "argv", ["backup.py", "--config", str(config_path)]), \
             patch.object(backup, "run", side_effect=running), patch("builtins.print"):
            self.assertEqual(backup.main(), 0)
        self.assertEqual(json.loads((state / "status.json").read_text())["status"], "verified")

    def test_source_edits_after_capture_do_not_invalidate_the_saved_version(self):
        if not self.binary.is_file():
            self.skipTest("Real Restic binary not installed")
        real_command = subprocess.run

        def update_during_check(command, **kwargs):
            result = real_command(command, **kwargs)
            if "check" in command and result.returncode == 0:
                (self.source / "document.txt").write_text("next version after capture")
            return result

        with patch.object(backup, "mount_guard"), \
             patch.object(backup.subprocess, "run", side_effect=update_during_check):
            saved = backup.run(self.config)
        self.assertEqual(saved["status"], "verified")
        self.assertEqual((self.source / "document.txt").read_text(), "next version after capture")
        restored = self.base / "captured-restore"
        self.restic("restore", saved["snapshot_id"], "--target", str(restored))
        self.assertEqual((restored / "inputs/document.txt").read_text(), "original fixture")


if __name__ == "__main__":
    unittest.main()
