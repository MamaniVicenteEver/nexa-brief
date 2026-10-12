"""Deterministic clean-up of AI-generated copy so it always passes platform limits.

The model is asked to respect these rules, but it doesn't always — enforcing
them here means a long title or a stray '<' never makes an upload fail.
"""

from __future__ import annotations

import re

# YouTube API limits (videos.insert snippet).
YOUTUBE_TITLE_MAX = 100
YOUTUBE_DESCRIPTION_MAX = 5000
YOUTUBE_TAGS_MAX_CHARS = 500
TIKTOK_CAPTION_MAX = 150
TIKTOK_HASHTAGS_MAX = 6
YOUTUBE_TAGS_MAX = 15

_FORBIDDEN = re.compile(r"[<>]")  # YouTube rejects titles/descriptions containing angle brackets
_SPACES = re.compile(r"[ \t]+")
_BLANK_LINES = re.compile(r"\n{3,}")
# Emoji and pictographic symbols (plus joiners/variation selectors). Leaves normal
# punctuation such as "¿", "–" and quotes untouched.
_EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U00002B00-\U00002BFF\U0001F900-\U0001F9FF\u200d\ufe0f]+"
)


def strip_emojis(text: str) -> str:
    return _SPACES.sub(" ", _EMOJI.sub("", text)).strip()


def _clean_line(text: str) -> str:
    return _SPACES.sub(" ", _FORBIDDEN.sub("", text)).strip()


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rsplit(" ", 1)[0].rstrip(" ,.;:-|")
    return f"{cut}…"


def clean_title(title: str, limit: int = YOUTUBE_TITLE_MAX) -> str:
    return _truncate(_clean_line(title.replace("\n", " ")).strip("\"'"), limit)


def clean_description(description: str, limit: int = YOUTUBE_DESCRIPTION_MAX) -> str:
    lines = [_clean_line(line) for line in description.replace("\r", "").split("\n")]
    text = _BLANK_LINES.sub("\n\n", "\n".join(lines)).strip()
    return _truncate(text, limit)


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out = []
    for item in items:
        key = item.casefold()
        if item and key not in seen:
            seen.add(key)
            out.append(item)
    return out


def _tag_cost(tag: str) -> int:
    return len(tag) + (2 if " " in tag else 0)


def youtube_tags_length(tags: list[str]) -> int:
    """Length YouTube checks against its 500-char limit: multi-word tags count their quotes, plus one comma between tags."""
    return sum(_tag_cost(tag) for tag in tags) + max(len(tags) - 1, 0)


def clean_tags(tags: list[str], max_count: int = YOUTUBE_TAGS_MAX, max_chars: int = YOUTUBE_TAGS_MAX_CHARS) -> list[str]:
    out: list[str] = []
    for tag in _dedupe([_clean_line(t).lstrip("#").strip(",") for t in tags]):
        if len(out) >= max_count or youtube_tags_length([*out, tag]) > max_chars:
            break
        out.append(tag)
    return out


def clean_hashtags(hashtags: list[str], max_count: int = TIKTOK_HASHTAGS_MAX) -> list[str]:
    """Hashtags are stored without '#' and can't contain spaces or punctuation."""
    words = [re.sub(r"[^\w]", "", h.lstrip("#"), flags=re.UNICODE) for h in hashtags]
    return _dedupe(words)[:max_count]
