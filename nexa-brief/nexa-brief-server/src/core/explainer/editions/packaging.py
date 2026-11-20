"""Publication sidecars for a native revision; frozen audio/checkpoints stay intact."""
from copy import deepcopy
from dataclasses import replace
import hashlib
import re
from functools import lru_cache

from src.config.content_paths import content_key
from src.core.markets import normalize_locale
from src.core.explainer.publishing.opening import CHOSEN_TO_OPTION, opening_specs
from src.core.explainer.publishing.package import PublishPackage
from src.core.explainer.publishing.store import load_package
from .io import active_revision, read, safe, write
from .resolver import _source_revision


def load_native(folder):
    path = safe(folder, "publication.json")
    return PublishPackage.model_validate(read(path)) if path.is_file() else None


def prepare_package(video, folder, packaging, publish):
    """Reuse only source media/composition. Every public text comes from this market."""
    source = load_package(video.path)
    if source is None:
        raise ValueError("El diseño necesita un paquete original A/B/C para adaptar sus miniaturas")
    raw = source.model_dump()
    thumb = raw["thumbnail"]
    thumb["text_only"] = packaging.text_only.model_dump()
    thumb["with_image"].update(packaging.with_image.model_dump(), composition="", image_review=[])
    if video.design in {"rough", "binary"}:
        from .thumbnail_layout import wrap_image_intro
        thumb["with_image"]["text"] = wrap_image_intro(thumb["with_image"]["text"])
    original_c = thumb.get("tabloid") or {"image": thumb["with_image"].get("image")}
    thumb["tabloid"] = {**original_c, **packaging.tabloid.model_dump(), "image_review": []}
    thumb.update(chosen=packaging.chosen_thumbnail, kicker=packaging.kicker)
    raw["titles"] = {"youtube": [t.model_dump() for t in packaging.titles], "chosen": packaging.chosen_title,
                     "facebook": {"title": publish["facebook"]["title"], "first_line": publish["facebook"]["description"].split("\n")[0]},
                     "tiktok": {"caption": publish["tiktok"]["caption"]}}
    raw["description"] = {"hook": publish["youtube"]["description"], "context": "", "chapters": [],
                          "reflection": "", "question": ""}
    raw["tags"] = {"youtube": publish["youtube"]["tags"], "youtube_hashtags": [],
                   "facebook": [], "tiktok": publish["tiktok"]["hashtags"]}
    # Keep the source attribution as exact legal/source text in the signed package.
    raw["pinned_comment"] = publish["youtube"]["pinned"]
    package = PublishPackage.model_validate(raw)
    rules = read(safe(folder, "edition.json")).get("resolved_strategies", {}).get("title", {}).get("effective", {})
    maximum = rules.get("max_chars", 100)
    if any(len(t.text) > maximum for t in package.titles.youtube):
        raise ValueError(f"Los títulos exceden la estrategia activa ({maximum} caracteres)")
    if set(opening_specs(package, video.path, video.design)) != {"A", "B", "C"}:
        raise ValueError("Se requieren las tres miniaturas y los medios originales aprobados")
    apply_package(video, folder, package)
    return package


def apply_package(video, folder, package):
    """Update only publication sidecars, never ES or frozen adaptation inputs."""
    specs = opening_specs(package, video.path, video.design)
    spec = specs[CHOSEN_TO_OPTION[package.thumbnail.chosen]]
    board = deepcopy(read(safe(folder, "storyboard.json")))
    opening = next((b for b in board.get("beats", []) if b.get("t") == 0 and b.get("layer", "main") == "main"), None)
    if opening is None:
        raise ValueError("La edición no tiene una apertura en t=0")
    opening.update(use=spec["component"], params=spec["params"])
    config = deepcopy(read(safe(folder, "config.json")))
    cfg = config["configs"][0] if "configs" in config else config
    identity = read(safe(folder, "edition.json"))
    cfg["storyboardUrl"] = f"languages/{identity['locale']}/revisions/{identity['revision']}/storyboard.publication.json"
    cfg["title"] = package.titles.youtube_chosen.text
    write(safe(folder, "storyboard.publication.json"), board)
    write(safe(folder, "config.publication.json"), config)
    write(safe(folder, "publication.json"), package.model_dump())


