"""Herramientas del kit con edición maestra (voz, transcripción, cierre) sin servicios reales."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import types
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / "src/templates/_tools/explainer-kit/tools"
DEMO = ROOT / "src/templates/nodetech/lo-que-le-contas-a-la-ia-no-es-privado-tus-chats"
sys.path.insert(0, str(TOOLS))

import edition_context  # noqa: E402
import narrate  # noqa: E402
import outro  # noqa: E402
import transcribe  # noqa: E402
import tts  # noqa: E402
from src.core.explainer.editions.resolver import build_edition  # noqa: E402


@pytest.fixture()
def production(tmp_path):
    dest = tmp_path / "demo"
    shutil.copytree(DEMO, dest, ignore=shutil.ignore_patterns("media", "render", "work", "*.mp3", "components"))
    return dest


def write_edition(production: Path, locale: str) -> Path:
    edition = build_edition(production, locale)
    rev = production / "languages" / locale / "revisions" / edition.revision
    rev.mkdir(parents=True)
    path = rev / "edition.json"
    path.write_text(edition.model_dump_json(by_alias=True, indent=2))
    return path


def test_context_reads_edition_and_paths(production):
    ctx = edition_context.load(write_edition(production, "en-US"))
    assert ctx.production == production.resolve()
    assert ctx.locale == "en-US" and ctx.whisper_language == "en" and ctx.language_name == "English"
    assert ctx.path_of("audio") == production.resolve() / "languages/en-US/revisions/rev-001/song.mp3"
    assert "English-language" in ctx.initial_prompt("OpenAI")
    assert ctx.speakable("OpenAI and ChatGPT") == "Open A I and Chat G P T"


def test_argv_edition_is_removed(monkeypatch, production):
    path = write_edition(production, "pt-BR")
    monkeypatch.setattr(sys, "argv", ["tool", "a", "--edition", str(path), "b"])
    ctx = edition_context.from_argv()
    assert ctx.locale == "pt-BR" and sys.argv == ["tool", "a", "b"]


def test_no_edition_keeps_spanish_chunks(monkeypatch):
    monkeypatch.delenv("NEXA_EDITION", raising=False)
    script = json.loads((DEMO / "assets/script.json").read_text())
    style = narrate.chunks(script, narrate.BASE)[0]["style"]
    assert style.startswith("Narrador de documental") and "130 palabras por minuto" in style
    prompt = tts.director_prompt(script, script["segments"][:1])
    assert "Latin American Spanish documentary narrator" in prompt


def test_edition_chunks_use_identity_voice(production):
    ctx = edition_context.load(write_edition(production, "en-US"))
    script = {"title": "Your chats", "segments": [
        {"id": "s01", "tone": "alarma", "intensity": 1.0, "text": "OpenAI kept the logs. Then a judge asked.",
         "delivery_note": "Firm, never rushed."}]}
    c = narrate.chunks_edition(script, ctx)[0]
    assert "English (en-US)" in c["style"] and f"about {ctx.target_wpm} words per minute" in c["style"]
    assert "Firm, never rushed." in c["style"] and "Narrador" not in c["style"]
    assert c["text"].startswith("<breath> Open A I kept the logs. <short pause> Then")
    prompt = tts.director_prompt(script, script["segments"], profile=ctx.direction, pace="Aim for 150.", language="English")
    assert "Latin American Spanish" not in prompt and ctx.direction in prompt


def test_number_words():
    assert edition_context.en_num(20_000_000) == "twenty million"
    assert edition_context.en_num(1956) == "one thousand nine hundred fifty six"
    assert edition_context.pt_num(20_000_000) == "vinte milhoes"
    assert edition_context.pt_num(1956) == "mil novecentos e cinquenta e seis"


def _fake_whisper(monkeypatch, calls, words):
    class W:
        def __init__(self, word, start, end):
            self.word, self.start, self.end, self.probability = word, start, end, 0.9

    class Seg:
        def __init__(self):
            self.words = [W(*w) for w in words]
            self.start, self.end = self.words[0].start, self.words[-1].end
            self.text = "".join(w.word for w in self.words)

    class Model:
        def __init__(self, *a, **k):
            pass

        def transcribe(self, audio, **kw):
            calls.append(kw)
            return [Seg()], types.SimpleNamespace(duration=words[-1][2] + 0.5)

    monkeypatch.setitem(sys.modules, "faster_whisper", types.SimpleNamespace(WhisperModel=Model))


def test_transcribe_with_edition_writes_raw(monkeypatch, production):
    ctx = edition_context.load(write_edition(production, "en-US"))
    rev = ctx.path_of("script").parent
    (rev / "script.json").write_text(json.dumps({"segments": [{"id": "s01", "text": "Twenty million chats."}]}))
    calls = []
    _fake_whisper(monkeypatch, calls, [(" Twenty", 0.0, 0.4), (" milion", 0.4, 0.8), (" chats.", 0.8, 1.2)])
    transcribe.main("audio.mp3", str(rev / "script.json"), str(ctx.path_of("lyrics")), ctx)
    assert calls[0]["language"] == "en" and calls[0]["initial_prompt"].startswith("An English-language")
    raw = json.loads((rev / "transcript-raw.json").read_text())
    fixed = json.loads(ctx.path_of("lyrics").read_text())
    assert raw["segments"][0]["words"][1]["word"] == " milion"
    assert fixed["segments"][0]["words"][1]["word"] == " million" and fixed["metadata"]["language"] == "en"


def _silence(path: Path, seconds: float):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
                    "-t", str(seconds), "-b:a", "64k", str(path)], check=True)


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg")
def test_outro_apply_edition_uses_revision_paths(monkeypatch, production, tmp_path):
    ctx = edition_context.load(write_edition(production, "en-US"))
    kit = tmp_path / "kit"
    audio = kit / ctx.outro["audio"]
    audio.parent.mkdir(parents=True)
    _silence(audio, 2.0)
    audio.with_suffix(".json").write_text(json.dumps({"voice": "Iapetus", "dur": 2.0, "timings": {"likeAt": 0.5},
                                                      "words": [{"word": " Thanks", "start": 0.1, "end": 0.5}]}))
    monkeypatch.setattr(edition_context, "KIT", kit)
    rev = ctx.path_of("config").parent
    _silence(rev / "song.mp3", 3.0)
    (rev / "lyrics.json").write_text(json.dumps({"segments": [{"text": " Hi", "words": [{"word": " Hi", "start": 0.2, "end": 1.0}]}]}))
    (rev / "storyboard.json").write_text(json.dumps({"beats": []}))
    (rev / "config.json").write_text((production / "assets/config.json").read_text())
    before = (production / "assets/config.json").read_text()
    result = outro.apply(ctx.production, ctx)
    cfg = json.loads((rev / "config.json").read_text())
    c = cfg["configs"][0] if "configs" in cfg else cfg
    assert result and c["audio"]["src"] == "languages/en-US/revisions/rev-001/song-with-outro.mp3"
    assert c["outro"]["thanks"] == "THANKS FOR WATCHING" and c["outro"]["likeAt"] == 0.5
    assert (rev / "song-with-outro.mp3").exists()
    assert (production / "assets/config.json").read_text() == before


def test_outro_spoken_in_every_market(production):
    for locale in ("es-419", "en-US", "pt-BR"):
        spoken = build_edition(production, locale).outro_spoken
        assert spoken and set(spoken.cues) == {"likeAt", "subscribeAt", "bellAt", "supportAt"}
        low = spoken.text.lower()
        assert all(cue.lower() in low for cue in spoken.cues.values())


def test_outro_measure_reuses_audio_and_reports_estimated_cue(monkeypatch, production, tmp_path):
    ctx = edition_context.load(write_edition(production, "en-US"))
    kit = tmp_path / "kit"
    audio = kit / ctx.outro["audio"]
    audio.parent.mkdir(parents=True)
    audio.write_bytes(b"existing audio")
    monkeypatch.setattr(edition_context, "KIT", kit)
    monkeypatch.setattr(outro, "KIT", kit)
    monkeypatch.setattr(outro, "_synthesize", lambda *_: pytest.fail("must reuse existing audio"))
    _fake_whisper(monkeypatch, [], [(" Thanks", 0, .4), (" subscribe", .4, .8), (" bell", .8, 1.2)])
    assert outro.make_voice(ctx) == audio
    meta = json.loads(audio.with_suffix(".json").read_text())
    assert meta["voice"] == "Iapetus" and meta["warnings"]
    assert set(meta["timings"]) == {"likeAt", "subscribeAt", "bellAt", "supportAt"}
