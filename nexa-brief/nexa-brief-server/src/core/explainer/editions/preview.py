"""Resolve an active revision using the already-authorized original config path."""
from src.core.markets import normalize_locale
from .io import active_revision, profile_for, safe
import re


def public_edition_file(parts):
    if len(parts) != 8:
        return False
    try:
        locale = normalize_locale(parts[4])
    except ValueError:
        return False
    return (parts[3] == "languages" and locale == parts[4] and locale != "es-419"
            and parts[5] == "revisions" and bool(re.fullmatch(r"rev-\d{3,}", parts[6]))
            and (parts[7] in {"config.json", "config.publication.json", "lyrics.json", "storyboard.json", "storyboard.publication.json", "song.mp3", "song-with-outro.mp3", "publish.json"}
                 or bool(re.fullmatch(r"thumbnail-[ABC](?:-9x16)?\.(?:jpg|webp)", parts[7]))))


def edition_config(original, locale, requested_revision=None):
    locale = normalize_locale(locale)
    if locale == "es-419":
        return original
    if original.name != "config.json" or original.parent.name != "assets":
        raise ValueError("La edición solo selecciona el config de una producción")
    production = original.parent.parent
    profile_for(production)
    revision = active_revision(production, locale)
    if revision is None:
        raise ValueError("El idioma todavía no tiene una revisión activa")
    if requested_revision and requested_revision != revision.name:
        raise ValueError("La revisión seleccionada ya no es la activa")
    publication = safe(revision, "config.publication.json")
    return publication if publication.is_file() else safe(revision, "config.json")
