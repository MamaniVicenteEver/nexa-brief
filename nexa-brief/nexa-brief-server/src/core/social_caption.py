"""Concise public copy; research and attribution remain separate from captions."""
from __future__ import annotations

import re
from collections.abc import Iterable

_URL = re.compile(r"https?://\S+|www\.\S+", re.I)
_TAG = re.compile(r"(?<!\w)#[\w]+", re.UNICODE)


def clean_tags(values: Iterable[str], limit: int = 5) -> list[str]:
    result, seen = [], set()
    for value in values:
        tag = "#" + str(value).strip().lstrip("#").replace(" ", "")
        if not re.fullmatch(r"#[\w]+", tag) or tag.casefold() in seen:
            continue
        result.append(tag)
        seen.add(tag.casefold())
        if len(result) == limit:
            break
    return result


def brief_caption(text: str, question: str = "", tags: Iterable[str] = ()) -> str:
    def clean(value: str) -> str:
        value = re.sub(r"\[([^]]+)\]\([^)]*\)", r"\1", value)
        return " ".join(_TAG.sub("", _URL.sub("", value)).split()).strip(" ·—-")
    opening = clean(text)
    if len(opening) > 240:
        opening = opening[:237].rsplit(" ", 1)[0].rstrip(".,;:") + "…"
    question = clean(question)
    if question and question.casefold() in opening.casefold():
        question = ""
    return "\n\n".join(part for part in (opening, question, " ".join(clean_tags(tags))) if part)


def compact_existing_caption(title: str, caption: str, tags: Iterable[str] = ()) -> str:
    question = re.search(r"¿[^?]+\?(?:\s*Cuéntanos[^.]*\.)?", caption, re.I)
    return brief_caption(title, question.group(0) if question else "", [*tags, *_TAG.findall(caption)])


def social_video_parts(title: str, description: str, tags: Iterable[str] = ()) -> tuple[str, list[str]]:
    """Separate caption and hashtags because Meta/TikTok adapters append the tags."""
    compact = compact_existing_caption(title, description)
    chosen_tags = clean_tags(_TAG.findall(compact) or tags)
    body = "\n\n".join(part.strip() for part in _TAG.sub("", compact).split("\n\n") if part.strip())
    return body, [tag.lstrip("#") for tag in chosen_tags]
