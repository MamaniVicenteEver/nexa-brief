#!/usr/bin/env python3
"""nuevo.py · crea la carpeta de un video NOTICIERO nuevo (resumen del día / de la semana) con todo listo.

    source <repo>/scripts/profile-env.sh            # define NEXA_PROFILE_DIR (una vez por terminal)
    python3 <_atlas>/noticiero/tools/nuevo.py resumen-2026-11-10 --fecha 2026-11-10 \
        --titulo "Resumen geopolítico del 10 de noviembre de 2026" [--categoria nodepolitics] [--periodo dia|semana]

Crea `$NEXA_PROFILE_DIR/sandbox/<categoria>/<id>/` (sandbox: ahí se prueba; promover es decisión del usuario):
    index.html          el wrapper (no se edita; carga el motor compartido por ruta relativa)
    info.json           ficha (estado «en preparación»)
    AGENTS.md           puntero corto a AGENTE.md
    PLAN.md             pedido + decisiones (se rellena en el paso 0)
    assets/config.json  estilo «original», audio song-outro.mp3
    assets/media/CREDITS.md
    work/voice.json     perfil de voz FIJO (copia de noticiero/voz.json)
    work/build_scene.py generador de la escena (copia de plantilla/build_scene.py, con la biblioteca ya importada)
    work/{briefs,research,results}/
No toca nada fuera de esa carpeta. Si ya existe, se niega (no pisa).
"""
from __future__ import annotations
import argparse, json, os, re, shutil, sys
from pathlib import Path

NOTICIERO = Path(__file__).resolve().parents[1]
PLANTILLA = NOTICIERO / "plantilla"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("id"); ap.add_argument("--fecha", required=True, help="AAAA-MM-DD (día o fin de la semana cubierta)")
    ap.add_argument("--titulo", required=True)
    ap.add_argument("--categoria", default="nodepolitics")
    ap.add_argument("--periodo", default="semana", choices=["dia", "semana"])
    ap.add_argument("--raiz", default="", help="carpeta sandbox alternativa (por defecto $NEXA_PROFILE_DIR/sandbox)")
    a = ap.parse_args()
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,60}", a.id):
        sys.exit("id: minúsculas, números y guiones (3–60)")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", a.fecha):
        sys.exit("--fecha AAAA-MM-DD")
    base = Path(a.raiz) if a.raiz else None
    if base is None:
        prof = os.environ.get("NEXA_PROFILE_DIR")
        if not prof:
            sys.exit("NEXA_PROFILE_DIR no está definido: `source <repo>/scripts/profile-env.sh` (ver AGENTS.md raíz)")
        base = Path(prof) / "sandbox"
    ep = base / a.categoria / a.id
    if ep.exists():
        sys.exit(f"{ep} ya existe; no se pisa")
    for d in ("assets/media", "work/briefs", "work/research", "work/results"):
        (ep / d).mkdir(parents=True)
    shutil.copy(PLANTILLA / "index.html", ep / "index.html")
    shutil.copy(NOTICIERO / "voz.json", ep / "work" / "voice.json")
    # el generador sabe dónde está la biblioteca: ruta absoluta al motor compartido de ESTE servidor
    src = (PLANTILLA / "build_scene.py").read_text().replace("__TOOLS__", str(NOTICIERO / "tools"))
    (ep / "work" / "build_scene.py").write_text(src)
    (ep / "assets" / "media" / "CREDITS.md").write_text("")
    (ep / "assets" / "config.json").write_text(json.dumps({
        "activeId": "default",
        "configs": [{"id": "default", "estilo": "original", "sceneUrl": "assets/scene.json",
                     "audio": {"src": "assets/song-outro.mp3"}, "lyricsUrl": "assets/lyrics.json"}]}, indent=2, ensure_ascii=False))
    info = json.loads((PLANTILLA / "info.json").read_text())
    info.update({"title": a.titulo, "created_at": a.fecha, "status": "en preparación"})
    (ep / "info.json").write_text(json.dumps(info, indent=2, ensure_ascii=False))
    (ep / "AGENTS.md").write_text(
        f"# {a.titulo}\n\nVideo de la plantilla NOTICIERO (Atlas). Instrucciones: `{NOTICIERO}/AGENTE.md` (única entrada).\n"
        "Motor compartido `nodehistory/_atlas`: no se copia ni se edita para un video. Estilo: `original`. Voz fija: ver `work/voice.json`.\n"
        "Comprobar con `tools/check.py`. Sin MP4, sin publicar, sin commit.\n")
    plan = (PLANTILLA / "PLAN.md").read_text().replace("{{TITULO}}", a.titulo).replace("{{FECHA}}", a.fecha).replace("{{PERIODO}}", a.periodo).replace("{{ID}}", a.id)
    (ep / "PLAN.md").write_text(plan)
    print(f"creado {ep}\nsiguiente: leer {NOTICIERO}/AGENTE.md §3 (proceso) y empezar por PLAN.md")


if __name__ == "__main__":
    main()
