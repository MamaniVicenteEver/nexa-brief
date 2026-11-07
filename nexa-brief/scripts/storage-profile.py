#!/usr/bin/env python3
"""Create an empty profile or select one; never import another profile's data."""
import argparse
import ctypes
import errno
import json
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
SERVER = PROJECT / "nexa-brief-server"
sys.path.insert(0, str(SERVER))
from src.config.profile_layout import resolve_profile_layout
from src.config.storage_profile import DEFAULT_PROVIDERS, load_profile
from src.config.design_guides import DESIGN_GUIDE

CATEGORIES = ("nodetech", "nodehistory", "nodepolitics", "nodeeconomy", "nodeaction", "nodemotion", "otros")
GUIDE = """# Perfil de almacenamiento

Este directorio pertenece exclusivamente a este perfil. Guarda datos y artefactos aquí;
no copies datos ni credenciales de otro perfil. `data/` es para datos JSON;
usa `productions/`, `renders/`, `resources/` y `sandbox/` para sus artefactos.
No abras `data/` ni `.system/`: contienen índices, sesiones y configuración privada.
Trabaja únicamente en la producción o prototipo asignado y en sus recursos autorizados.
Estas instrucciones orientan al agente; la protección efectiva requiere aislamiento del proceso.
Los motores y componentes compartidos viven en el repositorio, `src/templates/_tools/`.
Los diseños reutilizables del perfil viven en `sandbox/designs/` durante prueba
y en `designs/` al promoverlos; no son episodios ni se guardan en `productions/`.
Consulta el AGENTS.md de la carpeta asignada y el PLAN.md del video antes de trabajar.
"""
GUIDE_V3 = """# Perfil de almacenamiento v3

Este perfil es independiente. Consulta estas instrucciones y las de la carpeta
asignada; no recorras todo el proyecto ni otros perfiles para crear un contenido.
Los registros se consultan y modifican mediante los servicios CRUD del servidor;
`data/json/` contiene un JSON por sección. No lo edites desde una tarea creativa.
Trabaja en `productions/<categoría>/<contenido_id>/` o el sandbox asignado.
Los resultados finales van en `renders/videos/<categoría>/<video_id>/<render_id>/`
y `renders/images/<categoría>/<post_id>/<render_id>/`. Los recursos subidos
independientemente van en `resources/<tipo>/<asset_id>/` y se reutilizan por ID.
Los logs reales pertenecen a `logs/`; data mantiene sus referencias por ID.
Los contratos compartidos están en el repositorio, en
`src/templates/_tools/design-definitions/<design_id>/`. Los motores se referencian
desde esos contratos. El estado por perfil se cambia mediante el servicio de Showcase.
Guarda capturas, scripts y revisiones temporales juntos en `work/results/test/`.
No abras `.system/`, credenciales, sesiones, archivos .env ni datos de otros perfiles.
No publiques ni borres originales como parte de una revisión. Usa servicios para
registrar recursos y resultados; conserva IDs aunque cambie un título o categoría.
Estas guías no sustituyen permisos del sistema ni aislamiento del proceso.
"""
RENDER_GUIDE = """# Resultados finales

Las siguientes rutas son relativas a la raíz del perfil, también al leer esta guía
desde una categoría. Los videos terminados van en
`renders/videos/<categoría>/<video_id>/<render_id>-<formato>/video.mp4`.
Las imágenes finales van en `renders/images/<categoría>/<post_id>/<publication_id>/<asset_id>.jpg`.
Conserva versiones anteriores e IDs; registra resultados mediante los servicios.
No guardes originales, audio de entrada ni pruebas aquí: pertenecen a productions
y work/results/test. No modifiques ni borres un resultado aprobado sin autorización.
"""
RESOURCE_GUIDE = """# Recursos independientes

Usa `resources/<tipo>/<asset_id>/`, relativo a la raíz del perfil, para archivos
subidos sin producción asociada.
Consulta el registro de recursos mediante el servicio; conserva ID, procedencia,
licencia, hash y tipo. Reutiliza por referencia y no copies un recurso por cada video.
Antes de borrar, comprueba las referencias de contenidos y publicaciones.
"""
PRODUCTION_GUIDE = """# Producciones del perfil

Usa `<categoría>/<video_id>/` para cada producción. Conserva el ID estable aunque cambie el título.
En la raíz del video guarda PLAN.md, manifest.json, publish.json y la composición HTML.
Guarda imágenes, audio, clips, guion y storyboard en `assets/`. Las capturas, scripts y
reportes temporales de revisión van juntos en `work/results/test/`; no los disperses.
Los videos terminados pertenecen a `renders/<video_id>/<recording_id>/` del perfil.
Los logs reales pertenecen a `logs/`; el servidor mantiene los índices de `data/`.
No edites motores compartidos ni otras producciones como parte de una tarea de video.
Los recursos subidos sin video pertenecen a `resources/` y se referencian por su ID.
No copies sesiones, conexiones o datos de otro perfil. No publiques ni borres originales
como parte de una revisión visual. Usa los servicios del servidor para registrar resultados.
"""
SANDBOX_GUIDE = """# Sandbox del perfil

Esta carpeta contiene únicamente prototipos de este perfil. Usa la categoría correspondiente
para cada prototipo y consulta las instrucciones del proyecto antes de crear uno.
Guarda recursos propios en `assets/` y pruebas temporales en `work/results/test/`.
No modifiques los motores del repositorio ni copies datos de otro perfil.
Para promover una prueba a producción, usa el servicio de promoción; no dupliques el video.
"""


