/* lyrics-decadas · orquestador.
   1. Carga config.json → assets/config.json → DEFAULTS (contrato NodeMotion).
   2. Valida la configuración (valores fuera de rango → por defecto + aviso).
   3. Resuelve los componentes activos (config.components + ?c=/cx/p).
   4. Registra fuentes, convierte las fotos a semitono, lee la letra y la agrupa
      en fragmentos de 1–4 palabras, cada uno con una escena del mazo.
   5. En cada cuadro dibuja el estado del segundo actual del <audio>. */
(function (root) {
  "use strict";
  const DC = root.Decadas, K = DC.core, R = DC.registry;
  const doc = document, $ = id => doc.getElementById(id);
  const later = (fn, ms) => (root.__nbSetTimeout || root.setTimeout)(fn, ms);
  const warn = (...a) => console.warn("[lyrics-decadas]", ...a);
  const isObj = v => v && typeof v === "object" && !Array.isArray(v);

  const DEFAULTS = {
    id: "default",
    audio: { src: "assets/song.mp3" },
    lyricsUrl: "assets/lyrics.json",
    lyricsFilter: { dropPatterns: ["(?i)subt[ií]tulos", "(?i)amara\\.org", "(?i)thanks for watching"], maxWordSec: 3.5 },
    seed: 23,
    colors: { dark: "#190F06", pale: "#E4EDF7", blue: "#0080FD", white: "#F4F4F2", black: "#050505" },
    fonts: {
      display: { family: "Archivo", src: "assets/fonts/Archivo.woff2", variable: true, stretch: 72, weight: 800, tracking: -0.01 },
      brand: { family: "Caveat Brush", src: "assets/fonts/CaveatBrush-Regular.woff2", stretch: 100, weight: 400 },
      signature: { family: "Mrs Saint Delafield", src: "assets/fonts/MrsSaintDelafield-Regular.woff2", stretch: 100, weight: 400 }
    },
    media: [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ type: "image", src: `assets/media/foto-0${i}.jpg` })),
    halftone: { enabled: true, cell: 7, contrast: 1.15, size: 900 },
    texts: { label: "", tags: ["DIC-97", "NOV-86", "ENE-MAR", "LADO A"], credit: "" },
    components: { intro: true, outro: "decadas.outrov1", photos: true, tags: true, signature: true, fragments: true },
    intro: { title: "", artist: "", minSec: 1.8 },
    outro: { title: "Gracias", sub: "por ver", feats: "Suscríbete · NodeMotion", brand: "NodeMotion", line: "NodeMotion producciones", leadSec: 0.4, minSec: 3, maxSec: 6 },
    timing: { leadSec: 0.06, maxWords: 4, maxChars: 18, wordGapSec: 0.45, gapSec: 1.3, holdSec: 0.5, splitChars: 9 },
    scenes: { deck: { letras: 1.2, titulo: 2.4, barrido: 1.2, gigante: 1.4, contador: 1.6, credito: 1.6, foto: 0.6 }, cooldown: 2, letrasMaxLetters: 8 },
    transitions: { flashSec: 0.1, wipeSec: 0.22, deck: { cut: 5, photoFlash: 1.4, blueWipe: 1, letterSlam: 0.8 } },
    motion: { rollSec: 0.35, rollGlyphs: "0123456789", drift: 0.03, fragmentSpeed: 1 },
    interludes: { minSec: 0.8, maxSec: 3, deck: { letras: 1, foto: 1, titulo: 1 } },
    overrides: [],
    debug: { enabled: false }
  };
  const DECLARED = [
    { name: "decadas.intro", key: "intro" },
    { name: "decadas.outrov1", group: "outro", default: true },
    { name: "decadas.outrov2", group: "outro" },
    { name: "decadas.fotos", key: "photos" },
    { name: "decadas.etiquetas", key: "tags" },
    { name: "decadas.firma", key: "signature" },
    { name: "decadas.fragmentos", key: "fragments" }
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
    for (const k of ["display", "brand", "signature"]) {
      const f = { ...D.fonts[k], ...(isObj(raw.fonts?.[k]) ? raw.fonts[k] : {}) };
      C.fonts[k] = { family: String(f.family), src: f.src ? String(f.src) : "", variable: !!f.variable,
        stretch: num(f.stretch, D.fonts[k].stretch, 50, 200, `fonts.${k}.stretch`), weight: num(f.weight, D.fonts[k].weight, 100, 1000, `fonts.${k}.weight`),
        tracking: num(f.tracking, D.fonts[k].tracking || 0, -0.2, 0.5, `fonts.${k}.tracking`) };
    }
    const media = Array.isArray(raw.media) ? raw.media : D.media;
    C.media = media.filter(m => isObj(m) && m.type === "image" && typeof m.src === "string" && m.src).map(m => ({ type: "image", src: m.src }));
    if (Array.isArray(raw.media) && C.media.length < raw.media.length) warn("media: solo se usan entradas {type:\"image\", src}");
    const h = raw.halftone || {};
    C.halftone = { enabled: h.enabled !== undefined ? !!h.enabled : D.halftone.enabled, cell: num(h.cell, D.halftone.cell, 3, 30, "halftone.cell"),
      contrast: num(h.contrast, D.halftone.contrast, 0.3, 3, "halftone.contrast"), size: num(h.size, D.halftone.size, 300, 2000, "halftone.size") };
    const tx = raw.texts || {};
    C.texts = { label: String(tx.label ?? D.texts.label).slice(0, 24), tags: Array.isArray(tx.tags) ? tx.tags.map(x => String(x).slice(0, 10)).filter(Boolean) : D.texts.tags, credit: String(tx.credit ?? D.texts.credit).slice(0, 40) };
    const rc = isObj(raw.components) ? raw.components : {};
    C.components = { ...D.components };
    for (const k of ["intro", "photos", "tags", "signature", "fragments"]) if (rc[k] !== undefined) C.components[k] = !!rc[k];
    if (rc.outro !== undefined) C.components.outro = R.outros[rc.outro] ? rc.outro : (warn(`components.outro: ${Object.keys(R.outros).join("|")}`), D.components.outro);
    C.intro = { ...D.intro, ...(isObj(raw.intro) ? raw.intro : {}) };
    C.intro.minSec = num(C.intro.minSec, D.intro.minSec, 0.5, 20, "intro.minSec");
    C.outro = { ...D.outro, ...(isObj(raw.outro) ? raw.outro : {}) };
    for (const k of ["leadSec", "minSec", "maxSec"]) C.outro[k] = num(C.outro[k], D.outro[k], 0, 30, "outro." + k);
    const t = raw.timing || {};
    C.timing = { leadSec: num(t.leadSec, D.timing.leadSec, -0.5, 1, "timing.leadSec"), maxWords: Math.round(num(t.maxWords, D.timing.maxWords, 1, 8, "timing.maxWords")),
      maxChars: num(t.maxChars, D.timing.maxChars, 4, 40, "timing.maxChars"), wordGapSec: num(t.wordGapSec, D.timing.wordGapSec, 0.1, 5, "timing.wordGapSec"),
      gapSec: num(t.gapSec, D.timing.gapSec, 0.3, 10, "timing.gapSec"), holdSec: num(t.holdSec, D.timing.holdSec, 0, 5, "timing.holdSec"),
      splitChars: num(t.splitChars, D.timing.splitChars, 3, 60, "timing.splitChars") };
    C.scenes = { deck: deck(raw.scenes?.deck, D.scenes.deck, DC.SCENES, "scenes.deck"), cooldown: Math.round(num(raw.scenes?.cooldown, D.scenes.cooldown, 0, 5, "scenes.cooldown")),
      letrasMaxLetters: num(raw.scenes?.letrasMaxLetters, D.scenes.letrasMaxLetters, 2, 20, "scenes.letrasMaxLetters") };
    const tr = raw.transitions || {};
    C.transitions = { flashSec: num(tr.flashSec, D.transitions.flashSec, 0.02, 1, "transitions.flashSec"), wipeSec: num(tr.wipeSec, D.transitions.wipeSec, 0.05, 1.5, "transitions.wipeSec"),
      deck: deck(tr.deck, D.transitions.deck, DC.TRANSITIONS, "transitions.deck") };
    const m = raw.motion || {};
    C.motion = { rollSec: num(m.rollSec, D.motion.rollSec, 0, 2, "motion.rollSec"), rollGlyphs: typeof m.rollGlyphs === "string" && m.rollGlyphs ? m.rollGlyphs : D.motion.rollGlyphs,
      drift: num(m.drift, D.motion.drift, 0, 0.5, "motion.drift"), fragmentSpeed: num(m.fragmentSpeed, D.motion.fragmentSpeed, 0, 5, "motion.fragmentSpeed") };
    C.interludes = { minSec: num(raw.interludes?.minSec, D.interludes.minSec, 0.2, 10, "interludes.minSec"), maxSec: num(raw.interludes?.maxSec, D.interludes.maxSec, 0.5, 20, "interludes.maxSec"),
      deck: deck(raw.interludes?.deck, D.interludes.deck, ["letras", "foto", "titulo"], "interludes.deck") };
    C.overrides = (Array.isArray(raw.overrides) ? raw.overrides : []).filter(o => isObj(o) && (o.match || o.at !== undefined)).map(o => ({ ...o, match: o.match ? norm(o.match) : null }));
    for (const o of C.overrides) {
      if (o.scene && !R.scenes[o.scene]) { warn(`overrides: escena ${o.scene} no existe`); delete o.scene; }
      if (o.transition && !R.transitions[o.transition]) { warn(`overrides: transición ${o.transition} no existe`); delete o.transition; }
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
        if (isObj(op)) for (const k of ["title", "sub", "feats", "brand", "line"]) if (typeof op[k] === "string") C.outro[k] = op[k].slice(0, 60);
        const ip = obj?.["decadas.intro"];
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
        const face = new FontFace(f.family, `url("${encodeURI(f.src)}")`, f.variable ? { weight: "100 900", stretch: "62% 125%" } : {});
        doc.fonts.add(face);
        return face.load().catch(() => warn(`fuente no cargada: ${f.family} (${f.src})`));
      } catch (e) { warn(`fuente inválida: ${f.family}`); return null; }
    });
    await Promise.race([Promise.all(jobs), new Promise(res => later(res, 6000))]);
  }
  async function loadPhotos(C) {
    if (!C.components.photos) return [];
    const jobs = C.media.map(m => new Promise(res => {
      const img = new Image();
      img.onload = () => { try { res(C.halftone.enabled ? K.halftone(img, { ...C.halftone, ink: C.colors.black }) : m.src); } catch (e) { warn(`semitono falló: ${m.src}`); res(m.src); } };
      img.onerror = () => { warn(`foto no encontrada: ${m.src}`); res(null); };
      img.src = encodeURI(m.src);
    }));
    const out = await Promise.race([Promise.all(jobs), new Promise(res => later(() => res([]), 8000))]);
    return out.filter(Boolean);
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
        const toks = String(seg.text || "").trim().split(/\s+/).filter(Boolean);
        const step = (+seg.end - +seg.start) / Math.max(1, toks.length);
        words = toks.map((t, i) => ({ text: t, start: +seg.start + i * step, end: +seg.start + (i + 1) * step }));
      }
      for (const w of words) {
        const text = String(w.text || "").trim().replace(/^[^\p{L}\p{N}¿¡']+|[^\p{L}\p{N}?!']+$/gu, "");
        if (!text || !Number.isFinite(w.start) || !Number.isFinite(w.end) || drops.some(rx => rx.test(text))) continue;
        out.push({ text, start: w.start, end: Math.max(w.start + 0.05, Math.min(w.end, w.start + C.lyricsFilter.maxWordSec)), seg: si });
      }
    });
    out.sort((a, b) => a.start - b.start);
    return out;
  }

  /* palabras → fragmentos → escenas */
  function buildTimeline(words, dur, C, label) {
    const r = K.rng(C.seed), tm = C.timing, comp = C.components;
    const chunks = [];
    for (const w of words) {
      const c = chunks[chunks.length - 1];
      const chars = c ? c.words.map(x => x.text).join(" ").length + 1 + w.text.length : 0;
      if (!c || c.words.length >= tm.maxWords || chars > tm.maxChars || w.seg !== c.seg || w.start - c.words[c.words.length - 1].end > tm.wordGapSec) chunks.push({ seg: w.seg, words: [w] });
      else c.words.push(w);
    }
    const scenes = []; let idx = 0;
    const recent = [];
    const push = sc => { sc.seed = (C.seed * 1000 + (idx++) * 7919) >>> 0; scenes.push(sc); return sc; };
    const filler = (t0, t1) => {
      let t = t0, last = null;
      while (t1 - t >= C.interludes.minSec * 0.6) {
        const len = Math.min(C.interludes.maxSec, t1 - t);
        const kind = r.weighted(C.interludes.deck, last ? [last] : null); last = kind;
        const d = Math.min(1.2, len * 0.6);
        push({ kind: "scene", type: kind, text: label, words: [{ text: label, t: 0.05, d }], keyword: { text: label.split(/\s+/)[0] || label, t: 0, d: Math.min(1.4, len * 0.7) }, t0: t, t1: t + len, transition: "cut", filler: true });
        t += len;
      }
    };
    const first = chunks.length ? chunks[0].words[0].start - tm.leadSec : dur;
    if (comp.intro && first >= C.intro.minSec) push({ kind: "intro", t0: 0, t1: first });
    else if (first >= C.interludes.minSec) filler(0, first);
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
      const text = c.words.map(w => w.text).join(" ");
      const rel = c.words.map((w, k) => ({ text: w.text, t: Math.max(0, w.start - tm.leadSec - t0), d: Math.max(0.12, (c.words[k + 1] ? c.words[k + 1].start : w.end) - w.start) }));
      const letterCount = w => [...w.text.replace(/[^\p{L}\p{N}]/gu, "")].length;
      const kw = rel.reduce((a, b) => (letterCount(b) > letterCount(a) ? b : a), rel[0]);
      const keyword = { text: kw.text, t: kw.t, d: Math.min(Math.max(0.35, kw.d), 1.2, t1 - t0 - kw.t) };
      const ov = C.overrides.find(o => (o.match && (o.match === norm(text) || norm(text).split(" ").includes(o.match))) || (o.at !== undefined && Math.abs(o.at - c.words[0].start) < 0.3)) || {};
      const dk = { ...C.scenes.deck };
      const kl = letterCount(kw);
      if (!(kl >= 2 && kl <= C.scenes.letrasMaxLetters && keyword.d >= 0.3)) delete dk.letras;
      if (kl < 2) delete dk.gigante;
      if (!comp.photos) { delete dk.foto; delete dk.gigante; }
      const type = ov.scene || r.weighted(dk, recent);
      recent.push(type); if (recent.length > C.scenes.cooldown) recent.shift();
      const tdeck = { ...C.transitions.deck };
      if (!comp.photos) delete tdeck.photoFlash;
      push({ kind: "scene", type, text, words: rel, keyword, t0, t1, transition: ov.transition || (Object.keys(tdeck).length ? r.weighted(tdeck) : "cut") });
      if (gap !== null) filler(gap, Math.min(next, outroT0));
    });
    if (!chunks.length) warn("letra vacía: solo intro y cierre");
    const fill = scenes.length ? scenes[scenes.length - 1].t1 : 0;
    if (outroT0 - fill >= C.interludes.minSec * 0.6) filler(fill, outroT0);
    push({ kind: "outro", id: comp.outro, t0: outroT0, t1: Math.max(dur, outroT0 + C.outro.minSec) });
    scenes.sort((a, b) => a.t0 - b.t0);
    for (let i = 0; i + 1 < scenes.length; i++) if (scenes[i].t1 > scenes[i + 1].t0) scenes[i].t1 = scenes[i + 1].t0;
    return scenes;
  }

  function setColors(C, paperOverride) {
    const rs = doc.documentElement.style;
    for (const k in C.colors) rs.setProperty("--" + k, C.colors[k]);
    if (paperOverride) rs.setProperty("--dark", paperOverride);
  }
  function makeCtx(C, W, H, photos) {
    const label = String(C.texts.label || C.intro.title || "Décadas").trim();
    return { W, H, u: Math.min(W, H) / 100, C, fonts: C.fonts, photos, label, tags: C.texts.tags, credit: C.texts.credit || C.intro.artist || label };
  }
  function buildScene(sc, ctx) {
    let b;
    if (sc.kind === "intro") b = R.intro(sc, ctx);
    else if (sc.kind === "outro") b = (R.outros[sc.id] || R.outros["decadas.outrov1"])(sc, ctx);
    else b = (R.scenes[sc.type] || R.scenes.titulo)(sc, ctx);
    const tr = sc.transition && R.transitions[sc.transition] ? R.transitions[sc.transition](sc, ctx) : null;
    if (tr) b.root.appendChild(tr.root);
    return { root: b.root, update(lt) { b.update(lt); if (tr) tr.update(lt); } };
  }

  async function boot() {
    const params = new URLSearchParams(location.search);
    const C = await loadConfig();
    applySelection(C, params);
    setColors(C);
    const stage = $("stage"), audio = $("audio"), hud = $("hud");
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
    const [words, audioDur, , photos] = await Promise.all([loadLyrics(C), durReady, loadFonts(C), loadPhotos(C)]);
    const dur = isFinite(audioDur) && audioDur > 0 ? audioDur : (words.length ? words[words.length - 1].end + 3 : 30);
    let W = innerWidth, H = innerHeight;
    let ctx = makeCtx(C, W, H, photos);
    const scenes = buildTimeline(words, dur, C, ctx.label);
    let cur = null, curIdx = -1;
    const sceneAt = t => { let lo = 0, hi = scenes.length - 1, ans = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (scenes[m].t0 <= t) { ans = m; lo = m + 1; } else hi = m - 1; } return ans; };
    function render(t) {
      let i = sceneAt(t); if (i < 0) i = 0;
      if (i !== curIdx) { if (cur) cur.root.remove(); cur = buildScene(scenes[i], ctx); curIdx = i; stage.appendChild(cur.root); }
      const sc = scenes[i];
      cur.update(Math.min(Math.max(0, t - sc.t0), sc.t1 - sc.t0));
      if (DEBUG) hud.textContent = `t ${t.toFixed(2)} · #${i} ${sc.kind}:${sc.type || sc.id || ""} · ${sc.transition || ""} · "${sc.text || ""}"`;
    }
    let wall0 = null, forced = FROZEN;
    const clock = now => forced != null ? forced : (audioStarted || audio.currentTime > 0) ? audio.currentTime : (now - wall0) / 1000;
    function frame(now) { if (wall0 === null) wall0 = now; render(clock(now)); if (forced == null) requestAnimationFrame(frame); }
    addEventListener("resize", () => { W = innerWidth; H = innerHeight; ctx = makeCtx(C, W, H, photos); K.measureCache.clear(); if (cur) cur.root.remove(); cur = null; curIdx = -1; if (forced != null) render(forced); });
    if (DEBUG) hud.style.display = "block";
    root.__decadas = { config: C, scenes: () => scenes, seek(t) { forced = t; render(t); }, release() { forced = null; requestAnimationFrame(frame); }, duration: dur };
    requestAnimationFrame(frame);
  }

  DC.player = { DEFAULTS, DECLARED, validate, buildTimeline, loadFonts, loadPhotos, loadLyrics, makeCtx, buildScene, setColors, norm };
  if (!root.__DECADAS_NO_BOOT) boot().catch(e => console.error("[lyrics-decadas] fallo de arranque", e));
})(typeof window !== "undefined" ? window : globalThis);
