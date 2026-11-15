"""Prompts compartidos y versionados para las promos NodeMotion."""

from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from pathlib import Path

SKILL = Path(__file__).resolve().parents[4] / "src/templates/_tools/nodemotion/promo/production"
PROMPTS = SKILL / "prompts"
STAGES = ("base", "investigar", "escribir", "revisar", "medios", "ritmo", "contexto", "publicar", "miniaturas")
STAGE_FILES = {'investigar.md': 'research.md', 'escribir.md': 'write.md', 'revisar.md': 'review.md', 'medios.md': 'media.md', 'ritmo.md': 'timing.md', 'contexto.md': 'context.md', 'publicar.md': 'publish.md', 'miniaturas.md': 'thumbnails.md'}


def prompt_filename(name: str) -> str:
    """Historical hash keys remain transport IDs; physical filenames are English."""
    return STAGE_FILES.get(name, name)


TEMPLATES = frozenset(f"promo-{name}" for name in ("editorial", "dynamic", "kinetic", "sports", "trendy", "urban", "breaking", "pulse"))


def reference(version: str | None = None) -> dict:
    """Valida todos los archivos de la versión y devuelve una referencia portable."""
    manifest = json.loads((PROMPTS / "active.json").read_text(encoding="utf-8"))
    version = version or manifest["active"]
    if not isinstance(version, str) or not re.fullmatch(r"(?:historical-)?v[1-9][0-9]*", version):
        raise ValueError("versión de prompts inválida")
    hashes = manifest.get("versions", {}).get(version)
    allowed = {f"{stage}.md" for stage in STAGES}
    if not isinstance(hashes, dict) or "base.md" not in hashes or not set(hashes).issubset(allowed):
        raise ValueError("versión de prompts desconocida o manifiesto incompleto")
    for name in sorted(hashes):
        digest = hashlib.sha256((PROMPTS / "versions" / version / prompt_filename(name)).read_bytes()).hexdigest()
        if digest != hashes[name]:
            raise ValueError(f"hash de prompt no coincide: {version}/{name}")
    return {"version": version, "hashes": dict(hashes)}


def compose(
    stage: str, template_id: str | None = None, version: str | None = None, *, include_base: bool = True
) -> str:
    """Construye el prompt compartido y, si se solicita, el contrato del diseño."""
    if stage not in STAGES:
        raise ValueError("etapa de prompt desconocida")
    ref = reference(version)
    if f"{stage}.md" not in ref["hashes"]:
        raise ValueError("etapa no disponible en esta versión de prompts")
    folder = PROMPTS / "versions" / ref["version"]
    base = (folder / "base.md").read_text(encoding="utf-8").strip()
    fragment = (folder / prompt_filename(f"{stage}.md")).read_text(encoding="utf-8").strip()
    result = base if stage == "base" else (base + "\n\n" + fragment if include_base else fragment)
    if template_id is not None:
        if template_id not in TEMPLATES:
            raise ValueError("plantilla de promo desconocida")
        contract = json.loads((SKILL / "templates" / f"{template_id}.json").read_text(encoding="utf-8"))
        if contract.get("template_id") != template_id:
            raise ValueError("contrato de plantilla inválido")
        fields = ("template_id", "inputs", "media_slot_order", "scene_cycle", "rhythm", "script", "thumbnail")
        selected = {key: contract[key] for key in fields if key in contract}
        result += "\n\nCONTRATO DEL DISEÑO (datos estructurados):\n" + json.dumps(
            selected, ensure_ascii=False, indent=2
        )
    return result + "\n"


def project_reference_path(target: Path) -> Path:
    """Prefer the canonical English path, preserving existing project references."""
    current = Path(target) / "work/instructions/prompts-version.json"
    legacy = Path(target) / "work/instrucciones/prompts-version.json"
    return legacy if not current.exists() and legacy.is_file() else current


def pin_project(target: Path, adopt: bool = False) -> dict:
    """Fija la versión activa; proyectos existentes requieren adopción explícita."""
    target = Path(target)
    if not (target / "brief.json").is_file():
        raise ValueError("falta brief.json del proyecto")
    path = project_reference_path(target)
    if path.exists():
        return reference_file(path)
    if not adopt and (target / "work").exists():
        raise ValueError("proyecto existente sin referencia; requiere adopción explícita")
    return bind_reference(path, reference())


def resolve_project(target: Path, stage: str) -> str:
    target = Path(target)
    path = project_reference_path(target)
    saved = reference_file(path)
    brief = json.loads((target / "brief.json").read_text(encoding="utf-8"))
    return compose(stage, brief["template"], saved["version"])


def validate_reference(value: dict) -> dict:
    """Acepta solo una referencia completa cuyo contenido central siga intacto."""
    if not isinstance(value, dict) or value != reference(value.get("version")):
        raise ValueError("referencia de prompts incompatible o alterada")
    return value


def reference_file(path: Path) -> dict:
    return validate_reference(json.loads(Path(path).read_text(encoding="utf-8")))


def bind_reference(path: Path, value: dict) -> dict:
    """Fija una referencia de transporte sin sobrescribir otra versión."""
    value = validate_reference(value)
    path = Path(path)
    if path.exists():
        if reference_file(path) != value:
            raise ValueError("el draft ya tiene otra versión de prompts")
        return value
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".prompts-reference-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        try:
            os.link(temporary, path)
        except FileExistsError:
            if reference_file(path) != value:
                raise ValueError("otra ejecución fijó otra versión de prompts")
    finally:
        os.unlink(temporary)
    return value