def production_categories() -> set[str]:
    """Initial production folders include all safe versioned catalog folders."""
    data = json.loads((SERVER / "niches.json").read_text(encoding="utf-8"))
    result = set(CATEGORIES)

    def visit(categories):
        if not isinstance(categories, dict):
            raise ValueError("Invalid product categories")
        for category in categories.values():
            if not isinstance(category, dict):
                raise ValueError("Invalid product category")
            folder = category.get("folder")
            if folder is not None:
                if not isinstance(folder, str) or not re.fullmatch(r"[a-z][a-z0-9_-]{0,47}", folder):
                    raise ValueError("Invalid product category folder")
                result.add(folder)
            visit(category.get("children") or {})

    visit(data.get("categories", {}))
    return result


def rename_noreplace(source: Path, target: Path) -> None:
    """Publish atomically without replacing a concurrently created profile (Linux)."""
    libc = ctypes.CDLL(None, use_errno=True)
    rename = getattr(libc, "renameat2", None)
    if rename is None:
        raise OSError("Atomic no-replace rename is unavailable")
    rename.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    rename.restype = ctypes.c_int
    if rename(-100, os.fsencode(source), -100, os.fsencode(target), 1) != 0:
        error = ctypes.get_errno()
        if error in (errno.EEXIST, errno.ENOTEMPTY):
            raise FileExistsError("Profile already exists; existing data was not changed")
        raise OSError(error, os.strerror(error))


def scaffold_v3(root: Path, *, replace_guides: bool = False) -> None:
    """Create the public shape and scoped instructions; never read private data."""
    layout = resolve_profile_layout(root, 3)
    categories = production_categories()
    guides = {root: GUIDE_V3, layout.productions_dir: PRODUCTION_GUIDE.replace(
        "renders/<video_id>/<recording_id>/", "renders/videos/<categoría>/<video_id>/<recording_id>/"
    ), layout.sandbox_dir: SANDBOX_GUIDE, layout.renders_dir: RENDER_GUIDE,
        layout.resources_dir: RESOURCE_GUIDE, layout.logs_dir:
        "# Registros de ejecución\n\nLogs y consumo por ID de ejecución. No incluir secretos ni sesiones.\n"}
    for category in categories:
        guides[layout.productions_dir / category] = guides[layout.productions_dir]
        guides[layout.sandbox_dir / category] = SANDBOX_GUIDE
        for kind in ("videos", "images"):
            guides[layout.renders_dir / kind / category] = RENDER_GUIDE
    for kind in ("images", "videos", "audio", "music", "sounds"):
        guides[layout.resources_dir / kind] = RESOURCE_GUIDE
    for directory, body in guides.items():
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        for name in ("AGENTS.md", "CLAUDE.md"):
            target = directory / name
            if not target.exists() or replace_guides:
                target.write_text(body, encoding="utf-8")
                target.chmod(0o600)
    for directory in (layout.system_dir, layout.runtime_dir, layout.cache_dir,
                      layout.connections_dir, layout.tiktok_dir, layout.web_data_dir, layout.config_dir):
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    for category in CATEGORIES:
        (layout.sandbox_dir / "referencias" / category).mkdir(parents=True, exist_ok=True, mode=0o700)
    records = layout.data_dir / "json"
    records.mkdir(parents=True, exist_ok=True, mode=0o700)
    for section in ("videos", "image-posts", "publicaciones", "resources", "designs", "jobs", "logs"):
        target = records / (section + ".json")
        if not target.exists():
            target.write_text(json.dumps({"schema_version": 1, "revision": 0,
                                         "collections": {}, "documents": {}}, indent=2) + "\n", encoding="utf-8")
            target.chmod(0o600)


