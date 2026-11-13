"""Deterministic, reviewable attribution for native YouTube editions."""
from copy import deepcopy
import re

YOUTUBE_MAX_BYTES = 5000
HEADINGS = {"en": ("SOURCES", "CREDITS"), "pt": ("FONTES", "CRÉDITOS"), "es": ("FUENTES", "CRÉDITOS")}


def _normal(line):
    return " ".join(line.strip().lstrip("-• ").split()).casefold()


def _urls(text):
    return {url.rstrip(".,;:!?") for url in re.findall(r"https?://[^\s<>]+", text)}


def represented(entry, description, *, credit=False):
    """Recognize an unchanged or properly attributed localized entry.

    URL-bearing credits also require the original author on the same line; a
    link alone is not sufficient attribution. An existing no-URL credit is
    recognized only by a distinctive proper name in the credits section.
    """
    entry_key = _normal(entry)
    if entry_key and any(entry_key == _normal(line) for line in description.splitlines()):
        return True
    urls = _urls(entry)
    if urls:
        if not urls.issubset(_urls(description)):
            return False
        if not credit:
            return True
        pieces = [part.strip() for part in entry.split(" — ")]
        if len(pieces) < 3:
            return False
        author = _normal(pieces[1])
        license_terms = re.search(r"\bCC\s*(?:BY(?:-SA)?(?:\s+\d(?:\.\d)?)?(?:\s+fr)?|0)\b|Pixabay Content License", entry, re.I)
        matching = [line for line in description.splitlines() if urls.intersection(_urls(line))]
        return any(author in _normal(line) and (not license_terms or _normal(license_terms.group()) in _normal(line))
                   for line in matching)
    if credit:
        sections = re.split(r"(?im)^.*(?:credits|créditos).*$", description, maxsplit=1)
        names = re.findall(r"\b(?:OpenAI)\b", entry)
        return len(sections) > 1 and bool(names) and any(name in sections[1] for name in names)
    return False


def youtube_description(description, package, locale):
    """Append original attribution verbatim; never shorten legal text or links."""
    description = (description or "").strip()
    lines_seen = {_normal(line) for line in description.splitlines() if line.strip()}
    source_heading, credit_heading = HEADINGS.get((locale or "").split("-")[0].lower(), HEADINGS["en"])
    parts = [description] if description else []
    for heading, entries in ((source_heading, package.sources), (credit_heading, package.credits)):
        pending = []
        for entry in entries:
            entry = entry.strip()
            key = _normal(entry)
            if key and key not in lines_seen and not represented(entry, "\n\n".join(parts), credit=heading == credit_heading):
                pending.append(entry)
                lines_seen.add(key)
        if pending:
            # Do not repeat a heading already present in the editorial text.
            prefix = [] if _normal(heading) in lines_seen else [heading]
            parts.append("\n".join([*prefix, *pending]))
            lines_seen.add(_normal(heading))
    return "\n\n".join(parts)


def publication_view(publish, package, locale):
    """Derive the same public text for the studio and the publishing adapter."""
    value = deepcopy(publish)
    if package is not None:
        youtube = value.setdefault("youtube", {})
        youtube["description"] = youtube_description(youtube.get("description", ""), package, locale)
    return value


def description_issues(description):
    issues = []
    count = len(description.encode("utf-8"))
    if count > YOUTUBE_MAX_BYTES:
        issues.append(f"La descripción de YouTube ocupa {count} bytes; el máximo es {YOUTUBE_MAX_BYTES}. Reduce el texto sin quitar fuentes ni créditos.")
    if "<" in description or ">" in description:
        issues.append("La descripción de YouTube contiene < o >, caracteres que YouTube no admite.")
    return issues
