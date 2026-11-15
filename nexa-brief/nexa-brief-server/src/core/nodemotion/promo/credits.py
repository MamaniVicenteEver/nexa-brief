"""Créditos deterministas de recursos para las descripciones de promos."""

from __future__ import annotations
import copy
import re

# Límites de descripción de las estrategias comerciales activas y PlatformDetails.
DEFAULT_LIMITS = {"youtube": 5000, "facebook": 2000, "instagram": 2000, "tiktok": 2000}
BEGIN = "Créditos de medios:"
END = "Fin de créditos de medios."


def _clean(value):
    return " ".join(value.split()) if isinstance(value, str) else ""


def _line(resource, music_edited):
    if not isinstance(resource, dict):
        raise ValueError("Ficha de recurso inválida")
    values = {
        name: _clean(resource.get(name)) for name in ("author", "license", "source_url", "license_url", "attribution")
    }
    if not all(values.values()):
        raise ValueError("Faltan autor, licencia, URLs o atribución de un recurso")
    # El campo attribution puede contener requisitos adicionales del autor.
    # Una URL de licencia común se imprime una sola vez al pie del bloque.
    line = values["attribution"].replace(values["license_url"], "").strip(" ·")
    line = re.sub(r"\s*·\s*·\s*", " · ", line)
    for name in ("author", "license", "source_url"):
        if values[name].casefold() not in line.casefold():
            line += " · " + values[name]
    modifications = []
    if resource.get("type") == "video" and resource.get("derived_from") and resource.get("focus") is not None:
        modifications.append("imagen animada y recortada")
    if resource.get("type") == "music" and music_edited:
        modifications.append("música recortada con fundido final")
    for item in modifications:
        if item.casefold() not in line.casefold():
            line += " · " + item
    return line, values, modifications


def _remove_own_block(description):
    pattern = re.compile(r"(?m)^" + re.escape(BEGIN) + r"\n.*?\n" + re.escape(END) + r"(?=\n|$)", re.DOTALL)
    if description.count(BEGIN) != description.count(END) or description.count(BEGIN) > 1:
        raise ValueError("Bloque de créditos incompleto o duplicado; requiere revisión")
    match = pattern.search(description)
    if not match:
        if BEGIN in description or END in description:
            raise ValueError("Bloque de créditos incompatible; requiere revisión")
        return description
    start = match.start()
    if start >= 2 and description[start - 2 : start] == "\n\n":
        start -= 2
    return description[:start] + description[match.end() :]


def apply_credits(
    details: dict, resources: list[dict], *, music_edited: bool = False, limits: dict | None = None
) -> dict:
    """Devuelve copia completa; nunca trunca ni altera texto ajeno al bloque propio.

    ``music_edited`` solo se activa si el host sabe que utilizó el recorte con
    fundido. Recursos derivados de fotos llevan ``derived_from`` y ``focus``.
    Si un campo o todo el contenido no cabe, falla antes de cambiar ningún dato.
    """
    if not isinstance(details, dict) or not isinstance(resources, list) or not resources:
        raise ValueError("Faltan detalles o fichas de recursos")
    entries = []
    for resource in resources:
        item = _line(resource, music_edited)
        if item[0] not in [entry[0] for entry in entries]:
            entries.append(item)
    result = copy.deepcopy(details)
    copies = result.get("copies")
    if not isinstance(copies, dict):
        raise ValueError("Faltan copias de publicación")
    limits = {**DEFAULT_LIMITS, **(limits or {})}
    for platform in DEFAULT_LIMITS:
        copy_item = copies.get(platform)
        if not isinstance(copy_item, dict) or not isinstance(copy_item.get("description"), str):
            raise ValueError(f"Falta la descripción de {platform}")
        base = _remove_own_block(copy_item["description"])
        folded = base.casefold()
        missing = []
        license_urls = []
        for line, values, modifications in entries:
            # Reconocer un crédito completo previo sin borrar textos editoriales.
            required = [values[k].casefold() for k in ("author", "license", "source_url", "license_url")] + [
                v.casefold() for v in modifications
            ]
            if not all(part in folded for part in required):
                missing.append(line)
                if values["license_url"] not in license_urls:
                    license_urls.append(values["license_url"])
        block = (
            (
                BEGIN
                + "\n"
                + "\n".join("- " + line for line in missing)
                + "\nLicencias: "
                + " · ".join(license_urls)
                + "\n"
                + END
            )
            if missing
            else ""
        )
        description = "\n\n".join(part for part in (base, block) if part)
        limit = limits.get(platform)
        if type(limit) is not int or limit <= 0 or limit > 5000:
            raise ValueError(f"Límite de {platform} inválido")
        if len(description) > limit:
            raise ValueError(
                f"Los créditos completos exceden el límite de {platform} ({len(description)}/{limit}); edita la descripción o reduce recursos"
            )
        copy_item["description"] = description
    return result
