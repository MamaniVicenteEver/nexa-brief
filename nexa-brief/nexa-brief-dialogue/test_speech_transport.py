import base64
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from server_bridge import speak


class Pool:
    def __init__(self):
        self.keys = [types.SimpleNamespace(label=str(i), value="test-only") for i in range(4)]
        self.marked = []

    def available(self, model):
        return self.keys

    def mark_exhausted(self, key, model):
        self.marked.append(key.label)


class TransportTest(unittest.TestCase):
    def call(self, responses):
        self.requests = []
        owner = self

        class Client:
            def __init__(self, **kwargs):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *args):
                pass

            def post(self, url, **kwargs):
                owner.requests.append((url, kwargs))
                code, payload = responses.pop(0)
                return types.SimpleNamespace(status_code=code, json=lambda: payload)

        return patch.dict("sys.modules", {"httpx": types.SimpleNamespace(Client=Client)})

    def test_daily_quota_uses_next_configured_key_and_keeps_voice_model_and_usage(self):
        pool = Pool()
        usage = {"totalTokenCount": 44}
        response = {"candidates": [{"content": {"parts": [{"inlineData": {"data": base64.b64encode(b'\x01\x00' * 24000).decode()}}]}}], "usageMetadata": usage}
        with tempfile.TemporaryDirectory() as tmp, self.call([
            (429, {"error": {"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier"}}), (200, response)]):
            seconds, measured, attempts = speak(pool, "texto", Path(tmp)/"out.wav", "Sulafat", "fixed-model")
            self.assertEqual(seconds, 1)
            self.assertEqual(measured, usage)
            self.assertEqual(pool.marked, ["0"])
            self.assertEqual(len(attempts), 2)
            for url, request in self.requests:
                self.assertIn("fixed-model:generateContent", url)
                self.assertEqual(request["json"]["generationConfig"]["speechConfig"]["voiceConfig"]["prebuiltVoiceConfig"]["voiceName"], "Sulafat")

    def test_per_minute_rate_limit_stops_without_retry_or_marking_daily_quota(self):
        pool = Pool()
        with tempfile.TemporaryDirectory() as tmp, self.call([(429, {"error": {"quotaId": "GenerateRequestsPerMinute"}})]):
            with self.assertRaises(RuntimeError):
                speak(pool, "texto", Path(tmp)/"out.wav", "Sulafat", "fixed-model")
            self.assertEqual(len(self.requests), 1)
            self.assertEqual(pool.marked, [])

    def test_daily_quota_attempts_are_bounded_to_three_keys(self):
        pool = Pool()
        with tempfile.TemporaryDirectory() as tmp, self.call([(429, {"error": {"quotaId": "PerDay"}})] * 4):
            with self.assertRaises(RuntimeError):
                speak(pool, "texto", Path(tmp)/"out.wav", "Sulafat", "fixed-model")
            self.assertEqual(len(self.requests), 3)


if __name__ == "__main__":
    unittest.main()
