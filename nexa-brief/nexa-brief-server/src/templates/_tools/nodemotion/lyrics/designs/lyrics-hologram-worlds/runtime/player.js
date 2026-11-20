/* ======================= ORQUESTADOR (player.js) =========================
   Se inserta en el documento detrás del núcleo común (promo/compiler/build/core.js)
   al compilar con promo/compiler/build/build.py. No dibuja nada: carga los
   componentes de ./components/, valida el config, arma el mapa de escenas `B`,
   aplica transiciones y decide intro / outro. Todo el contenido (textos,
   medios, colores, orden de escenas, animaciones) sale del JSON.
   Contrato de componentes (cada archivo de components/ registra piezas en
   window[REG_NAME]):
     REG.kit          funciones de dibujo compartidas
     REG.scenes[tipo] = { label, params: {clave: S.num|S.enum|S.bool|S.str}, render(sc, X, K) }
     REG.transitions[nombre] = (X, d, K) => void
     REG.hud(X, K)    capa fija opcional encima de cada escena
     REG.meta         { fallback, textIn, look: {clave: spec} }
   ?outro=v1|v2 en la URL fuerza el outro (vista de la galería).
   Modo letras (REG.meta.mode = "lyrics"): la línea de tiempo es core.lyricTimeline
   (frases de Whisper, mazo ponderado config.layouts + REG.scenes[t].fits, ecos en
   instrumentales, intro y outro); cada escena recibe sus palabras con su tiempo. */
const REG_NAME = "NexaPromo_" + NAME.replace(/-/g, "_");
const S = {
  num: (min, max, def) => ({ t: "num", min, max, def }),
  enum: (of, def) => ({ t: "enum", of, def }),
  bool: def => ({ t: "bool", def }),
  str: (max, def = "") => ({ t: "str", max, def }),
};
const REG = window[REG_NAME] = window[REG_NAME] || {};
Object.assign(REG, { S, C, scenes: REG.scenes || {}, transitions: REG.transitions || {}, kit: REG.kit || {}, meta: REG.meta || {} });

