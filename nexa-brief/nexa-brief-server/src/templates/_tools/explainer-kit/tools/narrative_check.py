"""Forma del guion según la estrategia narrativa del video (la llama check_storyboard.py → kit.py check).

La narrativa está en assets/config.json → narrative_id y su JSON en
src/skills/explainer/strategies/narrative/<id>.json (esquema: src/core/explainer/narrative/models.py).
Solo valida ORDEN y FORMA, nunca duraciones:
  · cada segmento con `act` conocido, los actos obligatorios presentes y en orden
  · intensidad de apertura (maxima ≥ 0.9, alta ≥ 0.7, media ≥ 0.4)
  · pregunta final: on_screen_question corta, beat common.question con ese texto, antes del outro
  · comentario fijado: su primera pregunta repite la de pantalla
Un video sin narrative_id (anterior al módulo) no se valida.
"""
import json, pathlib, re, unicodedata

SERVER = pathlib.Path(__file__).resolve().parents[5]   # tools → explainer-kit → _tools → templates → src → server
NARRATIVES = SERVER / "src" / "skills" / "explainer" / "strategies" / "narrative"
INTENSITY_MIN = {"baja": 0.0, "media": 0.4, "alta": 0.7, "maxima": 0.9}


def _norm(s):
    s = unicodedata.normalize("NFKD", str(s).lower()).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9 ]+", " ", s).split()


def _first_question(text):
    m = re.search(r"¿[^?]*\?", str(text))
    return m.group(0) if m else ""


def load(narrative_id):
    """(estrategia, error): el JSON de la narrativa o el motivo por el que no se pudo leer."""
    path = NARRATIVES / f"{narrative_id}.json"
    if not path.is_file():
        return None, f"narrativa {narrative_id}: no existe {path}"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except ValueError as exc:
        return None, f"narrativa {narrative_id}: JSON mal formado ({path}): {exc}"
    if data.get("id") != narrative_id:
        return None, f"narrativa {narrative_id}: el archivo declara id {data.get('id')!r}"
    return data, None


def hedge_hits(n, script):
    """Coberturas por oración; citas textuales y atribuciones a fuentes nombradas se exceptúan."""
    checks = (n.get("checks") or {}).get("script") or {}
    hits = []
    hedges = sorted(n.get("hook", {}).get("hedge_words", []), key=len, reverse=True)
    pattern = re.compile(r"(?<!\w)(?:" + "|".join(re.escape(x) for x in hedges) + r")(?!\w)", re.I) if hedges else None
    # Una atribución necesita un nombre propio u organización, no basta «según un estudio».
    source = re.compile(r"\b(?i:según|afirmó|dijo|advierte|sostiene|informó|de acuerdo con)\s+(?:(?i:el|la|los|las)\s+)?(?:[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.-]+|[A-Z]{2,})", 0)
    source_subject = re.compile(r"\b[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.-]+\s+(?i:dijo|afirmó|advierte|sostiene|informó)\b")
    source_of_study = re.compile(r"\b(?i:según|de acuerdo con)\s+(?i:un|el)\s+(?i:estudio|informe)\s+(?i:de)\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.-]+")
    for segment in script.get("segments", []):
        if segment.get("act") not in checks.get("hedge_acts", []) or not pattern:
            continue
        for sentence in re.split(r"(?<=[.!?…])\s+", segment.get("text", "")):
            unquoted = re.sub(r'«[^»]*»|“[^”]*”|"[^"]*"', '', sentence)
            if source.search(unquoted) or source_subject.search(unquoted) or source_of_study.search(unquoted):
                continue
            for match in pattern.finditer(unquoted):
                hits.append((segment.get("id", "?"), segment.get("act"), match.group()))
    return hits


