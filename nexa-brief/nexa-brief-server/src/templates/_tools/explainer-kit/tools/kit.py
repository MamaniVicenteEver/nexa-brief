#!/usr/bin/env python3
"""kit.py · la ÚNICA puerta de entrada a las herramientas del explainer-kit.

Cualquier agente (Claude, Codex, DeepSeek…) produce un video corriendo estos pasos en orden.
Correr siempre desde nexa-brief-server/ con el Python del proyecto:

  K=src/templates/_tools/explainer-kit/tools/kit.py
  .venv/bin/python $K new <diseño> <video-id> --title "Título" [--minutes 10]  # 1. carpeta del video (duración objetivo: lengths.json)
  .venv/bin/python $K status <video-id>                             #    qué falta (en cualquier momento)
  .venv/bin/python $K components <video-id>                         # 3c. control de los componentes propios (assets/components/)
  .venv/bin/python $K voice <video-id>                              # 4. narración (Gemini, rotando claves/modelos) + control
  .venv/bin/python $K transcribe <video-id>                         # 5. lyrics.json con tiempos por palabra (+ cierre con voz del canal)
  .venv/bin/python $K outro <video-id>                              #    vuelve a pegar el cierre con voz del canal (outro/)
  .venv/bin/python $K check <video-id>                              # 7. valida el storyboard contra la transcripción
  .venv/bin/python $K sheet <video-id> [--orient 9x16|16x9|both]    # 8. hoja de capturas (1 por plano) para revisar
  .venv/bin/python $K manifest <video-id>                           # 9. manifest.json con todo lo que se sabe del video
  .venv/bin/python $K render <video-id> [--formats 9x16,16x9]       # 10. mp4 cuadro a cuadro (opcional)
  .venv/bin/python $K preview <video-id>                            #    tiempos sintéticos para previsualizar SIN voz
  .venv/bin/python $K new <diseño> <id> --folder sandbox/nodehistory  #    video de PRUEBA (casa de pruebas, no sale en la app)
  .venv/bin/python $K promote <video-id>                            #    pasa un video de prueba listo a producción
  .venv/bin/python $K poster <video-id>                             #    portada render/poster.jpg (la tarjeta de la app)
  .venv/bin/python $K catalog                                        #    regenera CATALOG.md (después de crear componentes)
  .venv/bin/python $K delegate <video-id> <rol> --prompt-file work/x.md [--out …] [--context PLAN.md]
                                                                    #    trabajo acotado a DeepSeek (roles: src/skills/models/roles.json)
  .venv/bin/python $K usage <video-id>                              #    usage.json: modelos, tokens e iteraciones del video

Cada comando con <video-id> queda anotado en <video>/work/usage.jsonl (tools/usage.py): así se
cuentan las vueltas (check, components, sheet…) y los tokens de la voz y lo delegado.

Los pasos 2 (investigación + PLAN.md), 3 (guion), 3b (medios) y 6 (storyboard) los hace el agente
siguiendo AGENTS.md y guides/; este script no "piensa", solo ejecuta y verifica.
"""
import argparse, datetime, hashlib, json, os, pathlib, re, shutil, subprocess, sys, wave

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from places import KIT, SERVER, TEMPLATES, find_video, folder_for_design  # noqa: E402
sys.path.insert(0, str(SERVER))
from src.core.explainer.promote import PromoteError, promote  # noqa: E402
from lengths import of_script  # noqa: E402
import outro as outro_tool  # noqa: E402
import usage  # noqa: E402
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
        script = {"id": a.id, "design": a.design, "title": title.upper(), "kicker": "", "language": "es-419",
                  "voice_direction": "", "segments": [{"id": "s01", "tone": "intriga", "intensity": 0.7, "text": "…"}]}
        if a.minutes:
            script["target_minutes"] = a.minutes
        jsave(d / "assets/script.json", script)
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
    T = of_script(sc, design_of(d))
    words = sum(len(s.get("text", "").split()) for s in sc.get("segments", []))
    local = (jload(A / "components" / "catalog.json", {}) or {}).get("comps", [])
    facts = 8 if T["legacy"] else max(8, int(T["minutes"] * 2))
    steps = [
        (f"2 PLAN.md completo (≥ {facts} hechos con fuente)", bool(plan) and "{{" not in plan and len(re.findall(r"^\|\s*\d+\s*\|.*https?://", plan, re.M)) >= facts),
        (f"3 guion (script.json): {words} palabras, objetivo {T['words'][0]}–{T['words'][1]}", len(sc.get("segments", [])) >= T["segments"][0] and "…" not in json.dumps(sc) and T["words"][0] <= words),
        (f"3b medios + CREDITS.md (≥ {T['photos'][0]} fotos)", len(media) >= T["photos"][0] and len((A / "media/CREDITS.md").read_text().splitlines()) > 3 if (A / "media/CREDITS.md").exists() else False),
        (f"3c componentes propios: {len(local)} registrados (mínimo {T['domain_components']} si el tema tiene objetos que el catálogo no dibuja; si no, justificar en PLAN §7a)",
         len(local) >= T["domain_components"] or bool(re.search(r"sin componentes propios:\s*(?!<motivo>)\w", plan, re.I))),
        ("4 voz (song.mp3)", (A / "song.mp3").exists() and not (ly.get("metadata") or {}).get("fake")),
        ("5 transcripción (lyrics.json)", bool(ly.get("segments")) and not (ly.get("metadata") or {}).get("fake")),
        ("5b cierre con voz del canal (kit.py outro)", outro_tool.spec_for(d) is None or bool((ly.get("metadata") or {}).get("outro"))),
        (f"6 storyboard (≥ {T['beats'][0]} planos)", len(sb.get("beats", [])) >= max(15, T["beats"][0])),
        ("8 hoja de revisión", any((d / "work").glob("sheet-*.png"))),
        ("9 manifest", (jload(d / "manifest.json", {}) or {}).get("status") in ("listo", "renderizado")),
        ("10 render", any((d / "render").glob("*.mp4"))),
    ]
    target = "formato corto anterior (3–4,5 min)" if T["legacy"] else f"objetivo {T['minutes']:g} min"
    print(f"{a.id} · diseño {design_of(d)} · {target}")
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
    outro_tool.apply(d)   # cierre con voz del canal (siempre igual, no se genera con TTS)

