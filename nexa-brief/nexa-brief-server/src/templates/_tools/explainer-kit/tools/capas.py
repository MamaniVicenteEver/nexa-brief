#!/usr/bin/env python3
"""Biblioteca compartida de capas: validación, búsqueda, revisión y exportación.

La escena solo admite IDs del catálogo; nunca rutas, código o URLs. Las mismas
reglas estructurales JSON Schema se ejecutan en el runtime del navegador.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from jsonschema import Draft202012Validator
from PIL import Image, ImageChops, ImageDraw, ImageFont

KIT = Path(__file__).resolve().parents[1]
CAPAS = KIT / "capas"
SCHEMA_DIR = CAPAS / "schema"
ANIMATIONS = ["entrar-sube", "entrar-cae", "entrar-desliza", "salir-cae", "salir-funde",
              "respirar", "flotar", "temblar", "girar", "caer", "latir"]


def load_catalog(path=None):
    return json.loads(Path(path or CAPAS / "catalog.json").read_text(encoding="utf-8"))


def _schema_errors(value, filename):
    # JSON estricto no admite NaN/Infinity; json.loads de Python sí los admite
    # por defecto. Rechazarlos también en llamadas nativas conserva la paridad JS.
    def nonfinite(item, path="$"):
        if isinstance(item, float) and not math.isfinite(item):
            return [f"{path}: número no finito"]
        if isinstance(item, dict):
            return [error for key, child in item.items() for error in nonfinite(child, f"{path}.{key}")]
        if isinstance(item, list):
            return [error for index, child in enumerate(item) for error in nonfinite(child, f"{path}[{index}]")]
        return []

    invalid = nonfinite(value)
    if invalid:
        return invalid
    schema = json.loads((SCHEMA_DIR / filename).read_text(encoding="utf-8"))
    errors = Draft202012Validator(schema).iter_errors(value)
    return [f"{'.'.join(map(str, error.absolute_path)) or '$'}: {error.message}"
            for error in sorted(errors, key=lambda e: str(list(e.absolute_path)))]


def _safe_file(root, relative):
    """Incluye symlinks: una exportación no puede escapar de su biblioteca."""
    base = Path(root).resolve()
    path = (base / relative).resolve()
    if not path.is_relative_to(base):
        raise ValueError(f"ruta fuera de capas: {relative}")
    return path


def _opaque_near(alpha, x, y, tolerance=6):
    px, py = round(x), round(y)
    for dy in range(-tolerance, tolerance + 1):
        for dx in range(-tolerance, tolerance + 1):
            if dx * dx + dy * dy > tolerance * tolerance:
                continue
            xx, yy = px + dx, py + dy
            if 0 <= xx < alpha.width and 0 <= yy < alpha.height and alpha.getpixel((xx, yy)) >= 128:
                return True
    return False


def validate_catalog(catalog, root=None, check_files=True):
    """Errores de esquema, relaciones y, por defecto, imágenes/hashes reales."""
    errors = _schema_errors(catalog, "catalog.schema.json")
    if errors:
        return errors
    root = Path(root or CAPAS)
    seen = set()
    for asset in catalog["assets"]:
        aid = asset["id"]
        if aid in seen:
            errors.append(f"asset {aid}: id duplicado")
        seen.add(aid)
        w, h = asset["canvas"]["w"], asset["canvas"]["h"]
        x, y = asset["pivot"]
        if not (0 <= x < w and 0 <= y < h):
            errors.append(f"asset {aid}: pivot fuera del lienzo")
        if asset["height_ref"] > h:
            errors.append(f"asset {aid}: height_ref supera el lienzo")
        lo, hi = asset["limits"]["scale"]
        if lo > hi or not lo <= asset["defaults"]["scale"] <= hi:
            errors.append(f"asset {aid}: limits.scale o defaults.scale inválidos")
        if asset["default_pose"] not in asset["poses"]:
            errors.append(f"asset {aid}: default_pose inexistente")
        for anim in asset["animations"]:
            if anim not in catalog["animations"]:
                errors.append(f"asset {aid}: animación {anim} no declarada en catálogo")
        for pid, pose in asset["poses"].items():
            prefix = f"asset {aid}, pose {pid}"
            missing = set(asset["anchors"]) - pose["anchors"].keys()
            if missing:
                errors.append(f"{prefix}: anclas garantizadas ausentes: {', '.join(sorted(missing))}")
            if set(pose["masks"]) != set(asset["color_zones"]):
                errors.append(f"{prefix}: máscaras no coinciden con color_zones")
            for name, (ax, ay) in pose["anchors"].items():
                if not (0 <= ax < w and 0 <= ay < h):
                    errors.append(f"{prefix}: ancla {name} fuera del lienzo")
            if not check_files:
                continue
            try:
                image_path = _safe_file(root, pose["file"])
                digest = hashlib.sha256(image_path.read_bytes()).hexdigest()
                if digest != pose["sha256"]:
                    errors.append(f"{prefix}: sha256 no coincide: {pose['file']}")
                with Image.open(image_path) as image:
                    if image.size != (w, h):
                        errors.append(f"{prefix}: tamaño {image.size}, esperado {(w, h)}")
                    if image.mode != "RGBA":
                        errors.append(f"{prefix}: la pose debe ser RGBA")
                    else:
                        alpha = image.getchannel("A")
                        amin, amax = alpha.getextrema()
                        if amin == 255 or amax == 0:
                            errors.append(f"{prefix}: falta alfa real (transparencia y figura visible)")
                        for name, (ax, ay) in pose["anchors"].items():
                            if not _opaque_near(alpha, ax, ay):
                                errors.append(f"{prefix}: ancla {name} no está sobre píxel opaco (tolerancia 6 px)")
            except (OSError, ValueError) as exc:
                errors.append(f"{prefix}: archivo no disponible: {exc}")
            for zone, relative in pose["masks"].items():
                try:
                    with Image.open(_safe_file(root, relative)) as mask:
                        if mask.size != (w, h):
                            errors.append(f"{prefix}, zona {zone}: tamaño de máscara incorrecto")
                        if mask.mode not in ("L", "1"):
                            errors.append(f"{prefix}, zona {zone}: máscara debe estar en escala de grises (L o 1)")
                        elif mask.getextrema()[1] == 0:
                            errors.append(f"{prefix}, zona {zone}: máscara vacía")
                except (OSError, ValueError) as exc:
                    errors.append(f"{prefix}, zona {zone}: máscara no disponible: {exc}")
    return errors


def validate_scene(params, catalog, duration):
    """Veredicto atómico; la duración es la efectiva del beat, en segundos."""
    errors = _schema_errors(params, "escena.schema.json")
    if errors:
        return errors
    if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration <= 0:
        return ["duración del beat debe ser un número finito mayor que cero"]
    catalog_errors = validate_catalog(catalog, check_files=False)
    if catalog_errors:
        return [f"catálogo: {error}" for error in catalog_errors]
    assets = {asset["id"]: asset for asset in catalog["assets"]}
    actors = {}
    active_poses = {}
    for actor in params["elenco"]:
        aid = actor["id"]
        if aid in actors:
            errors.append(f"elenco {aid}: id duplicado")
        actors[aid] = actor
        asset = assets.get(actor["asset"])
        if asset is None:
            errors.append(f"elenco {aid}: asset inexistente {actor['asset']}")
            continue
        if asset["status"] != "aprobado":
            errors.append(f"elenco {aid}: asset {asset['id']} no aprobado")
        pose = actor.get("pose", asset["default_pose"])
        if pose not in asset["poses"]:
            errors.append(f"elenco {aid}: pose inexistente {pose}")
        active_poses[aid] = {pose}
        lo, hi = asset["limits"]["scale"]
        scale = actor.get("escala", asset["defaults"]["scale"])
        if not lo <= scale <= hi:
            errors.append(f"elenco {aid}: escala fuera de limits.scale [{lo}, {hi}]")
        for zone in actor.get("estilo", {}).get("zonas", {}):
            if zone not in asset["color_zones"]:
                errors.append(f"elenco {aid}: zona no declarada {zone}")
        for anim in [actor.get("anim"), actor.get("entrada", {}).get("anim")]:
            if anim is not None and anim not in asset["animations"]:
                errors.append(f"elenco {aid}: animación incompatible {anim}")
        if actor.get("entrada", {}).get("dur", 0) > duration:
            errors.append(f"elenco {aid}: entrada fuera del beat")
    for event in params.get("eventos", []):
        aid, action, value, at = event["id"], event["accion"], event["valor"], event["en"]
        if at > duration:
            errors.append(f"evento {aid}: en fuera del beat")
        if isinstance(value, dict) and at + value.get("dur", 0) > duration + 1e-9:
            errors.append(f"evento {aid}: transición fuera del beat")
        actor = actors.get(aid)
        if actor is None:
            errors.append(f"evento: id inexistente {aid}")
            continue
        asset = assets.get(actor["asset"])
        if asset is None:
            continue
        if action == "pose":
            if value not in asset["poses"]:
                errors.append(f"evento {aid}: pose inexistente {value}")
            active_poses.setdefault(aid, set()).add(value)
        elif action == "color" and value["zona"] not in asset["color_zones"]:
            errors.append(f"evento {aid}: zona no declarada {value['zona']}")
        elif action in ("anim", "salir") and value not in asset["animations"]:
            errors.append(f"evento {aid}: animación incompatible {value}")
        elif action == "escala":
            lo, hi = asset["limits"]["scale"]
            if not lo <= value["valor"] <= hi:
                errors.append(f"evento {aid}: escala fuera de limits.scale [{lo}, {hi}]")
    for key, override in params.get("formato", {}).items():
        for aid, values in override["elenco"].items():
            if aid not in actors:
                errors.append(f"formato {key}: id inexistente {aid}")
                continue
            asset = assets.get(actors[aid]["asset"])
            if asset and "escala" in values:
                lo, hi = asset["limits"]["scale"]
                if not lo <= values["escala"] <= hi:
                    errors.append(f"formato {key}, {aid}: escala fuera de limits.scale [{lo}, {hi}]")
    for connection in params.get("conexiones", []):
        for end in ("de", "a"):
            aid, anchor = connection[end].split(":")
            actor = actors.get(aid)
            if actor is None:
                errors.append(f"conexión {end}: id inexistente {aid}")
                continue
            asset = assets.get(actor["asset"])
            if asset is None:
                continue
            for pose_id in sorted(active_poses.get(aid, [])):
                pose = asset["poses"].get(pose_id)
                if pose is not None and anchor not in pose["anchors"]:
                    errors.append(f"conexión {end}: ancla {anchor} inexistente en {aid}, pose activa {pose_id}")
    return errors


def scene_check(document, catalog=None, duration=None):
    """Valida un storyboard o beat; tiempos absolutos no cambian eventos locales.

    Para storyboards aún sin resolver, cada beat de capas debe traer dur numérico.
    El check general llama validate_scene con la duración ya resuelta por el kit.
    """
    catalog = load_catalog() if catalog is None else catalog
    beats = document.get("beats") if isinstance(document, dict) and "beats" in document else [document]
    if not isinstance(beats, list):
        return ["storyboard.beats debe ser una lista"]
    errors = []
    for index, beat in enumerate(beats):
        if not isinstance(beat, dict):
            errors.append(f"beat #{index}: debe ser objeto")
            continue
        if beat.get("use") != "common.capas":
            continue
        dur = duration if duration is not None else beat.get("dur")
        for error in validate_scene(beat.get("params", {}), catalog, dur):
            errors.append(f"beat #{index} common.capas: {error}")
    return errors


def compact_list(catalog, tags=None):
    tags = set(tags or [])
    return [{"id": asset["id"], "tipo": asset["type"], "poses": list(asset["poses"]),
             "anclas": asset["anchors"], "zonas": list(asset["color_zones"]),
             "animaciones": asset["animations"], "uso": asset["description"]}
            for asset in catalog["assets"]
            if asset["status"] == "aprobado" and (not tags or tags <= set(asset["tags"]))]


def _font(size):
    path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def sheet(asset, root=None, output=None):
    """Hoja por pose: claro/oscuro/damero y una columna teñida por zona."""
    root = Path(root or CAPAS)
    zones = list(asset["color_zones"])
    cell_w, cell_h, title_h = 300, 450, 62
    columns = 3 + len(zones)
    result = Image.new("RGB", (columns * cell_w, len(asset["poses"]) * (cell_h + title_h)), "#101722")
    draw = ImageDraw.Draw(result)
    font = _font(16)
    for row, (pid, pose) in enumerate(asset["poses"].items()):
        image = Image.open(_safe_file(root, pose["file"])).convert("RGBA")
        for col, label in enumerate(["Claro", "Oscuro", "Damero"] + zones):
            bg = Image.new("RGBA", image.size, "#F0F0EE" if col == 0 else "#101722")
            if col >= 2:
                checker = ImageDraw.Draw(bg)
                for yy in range(0, image.height, 64):
                    for xx in range(0, image.width, 64):
                        checker.rectangle((xx, yy, xx+63, yy+63), fill="#B8BEC5" if (xx//64+yy//64)%2 else "#E9EBEE")
            sprite = image.copy()
            if col >= 3:
                zone = zones[col - 3]
                mask = Image.open(_safe_file(root, pose["masks"][zone])).convert("L")
                colored = Image.new("RGBA", image.size, "#E3262F")
                colored.putalpha(ImageChops.multiply(mask, image.getchannel("A")))
                sprite = Image.alpha_composite(sprite, colored)
            bg = Image.alpha_composite(bg, sprite)
            marker = ImageDraw.Draw(bg)
            for index, (name, (x, y)) in enumerate(pose["anchors"].items(), 1):
                marker.ellipse((x-10,y-10,x+10,y+10), fill="#FFD839", outline="#000000", width=3)
                marker.text((x+14,y-15), name, fill="#F04433", font=_font(28), stroke_width=1, stroke_fill="#000000")
            scale = min((cell_w-16)/image.width, (cell_h-16)/image.height)
            thumb = bg.convert("RGB").resize((round(image.width*scale), round(image.height*scale)), Image.Resampling.LANCZOS)
            x0, y0 = col*cell_w, row*(cell_h+title_h)
            draw.text((x0+10,y0+8), f"{asset['id']} · {pid}", font=font, fill="white")
            draw.text((x0+10,y0+31), label + (" · rojo" if col>=3 else ""), font=font, fill="#B9D4FF")
            result.paste(thumb, (x0+(cell_w-thumb.width)//2,y0+title_h))
    target = Path(output or root / "review" / f"{asset['id']}.jpg")
    target.parent.mkdir(parents=True, exist_ok=True)
    result.save(target, quality=94)
    return target


def _scheme(value):
    return json.dumps(str(value), ensure_ascii=False)


def export_asset(asset, catalog, catalog_path, root=None):
    """Exporta capas XCF planas con nombres pose:<id> y mask:<pose>:<zona>.

    GIMP 2.10 usa Script-Fu; GIMP 3 usa su intérprete python-fu-eval. Pillow
    normaliza el lienzo RGBA, las máscaras L y el formato de destino declarado.
    """
    executable = next((found for name in ("gimp-console", "gimp-console-3.0", "gimp-console-2.10")
                       if (found := shutil.which(name))), None)
    if executable is None:
        raise RuntimeError("No se encontró gimp-console. Exportá el XCF en la máquina con GIMP según capas/README.md y ejecutá validate y sheet aquí.")
    profile_raw = os.environ.get("NEXA_PROFILE_DIR")
    if not profile_raw:
        raise RuntimeError("NEXA_PROFILE_DIR no está definido: ejecutá source scripts/profile-env.sh desde la raíz con bash.")
    profile = Path(profile_raw).resolve()
    profile_data = json.loads((profile / "profile.json").read_text(encoding="utf-8"))
    if profile_data.get("schema_version") not in (2, 3):
        raise RuntimeError("El exportador requiere un perfil de almacenamiento v2 o v3.")
    master = asset["master"]
    if not master:
        raise RuntimeError(f"asset {asset['id']}: no tiene master XCF declarado")
    resource_root = profile / "resources/images" / master["resource_id"]
    source = _safe_file(resource_root, master["file"])
    if source.suffix.lower() != ".xcf" or not source.is_file():
        raise RuntimeError(f"Master XCF ausente: {source}")
    root = Path(root or CAPAS)
    version = subprocess.run([executable, "--version"], capture_output=True, text=True, check=True).stdout
    with tempfile.TemporaryDirectory(prefix="nexa-capas-export-") as temp:
        requests = []
        for pid, pose in asset["poses"].items():
            requests.append((f"pose:{pid}", Path(temp) / f"{pid}.png", pose["file"], False))
            requests.extend((f"mask:{pid}:{zone}", Path(temp) / f"{pid}.{zone}.png", filename, True)
                            for zone, filename in pose["masks"].items())
        if "GIMP version 3" in version or "3." in version.split()[-1]:
            # Solo se exportan los drawables nombrados, nunca el compuesto completo.
            code = "from gi.repository import Gimp,Gio; image=Gimp.file_load(Gimp.RunMode.NONINTERACTIVE,Gio.File.new_for_path(" + repr(str(source)) + ")); "
            code += "layers={layer.get_name():layer for layer in image.get_layers()}; "
            for name, destination, _, _ in requests:
                code += (f"out=Gimp.Image.new({asset['canvas']['w']},{asset['canvas']['h']},Gimp.ImageBaseType.RGB); "
                         f"layer=Gimp.Layer.new_from_drawable(layers[{name!r}],out); out.insert_layer(layer,None,0); layer.set_visible(True); "
                         f"proc=Gimp.get_pdb().lookup_procedure('file-png-export'); cfg=proc.create_config(); "
                         f"cfg.set_property('run-mode',Gimp.RunMode.NONINTERACTIVE); cfg.set_property('image',out); cfg.set_property('file',Gio.File.new_for_path({str(destination)!r})); "
                         "res=proc.run(cfg); assert res.index(0)==Gimp.PDBStatusType.SUCCESS; out.delete(); ")
            code += "image.delete()"
            command = [executable, "--new-instance", "--no-interface", "--no-data", "--no-fonts", "--batch-interpreter=python-fu-eval", "-b", code, "--quit"]
        else:
            code = f"(let* ((im (car (gimp-file-load RUN-NONINTERACTIVE {_scheme(source)} {_scheme(source)}))) (ls (cadr (gimp-image-get-layers im)))) "
            for name, destination, _, _ in requests:
                code += f"(let* ((found -1)) (let loop ((i 0)) (if (< i (vector-length ls)) (begin (if (string=? (car (gimp-item-get-name (vector-ref ls i))) {_scheme(name)}) (set! found (vector-ref ls i))) (loop (+ i 1))))) "
                code += f"(if (= found -1) (error {_scheme('Falta capa ' + name)})) "
                code += f"(let* ((out (car (gimp-image-new {asset['canvas']['w']} {asset['canvas']['h']} RGB))) (layer (car (gimp-layer-new-from-drawable found out)))) (gimp-image-insert-layer out layer 0 0) (gimp-item-set-visible layer TRUE) "
                code += f"(file-png-save2 RUN-NONINTERACTIVE out layer {_scheme(destination)} {_scheme(destination)} 0 9 0 0 0 0 0 0 0) (gimp-image-delete out))) "
            code += "(gimp-image-delete im))"
            command = [executable, "--new-instance", "--no-interface", "--no-data", "--no-fonts", "-b", code, "-b", "(gimp-quit 0)"]
        result = subprocess.run(command, capture_output=True, text=True, timeout=180)
        if result.returncode or any(not req[1].is_file() for req in requests):
            raise RuntimeError(f"GIMP no exportó todas las capas (exit {result.returncode}): {(result.stderr or result.stdout)[-2000:]}")
        for _, intermediate, relative, is_mask in requests:
            target = _safe_file(root, relative)
            target.parent.mkdir(parents=True, exist_ok=True)
            with Image.open(intermediate) as image:
                if image.size != (asset["canvas"]["w"], asset["canvas"]["h"]):
                    raise RuntimeError(f"Exportación con lienzo incorrecto: {relative}")
                if is_mask:
                    image.convert("L").save(target)
                else:
                    image.convert("RGBA").save(target, lossless=True)
        for pose in asset["poses"].values():
            pose["sha256"] = hashlib.sha256(_safe_file(root, pose["file"]).read_bytes()).hexdigest()
    Path(catalog_path).write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=CAPAS / "catalog.json", help="Catálogo; las rutas de medios se resuelven desde su carpeta")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("validate", help="Valida esquema, referencias y medios")
    check = commands.add_parser("scene-check", help="Valida todos los beats common.capas")
    check.add_argument("file", type=Path)
    check.add_argument("--duration", type=float, help="Duración efectiva si el beat aún no tiene dur")
    listing = commands.add_parser("list", help="Assets aprobados para elegir sin inventar IDs")
    listing.add_argument("--tags", default="")
    listing.add_argument("--json", action="store_true")
    review = commands.add_parser("sheet", help="Hoja de revisión de todas las poses")
    review.add_argument("asset_id")
    review.add_argument("--output", type=Path)
    export = commands.add_parser("export", help="Exporta desde el XCF maestro del perfil activo")
    export.add_argument("asset_id")
    args = parser.parse_args(argv)
    try:
        catalog = load_catalog(args.catalog)
        root = args.catalog.resolve().parent
        if args.command == "validate":
            errors = validate_catalog(catalog, root)
        elif args.command == "scene-check":
            errors = scene_check(json.loads(args.file.read_text(encoding="utf-8")), catalog, args.duration)
        elif args.command == "list":
            errors = validate_catalog(catalog, root, check_files=False)
            if not errors:
                rows = compact_list(catalog, [tag.strip() for tag in args.tags.split(",") if tag.strip()])
                if args.json:
                    print(json.dumps(rows, ensure_ascii=False))
                else:
                    for row in rows:
                        print(f"{row['id']} ({row['tipo']}) | poses: {','.join(row['poses'])} | anclas: {','.join(row['anclas'])} | zonas: {','.join(row['zonas'])} | anim: {','.join(row['animaciones'])} | {row['uso']}")
        else:
            errors = validate_catalog(catalog, root, check_files=args.command == "sheet")
            if not errors:
                asset = next((row for row in catalog["assets"] if row["id"] == args.asset_id), None)
                if asset is None:
                    errors = [f"asset inexistente: {args.asset_id}"]
                elif args.command == "sheet":
                    print(sheet(asset, root, args.output))
                else:
                    export_asset(asset, catalog, args.catalog, root)
                    errors = validate_catalog(catalog, root)
        if errors:
            for error in errors:
                print("ERROR: " + error, file=sys.stderr)
            return 1
        if args.command in ("validate", "scene-check", "export"):
            print(f"OK: {args.command}")
        return 0
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.SubprocessError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
