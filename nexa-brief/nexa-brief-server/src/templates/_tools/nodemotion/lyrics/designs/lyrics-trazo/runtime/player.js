/* lyrics-trazo · orquestador.
   1. Carga config.json → assets/config.json → DEFAULTS (contrato NodeMotion).
   2. Valida y completa la configuración (valores fuera de rango → por defecto + aviso).
   3. Resuelve los componentes activos (config.components + ?c=/cx/p de la vista previa).
   4. Registra las fuentes locales, lee la letra (formato Whisper) y arma la línea de tiempo.
   5. En cada cuadro dibuja el estado del segundo actual del <audio> (determinista).
   Los componentes viven en components/*.js y se registran en window.Trazo.registry. */
(function (root) {
  "use strict";
  const T = root.Trazo, K = T.core, R = T.registry;
  const doc = document, $ = id => doc.getElementById(id);
  /* espera de carga: usa el temporizador virtual del reloj HyperFrames si existe */
  const later = (fn, ms) => (root.__nbSetTimeout || root.setTimeout)(fn, ms);

  /* ------------------------------ por defecto ------------------------------ */
  const F = (family, file, lineHeight, scale) => ({ family, src: "assets/fonts/" + file, lineHeight, scale });
  const DEFAULTS = {
    id: "default",
    audio: { src: "assets/song.mp3" },
    lyricsUrl: "assets/lyrics.json",
    lyricsFilter: { dropPatterns: ["(?i)subt[ií]tulos", "(?i)amara\\.org", "(?i)thanks for watching"], maxWordSec: 3.5 },
    seed: 11,
    colors: { ink: "#FFFFFF", paper: "#050505", inkInverted: "#0B0B0B", paperInverted: "#F6F6F3" },
    fonts: {
      marker: F("Permanent Marker", "PermanentMarker-Regular.woff2", 1.0, 1),
      bubble: F("Rubik Bubbles", "RubikBubbles-Regular.woff2", 0.92, 1),
      brush: F("Knewave", "Knewave-Regular.woff2", 1.0, 1),
      chalk: F("Cabin Sketch", "CabinSketch-Bold.woff2", 0.95, 1),
      sketch: F("Fredericka the Great", "FrederickatheGreat-Regular.woff2", 1.0, 1),
      tall: F("Amatic SC", "AmaticSC-Bold.woff2", 0.86, 1),
      scratch: F("Rock Salt", "RockSalt-Regular.woff2", 1.25, 0.92),
      signature: F("Mrs Saint Delafield", "MrsSaintDelafield-Regular.woff2", 1.1, 1.1),
      scribble: F("Rubik Scribble", "RubikScribble-Regular.woff2", 0.92, 1),
      hatchfont: F("Rubik Marker Hatch", "RubikMarkerHatch-Regular.woff2", 0.92, 1),
      sketchcaps: F("Londrina Sketch", "LondrinaSketch-Regular.woff2", 0.92, 1),
      block: F("Londrina Solid", "LondrinaSolid-Black.woff2", 0.92, 1),
      graffiti: F("Sedgwick Ave Display", "SedgwickAveDisplay-Regular.woff2", 0.95, 1),
      thinbrush: F("Mansalva", "Mansalva-Regular.woff2", 1.0, 1),
      doodle: F("Rubik Doodle Shadow", "RubikDoodleShadow-Regular.woff2", 0.92, 1),
      caveat: F("Caveat Brush", "CaveatBrush-Regular.woff2", 0.95, 1)
    },
    styles: {
      "marker-caps": { font: "marker", treatment: "solid", case: "upper", weight: 3 },
      "bubble": { font: "bubble", treatment: "solid", case: "lower", weight: 2 },
      "brush": { font: "brush", treatment: "solid", case: "title", weight: 2 },
      "brush-outline": { font: "brush", treatment: "outline", case: "upper", weight: 1 },
      "chalk": { font: "chalk", treatment: "solid", case: "upper", weight: 2 },
      "sketch": { font: "sketch", treatment: "solid", case: "upper", weight: 1.5 },
      "tall": { font: "tall", treatment: "solid", case: "upper", weight: 2.5, tracking: 0.02 },
      "scratch": { font: "scratch", treatment: "solid", case: "lower", weight: 1.5 },
      "signature": { font: "signature", treatment: "solid", case: "title", weight: 1, dim: 0.82 },
      "scribble": { font: "scribble", treatment: "solid", case: "upper", weight: 1 },
      "hatch-fill": { font: "hatchfont", treatment: "solid", case: "upper", weight: 1 },
      "sketch-caps": { font: "sketchcaps", treatment: "solid", case: "upper", weight: 1.5 },
      "block-hatch": { font: "block", treatment: "hatch", case: "upper", weight: 1.5 },
      "block-shadow": { font: "block", treatment: "shadow", case: "upper", weight: 1 },
      "graffiti": { font: "graffiti", treatment: "solid", case: "lower", weight: 1.5 },
      "thin-brush": { font: "thinbrush", treatment: "solid", case: "lower", weight: 1.5 },
      "doodle": { font: "doodle", treatment: "solid", case: "upper", weight: 1 },
      "caveat": { font: "caveat", treatment: "solid", case: "lower", weight: 1.5 }
    },
    components: { intro: true, outro: "trazo.outrov1", interludes: true, burst: true, invert: true, hatch: true, doodles: true },
    intro: { title: "", artist: "", titleFont: "caveat", artistFont: "tall", minSec: 1.6 },
    outro: { title: "Gracias", sub: "por ver", feats: "Suscríbete · NodeMotion", titleFont: "bubble", subFont: "signature", featsFont: "tall", leadSec: 0.35, minSec: 2.6, maxSec: 6 },
    timing: { leadSec: 0.05, minWordSec: 0.16, maxMergeChars: 12, gapSec: 0.85, holdSec: 0.4 },
    size: { fill: 0.8, fillH: 0.6 },
    layouts: { deck: { line: 3, stack: 2, vertical: 0.8, stair: 0.7 }, stackMinLetters: 5, verticalMaxLetters: 5, portraitStackBoost: 2.2 },
    motion: { boilFps: 8, boil: 0.35, wobble: 2.2, grain: 0.5, punch: 0.1, drift: 0.05, shake: 0.5,
      deck: { punch: 3, drift: 2, pop: 1.5, recede: 1, shake: 0.6, none: 1 } },
    transitions: { flashSec: 0.08, zoomSec: 0.12, deck: { cut: 6, flash: 1.2, zoom: 1, shift: 0.6, blink: 0.6 } },
    invert: { chance: 0.12, minGap: 4 },
    hatch: { chance: 0.06 },
    doodles: { chance: 0.2, deck: { rays: 2, star: 2, underline: 1, circle: 1, arrow: 0.5 } },
    interludes: { minSec: 0.45, maxSec: 3, deck: { sun: 3, holes: 2, crack: 2, scribble: 2, spark: 1 } },
    burst: { minSec: 0.85, minLetters: 3, stepSec: 0.1, invertChance: 0.5, hatchChance: 0.2, words: [] },
    overrides: [],
    debug: { enabled: false }
  };

  /* componentes declarados (mismo contrato que info.json → components) */
  const DECLARED = [
    { name: "trazo.intro", key: "intro" },
    { name: "trazo.outrov1", group: "outro", default: true },
    { name: "trazo.outrov2", group: "outro" },
    { name: "trazo.interludios", key: "interludes" },
    { name: "trazo.rafaga", key: "burst" },
    { name: "trazo.inversion", key: "invert" },
    { name: "trazo.trama", key: "hatch" },
    { name: "trazo.garabatos", key: "doodles" }
  ];

  /* ------------------------------ validación ------------------------------ */
  const warn = (...a) => console.warn("[lyrics-trazo]", ...a);
  const isObj = v => v && typeof v === "object" && !Array.isArray(v);
  function num(v, d, lo, hi, path) {
    if (v === undefined) return d;
    const n = Number(v);
    if (!Number.isFinite(n) || n < lo || n > hi) { warn(`${path}=${JSON.stringify(v)} fuera de [${lo}, ${hi}] → ${d}`); return d; }
    return n;
  }
  function deck(v, d, allowed, path) {
    if (!isObj(v)) return { ...d };
    const out = {};
    for (const k in v) {
      if (!allowed.includes(k)) { warn(`${path}.${k} no existe (opciones: ${allowed.join(", ")})`); continue; }
      out[k] = num(v[k], 0, 0, 100, `${path}.${k}`);
    }
    return Object.values(out).some(x => x > 0) ? out : { ...d };
  }
  const color = (v, d, path) => (typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v.trim()) ? v.trim() : (v !== undefined && warn(`${path} no es un color #hex`), d));

  function validate(raw) {
    const D = DEFAULTS, C = {};
    raw = isObj(raw) ? raw : {};
    C.id = raw.id || "default";
    C.audio = { src: String(raw.audio?.src || D.audio.src) };
    C.lyricsUrl = String(raw.lyricsUrl || D.lyricsUrl);
    C.lyricsFilter = { dropPatterns: Array.isArray(raw.lyricsFilter?.dropPatterns) ? raw.lyricsFilter.dropPatterns.map(String) : D.lyricsFilter.dropPatterns,
      maxWordSec: num(raw.lyricsFilter?.maxWordSec, D.lyricsFilter.maxWordSec, 0.2, 30, "lyricsFilter.maxWordSec") };
    C.seed = Math.round(num(raw.seed, D.seed, 0, 2 ** 31, "seed"));
    C.colors = {};
    for (const k in D.colors) C.colors[k] = color(raw.colors?.[k], D.colors[k], "colors." + k);
    C.fonts = { ...D.fonts };
    if (isObj(raw.fonts)) for (const k in raw.fonts) {
      const f = raw.fonts[k];
      if (!isObj(f) || !f.family) { warn(`fonts.${k} necesita family`); continue; }
      C.fonts[k] = { family: String(f.family), src: f.src ? String(f.src) : "", lineHeight: num(f.lineHeight, 0.95, 0.5, 2, `fonts.${k}.lineHeight`), scale: num(f.scale, 1, 0.3, 3, `fonts.${k}.scale`) };
    }
    const fontKeys = Object.keys(C.fonts);
    const styleIn = isObj(raw.styles) ? raw.styles : D.styles;
    C.styles = {};
    for (const k in styleIn) {
      const s = styleIn[k];
      if (!isObj(s) || !fontKeys.includes(s.font)) { warn(`styles.${k}.font debe ser una de: ${fontKeys.join(", ")}`); continue; }
      C.styles[k] = { font: s.font,
        treatment: T.TREATMENTS.includes(s.treatment) ? s.treatment : (s.treatment && warn(`styles.${k}.treatment: ${T.TREATMENTS.join("|")}`), "solid"),
        case: ["upper", "lower", "title", "asis"].includes(s.case) ? s.case : "asis",
        weight: num(s.weight, 1, 0, 100, `styles.${k}.weight`), tracking: num(s.tracking, 0, -0.2, 0.5, `styles.${k}.tracking`),
        dim: s.dim === undefined ? 0 : num(s.dim, 1, 0.1, 1, `styles.${k}.dim`), scale: num(s.scale, 1, 0.3, 1.5, `styles.${k}.scale`) };
    }
    if (!Object.keys(C.styles).length) C.styles = JSON.parse(JSON.stringify(D.styles));
    const rc = isObj(raw.components) ? raw.components : {};
    C.components = { ...D.components };
    for (const k of ["intro", "interludes", "burst", "invert", "hatch", "doodles"]) if (rc[k] !== undefined) C.components[k] = !!rc[k];
    if (rc.outro !== undefined) C.components.outro = R.outros[rc.outro] ? rc.outro : (warn(`components.outro: ${Object.keys(R.outros).join("|")}`), D.components.outro);
    const sub = (k, extra) => ({ ...D[k], ...(isObj(raw[k]) ? raw[k] : {}), ...extra });
    C.intro = sub("intro");
    C.intro.minSec = num(C.intro.minSec, D.intro.minSec, 0.5, 20, "intro.minSec");
    C.outro = sub("outro");
    for (const k of ["leadSec", "minSec", "maxSec"]) C.outro[k] = num(C.outro[k], D.outro[k], 0, 30, "outro." + k);
    for (const k of ["titleFont", "subFont", "featsFont"]) if (!fontKeys.includes(C.outro[k])) { warn(`outro.${k} → ${D.outro[k]}`); C.outro[k] = D.outro[k]; }
    for (const k of ["titleFont", "artistFont"]) if (!fontKeys.includes(C.intro[k])) { warn(`intro.${k} → ${D.intro[k]}`); C.intro[k] = D.intro[k]; }
    C.timing = sub("timing");
    C.timing.leadSec = num(C.timing.leadSec, D.timing.leadSec, -0.5, 1, "timing.leadSec");
    C.timing.minWordSec = num(C.timing.minWordSec, D.timing.minWordSec, 0, 2, "timing.minWordSec");
    C.timing.maxMergeChars = num(C.timing.maxMergeChars, D.timing.maxMergeChars, 0, 40, "timing.maxMergeChars");
    C.timing.gapSec = num(C.timing.gapSec, D.timing.gapSec, 0.2, 10, "timing.gapSec");
    C.timing.holdSec = num(C.timing.holdSec, D.timing.holdSec, 0, 5, "timing.holdSec");
    C.size = { fill: num(raw.size?.fill, D.size.fill, 0.2, 1, "size.fill"), fillH: num(raw.size?.fillH, D.size.fillH, 0.2, 1, "size.fillH") };
    C.layouts = { deck: deck(raw.layouts?.deck, D.layouts.deck, T.LAYOUTS, "layouts.deck"),
      stackMinLetters: num(raw.layouts?.stackMinLetters, D.layouts.stackMinLetters, 2, 20, "layouts.stackMinLetters"),
      verticalMaxLetters: num(raw.layouts?.verticalMaxLetters, D.layouts.verticalMaxLetters, 2, 12, "layouts.verticalMaxLetters"),
      portraitStackBoost: num(raw.layouts?.portraitStackBoost, D.layouts.portraitStackBoost, 0, 10, "layouts.portraitStackBoost") };
    const m = raw.motion || {};
    C.motion = { boilFps: num(m.boilFps, D.motion.boilFps, 0, 30, "motion.boilFps"), boil: num(m.boil, D.motion.boil, 0, 3, "motion.boil"),
      wobble: num(m.wobble, D.motion.wobble, 0, 10, "motion.wobble"), grain: num(m.grain, D.motion.grain, 0, 1, "motion.grain"),
      punch: num(m.punch, D.motion.punch, 0, 1, "motion.punch"), drift: num(m.drift, D.motion.drift, 0, 0.5, "motion.drift"),
      shake: num(m.shake, D.motion.shake, 0, 3, "motion.shake"), deck: deck(m.deck, D.motion.deck, T.MOTIONS, "motion.deck") };
    const tr = raw.transitions || {};
    C.transitions = { flashSec: num(tr.flashSec, D.transitions.flashSec, 0, 1, "transitions.flashSec"), zoomSec: num(tr.zoomSec, D.transitions.zoomSec, 0.02, 1, "transitions.zoomSec"),
      deck: deck(tr.deck, D.transitions.deck, T.TRANSITIONS, "transitions.deck") };
    C.invert = { chance: num(raw.invert?.chance, D.invert.chance, 0, 1, "invert.chance"), minGap: num(raw.invert?.minGap, D.invert.minGap, 0, 50, "invert.minGap") };
    C.hatch = { chance: num(raw.hatch?.chance, D.hatch.chance, 0, 1, "hatch.chance") };
    C.doodles = { chance: num(raw.doodles?.chance, D.doodles.chance, 0, 1, "doodles.chance"), deck: deck(raw.doodles?.deck, D.doodles.deck, T.DOODLES, "doodles.deck") };
    C.interludes = { minSec: num(raw.interludes?.minSec, D.interludes.minSec, 0.1, 10, "interludes.minSec"), maxSec: num(raw.interludes?.maxSec, D.interludes.maxSec, 0.3, 20, "interludes.maxSec"),
      deck: deck(raw.interludes?.deck, D.interludes.deck, T.INTERLUDES, "interludes.deck") };
    const b = raw.burst || {};
    C.burst = { minSec: num(b.minSec, D.burst.minSec, 0.2, 10, "burst.minSec"), minLetters: num(b.minLetters, D.burst.minLetters, 1, 30, "burst.minLetters"),
      stepSec: num(b.stepSec, D.burst.stepSec, 0.04, 1, "burst.stepSec"), invertChance: num(b.invertChance, D.burst.invertChance, 0, 1, "burst.invertChance"),
      hatchChance: num(b.hatchChance, D.burst.hatchChance, 0, 1, "burst.hatchChance"), words: Array.isArray(b.words) ? b.words.map(w => norm(w)) : [] };
    C.overrides = (Array.isArray(raw.overrides) ? raw.overrides : []).filter(o => isObj(o) && (o.match || o.at !== undefined)).map(o => ({ ...o, match: o.match ? norm(o.match) : null }));
    for (const o of C.overrides) {
      if (o.style && !C.styles[o.style]) { warn(`overrides: estilo ${o.style} no existe`); delete o.style; }
      if (o.layout && !T.LAYOUTS.includes(o.layout)) { warn(`overrides: layout ${o.layout}`); delete o.layout; }
      if (o.motion && !R.motions[o.motion]) delete o.motion;
      if (o.transition && !R.transitions[o.transition]) delete o.transition;
      if (o.doodle && !R.doodles[o.doodle]) delete o.doodle;
    }
    C.debug = { enabled: !!raw.debug?.enabled };
    return C;
  }
  function norm(s) { return String(s || "").toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ' ]/g, "").trim(); }

  /* ------------------- selección de componentes (vista previa) ------------------- */
  function applySelection(C, params) {
    const picked = params.getAll("c").filter(Boolean);
    if (!picked.length) return;
    const known = new Map(DECLARED.map(d => [d.name, d]));
    const explicit = params.get("cx") === "1";
    if (explicit) for (const d of DECLARED) if (d.key) C.components[d.key] = false;
    const groups = new Set();
    for (const name of picked) {
      const d = known.get(name);
      if (!d) { warn(`componente desconocido: ${name}`); continue; }
      if (d.group) { if (groups.has(d.group)) { warn(`dos componentes del grupo ${d.group}: se ignora ${name}`); continue; } groups.add(d.group); C.components.outro = name; }
      else C.components[d.key] = true;
    }
    try {
      const p = params.get("p");
      if (p && new TextEncoder().encode(p).length <= 8192) {
        const obj = JSON.parse(p);
        const op = obj?.[C.components.outro];
        if (isObj(op)) for (const k of ["title", "sub", "feats"]) if (typeof op[k] === "string") C.outro[k] = op[k].slice(0, 60);
        const ip = obj?.["trazo.intro"];
        if (isObj(ip)) for (const k of ["title", "artist"]) if (typeof ip[k] === "string") C.intro[k] = ip[k].slice(0, 60);
      }
    } catch (e) { warn("parámetro p inválido"); }
  }

  /* ------------------------------ carga ------------------------------ */
  async function fetchJSON(url) { try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { /* siguiente */ } return null; }
  async function loadConfig() {
    const db = (await fetchJSON("config.json")) || (await fetchJSON("assets/config.json"));
    if (!db) { warn("config.json no disponible — se usan los valores por defecto"); return validate(DEFAULTS); }
    const list = Array.isArray(db.configs) ? db.configs : [db];
    return validate(list.find(c => c.id === db.activeId) || list[0]);
  }
  async function loadFonts(C) {
    const jobs = Object.values(C.fonts).filter(f => f.src).map(f => {
      try {
        const face = new FontFace(f.family, `url("${encodeURI(f.src)}")`);
        doc.fonts.add(face);
        return face.load().catch(() => warn(`fuente no cargada: ${f.family} (${f.src})`));
      } catch (e) { warn(`fuente inválida: ${f.family}`); return null; }
    });
    await Promise.race([Promise.all(jobs), new Promise(res => later(res, 6000))]);
  }
  /* letra Whisper → lista plana de palabras {text, start, end} */
  async function loadLyrics(C) {
    const data = await fetchJSON(C.lyricsUrl);
    if (!data) { warn(`no se pudo leer la letra (${C.lyricsUrl})`); return []; }
    const drops = C.lyricsFilter.dropPatterns.map(p => { try { const ci = p.startsWith("(?i)"); return new RegExp(ci ? p.slice(4) : p, ci ? "i" : ""); } catch (e) { warn(`lyricsFilter: patrón inválido ${p}`); return null; } }).filter(Boolean);
    const out = [];
    for (const seg of data.segments || []) {
      if (drops.some(rx => rx.test(seg.text || ""))) continue;
      let words = Array.isArray(seg.words) && seg.words.length ? seg.words.map(w => ({ text: w.word, start: +w.start, end: +w.end })) : null;
      if (!words) {
        const toks = String(seg.text || "").trim().split(/\s+/).filter(Boolean);
        const s0 = +seg.start, s1 = +seg.end, step = (s1 - s0) / Math.max(1, toks.length);
        words = toks.map((t, i) => ({ text: t, start: s0 + i * step, end: s0 + (i + 1) * step }));
      }
      for (const w of words) {
        const text = String(w.text || "").trim().replace(/^[^\p{L}\p{N}¿¡']+|[^\p{L}\p{N}?!']+$/gu, "");
        if (!text || !Number.isFinite(w.start) || !Number.isFinite(w.end) || drops.some(rx => rx.test(text))) continue;
        out.push({ text, start: w.start, end: Math.max(w.start + 0.05, Math.min(w.end, w.start + C.lyricsFilter.maxWordSec)) });
      }
    }
    out.sort((a, b) => a.start - b.start);
    return out;
  }

  /* --------------------------- línea de tiempo --------------------------- */
  function buildTimeline(words, dur, C, aspect = 9 / 16) {
    const r = K.rng(C.seed), tm = C.timing, comp = C.components;
    const scenes = [];
    const recent = { style: [], interlude: [] };
    let sinceInv = 99, idx = 0;
    const push = sc => { sc.seed = (C.seed * 1000 + (idx++) * 7919) >>> 0; scenes.push(sc); return sc; };
    const interlude = (t0, t1, hint) => {
      if (!comp.interludes || t1 - t0 < C.interludes.minSec) return false;
      let t = t0;
      while (t1 - t > C.interludes.minSec * 0.6) {
        const len = Math.min(C.interludes.maxSec, t1 - t);
        const dk = { ...C.interludes.deck };
        if (len < 0.9) { delete dk.holes; delete dk.crack; }
        const kind = hint && dk[hint] ? hint : r.weighted(dk, recent.interlude);
        recent.interlude = [kind];
        push({ kind: "interlude", type: kind, t0: t, t1: t + len, inverted: kind === "scribble" ? r() < 0.4 : undefined });
        t += len; hint = null;
      }
      return true;
    };
    /* palabras demasiado cortas se juntan con la siguiente */
    const units = [];
    for (let i = 0; i < words.length; i++) {
      const u = { text: words[i].text, start: words[i].start, end: words[i].end, n: 1 };
      while (i + 1 < words.length && u.n < 2 && (words[i + 1].start - u.start) < tm.minWordSec &&
             (u.text.length + words[i + 1].text.length) <= tm.maxMergeChars) { i++; u.text += " " + words[i].text; u.end = words[i].end; u.n++; }
      units.push(u);
    }
    const first = units.length ? units[0].start - tm.leadSec : dur;
    if (comp.intro && first >= C.intro.minSec) push({ kind: "intro", t0: 0, t1: first });
    else if (first > 0.3) interlude(0, first, "sun");

    /* cierre: termina con la canción y nunca tapa la letra */
    const lastEnd = units.length ? units[units.length - 1].end : 0;
    let outroT0 = Math.max(lastEnd + C.outro.leadSec, dur - C.outro.maxSec);
    if (dur - outroT0 < C.outro.minSec) outroT0 = Math.max(lastEnd + 0.1, dur - C.outro.minSec);

    units.forEach((u, i) => {
      const t0 = Math.max(0, u.start - tm.leadSec);
      if (t0 >= outroT0) return;
      const next = i + 1 < units.length ? units[i + 1].start - tm.leadSec : outroT0;
      let t1 = Math.min(next, outroT0);
      let gapStart = null;
      if (next - u.end > tm.gapSec) { gapStart = Math.min(t1, u.end + tm.holdSec); t1 = gapStart; }
      const key = norm(u.text);
      const ov = C.overrides.find(o => (o.match && o.match === key) || (o.at !== undefined && Math.abs(o.at - u.start) < 0.25)) || {};
      const letters = [...u.text.replace(/\s+/g, "")].length;
      const sustained = (u.end - u.start) >= C.burst.minSec && letters >= C.burst.minLetters;
      const wantBurst = ov.burst !== undefined ? !!ov.burst : (comp.burst && u.n === 1 && (sustained || C.burst.words.includes(key)));
      if (wantBurst && t1 - t0 >= C.burst.stepSec * 4) {
        const n = Math.floor((t1 - t0) / C.burst.stepSec);
        const steps = []; let li = 0;
        const chars = [...u.text.replace(/\s+/g, "")];
        let inv = r() < 0.5;
        for (let k = 0; k < n; k++) {
          const style = C.styles[r.weighted(Object.fromEntries(Object.entries(C.styles).map(([id, s]) => [id, s.weight])))];
          if (comp.invert && r() < C.burst.invertChance) inv = !inv;
          const whole = k % 3 === 0;
          steps.push({ letter: !whole, text: whole ? u.text : chars[li++ % chars.length], style, layout: whole ? r.pick(["line", "stack"]) : "line",
            inverted: comp.invert ? inv : false, hatch: comp.hatch && r() < C.burst.hatchChance });
        }
        push({ kind: "burst", text: u.text, t0, t1: t0 + n * C.burst.stepSec, stepSec: C.burst.stepSec, steps });
        if (t0 + n * C.burst.stepSec < t1) scenes[scenes.length - 1].t1 = t1;
      } else {
        const styleId = ov.style || r.weighted(Object.fromEntries(Object.entries(C.styles).map(([id, s]) => [id, s.weight])), recent.style);
        recent.style.push(styleId); if (recent.style.length > 2) recent.style.shift();
        const ld = { ...C.layouts.deck };
        if (!(letters <= C.layouts.verticalMaxLetters && u.n === 1 && letters >= 2)) delete ld.vertical;
        if (letters < C.layouts.stackMinLetters && u.n === 1) { delete ld.stack; delete ld.stair; }
        /* la orientación cambia el reparto: en vertical se apila más, en horizontal se escribe en línea */
        if (aspect < 0.85 && letters >= C.layouts.stackMinLetters) { if (ld.stack) ld.stack *= C.layouts.portraitStackBoost; if (ld.line) ld.line *= 0.6; }
        if (aspect > 1.2) { if (ld.vertical) ld.vertical *= 0.3; if (ld.stack) ld.stack *= 0.6; if (ld.line) ld.line *= 1.6; }
        const layout = ov.layout || (Object.keys(ld).length ? r.weighted(ld) : "line");
        let inverted = false;
        if (ov.inverted !== undefined) inverted = !!ov.inverted;
        else if (comp.invert && sinceInv >= C.invert.minGap && r() < C.invert.chance) inverted = true;
        sinceInv = inverted ? 0 : sinceInv + 1;
        const hatch = ov.hatch !== undefined ? !!ov.hatch : (comp.hatch && r() < C.hatch.chance);
        const doodle = ov.doodle || (comp.doodles && r() < C.doodles.chance ? r.weighted(C.doodles.deck) : null);
        push({ kind: "word", text: u.text, t0, t1, style: C.styles[styleId], styleId, layout, inverted, hatch, doodle,
          motion: ov.motion || r.weighted(C.motion.deck), transition: ov.transition || r.weighted(C.transitions.deck) });
      }
      if (gapStart !== null) interlude(gapStart, Math.min(next, outroT0));
    });
    if (!units.length) warn("letra vacía: solo intro y cierre");
    const fill = scenes.length ? scenes[scenes.length - 1].t1 : 0;
    if (outroT0 - fill > 0.3) interlude(fill, outroT0);
    push({ kind: "outro", id: comp.outro, t0: outroT0, t1: Math.max(dur, outroT0 + C.outro.minSec) });
    scenes.sort((a, b) => a.t0 - b.t0);
    return scenes;
  }

  /* ------------------------------ arranque ------------------------------ */
  async function boot() {
    const params = new URLSearchParams(location.search);
    const C = await loadConfig();
    applySelection(C, params);
    const stage = $("stage"), ink = $("ink"), audio = $("audio"), hud = $("hud");
    const DEBUG = C.debug.enabled || params.get("debug") === "1";
    const FROZEN = params.has("t") ? Math.max(0, parseFloat(params.get("t")) || 0) : null;
    const rs = doc.documentElement.style;
    rs.setProperty("--ink", C.colors.ink); rs.setProperty("--paper", C.colors.paper);
    rs.setProperty("--ink-inv", C.colors.inkInverted); rs.setProperty("--paper-inv", C.colors.paperInverted);

    /* tinta: filtro de temblor (3 variantes) + máscara de grano */
    const defs = $("tz-defs");
    for (let i = 0; i < 3; i++) {
      defs.insertAdjacentHTML("beforeend",
        `<filter id="tz-ink-${i}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="${C.seed + i * 3}" result="n"/>` +
        `<feDisplacementMap in="SourceGraphic" in2="n" scale="${C.motion.wobble}" xChannelSelector="R" yChannelSelector="G"/></filter>`);
    }
    if (C.motion.grain > 0) {
      const g = K.grainTexture(C.seed, 192, C.motion.grain);
      ink.style.webkitMaskImage = ink.style.maskImage = `url(${g})`;
      ink.style.webkitMaskSize = ink.style.maskSize = "192px 192px";
    }

    audio.src = encodeURI(C.audio.src);
    let audioStarted = false;
    audio.addEventListener("playing", () => { audioStarted = true; });
    if (FROZEN == null) audio.play().catch(() => { /* sin autoplay: reloj de pared hasta que alguien dé play */ });

    const durReady = new Promise(res => {
      if (isFinite(audio.duration) && audio.duration > 0) return res(audio.duration);
      audio.addEventListener("loadedmetadata", () => res(audio.duration), { once: true });
      audio.addEventListener("error", () => res(NaN), { once: true });
      later(() => res(NaN), 4000);
    });
    const [words, audioDur] = await Promise.all([loadLyrics(C), durReady, loadFonts(C)]);
    K.measureCache.clear();
    const dur = isFinite(audioDur) && audioDur > 0 ? audioDur : (words.length ? words[words.length - 1].end + 3 : 30);
    let W = innerWidth, H = innerHeight;
    let scenes = buildTimeline(words, dur, C, W / H);
    const ctxOf = () => ({ W, H, u: Math.min(W, H) / 100, C, fonts: C.fonts });
    let ctx = ctxOf();
    let cur = null, curIdx = -1, lastFilter = -1;
    const sceneAt = t => { let lo = 0, hi = scenes.length - 1, ans = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (scenes[m].t0 <= t) { ans = m; lo = m + 1; } else hi = m - 1; } return ans; };
    function build(sc) {
      if (sc.kind === "intro") return R.intro(sc, ctx);
      if (sc.kind === "outro") return (R.outros[sc.id] || R.outros["trazo.outrov1"])(sc, ctx);
      if (sc.kind === "interlude") return R.interludes[sc.type](sc, ctx);
      return R.scenes[sc.kind](sc, ctx);
    }
    function render(t) {
      const boilStep = C.motion.boilFps > 0 ? Math.floor(t * C.motion.boilFps) : 0;
      let i = sceneAt(t);
      if (i < 0) i = 0;
      if (i !== curIdx) {
        if (cur) cur.root.remove();
        cur = build(scenes[i]); curIdx = i;
        ink.appendChild(cur.root);
      }
      const sc = scenes[i];
      const lt = Math.min(Math.max(0, t - sc.t0), sc.t1 - sc.t0);
      const st = cur.update(lt, { boilStep, t }) || {};
      stage.classList.toggle("inv", !!st.inv);
      if (C.motion.wobble > 0) {
        const f = boilStep % 3;
        if (f !== lastFilter) { ink.style.filter = `url(#tz-ink-${f})`; lastFilter = f; }
      }
      if (C.motion.grain > 0) ink.style.webkitMaskPosition = ink.style.maskPosition = `${(boilStep * 53) % 192}px ${(boilStep * 97) % 192}px`;
      if (DEBUG) hud.textContent = `t ${t.toFixed(2)} · #${i} ${sc.kind}${sc.type ? ":" + sc.type : ""} · ${sc.styleId || ""} ${sc.layout || ""} ${sc.motion || ""}/${sc.transition || ""} · "${sc.text || ""}"`;
    }
    let wall0 = null, forced = FROZEN;
    const clock = now => forced != null ? forced : (audioStarted || audio.currentTime > 0) ? audio.currentTime : (now - wall0) / 1000;
    function frame(now) {
      if (wall0 === null) wall0 = now;
      render(clock(now));
      if (forced == null) requestAnimationFrame(frame);
    }
    addEventListener("resize", () => { W = innerWidth; H = innerHeight; ctx = ctxOf(); scenes = buildTimeline(words, dur, C, W / H); K.measureCache.clear(); if (cur) cur.root.remove(); cur = null; curIdx = -1; if (forced != null) render(forced); });
    if (DEBUG) hud.style.display = "block";
    root.__trazo = { config: C, scenes: () => scenes, seek(t) { forced = t; render(t); }, release() { forced = null; requestAnimationFrame(frame); }, duration: dur };
    requestAnimationFrame(frame);
  }

  T.player = { DEFAULTS, DECLARED, validate, buildTimeline, loadLyrics, loadFonts, norm };
  if (!root.__TRAZO_NO_BOOT) boot().catch(e => console.error("[lyrics-trazo] fallo de arranque", e));
})(typeof window !== "undefined" ? window : globalThis);
