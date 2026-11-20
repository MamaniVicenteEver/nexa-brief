"""Monotonic segment/word alignment and bounded semantic cue resolution."""
from __future__ import annotations

from bisect import bisect_right
from difflib import SequenceMatcher

from src.core.localization.texts import tokens


def words_of(lyrics: dict) -> list[dict]:
    return [w for s in lyrics.get("segments", []) if not s.get("outro") for w in s.get("words", [])]


def align(script: dict, lyrics: dict) -> tuple[dict, list[dict]]:
    words = words_of(lyrics)
    if not words:
        raise ValueError("La transcripción no contiene palabras")
    previous = 0
    for word in words:
        if not 0 <= float(word["start"]) <= float(word["end"]) or float(word["start"]) < previous:
            raise ValueError("Tiempos de transcripción inválidos")
        previous = float(word["start"])
    ref, starts, hyp, owners = [], [], [], []
    for segment in script["segments"]:
        starts.append(len(ref))
        ref.extend(tokens(segment["text"]))
    if not ref:
        raise ValueError("Guion vacío")
    for i, word in enumerate(words):
        for token in tokens(word["word"]):
            hyp.append(token)
            owners.append(i)
    if not hyp:
        raise ValueError("La transcripción no contiene texto")
    mapping, discrepancies = {}, []
    for op, a, b, c, d in SequenceMatcher(a=ref, b=hyp, autojunk=False).get_opcodes():
        if op != "equal":
            discrepancies.append({"kind": "transcript_discrepancy", "operation": op,
                                  "expected": " ".join(ref[a:b]), "heard": " ".join(hyp[c:d]),
                                  "word_start": owners[c] if c < len(owners) else len(words) - 1})
        for index in range(a, b):
            target = c + (index - a) * (d - c) // max(1, b - a)
            mapping[index] = owners[min(target, len(owners) - 1)]
    boundaries = [0]
    for start in starts[1:]:
        boundaries.append(max(boundaries[-1], mapping.get(start, len(words))))
    boundaries.append(len(words))
    segments = {}
    for i, segment in enumerate(script["segments"]):
        begin, end = boundaries[i:i + 2]
        if begin == end:
            raise ValueError(f"Sin palabras alineadas para {segment['id']}")
        segments[segment["id"]] = {"word_start": begin, "word_end": end,
                                  "start": words[begin]["start"], "end": words[end - 1]["end"]}
    return {"schema_version": 1, "segments": segments}, discrepancies


def phrase_matches(phrase: str, words: list[dict], begin=0, end=None) -> list[int]:
    needle = tokens(phrase)
    stream, owners = [], []
    for i in range(begin, len(words) if end is None else end):
        for token in tokens(words[i]["word"]):
            stream.append(token)
            owners.append(i)
    if not needle:
        return []
    return [owners[i] for i in range(len(stream) - len(needle) + 1) if stream[i:i + len(needle)] == needle]


def source_cues(script: dict, storyboard: dict, lyrics: dict) -> tuple[dict, list[dict]]:
    alignment, warnings = align(script, lyrics)
    words = words_of(lyrics)
    ids = list(alignment["segments"])
    rows = list(alignment["segments"].values())
    starts = [row["start"] for row in rows]
    cues, cursor = {}, 0
    for i, beat in enumerate(storyboard["beats"]):
        if beat.get("t") == 0:
            continue
        phrase = beat.get("at", "")
        matches = phrase_matches(phrase, words) if phrase else []
        match = next((n for n in matches if n >= cursor), matches[0] if matches else None)
        if phrase and match is None:
            raise ValueError(f"Ancla fuente no encontrada: escena {i}: {phrase}")
        if match is not None:
            cursor = match
        time = float(beat.get("t", words[match]["start"] if match is not None else 0))
        index = max(0, min(len(rows) - 1, bisect_right(starts, time) - 1))
        row = rows[index]
        fraction = max(0, min(1, (time - row["start"]) / max(.01, row["end"] - row["start"])))
        cues[f"scene.{i}"] = {"segment_id": ids[index], "source_phrase": phrase,
                               "source_time": time, "fraction": fraction, "anchored": bool(phrase)}
    return cues, warnings


def target_time(cue: dict, target_phrase: str, alignment: dict, words: list[dict]) -> tuple[float, dict | None]:
    row = alignment["segments"][cue["segment_id"]]
    hits = phrase_matches(target_phrase, words, row["word_start"], row["word_end"])
    if len(hits) == 1:
        return float(words[hits[0]]["start"]), None
    time = row["start"] + cue["fraction"] * (row["end"] - row["start"])
    return time, {"kind": "cue_proportional_fallback", "segment_id": cue["segment_id"],
                  "target_phrase": target_phrase, "matches": len(hits)}