def check_script(n, script, errs):
    rules = (n.get("checks") or {}).get("script") or {}
    segments = script.get("segments", [])
    hits = hedge_hits(n, script)
    for sid, act, word in hits:
        errs.append(f"segmento {sid} ({act}): cobertura «{word}» prohibida; afirma un hecho verificado o atribuye la cita a una fuente nombrada en la misma oración")
    for segment in segments:
        act, sid, text = segment.get("act"), segment.get("id", "?"), segment.get("text", "")
        allowed = (n.get("voice") or {}).get("allowed_tones", {}).get(act)
        if allowed and segment.get("tone") not in allowed:
            errs.append(f"segmento {sid} ({act}): tone {segment.get('tone')!r} no permitido; usa {allowed}")
    for key, label, vocabulary in (("concrete_act", "cifra o fecha", rules.get("number_words", [])),
                                    ("second_person_act", "segunda persona", rules.get("second_person_words", []))):
        act = rules.get(key)
        matching = [s for s in segments if s.get("act") == act] if act else []
        if not matching:
            continue
        text = " ".join(s.get("text", "") for s in matching)
        tokens = set(_norm(text))
        found = bool(tokens & set(_norm(" ".join(vocabulary))))
        if key == "concrete_act":
            found = found or bool(re.search(r"\d", text))
        if not found:
            errs.append(f"segmento(s) {', '.join(str(s.get('id', '?')) for s in matching)} ({act}): falta {label}; agrega una {label} verificable en el golpe")
    return len(hits)


def check(proto, config, script, storyboard, errs, script_only=False):
    narrative_id = config.get("narrative_id")
    if not narrative_id:
        return
    n, error = load(narrative_id)
    if error:
        errs.append(error)
        return
    tag = f"narrativa {narrative_id}"
    checks = n.get("checks") or {}
    spoken = [a["id"] for a in n.get("acts", []) if a.get("spoken", True)]
    segments = script.get("segments", [])
    acts = [s.get("act") for s in segments]

    missing_act = [s.get("id") for s in segments if not s.get("act")]
    if missing_act:
        errs.append(f"{tag}: segmentos sin `act`: {missing_act[:6]}")
    unknown = sorted({a for a in acts if a and a not in spoken})
    if unknown:
        errs.append(f"{tag}: actos que no existen en la narrativa: {unknown} (válidos: {spoken})")
    absent = [a for a in checks.get("required_acts", []) if a not in acts]
    if absent:
        errs.append(f"{tag}: faltan actos obligatorios: {absent}")
    firsts = [acts.index(a) for a in checks.get("order", []) if a in acts]
    if firsts != sorted(firsts):
        errs.append(f"{tag}: actos fuera de orden; el orden es {checks.get('order')}")

    opening = checks.get("opening_intensity")
    if opening and segments:
        value = segments[0].get("intensity")
        if value is None or float(value) < INTENSITY_MIN[opening]:
            errs.append(f"{tag}: el primer segmento abre con intensity {value}; la narrativa pide {opening} (≥ {INTENSITY_MIN[opening]})")

    check_script(n, script, errs)

    q = n.get("question")
    if not q:
        return
    q_segments = [s for s in segments if s.get("act") == q["act"]]
    screen = next((str(s["on_screen_question"]).strip() for s in q_segments if s.get("on_screen_question")), "")
    if q_segments and acts and acts[-1] != q["act"]:
        errs.append(f"{tag}: el acto {q['act']} tiene que ser el último hablado (antes del outro)")
    if not screen:
        errs.append(f"{tag}: falta on_screen_question en el acto {q['act']}")
    else:
        if len(screen.split()) > q["screen_max_words"]:
            errs.append(f"{tag}: la pregunta en pantalla tiene {len(screen.split())} palabras (máx. {q['screen_max_words']})")
        if not screen.endswith("?"):
            errs.append(f"{tag}: la pregunta en pantalla tiene que terminar en «?»")

    if script_only:
        return

    if checks.get("question_on_screen"):
        beats = [b for b in storyboard.get("beats", []) if b.get("use") == "common.question"]
        if not beats:
            errs.append(f"{tag}: falta el beat common.question (la pregunta en pantalla)")
        elif screen and _norm((beats[0].get("params") or {}).get("text", "")) != _norm(screen):
            errs.append(f"{tag}: common.question tiene que mostrar exactamente «{screen}»")
        elif not beats[0].get("until"):
            errs.append(f"{tag}: common.question necesita `until` (primeras palabras del outro) para quedar toda la pregunta")

    if checks.get("pinned_repeats_question") and screen:
        try:
            publish = json.loads((proto / "publish.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            publish = {}
        pinned = str(publish.get("pinned_comment", ""))
        if pinned and _norm(_first_question(pinned)) != _norm(screen):
            errs.append(f"{tag}: la primera pregunta del comentario fijado tiene que ser «{screen}»")
