"""Readable line breaks for text-and-image native edition thumbnails."""
import textwrap


def wrap_image_intro(text: str, *, width: int = 15) -> str:
    """Preserve explicit layout and every word; break unformatted long titles."""
    if "\n" in text or len(text) <= width:
        return text
    lines = textwrap.wrap(text, width=width, break_long_words=False, break_on_hyphens=False)
    return "\n".join(lines) if len(lines) > 1 else text