def cmd_outro(a):
    outro_tool.apply(vdir(a.id))

def cmd_preview(a):
    d = vdir(a.id)
    if (d / "assets/song.mp3").exists() and not a.force: sys.exit("ya hay voz real; preview pisaría song.mp3/lyrics.json (usar --force)")
    run([PY, TOOLS / "fake_timing.py", d / "assets/script.json", d / "assets/lyrics.json", d / "assets/song.mp3"])

# ---------------------------------------------------------------- check / sheet
def cmd_components(a):
    """3c · control de los componentes propios del video (tools/components.py)."""
    cmd = [PY, TOOLS / "components.py", vdir(a.id)]
    if a.only: cmd += ["--only", a.only]
    sys.exit(run(cmd).returncode)

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
    M["target_minutes"] = sc.get("target_minutes")
    chapters = chapter_times(sc, ly)
    if chapters: M["chapters"] = chapters
    else: M.pop("chapters", None)
    for k in ("youtube_title", "youtube_description", "youtube_tags", "tiktok_caption", "tiktok_hashtags", "thumbnail_text"):
        if pub.get(k): M[k] = pub[k]
    # el cierre con voz del canal es obligatorio si el canal/voz lo tiene grabado (outro/)
    has_outro = outro_tool.spec_for(d) is None or bool((ly.get("metadata") or {}).get("outro"))
    ok = all([M["duration_seconds"], M["transcript"]["words"], M["storyboard"]["beats"] >= 15, not M["transcript"]["fake"], has_outro])
    if not has_outro: print("⚠ falta el cierre con voz del canal: correr kit.py outro " + a.id)
    M["status"] = "renderizado" if any((d / "render").glob("*.mp4")) else ("listo" if ok else "en progreso")
    jsave(d / "manifest.json", M)
    print(f"✓ manifest.json · estado: {M['status']} · {M['duration_seconds']} s · {M['storyboard']['beats']} beats · {len(credits)} medios")

