/* lyrics-grunge-rojo · orquestador.
   1. Carga config.json → assets/config.json → DEFAULTS (contrato NodeMotion) y la valida.
   2. Resuelve componentes (config.components + ?c=/cx/p).
   3. Registra fuentes, genera texturas, prepara los <video> B/N (uno por medio, reutilizados).
   4. Agrupa la letra en fragmentos; cada uno recibe escena, variante y transición del mazo.
      Los silencios largos se llenan con «repaso» de frases ya cantadas e interludios.
   5. En cada cuadro dibuja el segundo de audio.currentTime y sincroniza el video visible. */
(function (root) {
  "use strict";
  const G = root.GrungeRojo, K = G.core, R = G.registry;
  const doc = document, $ = id => doc.getElementById(id);
  const later = (fn, ms) => (root.__nbSetTimeout || root.setTimeout)(fn, ms);
  const warn = (...a) => console.warn("[lyrics-grunge-rojo]", ...a);
  const isObj = v => v && typeof v === "object" && !Array.isArray(v);
  const CLIPS = ["tunnel-dance", "street-dance", "hoodie", "crowd", "breakdance", "night-hoodie"];

  const DEFAULTS = {
    id: "default",
    audio: { src: "assets/song.mp3" },
    lyricsUrl: "assets/lyrics.json",
    lyricsFilter: { dropPatterns: ["(?i)audio ?jungle", "(?i)envato", "(?i)oriel", "(?i)subt[ií]tulos", "(?i)amara\\.org"], maxWordSec: 3 },
    seed: 29,
    colors: { red: "#E8292E", white: "#F1F1EF", black: "#070707", paper: "#BDBDBA", paperLight: "#D6D6D2", chalk: "#F5F5F2" },
    fonts: {
      condensed: { family: "Anton", src: "assets/fonts/Anton-Regular.woff2", weight: 400, stretch: 100, tracking: 0 },
      thin: { family: "Oswald", src: "assets/fonts/Oswald.woff2", variable: "wght", weight: 300, stretch: 100, tracking: 0.3 },
      wide: { family: "Archivo", src: "assets/fonts/Archivo.woff2", variable: "wdth", weight: 900, stretch: 125, tracking: 0.02 }
    },
    media: CLIPS.map(n => ({ type: "video", src: `assets/media/${n}.bw.mp4`, poster: `assets/media/${n}-1.bw.jpg` })),
    components: { intro: true, outro: "grunge.outrov1", paper: true, doodles: true, fog: true, grain: true, distress: true, recap: true },
    intro: { title: "", artist: "", minSec: 1.6 },
    outro: { title: "Gracias", sub: "por ver", feats: "Suscríbete · NodeMotion", leadSec: 0.4, minSec: 3, maxSec: 6 },
    timing: { leadSec: 0.05, maxWords: 4, maxChars: 22, wordGapSec: 0.5, gapSec: 1.2, holdSec: 0.5 },
    scenes: { deck: { linea: 3, espaciada: 1.2, gigante: 1.4, hud: 0.8, pila: 1, marco: 0.8, eco: 0.9, ancho: 1, dupla: 1, flecha: 0.8, rojo: 1 }, cooldown: 2 },
    variants: { redChance: 0.55, doodleChance: 0.35, stripChance: 0.35, footageChance: 0.9,
      doodles: { circle: 2, strike: 1.2, underline: 1, arrow: 1, crown: 0.6, bolt: 0.6, slash: 0.8 } },
    transitions: { sec: 0.18, deck: { cut: 4, tear: 1, glitch: 1.4, flash: 1, redflash: 0.6, blur: 1 } },
    motion: { enterSec: 0.14, smear: 0.9, doodleSec: 0.3, videoRate: 1, grain: 0.6, distress: 0.5 },
    interludes: { minSec: 0.8, maxSec: 3, deck: { metraje: 1.4, franjas: 1, rejilla: 1 } },
    recap: { minGapSec: 4, stepSec: 1.7, interludeEvery: 3 },
    overrides: [],
    debug: { enabled: false }
  };
  const DECLARED = [
    { name: "grunge.intro", key: "intro" },
    { name: "grunge.outrov1", group: "outro", default: true },
    { name: "grunge.outrov2", group: "outro" },
    { name: "grunge.papel", key: "paper" },
    { name: "grunge.garabatos", key: "doodles" },
    { name: "grunge.niebla", key: "fog" },
    { name: "grunge.grano", key: "grain" },
    { name: "grunge.desgaste", key: "distress" },
    { name: "grunge.repaso", key: "recap" }
  ];

  function num(v, d, lo, hi, path) {
    if (v === undefined) return d;
    const n = Number(v);
    if (!Number.isFinite(n) || n < lo || n > hi) { warn(`${path}=${JSON.stringify(v)} fuera de [${lo}, ${hi}] → ${d}`); return d; }
    return n;
  }
  function deck(v, d, allowed, path) {
    if (!isObj(v)) return { ...d };
    const out = {};
    for (const k in v) { if (!allowed.includes(k)) { warn(`${path}.${k} no existe (opciones: ${allowed.join(", ")})`); continue; } out[k] = num(v[k], 0, 0, 100, `${path}.${k}`); }
    return Object.values(out).some(x => x > 0) ? out : { ...d };
  }
  const color = (v, d, path) => (typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v.trim()) ? v.trim() : (v !== undefined && warn(`${path} no es un color #hex`), d));
  function norm(s) { return String(s || "").toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ' ]/g, "").trim(); }

  function validate(raw) {
    const D = DEFAULTS, C = {};
    raw = isObj(raw) ? raw : {};
    C.id = raw.id || "default";
    C.audio = { src: String(raw.audio?.src || D.audio.src) };
    C.lyricsUrl = String(raw.lyricsUrl || D.lyricsUrl);
    C.lyricsFilter = { dropPatterns: Array.isArray(raw.lyricsFilter?.dropPatterns) ? raw.lyricsFilter.dropPatterns.map(String) : D.lyricsFilter.dropPatterns,
      maxWordSec: num(raw.lyricsFilter?.maxWordSec, D.lyricsFilter.maxWordSec, 0.2, 30, "lyricsFilter.maxWordSec") };
    C.seed = Math.round(num(raw.seed, D.seed, 0, 2 ** 31, "seed"));
    C.colors = {}; for (const k in D.colors) C.colors[k] = color(raw.colors?.[k], D.colors[k], "colors." + k);
    C.fonts = {};
    for (const k of ["condensed", "thin", "wide"]) {
      const f = { ...D.fonts[k], ...(isObj(raw.fonts?.[k]) ? raw.fonts[k] : {}) };
      C.fonts[k] = { family: String(f.family), src: f.src ? String(f.src) : "", variable: f.variable || "",
        weight: num(f.weight, D.fonts[k].weight, 100, 1000, `fonts.${k}.weight`), stretch: num(f.stretch, D.fonts[k].stretch, 50, 200, `fonts.${k}.stretch`),
        tracking: num(f.tracking, D.fonts[k].tracking, -0.2, 1, `fonts.${k}.tracking`) };
    }
    const media = Array.isArray(raw.media) ? raw.media : D.media;
    C.media = media.filter(m => isObj(m) && (m.type === "video" || m.type === "image") && typeof m.src === "string" && m.src)
      .map(m => ({ type: m.type, src: m.src, poster: m.type === "image" ? m.src : (typeof m.poster === "string" ? m.poster : ""), start: num(m.start, 0, 0, 3600, "media.start") }));
    if (!C.media.length) warn("media vacío: escenas sobre fondo oscuro");
    const rc = isObj(raw.components) ? raw.components : {};
    C.components = { ...D.components };
    for (const k of ["intro", "paper", "doodles", "fog", "grain", "distress", "recap"]) if (rc[k] !== undefined) C.components[k] = !!rc[k];
    if (rc.outro !== undefined) C.components.outro = R.outros[rc.outro] ? rc.outro : (warn(`components.outro: ${Object.keys(R.outros).join("|")}`), D.components.outro);
    C.intro = { ...D.intro, ...(isObj(raw.intro) ? raw.intro : {}) };
    C.intro.minSec = num(C.intro.minSec, D.intro.minSec, 0.5, 20, "intro.minSec");
    C.outro = { ...D.outro, ...(isObj(raw.outro) ? raw.outro : {}) };
    for (const k of ["leadSec", "minSec", "maxSec"]) C.outro[k] = num(C.outro[k], D.outro[k], 0, 30, "outro." + k);
    const t = raw.timing || {};
    C.timing = { leadSec: num(t.leadSec, D.timing.leadSec, -0.5, 1, "timing.leadSec"), maxWords: Math.round(num(t.maxWords, D.timing.maxWords, 1, 8, "timing.maxWords")),
      maxChars: num(t.maxChars, D.timing.maxChars, 4, 60, "timing.maxChars"), wordGapSec: num(t.wordGapSec, D.timing.wordGapSec, 0.1, 5, "timing.wordGapSec"),
      gapSec: num(t.gapSec, D.timing.gapSec, 0.3, 10, "timing.gapSec"), holdSec: num(t.holdSec, D.timing.holdSec, 0, 5, "timing.holdSec") };
    C.scenes = { deck: deck(raw.scenes?.deck, D.scenes.deck, G.SCENES, "scenes.deck"), cooldown: Math.round(num(raw.scenes?.cooldown, D.scenes.cooldown, 0, 5, "scenes.cooldown")) };
    const v = raw.variants || {};
    C.variants = { redChance: num(v.redChance, D.variants.redChance, 0, 1, "variants.redChance"), doodleChance: num(v.doodleChance, D.variants.doodleChance, 0, 1, "variants.doodleChance"),
      stripChance: num(v.stripChance, D.variants.stripChance, 0, 1, "variants.stripChance"), footageChance: num(v.footageChance, D.variants.footageChance, 0, 1, "variants.footageChance"),
      doodles: deck(v.doodles, D.variants.doodles, G.DOODLES, "variants.doodles") };
    const tr = raw.transitions || {};
    C.transitions = { sec: num(tr.sec, D.transitions.sec, 0.04, 1.5, "transitions.sec"), deck: deck(tr.deck, D.transitions.deck, G.TRANSITIONS, "transitions.deck") };
    const m = raw.motion || {};
    C.motion = {};
    for (const [k, lo, hi] of [["enterSec", 0, 1], ["smear", 0, 3], ["doodleSec", 0.05, 2], ["videoRate", 0.25, 2], ["grain", 0, 1], ["distress", 0, 1]]) C.motion[k] = num(m[k], D.motion[k], lo, hi, "motion." + k);
    C.interludes = { minSec: num(raw.interludes?.minSec, D.interludes.minSec, 0.2, 10, "interludes.minSec"), maxSec: num(raw.interludes?.maxSec, D.interludes.maxSec, 0.5, 20, "interludes.maxSec"),
      deck: deck(raw.interludes?.deck, D.interludes.deck, G.INTERLUDES, "interludes.deck") };
    const rp = raw.recap || {};
    C.recap = { minGapSec: num(rp.minGapSec, D.recap.minGapSec, 1, 60, "recap.minGapSec"), stepSec: num(rp.stepSec, D.recap.stepSec, 0.6, 6, "recap.stepSec"),
      interludeEvery: Math.round(num(rp.interludeEvery, D.recap.interludeEvery, 0, 20, "recap.interludeEvery")) };
    C.overrides = (Array.isArray(raw.overrides) ? raw.overrides : []).filter(o => isObj(o) && (o.match || o.at !== undefined)).map(o => ({ ...o, match: o.match ? norm(o.match) : null }));
    for (const o of C.overrides) {
      if (o.scene && !R.scenes[o.scene]) { warn(`overrides: escena ${o.scene} no existe`); delete o.scene; }
      if (o.transition && !R.transitions[o.transition]) { warn(`overrides: transición ${o.transition}`); delete o.transition; }
      if (o.doodle && !R.doodles[o.doodle]) { warn(`overrides: garabato ${o.doodle}`); delete o.doodle; }
    }
    C.debug = { enabled: !!raw.debug?.enabled };
    return C;
  }

  function applySelection(C, params) {
    const picked = params.getAll("c").filter(Boolean);
    if (!picked.length) return;
    const known = new Map(DECLARED.map(d => [d.name, d]));
    if (params.get("cx") === "1") for (const d of DECLARED) if (d.key) C.components[d.key] = false;
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
        const ip = obj?.["grunge.intro"];
        if (isObj(ip)) for (const k of ["title", "artist"]) if (typeof ip[k] === "string") C.intro[k] = ip[k].slice(0, 60);
      }
    } catch (e) { warn("parámetro p inválido"); }
  }

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
        const desc = f.variable === "wdth" ? { weight: "100 900", stretch: "62% 125%" } : f.variable === "wght" ? { weight: "200 700" } : {};
        const face = new FontFace(f.family, `url("${encodeURI(f.src)}")`, desc);
        doc.fonts.add(face);
        return face.load().catch(() => warn(`fuente no cargada: ${f.family} (${f.src})`));
      } catch (e) { warn(`fuente inválida: ${f.family}`); return null; }
    });
    await Promise.race([Promise.all(jobs), new Promise(res => later(res, 6000))]);
  }
  async function loadLyrics(C) {
    const data = await fetchJSON(C.lyricsUrl);
    if (!data) { warn(`no se pudo leer la letra (${C.lyricsUrl})`); return []; }
    const drops = C.lyricsFilter.dropPatterns.map(p => { try { const ci = p.startsWith("(?i)"); return new RegExp(ci ? p.slice(4) : p, ci ? "i" : ""); } catch (e) { warn(`patrón inválido ${p}`); return null; } }).filter(Boolean);
    const out = [];
    (data.segments || []).forEach((seg, si) => {
      if (drops.some(rx => rx.test(seg.text || ""))) return;
      let words = Array.isArray(seg.words) && seg.words.length ? seg.words.map(w => ({ text: w.word, start: +w.start, end: +w.end })) : null;
      if (!words) {
        const toks = String(seg.text || "").trim().split(/\s+/).filter(Boolean), step = (+seg.end - +seg.start) / Math.max(1, toks.length);
        words = toks.map((t, i) => ({ text: t, start: +seg.start + i * step, end: +seg.start + (i + 1) * step }));
      }
      for (const w of words) {
        const text = String(w.text || "").trim().replace(/^[^\p{L}\p{N}¿¡'*]+|[^\p{L}\p{N}?!'*]+$/gu, "");
        if (!text || !Number.isFinite(w.start) || !Number.isFinite(w.end) || drops.some(rx => rx.test(text))) continue;
        /* contracciones que Whisper separa («y» + «'all») vuelven a ser una palabra */
        const prev = out[out.length - 1];
        if (/^'/.test(String(w.text || "").trim()) && prev && prev.seg === si) { prev.text += text; prev.end = Math.max(prev.end, w.end); continue; }
        out.push({ text, start: w.start, end: Math.max(w.start + 0.05, Math.min(w.end, w.start + C.lyricsFilter.maxWordSec)), seg: si });
      }
    });
    out.sort((a, b) => a.start - b.start);
    return out;
  }

  /* palabras → fragmentos → escenas */
  function buildTimeline(words, dur, C, nClips) {
    const r = K.rng(C.seed), tm = C.timing, comp = C.components;
    const chunks = [];
    for (const w of words) {
      const c = chunks[chunks.length - 1];
      const chars = c ? c.words.map(x => x.text).join(" ").length + 1 + w.text.length : 0;
      if (!c || c.words.length >= tm.maxWords || chars > tm.maxChars || w.seg !== c.seg || w.start - c.words[c.words.length - 1].end > tm.wordGapSec) chunks.push({ seg: w.seg, words: [w] });
      else c.words.push(w);
    }
    const scenes = []; let idx = 0, lastClip = -1;
    const recent = [], sung = [];
    const push = sc => { sc.seed = (C.seed * 1000 + (idx++) * 7919) >>> 0; scenes.push(sc); return sc; };
    const clip = () => { if (!nClips) return -1; let c = r.int(0, nClips - 1); if (c === lastClip && nClips > 1) c = (c + 1) % nClips; lastClip = c; return c; };
    const variant = (type, text, ov) => {
      const v = { color: r() < C.variants.redChance ? "red" : "white", strip: "none", doodle: null, high: r() < 0.25 };
      if (comp.paper && r() < C.variants.stripChance) v.strip = r() < 0.5 ? "top" : "bottom";
      if (comp.doodles && r() < C.variants.doodleChance) v.doodle = r.weighted(C.variants.doodles);
      if (ov.doodle) v.doodle = ov.doodle;
      if (ov.color) v.color = ov.color;
      return v;
    };
    const lyricScene = (ws, t0, t1, extra) => {
      const text = ws.map(w => w.text).join(" ");
      const ov = C.overrides.find(o => (o.match && (norm(text) === o.match || norm(text).split(" ").includes(o.match))) || (o.at !== undefined && Math.abs(o.at - (ws[0].abs ?? t0)) < 0.3)) || {};
      const type = ov.scene || r.weighted(C.scenes.deck, recent);
      recent.push(type); if (recent.length > C.scenes.cooldown) recent.shift();
      const L = w => [...w.text.replace(/[^\p{L}\p{N}]/gu, "")].length;
      const key = ws.reduce((best, w, i) => (L(w) > L(ws[best]) ? i : best), 0);
      const bg = r() < C.variants.footageChance ? "footage" : "dark";
      push({ kind: "scene", type, text, words: ws, key, t0, t1, bg, clip: bg === "footage" ? clip() : -1, clipOff: r.range(0, 6),
        v: variant(type, text, ov), transition: ov.transition || r.weighted(C.transitions.deck), prev: sung.slice(-2), ...extra });
    };
    const interlude = (t0, t1, text) => {
      const type = r.weighted(C.interludes.deck);
      push({ kind: "interlude", type, text, t0, t1, bg: "footage", clip: clip(), clipOff: r.range(0, 6), v: { strip: r() < 0.5 ? "bottom" : "none" }, transition: r() < 0.5 ? "glitch" : "flash" });
    };
    /* silencio: repaso de frases ya cantadas (como la referencia) o interludios */
    const fill = (t0, t1) => {
      let t = t0, n = 0;
      if (comp.recap && t1 - t0 >= C.recap.minGapSec && chunks.length) {
        let ci = 0;
        while (t1 - t >= C.recap.stepSec * 0.7) {
          const len = Math.min(C.recap.stepSec, t1 - t);
          if (C.recap.interludeEvery && n % C.recap.interludeEvery === C.recap.interludeEvery - 1) interlude(t, t + len, sung[(ci + n) % Math.max(1, sung.length)] || "");
          else {
            const src = chunks[ci % chunks.length].words; ci++;
            const step = Math.min(0.16, len * 0.6 / src.length);
            lyricScene(src.map((w, i) => ({ text: w.text, t: 0.04 + i * step })), t, t + len, { recap: true });
          }
          t += len; n++;
        }
        return;
      }
      while (t1 - t >= C.interludes.minSec * 0.6) { const len = Math.min(C.interludes.maxSec, t1 - t); interlude(t, t + len, sung[sung.length - 1] || ""); t += len; }
    };
    const first = chunks.length ? chunks[0].words[0].start - tm.leadSec : dur;
    if (comp.intro && first >= C.intro.minSec) push({ kind: "intro", t0: 0, t1: first, bg: "footage", clip: clip(), clipOff: 0, v: {} });
    else if (first >= C.interludes.minSec) fill(0, first);
    const lastEnd = words.length ? words[words.length - 1].end : 0;
    let outroT0 = Math.max(lastEnd + C.outro.leadSec, dur - C.outro.maxSec);
    if (dur - outroT0 < C.outro.minSec) outroT0 = Math.max(lastEnd + 0.1, dur - C.outro.minSec);
    chunks.forEach((c, i) => {
      const t0 = Math.max(0, c.words[0].start - tm.leadSec);
      if (t0 >= outroT0) return;
      const next = i + 1 < chunks.length ? chunks[i + 1].words[0].start - tm.leadSec : outroT0;
      const end = c.words[c.words.length - 1].end;
      let t1 = Math.min(next, outroT0), gap = null;
      if (next - end > tm.gapSec) { gap = Math.min(t1, end + tm.holdSec); t1 = gap; }
      lyricScene(c.words.map(w => ({ text: w.text, t: Math.max(0, w.start - tm.leadSec - t0), abs: w.start })), t0, t1);
      sung.push(c.words.map(w => w.text).join(" "));
      if (gap !== null) fill(gap, Math.min(next, outroT0));
    });
    if (!chunks.length) warn("letra vacía: solo intro y cierre");
    const last = scenes.length ? scenes[scenes.length - 1].t1 : 0;
    if (outroT0 - last >= 0.5) fill(last, outroT0);
    push({ kind: "outro", id: comp.outro, t0: outroT0, t1: Math.max(dur, outroT0 + C.outro.minSec), bg: "footage", clip: clip(), clipOff: 1, prev: sung.slice(), v: {} });
    scenes.sort((a, b) => a.t0 - b.t0);
    for (let i = 0; i + 1 < scenes.length; i++) if (scenes[i].t1 > scenes[i + 1].t0) scenes[i].t1 = scenes[i + 1].t0;
    return scenes;
  }

  function textures(C) {
    return { paper: K.paperTexture(C.seed, C.colors.paper), paperLight: K.paperTexture(C.seed + 1, C.colors.paperLight), grain: K.grainTexture(C.seed), distress: K.distressTexture(C.seed, C.motion.distress) };
  }
  function makeCtx(C, W, H, tex) {
    return { W, H, u: Math.min(W, H) / 100, C, fonts: C.fonts, tex, media: C.media, red: C.colors.red, white: C.colors.white, black: C.colors.black, chalk: C.colors.chalk };
  }
  function buildScene(sc, ctx) {
    let b;
    if (sc.kind === "intro") b = R.intro(sc, ctx);
    else if (sc.kind === "outro") b = (R.outros[sc.id] || R.outros["grunge.outrov1"])(sc, ctx);
    else if (sc.kind === "interlude") b = (R.interludes[sc.type] || R.interludes.metraje)(sc, ctx);
    else b = (R.scenes[sc.type] || R.scenes.linea)(sc, ctx);
    const tr = sc.transition && R.transitions[sc.transition] ? R.transitions[sc.transition](sc, ctx, b.root) : null;
    return { root: b.root, update(lt) { b.update(lt); if (tr) tr(lt); } };
  }
  function applyLook(C, ctx) {
    const rs = doc.documentElement.style;
    rs.setProperty("--gr-distress", C.components.distress && C.motion.distress > 0 ? `url(${ctx.tex.distress})` : "none");
  }

  async function boot() {
    const params = new URLSearchParams(location.search);
    const C = await loadConfig();
    applySelection(C, params);
    const stage = $("stage"), audio = $("audio"), hud = $("hud"), grain = $("grain");
    const DEBUG = C.debug.enabled || params.get("debug") === "1";
    const FROZEN = params.has("t") ? Math.max(0, parseFloat(params.get("t")) || 0) : null;
    audio.src = encodeURI(C.audio.src);
    let audioStarted = false;
    audio.addEventListener("playing", () => { audioStarted = true; });
    if (FROZEN == null) audio.play().catch(() => { /* sin autoplay: reloj de pared */ });
    const durReady = new Promise(res => {
      if (isFinite(audio.duration) && audio.duration > 0) return res(audio.duration);
      audio.addEventListener("loadedmetadata", () => res(audio.duration), { once: true });
      audio.addEventListener("error", () => res(NaN), { once: true });
      later(() => res(NaN), 4000);
    });
    /* un <video> mudo por medio, reutilizado entre escenas */
    const pool = C.media.map(m => {
      if (m.type !== "video") return null;
      const v = doc.createElement("video");
      v.muted = true; v.playsInline = true;
      /* solo metadatos al arrancar: cada clip se descarga cuando su escena lo monta */
      v.preload = "metadata"; v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
      v.src = encodeURI(m.src);
      return v;
    });
    const [words, audioDur] = await Promise.all([loadLyrics(C), durReady, loadFonts(C)]);
    const dur = isFinite(audioDur) && audioDur > 0 ? audioDur : (words.length ? words[words.length - 1].end + 3 : 30);
    const tex = textures(C);
    let W = innerWidth, H = innerHeight, ctx = makeCtx(C, W, H, tex);
    applyLook(C, ctx);
    if (C.components.grain && C.motion.grain > 0) { grain.style.backgroundImage = `url(${tex.grain})`; grain.style.opacity = String(C.motion.grain); } else grain.style.display = "none";
    const scenes = buildTimeline(words, dur, C, C.media.length);
    let cur = null, curIdx = -1, curVideo = null;
    const sceneAt = t => { let lo = 0, hi = scenes.length - 1, ans = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (scenes[m].t0 <= t) { ans = m; lo = m + 1; } else hi = m - 1; } return ans; };
    function mount(i) {
      if (cur) cur.root.remove();
      if (curVideo) { curVideo.pause(); curVideo.remove(); curVideo = null; }
      const sc = scenes[i];
      cur = buildScene(sc, ctx); curIdx = i;
      stage.appendChild(cur.root);
      const slot = cur.root.querySelector(".gr-slot");
      const v = sc.clip >= 0 ? pool[sc.clip] : null;
      if (slot && v) { v.preload = "auto"; slot.appendChild(v); curVideo = v; }
    }
    function syncVideo(sc, t, scrub) {
      if (!curVideo) return;
      /* hasta tener un fotograma se ve el póster del hueco, nunca negro */
      curVideo.style.opacity = curVideo.readyState >= 2 ? "1" : "0";
      const v = curVideo, d = v.duration, rate = C.motion.videoRate, m = C.media[sc.clip] || {};
      let e = (m.start || 0) + sc.clipOff + (t - sc.t0) * rate;
      if (isFinite(d) && d > 0.3) e = e % (d - 0.08);
      /* no volver a buscar mientras el video todavía está buscando o sin metadatos */
      const canSeek = v.readyState >= 1 && !v.seeking;
      if (scrub) { if (!v.paused) v.pause(); if (canSeek && Math.abs(v.currentTime - e) > 0.02) { try { v.currentTime = e; } catch (err) { /* aún sin datos */ } } }
      else { v.playbackRate = rate; if (v.paused) v.play().catch(() => {}); if (canSeek && Math.abs(v.currentTime - e) > 0.35) { try { v.currentTime = e; } catch (err) { /* aún sin datos */ } } }
    }
    let forced = FROZEN, wall0 = null;
    function render(t, scrub) {
      let i = sceneAt(t); if (i < 0) i = 0;
      if (i !== curIdx) mount(i);
      const sc = scenes[i];
      cur.update(Math.min(Math.max(0, t - sc.t0), sc.t1 - sc.t0));
      syncVideo(sc, t, scrub);
      if (grain.style.display !== "none") { const s = Math.floor(t * 24); grain.style.transform = `translate(${(s * 37) % 50}px, ${(s * 53) % 50}px)`; }
      if (DEBUG) hud.textContent = `t ${t.toFixed(2)} · #${i} ${sc.kind}:${sc.type || sc.id || ""} · ${sc.transition || ""} · v ${JSON.stringify(sc.v || {})} · "${sc.text || ""}"${sc.recap ? " (repaso)" : ""}`;
    }
    const clock = now => forced != null ? forced : (audioStarted || audio.currentTime > 0) ? audio.currentTime : (now - wall0) / 1000;
    function frame(now) {
      if (wall0 === null) wall0 = now;
      const scrub = forced != null || (audioStarted && audio.paused);
      render(clock(now), scrub);
      if (forced == null) requestAnimationFrame(frame);
    }
    addEventListener("resize", () => { W = innerWidth; H = innerHeight; ctx = makeCtx(C, W, H, tex); K.measureCache.clear(); if (cur) cur.root.remove(); if (curVideo) { curVideo.pause(); curVideo.remove(); curVideo = null; } cur = null; curIdx = -1; if (forced != null) render(forced, true); });
    if (DEBUG) hud.style.display = "block";
    root.__grungeRojo = { config: C, scenes: () => scenes, seek(t) { forced = t; render(t, true); }, release() { forced = null; requestAnimationFrame(frame); }, duration: dur };
    requestAnimationFrame(frame);
  }

  G.player = { DEFAULTS, DECLARED, validate, buildTimeline, loadFonts, loadLyrics, textures, makeCtx, buildScene, applyLook, norm };
  if (!root.__GRUNGE_NO_BOOT) boot().catch(e => console.error("[lyrics-grunge-rojo] fallo de arranque", e));
})(typeof window !== "undefined" ? window : globalThis);