/* ---------------- carga de componentes ---------------- */
const COMPONENTS = ["kit.js", "transitions.js", "intro.js", "scenes.js", "worlds.js", "outro-v1.js", "outro-v2.js"];
const LOADED = [];
{
  const bases = [new URL("./components/", document.baseURI).href];
  /* los drafts viejos pueden no traer la carpeta: se usa la copia canónica de la plantilla */
  if (/^\/api\/v1\/(drafts|templates)\//.test(location.pathname))
    bases.push(new URL(`/api/v1/templates/${NAME}/showcase/components/`, location.origin).href);
  for (const file of COMPONENTS) {
    let ok = false;
    for (const base of bases) {
      try { await import(base + file); ok = true; break; } catch (e) { /* siguiente base */ }
    }
    if (ok) LOADED.push(file); else console.warn(`[${NAME}] componente no disponible: ${file}`);
  }
}

/* ---------------- validación del config ---------------- */
const WARN = [];
const warn = m => { WARN.push(m); console.warn(`[${NAME}] config: ${m}`); };
const CORE_TRANS = ["fade", "blur", "iris", "wipeL", "wipeR", "wipeUp", "wipeDown", "bars", "flash", "zoomIn", "zoomOut", "slice"];
const TRANS = () => ["cut", ...Object.keys(REG.transitions), ...CORE_TRANS];
function check(spec, v, path) {
  if (v === undefined) return spec.def;
  if (spec.t === "num") {
    if (typeof v !== "number" || !isFinite(v)) { warn(`${path} debe ser número → ${spec.def}`); return spec.def; }
    if (v < spec.min || v > spec.max) { const c = clamp(v, spec.min, spec.max); warn(`${path}=${v} fuera de [${spec.min}, ${spec.max}] → ${c}`); return c; }
    return v;
  }
  if (spec.t === "enum") { if (spec.of.includes(v)) return v; warn(`${path}="${v}" no es uno de ${spec.of.join("|")} → ${spec.def}`); return spec.def; }
  if (spec.t === "bool") { if (typeof v === "boolean") return v; warn(`${path} debe ser true/false → ${spec.def}`); return spec.def; }
  if (spec.t === "str") { if (typeof v === "string") return v.slice(0, spec.max); warn(`${path} debe ser texto`); return spec.def; }
  return v;
}
const getPath = (o, p) => p.split(".").reduce((a, k) => (a && typeof a === "object" ? a[k] : undefined), o);
const setPath = (o, p, v) => { const ks = p.split("."); let a = o; for (const k of ks.slice(0, -1)) a = (a[k] = a[k] && typeof a[k] === "object" ? a[k] : {}); a[ks[ks.length - 1]] = v; };
const TEXT_IN = ["type", "rise", "squash", "pop", "slam", "wipe", "fade", "cut", "mask", "stamp", "slide", "glitch", "spread"];
const LYR = REG.meta.mode === "lyrics";
{
  const base = DEFAULT_CONFIG.configs[0];
  /* paleta: solo #RRGGBB; los nombres de la plantilla son obligatorios */
  C.palette = { ...base.palette, ...(C.palette || {}) };
  for (const [k, v] of Object.entries(C.palette)) if (!/^#[0-9a-f]{6}$/i.test(String(v))) { warn(`palette.${k}="${v}" no es #RRGGBB → ${base.palette[k] || "#000000"}`); C.palette[k] = base.palette[k] || "#000000"; }
  for (const [k, v] of Object.entries(C.palette)) doc.documentElement.style.setProperty("--" + k, v);
  for (const k of ["display", "label"]) if (C.fonts?.[k]) doc.documentElement.style.setProperty(k === "display" ? "--fD" : "--fL", `"${String(C.fonts[k]).replace(/["\\]/g, "")}"`);
  const GLOBAL = {
    "transition.overlapSec": S.num(0, 1, 0.5), "transition.duration": S.num(0.1, 1, 0.45),
    "intro.enabled": S.bool(true), "intro.title": S.str(60), "intro.sub": S.str(60),
    "outro.enabled": S.bool(true), "outro.version": S.enum(["v1", "v2"], "v1"), "outro.minSec": S.num(1.5, 12, 3.5),
    "outro.title": S.str(60), "outro.cta": S.str(60),
    "anim.textIn": S.enum(TEXT_IN, REG.meta.textIn || "rise"), "anim.speed": S.num(0.5, 2, 1), "anim.intensity": S.num(0, 2, 1),
    "hud.enabled": S.bool(REG.meta.hud !== false),
    seed: S.num(0, 1e9, 7),
  };
  if (LYR) Object.assign(GLOBAL, {
    "intro.artist": S.str(60), "outro.sub": S.str(80), "outro.feats": S.str(80), "outro.sec": S.num(1.5, 12, 3.6),
    "timing.leadSec": S.num(0, 0.6, 0.1), "timing.holdSec": S.num(0.2, 3, 0.8), "timing.gapSec": S.num(0.8, 8, 2.2),
    "timing.echoSec": S.num(0.4, 4, 1.0), "timing.cooldown": S.num(0, 8, 3),
    "phrases.maxWords": S.num(1, 12, 5), "phrases.maxSec": S.num(0.8, 8, 2.6), "phrases.minWords": S.num(1, 6, 2),
  });
  for (const [k, spec] of Object.entries(REG.meta.look || {})) GLOBAL["look." + k] = spec;
  for (const [path, spec] of Object.entries(GLOBAL)) setPath(C, path, check(spec, getPath(C, path), path));
  const w = C.transition.weights || {};
  C.transition.weights = {};
  for (const [k, v] of Object.entries(w)) {
    if (!TRANS().includes(k)) warn(`transition.weights.${k} no es una transición disponible`);
    else if (typeof v !== "number" || v < 0) warn(`transition.weights.${k} debe ser un número ≥ 0`);
    else C.transition.weights[k] = v;
  }
  if (!Object.values(C.transition.weights).some(v => v > 0)) C.transition.weights = { cut: 1 };
  /* escenas: tipo conocido, medios existentes y parámetros dentro de rango */
  const ids = new Set((C.media || []).map(m => m.id));
  const fb = REG.meta.fallback || Object.keys(REG.scenes)[0];
  if (LYR) {
    /* mazo de letras: config.layouts = { tipo: { weight, bgs, media, trans, ...parámetros } } */
    const BGS = REG.meta.bgs || [];
    const lay = C.layouts && typeof C.layouts === "object" ? C.layouts : {};
    C.layouts = {};
    for (const [type, v0] of Object.entries(lay)) {
      if (!REG.scenes[type] || type === "intro" || /^outro/.test(type)) { warn(`layouts.${type} no es un tipo de escena del mazo`); continue; }
      const v = v0 && typeof v0 === "object" ? v0 : {};
      const out = { ...v, weight: check(S.num(0, 10, 1), v.weight, `layouts.${type}.weight`) };
      if (v.bgs !== undefined) out.bgs = (Array.isArray(v.bgs) ? v.bgs : []).filter(b => BGS.includes(b) || (warn(`layouts.${type}.bgs "${b}" no es uno de ${BGS.join("|")}`), false));
      if (out.bgs && !out.bgs.length) delete out.bgs;
      if (v.media !== undefined) out.media = (Array.isArray(v.media) ? v.media : []).filter(id => ids.has(id) || (warn(`layouts.${type}.media "${id}" no está en config.media`), false));
      if (v.trans !== undefined && !TRANS().includes(v.trans)) { warn(`layouts.${type}.trans="${v.trans}" no existe`); delete out.trans; }
      for (const [k, spec] of Object.entries(REG.scenes[type].params || {})) if (k in v) out[k] = check(spec, v[k], `layouts.${type}.${k}`);
      C.layouts[type] = out;
    }
    if (!Array.isArray(C.timeline) && !Object.values(C.layouts).some(v => v.weight > 0)) { warn("layouts sin pesos > 0 → mazo por defecto"); C.layouts = { [fb]: { weight: 1 } }; }
    if (!C.intro.enabled) { C.intro.title = ""; C.intro.artist = ""; }
  }
  if (!LYR) C.scenes = (Array.isArray(C.scenes) && C.scenes.length ? C.scenes : [{ type: fb }]).map((s, i) => {
    if (!s || typeof s !== "object") { warn(`scenes[${i}] debe ser un objeto`); s = {}; }
    let type = s.type;
    if (type === "outro") return { ...s };   /* el outro elegido (v1/v2) se resuelve en makeTimeline */
    if (!REG.scenes[type]) { warn(`scenes[${i}].type="${type}" no existe → ${fb}`); type = fb; }
    const out = { ...s, type };
    if (s.media !== undefined) {
      if (!Array.isArray(s.media)) { warn(`scenes[${i}].media debe ser una lista`); delete out.media; }
      else out.media = s.media.filter(id => typeof id === "number" || ids.has(id) || (warn(`scenes[${i}].media "${id}" no está en config.media`), false));
    }
    if (s.trans !== undefined && s.trans !== "auto" && !TRANS().includes(s.trans)) { warn(`scenes[${i}].trans="${s.trans}" no existe`); delete out.trans; }
    if (s.trans === "auto") delete out.trans;
    for (const [k, spec] of Object.entries(REG.scenes[type].params || {})) if (k in s) out[k] = check(spec, s[k], `scenes[${i}].${k}`);
    return out;
  });
  const q = QS.get("outro");
  if (q === "v1" || q === "v2") C.outro.version = q;
}
const P = C.palette, BR = C.brand || {};

/* ---------------- herramientas para los componentes ---------------- */
/* renglones de la escena con su instante de entrada: en el guion de promos
   cada "word" es un renglón completo; en Whisper real se agrupan por renglón */
function lines(X) {
  const sc = X.sc, L = Array.isArray(sc.seg.lines) && sc.seg.lines.length ? sc.seg.lines.map(String) : [sc.seg.text || ""];
  const per = sc.words.length === L.length;
  const k = 1 / (C.anim.speed || 1);
  return L.map((t, i) => ({ text: t.trim(), rt: Math.max(0.06, (per ? sc.words[i].rt : (X.lines[i]?.rt ?? 0.1)) * k) }));
}
const hide = (X, el, t) => { if (t > 0.001) X.T(el, "visibility", "hidden", true).set(t, "visible"); };
/* palabras de la escena con su tiempo relativo (modo letras: sincronía con lo cantado) */
const words = X => X.sc.words.map(w => ({ text: String(w.text).trim(), rt: Math.max(0.02, w.rt) })).filter(w => w.text);
const K = { words, div, tx, fit, textW, measure, mbox, kenBurns, canvasText, blurPass, mediaSpec, asStill, enterFx, mulberry32, clamp,
  EASE_OUT, EASE_IN, EASE_IO, EASE_BACK, C, P, BR, REG, lines, hide, warn };

/* ---------------- escenas + transición + HUD ---------------- */
function outroType() { return C.outro.version === "v2" && REG.scenes.outroV2 ? "outroV2" : REG.scenes.outroV1 ? "outroV1" : REG.meta.fallback; }
function defaults(params) { const o = {}; for (const [k, s] of Object.entries(params || {})) o[k] = s.def; return o; }
function runScene(type, sc, X) {
  const comp = REG.scenes[type] || REG.scenes[REG.meta.fallback];
  X.p = { ...defaults(comp.params), ...(LYR ? C.layouts[type] || {} : {}), ...sc.slot };
  X.L = div(X.root, "lay");
  comp.render(sc, X, K);
  if (C.hud.enabled && REG.hud) REG.hud(X, K);
  if (sc.idx === 0) return;
  const kind = pickTrans(X);
  const d = Math.min(C.transition.duration, Math.max(0.1, C.transition.overlapSec || C.transition.duration), X.dur * 0.6);
  if (!kind || kind === "cut") return;
  if (REG.transitions[kind]) REG.transitions[kind](X, d, K);
  else enterFx({ ...X, root: X.L }, kind, d);
}
const B = {};
const fbType = REG.meta.fallback || Object.keys(REG.scenes)[0];
B[fbType] = (sc, X) => runScene(fbType, sc, X);   /* primero: es el tipo de reserva de core.buildTimeline */
for (const type of Object.keys(REG.scenes)) if (!B[type]) B[type] = (sc, X) => runScene(type, sc, X);
B.outro = (sc, X) => runScene(outroType(), sc, X);

/* línea de tiempo: un segmento = una escena (core.buildTimeline). La primera
   escena es la intro y la última el outro elegido (v1/v2); si el último
   segmento es más corto que outro.minSec, absorbe los anteriores. */
/* línea de tiempo explícita (config.timeline): una escena por entrada, con tiempos del guion y
   no de la transcripción. Entrada: { t0, t1?, type, bg?, media?, trans?, words?: [texto | [texto, t]], p?: {parámetros} }.
   t1 por omisión = t0 de la siguiente. Los tipos "intro" y "outro" usan sus escenas propias. */
function explicitTimeline(tl, dur) {
  const sorted = tl.slice().sort((a, b) => a.t0 - b.t0);
  const list = sorted.map((s, i) => {
    const t0 = Math.max(0, +s.t0), t1 = Math.min(dur, s.t1 != null ? +s.t1 : (sorted[i + 1] ? +sorted[i + 1].t0 : dur));
    const type = REG.scenes[s.type] || s.type === "outro" ? s.type : (warn(`timeline[${i}].type="${s.type}" no existe → ${fbType}`), fbType);
    const ws = (s.words || []).map((w, j) => Array.isArray(w) ? { text: String(w[0]), t: +w[1] } : { text: String(w), t: t0 + 0.1 + j * 0.18 });
    if (s.trans !== undefined && s.trans !== "auto" && !TRANS().includes(s.trans)) warn(`timeline[${i}].trans="${s.trans}" no existe`);
    return { kind: type === "intro" ? "intro" : type === "outro" ? "outro" : "lyric", idx: i, t0, t1: Math.max(t0 + 0.05, t1), dur: Math.max(0.05, t1 - t0),
      type, seg: { text: ws.map(w => w.text).join(" ") }, words: ws.map(w => ({ text: w.text, rt: Math.max(0.02, w.t - t0) })),
      slot: { type, bg: s.bg || "void", media: s.media || [], trans: s.trans && s.trans !== "auto" && TRANS().includes(s.trans) ? s.trans : undefined, ...(s.p || {}) } };
  });
  return list;
}
/* galería: ?only=<pieza>&p=<JSON> muestra una sola pieza desde t = 0 (showcase/components.json) */
const ONLY_TYPES = { "hw.intro": "intro", "hw.outrov1": "outroV1", "hw.outrov2": "outroV2", "hw.compose": "compose" };
function onlyTimeline(dur) {
  const name = QS.get("only"); if (!name) return null;
  let P = {}; try { P = JSON.parse(QS.get("p") || "{}") || {}; } catch (e) { warn("p no es JSON válido"); }
  const type = ONLY_TYPES[name] || name;
  if (!REG.scenes[type]) { warn(`only=${name} no es una pieza de este diseño`); return null; }
  const D = Math.max(0.5, Math.min(dur, +P.duration || (type === "intro" ? 1.7 : type === "compose" ? 3 : 7)));
  if (P.title != null || P.artist != null) Object.assign(C.intro, { title: P.title ?? C.intro.title, artist: P.artist ?? C.intro.artist });
  if (/^outro/.test(type)) Object.assign(C.outro, { title: P.title ?? C.outro.title, sub: P.sub ?? C.outro.sub, feats: P.feats ?? C.outro.feats });
  return [{ kind: "lyric", idx: 0, t0: 0, t1: D, dur: D, type, seg: { text: "" }, words: [], slot: { type, bg: P.bg || "void", media: [], trans: "cut", ...P } }];
}
function makeTimeline(segs, dur) {
  const only = onlyTimeline(dur); if (only) return only;
  if (LYR && Array.isArray(C.timeline) && C.timeline.length) return explicitTimeline(C.timeline, dur);
  if (LYR) {
    const FITS = {};
    for (const [t, c] of Object.entries(REG.scenes)) if (c.fits) FITS[t] = c.fits;
    const list = lyricTimeline(segs, dur, FITS);
    list.forEach((s, i) => { s.idx = i; if (s.kind === "intro") s.type = "intro"; if (s.kind === "outro") s.type = "outro"; });
    return list;
  }
  const scenes = buildTimeline(segs, dur);
  if (!scenes.length) return scenes;
  scenes.forEach((s, i) => {
    if (s.type === "intro" && i > 0) s.type = fbType;
    if (/^outro/.test(s.type) && i < scenes.length - 1) s.type = fbType;
  });
  if (C.intro.enabled && REG.scenes.intro) scenes[0].type = "intro";
  else if (scenes[0].type === "intro") scenes[0].type = fbType;
  if (C.outro.enabled && scenes.length > 1) {
    const last = scenes[scenes.length - 1];
    while (scenes.length > 2 && last.t1 - last.t0 < C.outro.minSec) {
      const prev = scenes.splice(scenes.length - 2, 1)[0];
      const shift = last.t0 - prev.t0;
      last.words.forEach(w => { w.rt += shift; });
      last.t0 = prev.t0;
    }
    last.dur = last.t1 - last.t0;
    last.type = "outro";
  } else if (/^outro/.test(scenes[scenes.length - 1].type)) scenes[scenes.length - 1].type = fbType;
  scenes.forEach((s, i) => { s.idx = i; });
  return scenes;
}
window.__promoInfo = { name: NAME, components: LOADED, warnings: WARN, outro: () => outroType(), scenes: () => scenes.map(s => ({ t0: s.t0, type: s.type === "outro" ? outroType() : s.type, text: s.seg.text, kind: s.kind })) };
/* ===================== FIN ORQUESTADOR ===================== */
