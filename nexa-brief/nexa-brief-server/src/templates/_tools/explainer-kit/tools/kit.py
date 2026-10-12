#!/usr/bin/env python3
"""kit.py · la ÚNICA puerta de entrada a las herramientas del explainer-kit.

Cualquier agente (Claude, Codex, DeepSeek…) produce un video corriendo estos pasos en orden.
Correr siempre desde nexa-brief-server/ con el Python del proyecto:

  K=src/templates/_tools/explainer-kit/tools/kit.py
  .venv/bin/python $K new <diseño> <video-id> --title "Título"      # 1. carpeta del video desde las plantillas
  .venv/bin/python $K status <video-id>                             #    qué falta (en cualquier momento)
  .venv/bin/python $K voice <video-id>                              # 4. narración (Gemini, rotando claves/modelos) + control
  .venv/bin/python $K transcribe <video-id>                         # 5. lyrics.json con tiempos por palabra
  .venv/bin/python $K check <video-id>                              # 7. valida el storyboard contra la transcripción
  .venv/bin/python $K sheet <video-id> [--orient 9x16|16x9|both]    # 8. hoja de capturas (1 por plano) para revisar
  .venv/bin/python $K manifest <video-id>                           # 9. manifest.json con todo lo que se sabe del video
  .venv/bin/python $K render <video-id> [--formats 9x16,16x9]       # 10. mp4 cuadro a cuadro (opcional)
  .venv/bin/python $K preview <video-id>                            #    tiempos sintéticos para previsualizar SIN voz
  .venv/bin/python $K new <diseño> <id> --folder sandbox/nodehistory  #    video de PRUEBA (casa de pruebas, no sale en la app)
  .venv/bin/python $K promote <video-id>                            #    pasa un video de prueba listo a producción
  .venv/bin/python $K poster <video-id>                             #    portada render/poster.jpg (la tarjeta de la app)
  .venv/bin/python $K catalog                                        #    regenera CATALOG.md (después de crear componentes)

Los pasos 2 (investigación + PLAN.md), 3 (guion), 3b (medios) y 6 (storyboard) los hace el agente
siguiendo AGENTS.md y guides/; este script no "piensa", solo ejecuta y verifica.
"""
import argparse, datetime, hashlib, json, os, pathlib, re, shutil, subprocess, sys, wave

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from places import KIT, SERVER, TEMPLATES, find_video, folder_for_design, is_sandbox  # noqa: E402
PY = sys.executable
TOOLS = KIT / "tools"

def vdir(vid):
    d = find_video(vid)
    if d is None: sys.exit(f"no existe el video {vid} (se busca en src/templates/<carpeta de categoría>/)")
    return d
def jload(p, default=None):
    try: return json.loads(pathlib.Path(p).read_text())
    except Exception: return default
def jsave(p, data): pathlib.Path(p).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
def run(cmd, **kw):
    print("$", " ".join(str(c) for c in cmd)[:300], flush=True)
    return subprocess.run([str(c) for c in cmd], **kw)
def design_of(d): return (jload(d / "assets" / "config.json", {}) or {}).get("design") or (jload(d / "manifest.json", {}) or {}).get("design", "binary")

