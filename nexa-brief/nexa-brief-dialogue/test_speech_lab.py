import copy
import tempfile
import unittest
from pathlib import Path

from speech_lab import HERE, digest, load, validate_batch, validate_script, verify_review, write


class EditorialRulesTest(unittest.TestCase):
    def setUp(self):
        self.profile = load(HERE / "profiles/alma.json")
        self.brief = {"facts": [{"id": "a1"}]}
        self.script = {"character_id": "alma", "segments": [
            {"role": "opening", "text": "La cumbre del clima comienza hoy en Turquía y reúne a representantes de distintos países.", "fact_ids": ["a1"]},
            {"role": "body", "text": "Las conversaciones se desarrollarán durante los próximos días. El programa incluye encuentros y sesiones de trabajo. La información disponible corresponde a la agenda publicada por sus organizadores.", "fact_ids": ["a1"]},
            {"role": "closing", "text": "Síguenos para más.", "fact_ids": []}]}

    def test_direct_opening_passes_and_self_presentation_fails(self):
        self.assertEqual(validate_script(self.script, self.profile, self.brief), [])
        for intro in ["Hola, soy Alma.", "Soy Alma.", "Bienvenidos al canal.", "Hoy te cuento las noticias."]:
            with self.subTest(intro=intro):
                script = copy.deepcopy(self.script)
                script["segments"][0]["text"] = intro
                self.assertIn("self_introduction_or_generic_intro", validate_script(script, self.profile, self.brief))

    def test_unknown_or_missing_evidence_is_rejected(self):
        for refs, error in [(["invented"], "unknown_fact_reference"), ([], "evidence_reference_required")]:
            script = copy.deepcopy(self.script)
            script["segments"][1]["fact_ids"] = refs
            self.assertIn(error, validate_script(script, self.profile, self.brief))

    def test_brand_monologue_and_mid_script_cta_are_rejected(self):
        script = copy.deepcopy(self.script)
        script["segments"][-1]["text"] = "Mi compromiso es ayudarte a comprender el mundo."
        self.assertIn("invalid_closing", validate_script(script, self.profile, self.brief))
        script = copy.deepcopy(self.script)
        script["segments"][1], script["segments"][2] = script["segments"][2], script["segments"][1]
        self.assertIn("invalid_closing", validate_script(script, self.profile, self.brief))

    def test_batch_cannot_omit_or_duplicate_selected_character(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write(root / "profiles.snapshot.json", [self.profile])
            write(root / "briefs.json", [{"character_id": "alma", **self.brief}])
            write(root / "study.json", {"characters": ["alma"]})
            for scripts in [[], [self.script, self.script]]:
                with self.assertRaises(ValueError):
                    validate_batch(root, {"scripts": scripts})

    def test_audio_review_is_invalidated_by_text_or_evidence_change(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = {"scripts": [self.script]}
            briefs = [self.brief]
            write(root / "briefs.json", briefs)
            write(root / "editorial.review.json", {"status": "reviewed_for_audio_sample", "reviewer": "test",
                  "script_hash": digest(data), "brief_hash": digest(briefs)})
            verify_review(root, data)
            changed = copy.deepcopy(data)
            changed["scripts"][0]["segments"][0]["text"] += " Cambio."
            with self.assertRaises(ValueError):
                verify_review(root, changed)
            write(root / "briefs.json", [{"facts": []}])
            with self.assertRaises(ValueError):
                verify_review(root, data)


if __name__ == "__main__":
    unittest.main()