def _norm_words(text):
    import unicodedata
    s = unicodedata.normalize("NFD", text.lower())
    return re.findall(r"[a-zñ0-9]+", "".join(c for c in s if unicodedata.category(c) != "Mn"))

def chapter_times(sc, ly):
    """Capítulos de YouTube: [{at: 'm:ss', title}] desde los segmentos con "chapter" del guion.

    El inicio de cada capítulo es la primera palabra de su segmento en lyrics.json: se busca por
    sus primeras palabras (el guion dice los números en palabras y Whisper en cifras, así que si no
    aparecen se usa la posición proporcional en el guion). El primero siempre es 0:00 (YouTube).
    """
    segs = sc.get("segments", [])
    words = [w for s in ly.get("segments", []) for w in s.get("words", []) if w.get("word", "").strip()]
    if not words or not any(s.get("chapter") for s in segs): return []
    lyr = [(_norm_words(w["word"]) or [""])[0] for w in words]
    total = sum(len(s.get("text", "").split()) for s in segs) or 1
    out, done, cursor = [], 0, 0
    for s in segs:
        if s.get("chapter"):
            head = [w for w in _norm_words(s.get("text", "")) if not w.isdigit()][:3]
            idx = next((i for i in range(cursor, len(lyr) - len(head) + 1) if lyr[i:i + len(head)] == head), -1) if head else -1
            if idx < 0: idx = min(len(words) - 1, int(done / total * len(words)))
            cursor = idx
            sec = 0 if not out else int(words[idx]["start"])
            out.append({"at": f"{sec // 60}:{sec % 60:02d}", "title": s["chapter"]})
        done += len(s.get("text", "").split())
    return out

# ---------------------------------------------------------------- render / catalog
def cmd_render(a):
    # --seconds N: preview corto (0..N s) en render/preview/ — no cuenta como "renderizado" en el manifest.
    d = vdir(a.id); sizes = {"9x16": "1080x1920", "16x9": "1920x1080"}
    out_dir = d / "render" / "preview" if a.seconds else d / "render"
    out_dir.mkdir(parents=True, exist_ok=True)
    suffix = f"-{a.seconds:g}s" if a.seconds else ""
    formats = a.formats.split(",")
    for i, f in enumerate(formats, start=1):
        print(f"@@format {f} {i} {len(formats)}", flush=True)
        cmd = [PY, TEMPLATES / "_tools/commercial/render_promo.py", os.path.relpath(d / "index.html", TEMPLATES), out_dir / f"{a.id}-{f}{suffix}.mp4", "--size", sizes[f], "--workers", "4"]
        if a.seconds: cmd += ["--to", str(a.seconds)]
        env = dict(os.environ)
        env["PYTHONUNBUFFERED"] = "1"
        r = run(cmd, cwd=TEMPLATES, env=env)
        if r.returncode: sys.exit(r.returncode)
    if not a.seconds: cmd_manifest(a)

def cmd_poster(a):
    vdir(a.id)
    sys.exit(run([PY, TOOLS / "poster.py", a.id]).returncode)

def cmd_promote(a):
    """sandbox/<carpeta>/<id> → <carpeta>/<id> (producción): mueve la carpeta y corrige la ruta al motor."""
    d = find_video(a.id)
    if d is None:
        sys.exit(f"No existe {a.id}")
    try:
        plan = promote(d, force=a.force)
    except PromoteError as exc:
        sys.exit(exc.message)
    print(
        f"✓ {plan.source.relative_to(TEMPLATES)} → "
        f"{plan.destination.relative_to(TEMPLATES)} · ya aparece en la app (/plantillas)"
    )