# ---------------------------------------------------------------- new
def cmd_new(a):
    D = jload(KIT / "designs" / a.design / "design.json")
    if not D: sys.exit(f"diseño desconocido: {a.design} (ver designs/index.json)")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,60}", a.id): sys.exit("video-id: minúsculas, números y guiones (p. ej. muro-de-berlin)")
    # carpeta de la categoría: --folder (la elige el backend) o la del diseño en niches.json
    d = find_video(a.id) or TEMPLATES / (a.folder or folder_for_design(a.design)) / a.id
    if d.exists() and not a.force: sys.exit(f"ya existe {d} (usar --force para regenerar SOLO las plantillas faltantes)")
    for sub in ["assets/media", "work", "render"]: (d / sub).mkdir(parents=True, exist_ok=True)
    T = KIT / "templates"
    title = a.title or a.id.replace("-", " ").capitalize()
    def put(rel, text):
        p = d / rel
        if not p.exists() or rel == "index.html": p.write_text(text)
    kit_rel = os.path.relpath(KIT, d)   # p. ej. ../../_tools/explainer-kit (producción) o ../../../… (sandbox)
    put("index.html", (T / "index.html").read_text().replace("{{DESIGN}}", a.design).replace("{{TITLE}}", title).replace("{{KIT}}", kit_rel))
    put("PLAN.md", (T / "PLAN.md").read_text().replace("{{TITLE}}", title).replace("{{DESIGN}}", f"{a.design} ({D['name']})"))
    put("assets/media/CREDITS.md", f"# Créditos de medios · {title}\n\narchivo — título — autor — licencia — URL de la fuente\n")
    if not (d / "assets/config.json").exists():
        jsave(d / "assets/config.json", {"activeId": a.id, "configs": [{"id": a.id, "design": a.design, "title": title,
              "audio": {"src": "assets/song.mp3"}, "lyricsUrl": "assets/lyrics.json", "storyboardUrl": "assets/storyboard.json", "seed": int(hashlib.sha1(a.id.encode()).hexdigest()[:6], 16) % 9999}]})
    if not (d / "assets/script.json").exists():
        jsave(d / "assets/script.json", {"id": a.id, "design": a.design, "title": title.upper(), "kicker": "", "language": "es-419",
              "voice_direction": "", "segments": [{"id": "s01", "tone": "intriga", "intensity": 0.7, "text": "…"}]})
    if not (d / "assets/storyboard.json").exists():
        jsave(d / "assets/storyboard.json", {"version": 1, "family": D["family"], "title": title, "defaults": {"offset": -0.12},
              "beats": [{"t": 0, "use": f"{D['family']}.title", "params": {"text": title.upper()}, "until": "…"}]})
    if not (d / "publish.json").exists():
        jsave(d / "publish.json", {"youtube_title": "", "youtube_description": "", "youtube_tags": [], "tiktok_caption": "", "tiktok_hashtags": [], "thumbnail_text": ""})
    if not (d / "manifest.json").exists():
        jsave(d / "manifest.json", {"video_id": a.id, "design": a.design, "design_name": D["name"], "channel": D["channel"]["name"],
              "status": "nuevo", "created": datetime.date.today().isoformat(), "title": title})
    (d / "render" / ".gitignore").write_text("*.mp4\n"); (d / "work" / ".gitignore").write_text("*\n!.gitignore\n")
    print(f"✓ {d.relative_to(TEMPLATES)} listo. Siguiente: completar PLAN.md (AGENTS.md, paso 2).")

# ---------------------------------------------------------------- status
def cmd_status(a):
    d = vdir(a.id); A = d / "assets"
    sc = jload(A / "script.json", {}); sb = jload(A / "storyboard.json", {}); ly = jload(A / "lyrics.json", {})
    media = [p for p in (A / "media").glob("*") if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".mp4")]
    plan = (d / "PLAN.md").read_text() if (d / "PLAN.md").exists() else ""
    steps = [
        ("2 PLAN.md completo (≥ 8 hechos con fuente)", bool(plan) and "{{" not in plan and len(re.findall(r"^\|\s*\d+\s*\|.*https?://", plan, re.M)) >= 8),
        ("3 guion (script.json)", len(sc.get("segments", [])) >= 8 and "…" not in json.dumps(sc)),
        ("3b medios + CREDITS.md", len(media) >= 3 and len((A / "media/CREDITS.md").read_text().splitlines()) > 3 if (A / "media/CREDITS.md").exists() else False),
        ("4 voz (song.mp3)", (A / "song.mp3").exists() and not (ly.get("metadata") or {}).get("fake")),
        ("5 transcripción (lyrics.json)", bool(ly.get("segments")) and not (ly.get("metadata") or {}).get("fake")),
        ("6 storyboard", len(sb.get("beats", [])) >= 15),
        ("8 hoja de revisión", any((d / "work").glob("sheet-*.png"))),
        ("9 manifest", (jload(d / "manifest.json", {}) or {}).get("status") in ("listo", "renderizado")),
        ("10 render", any((d / "render").glob("*.mp4"))),
    ]
    print(f"{a.id} · diseño {design_of(d)}")
    for name, ok in steps: print(f"  {'✓' if ok else '·'} {name}")

# ---------------------------------------------------------------- voice / transcribe
def cmd_voice(a):
    d = vdir(a.id); work = d / "work"
    cmd = [PY, TOOLS / "narrate.py", d / "assets/script.json", work / "narration", "--design", design_of(d)]
    if a.voice: cmd += ["--voice", a.voice]
    if a.model: cmd += ["--model", a.model]
    if a.parts: cmd += ["--parts", str(a.parts)]
    if a.dry: cmd += ["--dry"]
    if run(cmd).returncode: sys.exit(1)
    if not a.dry:
        shutil.copy(work / "narration.mp3", d / "assets/song.mp3")
        print("✓ assets/song.mp3 · revisar work/narration.qc.json (faltan / sobran). Siguiente: kit.py transcribe")

