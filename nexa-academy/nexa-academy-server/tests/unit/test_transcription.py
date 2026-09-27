from src.academy.transcription import build_timing_payload


def _sample_transcription() -> dict:
    return {
        "metadata": {"audio_duration_sec": 3.0},
        "segments": [
            {
                "start": 0.0,
                "end": 3.0,
                "text": " Hello world again.",
                "words": [
                    {"word": " Hello", "start": 0.2, "end": 0.8},
                    {"word": " world", "start": 0.9, "end": 1.5},
                    {"word": " again", "start": 2.0, "end": 2.8},
                ],
            }
        ],
    }


def test_build_timing_payload_uses_whisper_word_boundaries() -> None:
    payload = build_timing_payload(
        _sample_transcription(),
        [
            {"id": "hello", "phrase": ["hello"], "title": "HELLO"},
            {"id": "again", "phrase": ["again"], "title": "AGAIN"},
        ],
    )

    assert payload["reading_cues"] == [
        {
            "id": "hello",
            "title": "HELLO",
            "start": 0.2,
            "end": 2.0,
            "matched_text": "Hello",
            "matched_word_start": 0,
            "matched_word_end": 0,
        },
        {
            "id": "again",
            "title": "AGAIN",
            "start": 2.0,
            "end": 3.0,
            "matched_text": "again",
            "matched_word_start": 2,
            "matched_word_end": 2,
        },
    ]


def test_unmatched_reading_phrase_is_not_fabricated() -> None:
    payload = build_timing_payload(
        _sample_transcription(),
        [{"id": "missing", "phrase": ["not", "spoken"], "title": "MISSING"}],
    )

    assert payload["reading_cues"] == []