def cmd_catalog(a):
    run([PY, TOOLS / "catalog.py"])

# ---------------------------------------------------------------- delegate / usage
def cmd_delegate(a):
    import delegate
    delegate.run(vdir(a.id), a.role, a.prompt_file, a.out, a.context)

def cmd_usage(a):
    s = usage.summarize(vdir(a.id))
    t = s["totals"]
    print(f"✓ {s['video']}/usage.json · {t['calls']} llamadas · entrada {t['input_tokens']:,} (caché {t['cached_input_tokens']:,})"
          f" · salida {t['output_tokens']:,} · razonamiento {t['reasoning_tokens']:,}")
    for name, b in s["by_provider"].items():
        print(f"  {name:<11} {b['calls']:>4} llamadas · {b['input_tokens']:>10,} entrada · {b['output_tokens']:>8,} salida · {b['seconds']:>8.0f} s")

# Comandos que se anotan en el registro de uso (los demás no tienen video o se anotan solos).
LOGGED = {"status", "components", "voice", "transcribe", "outro", "preview", "check", "sheet", "manifest", "render", "poster"}
PROVIDER_OF = {"transcribe": ("whisper", "large-v3")}   # voice anota cada pedido a Gemini desde narrate.py

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    p = sp.add_parser("new"); p.add_argument("design"); p.add_argument("id"); p.add_argument("--title", default=""); p.add_argument("--folder", default="", help="carpeta de categoría (nodetech, nodehistory…)"); p.add_argument("--force", action="store_true")
    p.add_argument("--minutes", type=float, default=0, help="duración objetivo (lengths.json: 5 corto, 10 normal, 15 serio, 30 largo)")
    p = sp.add_parser("components"); p.add_argument("id"); p.add_argument("--only", default="", help="un solo componente")
    for name in ("status", "transcribe", "check", "manifest", "outro"): sp.add_parser(name).add_argument("id")
    p = sp.add_parser("voice"); p.add_argument("id"); p.add_argument("--voice", default=""); p.add_argument("--model", default=""); p.add_argument("--parts", type=int, default=0); p.add_argument("--dry", action="store_true")
    p = sp.add_parser("preview"); p.add_argument("id"); p.add_argument("--force", action="store_true")
    p = sp.add_parser("sheet"); p.add_argument("id"); p.add_argument("--orient", default="9x16")
    p = sp.add_parser("render"); p.add_argument("id"); p.add_argument("--formats", default="9x16"); p.add_argument("--seconds", type=float, default=0, help="preview: solo los primeros N segundos (render/preview/)")
    p = sp.add_parser("poster"); p.add_argument("id")
    p = sp.add_parser("promote"); p.add_argument("id"); p.add_argument("--force", action="store_true")
    sp.add_parser("catalog")
    p = sp.add_parser("delegate"); p.add_argument("id"); p.add_argument("role"); p.add_argument("--prompt-file", required=True)
    p.add_argument("--out", default=""); p.add_argument("--context", action="append", default=[])
    sp.add_parser("usage").add_argument("id")
    a = ap.parse_args()
    if a.cmd not in LOGGED or find_video(getattr(a, "id", "")) is None:
        globals()["cmd_" + a.cmd](a)
        return
    started, ok = datetime.datetime.now(), True
    try:
        globals()["cmd_" + a.cmd](a)
    except SystemExit as exc:
        ok = exc.code in (None, 0)
        raise
    finally:
        provider, model = PROVIDER_OF.get(a.cmd, ("kit", ""))
        usage.record(find_video(a.id), provider=provider, model=model, role=a.cmd, ok=ok,
                     seconds=(datetime.datetime.now() - started).total_seconds())

if __name__ == "__main__":
    main()