def cmd_transcribe(a):
    d = vdir(a.id)
    if run([PY, TOOLS / "transcribe.py", d / "assets/song.mp3", d / "assets/script.json", d / "assets/lyrics.json"]).returncode: sys.exit(1)

def cmd_preview(a):
    d = vdir(a.id)
    if (d / "assets/song.mp3").exists() and not a.force: sys.exit("ya hay voz real; preview pisaría song.mp3/lyrics.json (usar --force)")
    run([PY, TOOLS / "fake_timing.py", d / "assets/script.json", d / "assets/lyrics.json", d / "assets/song.mp3"])

# ---------------------------------------------------------------- check / sheet
def cmd_check(a):
    sys.exit(run([PY, TOOLS / "check_storyboard.py", vdir(a.id)]).returncode)

def cmd_sheet(a):
    d = vdir(a.id)
    for o in (["9x16", "16x9"] if a.orient == "both" else [a.orient]):
        out = d / "work" / f"sheet-{o}.png"
        run([PY, TOOLS / "shoot.py", out, a.id, "--page", os.path.relpath(d / "index.html", KIT), "--times", "beats", "--orient", o, "--thumb", "330" if o == "9x16" else "220"])
        print(f"✓ {out.relative_to(TEMPLATES)} — MIRARLA: un cuadro por plano (AGENTS.md, paso 8)")

# ---------------------------------------------------------------- manifest
def audio_dur(p):
    try: return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], capture_output=True, text=True).stdout.strip())
    except Exception: return None

def cmd_manifest(a):
    d = vdir(a.id); A = d / "assets"
    M = jload(d / "manifest.json", {}) or {}
    cfg = jload(A / "config.json", {}); C = cfg["configs"][0] if "configs" in cfg else cfg
    D = jload(KIT / "designs" / C.get("design", "binary") / "design.json", {})
    sc = jload(A / "script.json", {}); sb = jload(A / "storyboard.json", {}); ly = jload(A / "lyrics.json", {})
    qcj = jload(d / "work" / "narration.qc.json", {}) or {}
    pub = jload(d / "publish.json", {}) or {}
    words = sum(len(s["text"].split()) for s in sc.get("segments", []))
    credits = [l for l in (A / "media/CREDITS.md").read_text().splitlines() if " — " in l and not l.startswith("archivo")] if (A / "media/CREDITS.md").exists() else []
    uses = {}
    for b in sb.get("beats", []): uses[b["use"]] = uses.get(b["use"], 0) + 1
    files = {str(p.relative_to(d)): p.stat().st_size for p in sorted(d.rglob("*")) if p.is_file() and "work" not in p.parts and p.name != ".gitignore"}
    dur = audio_dur(A / "song.mp3") if (A / "song.mp3").exists() else None
    M.update({
        "video_id": a.id, "design": C.get("design"), "design_name": D.get("name"), "channel": (C.get("outro") or {}).get("channel") or D.get("channel", {}).get("name"),
        "pipeline_type": "explainer_kit", "title": sc.get("title") or C.get("title"), "kicker": sc.get("kicker"),
        "language": sc.get("language", "es-419"), "duration_seconds": round(dur, 2) if dur else None,
        "script": {"segments": len(sc.get("segments", [])), "words": words, "arc": [{"id": s["id"], "tone": s["tone"], "intensity": s.get("intensity")} for s in sc.get("segments", [])]},
        # work/ no viaja con el repo: sin el QC de la voz se conserva el bloque que ya tenía el manifest.
        "voice": {"voice": qcj.get("voice"), "provenance": qcj.get("provenance"), "wpm": qcj.get("wpm"), "wer_aprox": qcj.get("wer_aprox"), "faltan": qcj.get("faltan", [])[:10], "sobran": qcj.get("sobran", [])[:10]} if qcj else M.get("voice"),
        "transcript": {"words": sum(len(s.get("words", [])) for s in ly.get("segments", [])), "fake": bool((ly.get("metadata") or {}).get("fake"))},
        "storyboard": {"beats": len(sb.get("beats", [])), "components": uses, "lyrics_moments": uses.get("common.lyric", 0)},
        "media": credits,
        "video_formats": [{"id": "reels", "aspect_ratio": "9:16", "width": 1080, "height": 1920, "output_filename": f"render/{a.id}-9x16.mp4"},
                          {"id": "youtube", "aspect_ratio": "16:9", "width": 1920, "height": 1080, "output_filename": f"render/{a.id}-16x9.mp4"}],
        "files": files, "updated": datetime.datetime.now().isoformat(timespec="seconds"),
    })
    for k in ("youtube_title", "youtube_description", "youtube_tags", "tiktok_caption", "tiktok_hashtags", "thumbnail_text"):
        if pub.get(k): M[k] = pub[k]
    ok = all([M["duration_seconds"], M["transcript"]["words"], M["storyboard"]["beats"] >= 15, not M["transcript"]["fake"]])
    M["status"] = "renderizado" if any((d / "render").glob("*.mp4")) else ("listo" if ok else "en progreso")
    jsave(d / "manifest.json", M)
    print(f"✓ manifest.json · estado: {M['status']} · {M['duration_seconds']} s · {M['storyboard']['beats']} beats · {len(credits)} medios")