def initialize(root: Path, args) -> None:
    root.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if root.exists() or root.is_symlink():
        raise FileExistsError("Profile already exists; existing data was not changed")
    staging = Path(tempfile.mkdtemp(prefix=".profile-init-", dir=root.parent))
    try:
        layout = resolve_profile_layout(staging, args.schema_version)
        if args.schema_version == 1:
            for directory in (layout.data_dir, layout.renders_dir, layout.connections_dir,
                              layout.web_data_dir, layout.tiktok_dir, layout.config_dir):
                directory.mkdir(mode=0o700)
        elif args.schema_version == 3:
            scaffold_v3(staging)
        else:
            for directory in (layout.data_dir, layout.logs_dir, layout.productions_dir, layout.renders_dir,
                              layout.resources_dir, layout.sandbox_dir, layout.designs_dir, layout.system_dir, layout.runtime_dir, layout.cache_dir,
                              layout.connections_dir, layout.tiktok_dir, layout.web_data_dir, layout.config_dir):
                directory.mkdir(parents=True, mode=0o700, exist_ok=True)
            (layout.sandbox_dir / "referencias").mkdir(mode=0o700)
            production_folders = production_categories()
            for category in CATEGORIES:
                (layout.sandbox_dir / category).mkdir(mode=0o700)
                (layout.sandbox_dir / "referencias" / category).mkdir(parents=True, mode=0o700)
            for category in production_folders:
                (layout.productions_dir / category).mkdir(mode=0o700)
            for name in ("AGENTS.md", "CLAUDE.md"):
                (staging / name).write_text(GUIDE, encoding="utf-8")
                (layout.sandbox_dir / name).write_text(SANDBOX_GUIDE, encoding="utf-8")
                (layout.productions_dir / name).write_text(PRODUCTION_GUIDE, encoding="utf-8")
                (layout.designs_dir / name).write_text(DESIGN_GUIDE, encoding="utf-8")
                test_designs = layout.sandbox_dir / "designs"
                test_designs.mkdir(mode=0o700, exist_ok=True)
                (test_designs / name).write_text(DESIGN_GUIDE, encoding="utf-8")
                for category in production_folders:
                    category_guide = f"# Categoría {category}\n\n" + PRODUCTION_GUIDE.split("\n", 1)[1]
                    (layout.productions_dir / category / name).write_text(category_guide, encoding="utf-8")
                for category in CATEGORIES:
                    (layout.sandbox_dir / category / name).write_text(SANDBOX_GUIDE, encoding="utf-8")
        # These are versioned product defaults, not content from another profile.
        shutil.copy2(SERVER / "niches.json", layout.config_dir / "niches.json")
        shutil.copytree(SERVER / "src/skills/image_posts/styles", layout.config_dir / "image-styles")
        layout.web_data_dir.chmod(0o2770)
        value = {"schema_version": args.schema_version, "id": args.profile,
                 "label": args.label or args.profile, "providers": DEFAULT_PROVIDERS,
                 "services": {"tiktok": {"port": args.tiktok_port}}}
        (staging / "profile.json").write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
        (staging / "profile.json").chmod(0o644)
        rename_noreplace(staging, root)
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["init", "show", "activate"])
    parser.add_argument("profile")
    parser.add_argument("--label")
    parser.add_argument("--home", type=Path, default=Path(os.environ.get("NEXA_DATA_HOME", str(Path.home() / ".local/share/nexa-brief"))))
    parser.add_argument("--tiktok-port", type=int, default=8100)
    parser.add_argument("--schema-version", type=int, choices=(1, 2, 3), default=3)
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z][a-z0-9_-]{0,47}", args.profile) or not 1024 <= args.tiktok_port <= 65535:
        raise SystemExit("Invalid profile or service port")
    root = args.home.expanduser().resolve() / "profiles" / args.profile
    if args.action == "init":
        try:
            initialize(root, args)
        except FileExistsError as exc:
            raise SystemExit(str(exc)) from exc
    if not (root / "profile.json").is_file():
        raise SystemExit("Profile does not exist; initialize it explicitly")
    load_profile(root)
    if args.action == "activate":
        selector = Path(os.environ.get("XDG_CONFIG_HOME", str(Path.home() / ".config"))) / "nexa-brief/storage-profile.json"
        selector.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        selector.write_text(json.dumps({"profile_dir": str(root)}) + "\n", encoding="utf-8")
        selector.chmod(0o600)
    print(json.dumps({"profile_dir": str(root), "profile": args.profile, "action": args.action}))


if __name__ == "__main__":
    main()