def approval_token(folder):
    """Bind human approval to the exact frozen revision and approved audio."""
    paths = [safe(folder, name) for name in ("edition.json", "script.json", "song-with-outro.mp3", "publish.json",
                                           "config.json", "storyboard.json", "lyrics.json")]
    package = safe(folder, "publication.json")
    stamp = (str(package), package.stat().st_mtime_ns, package.stat().st_size) if package.is_file() else None
    return _approval_token(tuple((str(p), p.stat().st_mtime_ns, p.stat().st_size) for p in paths), stamp)


@lru_cache(maxsize=32)
def _approval_token(files, package_stamp):
    from pathlib import Path
    digest = hashlib.sha256()
    for name, _, _ in files:
        with Path(name).open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
    if package_stamp:
        import json
        publication = read(Path(package_stamp[0]))
        # All three variants are reviewed together; selecting one does not change their content.
        publication.get("thumbnail", {}).pop("chosen", None)
        publication.get("titles", {}).pop("chosen", None)
        digest.update(json.dumps(publication, sort_keys=True, ensure_ascii=False).encode())
    # Older approvals did not cover the derived description. Bind the additional
    # public text when attribution changes the original description, invalidating
    # only approvals whose effective public metadata actually changed.
    if package_stamp:
        from .attribution import youtube_description
        folder = Path(package_stamp[0]).parent
        package = load_native(folder)
        publish = read(folder / "publish.json")
        original = publish.get("youtube", {}).get("description", "")
        locale = read(folder / "edition.json").get("locale", "")
        effective = youtube_description(original, package, locale)
        if effective != original.strip():
            digest.update(b"native-attribution-v1:")
            digest.update(effective.encode("utf-8"))
    return digest.hexdigest()


def approved(folder):
    path = safe(folder, "approval.json")
    if not path.is_file():
        return False
    value = read(path)
    return value.get("status") == "approved" and value.get("artifact_sha256") == approval_token(folder)


def approve(folder, *, note):
    write(safe(folder, "approval.json"), {"status": "approved", "artifact_sha256": approval_token(folder), "note": note})


def resolve_video(video, locale=None, revision=None, *, require_current=True):
    locale = normalize_locale(locale or "es-419")
    if locale == "es-419":
        if revision:
            raise ValueError("ES no usa revisiones nativas")
        return video
    from .io import profile_for
    profile_for(video.path)
    folder = active_revision(video.path, locale)
    if folder is None or (revision and folder.name != revision):
        raise ValueError("La revisión seleccionada ya no es la activa; actualiza la vista")
    if revision is not None and not re.fullmatch(r"rev-\d{3,}", revision):
        raise ValueError("Revisión inválida")
    identity = read(safe(folder, "edition.json"))
    if (identity.get("locale") != locale or identity.get("revision") != folder.name
            or identity.get("production_id") != video.video_id):
        raise ValueError("La identidad de la edición no coincide con la producción seleccionada")
    stale = identity.get("source_revision") != _source_revision(video.path)
    if require_current and stale:
        raise ValueError("El original cambió; revisa la edición antes de grabar")
    publish = read(safe(folder, "publish.json"))
    package = load_native(folder)
    from .attribution import publication_view
    publish = publication_view(publish, package, locale)
    fields = {f"{platform}_{key}": publish.get(platform, {}).get(key, [] if key in ("tags", "hashtags") else "")
              for platform, keys in {"youtube": ("title", "description", "tags"), "instagram": ("title", "description"),
                                     "facebook": ("title", "description"), "tiktok": ("caption", "hashtags")}.items() for key in keys}
    if package:
        fields["youtube_title"] = package.titles.youtube_chosen.text
    return replace(video, **fields, title=fields["youtube_title"], locale=locale, revision=folder.name, edition_path=folder,
                   pinned_comment=publish.get("youtube", {}).get("pinned", ""), status="listo",
                   script_review_required=False, rendered=[], demo=False,
                   duration_seconds=read(safe(folder, "lyrics.json")).get("metadata", {}).get("duration"))


def package_response(video):
    package = load_native(video.edition_path)
    if package is None:
        return None
    from .studio import review_issues
    def image_url(image):
        return "/api/v1/explainer/files/" + content_key(video.path / "assets/media" / image) if image else None
    return {"package": package.model_dump(), "issues": review_issues(video.path, video.edition_path),
            "title_max_chars": read(video.edition_path / "edition.json").get("resolved_strategies", {}).get("title", {}).get("effective", {}).get("max_chars", 100),
            "thumbnail_image_url": image_url(package.thumbnail.with_image.image),
            "thumbnail_tabloid_image_url": image_url(package.thumbnail.tabloid.image) if package.thumbnail.tabloid else None,
            "hook_strategy_names": {}}