# ---------------------------------------------------------------- render / catalog
def cmd_render(a):
    # --seconds N: preview corto (0..N s) en render/preview/ — no cuenta como "renderizado" en el manifest.
    d = vdir(a.id); sizes = {"9x16": "1080x1920", "16x9": "1920x1080"}
    out_dir = d / "render" / "preview" if a.seconds else d / "render"
    out_dir.mkdir(parents=True, exist_ok=True)
    suffix = f"-{a.seconds:g}s" if a.seconds else ""
    for f in a.formats.split(","):
        cmd = [PY, TEMPLATES / "_tools/commercial/render_promo.py", os.path.relpath(d / "index.html", TEMPLATES), out_dir / f"{a.id}-{f}{suffix}.mp4", "--size", sizes[f], "--workers", "4"]
        if a.seconds: cmd += ["--to", str(a.seconds)]
        r = run(cmd, cwd=TEMPLATES)
        if r.returncode: sys.exit(r.returncode)
    if not a.seconds: cmd_manifest(a)

def cmd_poster(a):
    vdir(a.id)
    sys.exit(run([PY, TOOLS / "poster.py", a.id]).returncode)

def cmd_promote(a):
    """sandbox/<carpeta>/<id> → <carpeta>/<id> (producción): mueve la carpeta y corrige la ruta al motor."""
    d = vdir(a.id)
    if not is_sandbox(d): sys.exit(f"{a.id} ya está en producción ({d.relative_to(TEMPLATES)})")
    st = (jload(d / "manifest.json", {}) or {}).get("status")
    if st not in ("listo", "renderizado") and not a.force:
        sys.exit(f"{a.id} está '{st}': terminá los pasos 2–9 (kit.py status) o usá --force")
    dest = TEMPLATES / d.parent.name / a.id
    if dest.exists(): sys.exit(f"ya existe {dest.relative_to(TEMPLATES)}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(d), str(dest))
    html = dest / "index.html"
    html.write_text(re.sub(r'src="[^"]*engine/loader\.js"', f'src="{os.path.relpath(KIT, dest)}/engine/loader.js"', html.read_text()))
    print(f"✓ {d.relative_to(TEMPLATES)} → {dest.relative_to(TEMPLATES)} · ya aparece en la app (/plantillas)")

def cmd_catalog(a):
    run([PY, TOOLS / "catalog.py"])

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    p = sp.add_parser("new"); p.add_argument("design"); p.add_argument("id"); p.add_argument("--title", default=""); p.add_argument("--folder", default="", help="carpeta de categoría (nodetech, nodehistory…)"); p.add_argument("--force", action="store_true")
    for name in ("status", "transcribe", "check", "manifest"): sp.add_parser(name).add_argument("id")
    p = sp.add_parser("voice"); p.add_argument("id"); p.add_argument("--voice", default=""); p.add_argument("--model", default=""); p.add_argument("--parts", type=int, default=0); p.add_argument("--dry", action="store_true")
    p = sp.add_parser("preview"); p.add_argument("id"); p.add_argument("--force", action="store_true")
    p = sp.add_parser("sheet"); p.add_argument("id"); p.add_argument("--orient", default="9x16")
    p = sp.add_parser("render"); p.add_argument("id"); p.add_argument("--formats", default="9x16"); p.add_argument("--seconds", type=float, default=0, help="preview: solo los primeros N segundos (render/preview/)")
    p = sp.add_parser("poster"); p.add_argument("id")
    p = sp.add_parser("promote"); p.add_argument("id"); p.add_argument("--force", action="store_true")
    sp.add_parser("catalog")
    a = ap.parse_args()
    globals()["cmd_" + a.cmd](a)

if __name__ == "__main__":
    main()
