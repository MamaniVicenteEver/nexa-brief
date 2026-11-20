from copy import deepcopy
import re


def seconds(value):
    if isinstance(value, (int, float)):
        return float(value)
    parts = str(value).split(":")
    try:
        return sum(float(part) * 60 ** i for i, part in enumerate(reversed(parts)))
    except ValueError:
        return 0


def platform_publish(raw: dict) -> dict:
    """Adapt the existing flat/v2 package to the public per-platform API."""
    if isinstance(raw.get("youtube"), dict):
        return deepcopy(raw)
    result = {}
    for platform in ("youtube", "instagram", "facebook", "tiktok"):
        fields = ("caption", "hashtags") if platform == "tiktok" else ("title", "description")
        result[platform] = {key: raw.get(f"{platform}_{key}", [] if key == "hashtags" else "") for key in fields}
    result["youtube"].update(tags=raw.get("youtube_tags", raw.get("tags", [])),
                              chapters=raw.get("chapters", []), pinned=raw.get("pinned_comment", ""))
    description = raw.get("description")
    if isinstance(description, dict):
        result["youtube"]["chapters"] = description.get("chapters", result["youtube"]["chapters"])
    # Chapters in the source v2 package are already timestamps, not segment IDs.
    result["youtube"]["chapters"] = [
        {"t": seconds(c.get("t", c.get("seconds", c.get("at", 0)))), "title": c.get("title", "")}
        for c in result["youtube"]["chapters"] if isinstance(c, dict)
    ]
    return result


def publication(output: dict, alignment: dict, *, chapters: bool) -> dict:
    value = deepcopy(output)
    value["youtube"]["chapters"] = [
        {"t": round(alignment["segments"][row["segment_id"]]["start"], 3), "title": row["title"]}
        for row in value["youtube"]["chapters"]
    ] if chapters else []
    if value["youtube"]["chapters"]:
        value["youtube"]["chapters"][0]["t"] = 0
    description = value["youtube"]["description"]
    description = re.sub(r"(?m)^\s*(?:\d{1,2}:)?\d{1,3}:\d{2}[^\n]*\n?", "", description).strip()
    lines = []
    for chapter in value["youtube"]["chapters"]:
        total = int(chapter["t"])
        hours, remaining = divmod(total, 3600)
        minutes, second = divmod(remaining, 60)
        stamp = f"{hours}:{minutes:02d}:{second:02d}" if hours else f"{minutes}:{second:02d}"
        lines.append(stamp + " " + chapter["title"])
    value["youtube"]["description"] = description + ("\n\n" + "\n".join(lines) if lines else "")
    return value
