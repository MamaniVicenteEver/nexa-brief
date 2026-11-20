"""Materialize audited visible defaults in a copy before localization.

The player resolves absent parameters using its component registry.  A source
storyboard alone therefore does not always contain every visible source string.
The manifest is audited against those registrations in test_editions_base.py.
"""
from copy import deepcopy
import json
import hashlib
from pathlib import Path

_DEFINITIONS = Path(__file__).resolve().parents[3] / "templates/_tools/design-definitions"


def materialize(storyboard: dict, spec, *, manifest_path: Path | None = None, production: Path | None = None):
    if manifest_path is None:
        manifest_path = _DEFINITIONS / spec.design_id / "localizable-defaults.json"
    if not manifest_path.is_file():
        raise ValueError(f"Falta auditar los textos predeterminados del diseño {spec.design_id}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema") != "nexa.localizable-defaults/1" or manifest.get("design_id") != spec.design_id:
        raise ValueError("Manifiesto de textos predeterminados inválido")
    result = deepcopy(storyboard)
    added = set()
    checked = set()
    for index, beat in enumerate(result.get("beats", [])):
        name = beat.get("use", "")
        params = beat.get("params") or {}
        if production is not None and name not in checked and name in spec.components:
            source = spec.components[name].source
            if source.startswith("component-library/sources/"):
                kit = _DEFINITIONS.parent / "explainer-kit"
                expected = (kit / source).resolve()
                actual = (Path(production) / "assets/components" / expected.name).resolve()
                if (not expected.is_relative_to(kit.resolve()) or
                    not actual.is_relative_to((Path(production) / "assets/components").resolve()) or
                    not expected.is_file() or not actual.is_file() or
                    hashlib.sha256(actual.read_bytes()).digest() != hashlib.sha256(expected.read_bytes()).digest()):
                    raise ValueError(f"El componente {name} difiere de su contrato auditado; revisa sus valores predeterminados")
            checked.add(name)
        for key, value in manifest.get("components", {}).get(name, {}).items():
            if name not in spec.components or not any(
                rule.translate and (pattern == key or pattern.startswith(key + "."))
                for pattern, rule in spec.components[name].fields.items()
            ):
                raise ValueError(f"Predeterminado sin contrato localizable: {name}.{key}")
            if key not in params:
                params[key] = deepcopy(value)
                added.add((index, key))
        # This component implements its own fallback for an empty or non-array
        # rungs value after the generic registry defaults have been resolved.
        if name == "rough.careerLadder" and (not isinstance(params.get("rungs"), list) or not params["rungs"]):
            params["rungs"] = ["PRIMER EMPLEO", "SENIOR"]
            added.add((index, "rungs"))
        beat["params"] = params
    return result, added
