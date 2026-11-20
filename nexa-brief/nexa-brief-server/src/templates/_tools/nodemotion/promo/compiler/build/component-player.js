/* ================= ORQUESTADOR COMPARTIDO DE COMPONENTES (promo-*) =================
   Pieza común del compilador de promos para diseños hechos por componentes
   (estándar desde promo-mono, 2026-11-14; mismo contrato que promo-pulse).
   Se concatena detrás de core.js y de un archivo del diseño que declara
     const COMPONENT_FILES = ["kit.js", ...];   // orden de carga de ./components/
   Si el diseño no lo declara, usa la lista histórica de promo-pulse.
   No dibuja nada: carga los componentes, valida el config, arma el mapa de
   escenas `B`, aplica transiciones y decide intro / outro. Todo el contenido
   (textos, medios, colores, orden de escenas, animaciones) sale del JSON.
   Contrato de componentes (cada archivo registra piezas en window[REG_NAME]):
     REG.kit          funciones de dibujo compartidas
     REG.scenes[tipo] = { label, params: {clave: S.num|S.enum|S.bool|S.str}, render(sc, X, K) }
     REG.transitions[nombre] = (X, d, K) => void
     REG.hud(X, K)    capa fija opcional encima de cada escena
     REG.meta         { fallback, textIn, look: {clave: spec} }
   ?outro=v1|v2 en la URL fuerza el outro (vista de la galería). */
const REG_NAME = "NexaPromo_" + NAME.replace(/-/g, "_");
const S = {
  num: (min, max, def) => ({ t: "num", min, max, def }),
  enum: (of, def) => ({ t: "enum", of, def }),
  bool: def => ({ t: "bool", def }),
  str: (max, def = "") => ({ t: "str", max, def }),
};
const REG = window[REG_NAME] = window[REG_NAME] || {};
Object.assign(REG, { S, scenes: REG.scenes || {}, transitions: REG.transitions || {}, kit: REG.kit || {}, meta: REG.meta || {} });

/* ---------------- carga de componentes ---------------- */
const COMPONENTS = typeof COMPONENT_FILES !== "undefined" ? COMPONENT_FILES
  : ["kit.js", "transiciones.js", "intro.js", "escenas.js", "outro-v1.js", "outro-v2.js"];
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
const TEXT_IN = ["type", "rise", "squash", "pop", "slam", "wipe", "fade", "cut"];
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
  C.scenes = (Array.isArray(C.scenes) && C.scenes.length ? C.scenes : [{ type: fb }]).map((s, i) => {
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
const K = { div, tx, fit, textW, measure, mbox, kenBurns, canvasText, blurPass, mediaSpec, asStill, enterFx, mulberry32, clamp,
  EASE_OUT, EASE_IN, EASE_IO, EASE_BACK, C, P, BR, REG, lines, hide, warn };

/* ---------------- escenas + transición + HUD ---------------- */
function outroType() { return C.outro.version === "v2" && REG.scenes.outroV2 ? "outroV2" : REG.scenes.outroV1 ? "outroV1" : REG.meta.fallback; }
function defaults(params) { const o = {}; for (const [k, s] of Object.entries(params || {})) o[k] = s.def; return o; }
function runScene(type, sc, X) {
  const comp = REG.scenes[type] || REG.scenes[REG.meta.fallback];
  X.p = { ...defaults(comp.params), ...sc.slot };
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
function makeTimeline(segs, dur) {
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
window.__promoInfo = { name: NAME, components: LOADED, warnings: WARN, outro: () => outroType(), scenes: () => scenes.map(s => ({ t0: s.t0, type: s.type === "outro" ? outroType() : s.type, text: s.seg.text })) };
/* ================= FIN ORQUESTADOR COMPARTIDO ================= */
