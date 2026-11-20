/* lyrics-kinetic-noir · orquestador.
   1. Carga config.json → assets/config.json → DEFAULTS (contrato NodeMotion) y valida.
   2. Registra las fuentes locales y lee la letra (formato Whisper).
   3. Agrupa palabras en frases cortas y elige una composición por frase (determinista por semilla).
   4. En cada cuadro dibuja el estado exacto del segundo actual del <audio>.
   Vista previa de piezas sueltas: ?only=<componente>&p=<json>&aspect=16:9|9:16&t=<s>&loop=0|1. */
(function (root) {
  "use strict";
  const N = root.Noir, K = N.core, R = N.registry;
  const doc = document, $ = id => doc.getElementById(id);
  const later = (fn, ms) => (root.__nbSetTimeout || root.setTimeout)(fn, ms);

  const F = (family, file, weight, lineHeight, tracking = 0, weightRange) => ({ family, src: "assets/fonts/" + file, weight, lineHeight, tracking, weightRange });
  const DEFAULTS = {
    id: "default",
    audio: { src: "assets/song.mp3" },
    lyricsUrl: "assets/lyrics.json",
    lyricsFilter: { dropPatterns: ["(?i)subt[ií]tulos", "(?i)amara\\.org", "(?i)thanks for watching"], maxWordSec: 3.5 },
    seed: 23,
    colors: { bg: "#05070C", bg2: "#111726", ink: "#FFFFFF", dim: "#7D8698", accent: "#E5332A", credit: "#7FD3FF", smoke: "#9DA3AE" },
    fonts: {
      expanded: F("Noir Expanded", "ArchivoExpanded-Black.woff2", 900, 0.88),
      condensed: F("Noir Condensed", "Anton-Regular.woff2", 400, 0.94, 0.005),
      slab: F("Noir Slab", "AlfaSlabOne-Regular.woff2", 400, 0.98),
      sans: F("Noir Sans", "Archivo.woff2", 800, 1.15, 0.28, "100 900"),
      script: F("Noir Script", "KaushanScript-Regular.woff2", 400, 1.1)
    },
    components: { intro: true, outro: "noir.outrov1", glitch: true, smoke: true },
    intro: { title: "", artist: "", minSec: 1.6 },
    outro: { title: "Gracias", sub: "por escuchar", feats: "Suscríbete · NodeMotion", leadSec: 0.4, minSec: 2.8, maxSec: 6 },
    credit: { text: "", useArtist: true },
    phrase: { maxWords: 7, minWords: 2, maxChars: 34, maxSec: 4.5, gapSec: 0.7, leadSec: 0.12, holdSec: 0.45, maxHoldSec: 1.6 },
    layouts: { deck: { bar: 1.2, stack: 1.3, quote: 1, ghost: 1, subtitle: 1.1, frame: 1, box: 1, highlight: 1.1 } },
    effects: { glitchSec: 0.18 },
    background: { streaks: 16, speed: 1, intensity: 1, vignette: 0.55, smokeChance: 0.18, smokeMinGap: 4 },
    debug: { enabled: false }
  };

  const DECLARED = [
    { name: "noir.intro", key: "intro" },
    { name: "noir.outrov1", group: "outro", default: true },
    { name: "noir.outrov2", group: "outro" },
    { name: "noir.glitch", key: "glitch" },
    { name: "noir.smoke", key: "smoke" }
  ];
  const PIECES = N.LAYOUTS.map(l => "noir." + l).concat(["noir.pause", "noir.intro", "noir.outrov1", "noir.outrov2"]);

  /* ------------------------------ validación ------------------------------ */
  const warn = (...a) => console.warn("[lyrics-kinetic-noir]", ...a);
  const isObj = v => v && typeof v === "object" && !Array.isArray(v);
  function num(v, d, lo, hi, path) {
    if (v === undefined) return d;
    const n = Number(v);
    if (!Number.isFinite(n) || n < lo || n > hi) { warn(`${path}=${JSON.stringify(v)} fuera de [${lo}, ${hi}] → ${d}`); return d; }
    return n;
  }
  const color = (v, d, path) => (typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v.trim()) ? v.trim() : (v !== undefined && warn(`${path} no es un color #hex`), d));
  const str = (v, d, max = 80) => (typeof v === "string" ? v.slice(0, max) : d);

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
    C.fonts = {};
    for (const k in D.fonts) {
      const f = isObj(raw.fonts?.[k]) ? raw.fonts[k] : {}, d = D.fonts[k];
      C.fonts[k] = { family: String(f.family || d.family), src: f.src !== undefined ? String(f.src) : d.src,
        weight: num(f.weight, d.weight, 100, 1000, `fonts.${k}.weight`), lineHeight: num(f.lineHeight, d.lineHeight, 0.5, 2, `fonts.${k}.lineHeight`),
        tracking: num(f.tracking, d.tracking, -0.2, 0.6, `fonts.${k}.tracking`), weightRange: f.weightRange || d.weightRange };
    }
    const rc = isObj(raw.components) ? raw.components : {};
    C.components = { ...D.components };
    for (const k of ["intro", "glitch", "smoke"]) if (rc[k] !== undefined) C.components[k] = !!rc[k];
    if (rc.outro !== undefined) C.components.outro = R.outros[rc.outro] ? rc.outro : (warn(`components.outro: ${Object.keys(R.outros).join("|")}`), D.components.outro);
    C.intro = { title: str(raw.intro?.title, D.intro.title), artist: str(raw.intro?.artist, D.intro.artist), minSec: num(raw.intro?.minSec, D.intro.minSec, 0.5, 20, "intro.minSec") };
    const O = raw.outro || {};
    C.outro = { title: str(O.title, D.outro.title, 40), sub: str(O.sub, D.outro.sub, 60), feats: str(O.feats, D.outro.feats, 60) };
    for (const k of ["leadSec", "minSec", "maxSec"]) C.outro[k] = num(O[k], D.outro[k], 0, 30, "outro." + k);
    C.credit = { text: str(raw.credit?.text, D.credit.text, 40), useArtist: raw.credit?.useArtist === undefined ? D.credit.useArtist : !!raw.credit.useArtist };
    const P = raw.phrase || {}, DP = D.phrase;
    C.phrase = { maxWords: Math.round(num(P.maxWords, DP.maxWords, 1, 12, "phrase.maxWords")), minWords: Math.round(num(P.minWords, DP.minWords, 1, 6, "phrase.minWords")),
      maxChars: num(P.maxChars, DP.maxChars, 6, 80, "phrase.maxChars"), maxSec: num(P.maxSec, DP.maxSec, 0.5, 15, "phrase.maxSec"),
      gapSec: num(P.gapSec, DP.gapSec, 0.1, 5, "phrase.gapSec"), leadSec: num(P.leadSec, DP.leadSec, 0, 1, "phrase.leadSec"),
      holdSec: num(P.holdSec, DP.holdSec, 0, 3, "phrase.holdSec"), maxHoldSec: num(P.maxHoldSec, DP.maxHoldSec, 0.2, 6, "phrase.maxHoldSec") };
    const dk = raw.layouts?.deck;
    C.layouts = { deck: { ...D.layouts.deck } };
    if (isObj(dk)) {
      const out = {};
      for (const k in dk) { if (!N.LAYOUTS.includes(k)) { warn(`layouts.deck.${k} no existe (${N.LAYOUTS.join(", ")})`); continue; } out[k] = num(dk[k], 0, 0, 100, `layouts.deck.${k}`); }
      if (Object.values(out).some(v => v > 0)) C.layouts.deck = out;
    }
    C.effects = { glitchSec: num(raw.effects?.glitchSec, D.effects.glitchSec, 0, 1, "effects.glitchSec") };
    const B = raw.background || {}, DB = D.background;
    C.background = { streaks: Math.round(num(B.streaks, DB.streaks, 0, 60, "background.streaks")), speed: num(B.speed, DB.speed, 0, 5, "background.speed"),
      intensity: num(B.intensity, DB.intensity, 0, 3, "background.intensity"), vignette: num(B.vignette, DB.vignette, 0, 1, "background.vignette"),
      smokeChance: num(B.smokeChance, DB.smokeChance, 0, 1, "background.smokeChance"), smokeMinGap: num(B.smokeMinGap, DB.smokeMinGap, 0, 50, "background.smokeMinGap") };
    C.debug = { enabled: !!raw.debug?.enabled };
    return C;
  }

  /* ------------------------------ carga ------------------------------ */
  /* la galería del Showcase vive en showcase/ y fija window.__NOIR_BASE = "../" */
  const BASE = typeof root.__NOIR_BASE === "string" ? root.__NOIR_BASE : "";
  const rel = u => (/^(https?:|\/|data:|blob:)/.test(u) ? u : BASE + u);
  async function fetchJSON(url) { try { const r = await fetch(rel(url)); if (r.ok) return await r.json(); } catch (e) { /* siguiente */ } return null; }
  async function loadConfig() {
    const db = (BASE ? null : await fetchJSON("config.json")) || (await fetchJSON("assets/config.json"));
    if (!db) { warn("config.json no disponible: se usan los valores por defecto"); return validate(DEFAULTS); }
    const list = Array.isArray(db.configs) ? db.configs : [db];
    return validate(list.find(c => c.id === db.activeId) || list[0]);
  }
  async function loadFonts(C) {
    const jobs = Object.values(C.fonts).filter(f => f.src).map(f => {
      try {
        const face = new FontFace(f.family, `url("${encodeURI(rel(f.src))}")`, { weight: f.weightRange || String(f.weight) });
        doc.fonts.add(face);
        return face.load().catch(() => warn(`fuente no cargada: ${f.family} (${f.src})`));
      } catch (e) { warn(`fuente inválida: ${f.family}`); return null; }
    });
    await Promise.race([Promise.all(jobs), new Promise(res => later(res, 6000))]);
  }
  /* letra Whisper → palabras {text, start, end, seg} en mayúsculas */
  async function loadLyrics(C) {
    const data = await fetchJSON(C.lyricsUrl);
    if (!data) { warn(`no se pudo leer la letra (${C.lyricsUrl})`); return []; }
    const drops = C.lyricsFilter.dropPatterns.map(p => { try { const ci = p.startsWith("(?i)"); return new RegExp(ci ? p.slice(4) : p, ci ? "i" : ""); } catch (e) { warn(`lyricsFilter: patrón inválido ${p}`); return null; } }).filter(Boolean);
    const out = [];
    (data.segments || []).forEach((seg, si) => {
      if (drops.some(rx => rx.test(seg.text || ""))) return;
      let words = Array.isArray(seg.words) && seg.words.length ? seg.words.map(w => ({ text: w.word, start: +w.start, end: +w.end })) : null;
      if (!words) {
        const toks = String(seg.text || "").trim().split(/\s+/).filter(Boolean);
        const s0 = +seg.start, s1 = +seg.end, step = (s1 - s0) / Math.max(1, toks.length);
        words = toks.map((t, i) => ({ text: t, start: s0 + i * step, end: s0 + (i + 1) * step }));
      }
      for (const w of words) {
        const raw = String(w.text || "").trim().replace(/^[^\p{L}\p{N}¿¡']+|[^\p{L}\p{N}?!']+$/gu, "");
        const text = raw.toLocaleUpperCase("es");
        if (!text || !Number.isFinite(w.start) || !Number.isFinite(w.end) || drops.some(rx => rx.test(text))) continue;
        /* en la letra transcrita una mayúscula inicial suele abrir verso (salvo «I», «I'm»…) */
        const cap = /^\p{Lu}/u.test(raw) && !/^I(?:'|$)/.test(raw);
        out.push({ text, start: w.start, end: Math.max(w.start + 0.05, Math.min(w.end, w.start + C.lyricsFilter.maxWordSec)), seg: si, cap });
      }
    });
    out.sort((a, b) => a.start - b.start);
    return out;
  }

  /* --------------------------- frases y línea de tiempo --------------------------- */
  const chars = ws => ws.reduce((s, w) => s + [...w.text].length + 1, -1);
  /* 1) versos: cambio de segmento, mayúscula inicial o silencio; 2) cada verso largo se reparte
     en partes equilibradas (nunca deja una palabra suelta al final de un verso) */
  function buildPhrases(words, C) {
    const P = C.phrase, verses = [], out = [];
    let cur = [];
    for (const w of words) {
      if (cur.length) {
        const last = cur[cur.length - 1];
        if (w.start - last.end > P.gapSec || w.seg !== last.seg || w.cap || (w.start - last.end > 0.28 && cur.length >= 3)) { verses.push(cur); cur = []; }
      }
      cur.push(w);
    }
    if (cur.length) verses.push(cur);
    for (const v of verses) {
      const dur = v[v.length - 1].end - v[0].start;
      const k = Math.max(1, Math.ceil(v.length / P.maxWords), Math.ceil(chars(v) / P.maxChars), Math.ceil(dur / P.maxSec));
      if (k === 1) { out.push(v); continue; }
      for (const part of K.partition(v, Math.min(k, v.length)).lines) out.push(part);
    }
    const merged = [];
    for (const ph of out) {
      const prev = merged[merged.length - 1];
      if (prev && ph.length === 1 && prev.length < P.maxWords && ph[0].start - prev[prev.length - 1].end < 0.35 &&
          chars(prev) + 1 + [...ph[0].text].length <= P.maxChars) prev.push(ph[0]);
      else merged.push(ph);
    }
    return merged;
  }
  function layoutDeck(C, n, letters, aspect) {
    const d = { ...C.layouts.deck };
    const ok = { ghost: n <= 2 && letters <= 16, frame: n <= 4 && letters <= 26, bar: n <= 5 && letters <= 26, subtitle: n >= 2 && n <= 7,
      stack: n >= 3, quote: n >= 3, box: n >= 4, highlight: n >= 4 };
    for (const k in d) if (!ok[k]) delete d[k];
    if (aspect < 0.85) { if (d.stack) d.stack *= 1.5; if (d.highlight) d.highlight *= 1.2; if (d.bar) d.bar *= 0.8; }
    return d;
  }
  function buildTimeline(words, dur, C, aspect = 16 / 9) {
    const r = K.rng(C.seed), P = C.phrase, comp = C.components, scenes = [];
    let idx = 0;
    const push = sc => { sc.seed = (C.seed * 1000 + (idx++) * 7919) >>> 0; scenes.push(sc); return sc; };
    const phrases = buildPhrases(words, C);
    const glitch = comp.glitch ? C.effects.glitchSec : 0;
    const first = phrases.length ? phrases[0][0].start - P.leadSec : dur;
    if (comp.intro && first >= C.intro.minSec) push({ kind: "intro", t0: 0, t1: first, glitch });
    else if (first > 0.05) push({ kind: "pause", t0: 0, t1: first });

    const lastEnd = phrases.length ? phrases[phrases.length - 1].slice(-1)[0].end : 0;
    let outroT0 = Math.max(lastEnd + C.outro.leadSec, dur - C.outro.maxSec);
    if (dur - outroT0 < C.outro.minSec) outroT0 = Math.max(lastEnd + 0.1, dur - C.outro.minSec);

    const recent = [];
    let sinceSmoke = 99;
    const credit = C.credit.text || (C.credit.useArtist ? C.intro.artist : "");
    phrases.forEach((ph, i) => {
      const prevEnd = scenes.length ? scenes[scenes.length - 1].t1 : 0;
      const t0 = Math.max(prevEnd, ph[0].start - P.leadSec);
      if (t0 >= outroT0 - 0.1) return;
      const next = i + 1 < phrases.length ? phrases[i + 1][0].start - P.leadSec : outroT0;
      const natural = ph[ph.length - 1].end + P.holdSec;
      const t1 = Math.min(next, outroT0, natural + P.maxHoldSec);
      const n = ph.length, letters = ph.reduce((s, w) => s + [...w.text].length, 0);
      const deck = layoutDeck(C, n, letters, aspect);
      const layout = r.weighted(deck, recent.slice(-2)) || (n >= 3 ? "quote" : "ghost");
      recent.push(layout);
      const smoke = comp.smoke && sinceSmoke >= C.background.smokeMinGap && r() < C.background.smokeChance;
      sinceSmoke = smoke ? 0 : sinceSmoke + 1;
      push({ kind: "phrase", layout, t0, t1, glitch, smoke, credit: layout === "quote" ? credit : "",
        words: ph.map(w => ({ text: w.text, start: w.start - t0, end: w.end - t0 })) });
      const pauseEnd = Math.min(next, outroT0);
      if (pauseEnd - t1 > 0.3) push({ kind: "pause", t0: t1, t1: pauseEnd });
      else if (pauseEnd > t1) scenes[scenes.length - 1].t1 = pauseEnd;
    });
    if (!phrases.length) warn("letra vacía: solo intro, pausas y cierre");
    const fill = scenes.length ? scenes[scenes.length - 1].t1 : 0;
    if (outroT0 - fill > 0.3) push({ kind: "pause", t0: fill, t1: outroT0 });
    else if (scenes.length && outroT0 > fill) scenes[scenes.length - 1].t1 = outroT0;
    push({ kind: "outro", id: comp.outro, t0: outroT0, t1: Math.max(dur, outroT0 + C.outro.minSec) });
    scenes.sort((a, b) => a.t0 - b.t0);
    return scenes;
  }

  /* vista previa de una pieza suelta (Showcase) */
  const DEMO = {
    bar: "ARTE QUE SE MUEVE", stack: "LO SIMPLE SIEMPRE QUEDA PARA EL FINAL", quote: "LA GENTE OLVIDA LO QUE NO LE HABLA",
    ghost: "MODERNO", subtitle: "TODO PASA EL ESTILO QUEDA", frame: "ABSTRACTO TÍTULOS EN MOVIMIENTO", box: "CREAR ES SOLO TAN RARO COMO LO QUE MIRAS",
    highlight: "LA VIDA PASA MIENTRAS HACES OTROS PLANES", pause: ""
  };
  function previewScene(name, C, p, dur) {
    const key = name.replace(/^noir\./, "");
    if (key === "intro") { if (p.title !== undefined) C.intro.title = String(p.title).slice(0, 60); if (p.artist !== undefined) C.intro.artist = String(p.artist).slice(0, 60); if (!C.intro.title) C.intro.title = "Título"; return { kind: "intro", t0: 0, t1: dur, glitch: C.effects.glitchSec, seed: C.seed }; }
    if (key === "outrov1" || key === "outrov2") { for (const k of ["title", "sub", "feats"]) if (typeof p[k] === "string") C.outro[k] = p[k].slice(0, 60); return { kind: "outro", id: name, t0: 0, t1: dur, seed: C.seed }; }
    if (key === "pause") return { kind: "pause", t0: 0, t1: dur, seed: C.seed };
    const text = typeof p.text === "string" && p.text.trim() ? p.text : DEMO[key] || "NOIR";
    const ws = N.synthWords(text, 0.2, Math.min(0.32, (dur - 1.2) / Math.max(1, text.split(/\s+/).length)), 0.3);
    return { kind: "phrase", layout: key, t0: 0, t1: dur, glitch: C.effects.glitchSec, smoke: !!p.smoke, seed: C.seed,
      credit: key === "quote" ? (typeof p.credit === "string" ? p.credit : "NodeMotion") : "", words: ws };
  }

  /* ------------------------------ arranque ------------------------------ */
  async function boot() {
    const params = new URLSearchParams(location.search);
    const C = await loadConfig();
    const only = params.get("only");
    for (const name of params.getAll("c")) {
      const d = DECLARED.find(x => x.name === name);
      if (!d) { warn(`componente desconocido: ${name}`); continue; }
      if (d.group) C.components.outro = name; else C.components[d.key] = true;
    }
    const stage = $("stage"), type = $("type"), fade = $("fade"), audio = $("audio"), hud = $("hud");
    const DEBUG = C.debug.enabled || params.get("debug") === "1";
    const FROZEN = params.has("t") ? Math.max(0, parseFloat(params.get("t")) || 0) : null;
    const rs = doc.documentElement.style;
    for (const [k, v] of Object.entries({ bg: C.colors.bg, ink: C.colors.ink, dim: C.colors.dim, accent: C.colors.accent, credit: C.colors.credit })) rs.setProperty("--" + k, v);
    const aspect = params.get("aspect");
    if (only && aspect && /^\d+:\d+$/.test(aspect)) stage.dataset.aspect = aspect;
    N.background.init($("bg"), C);

    let words = [], dur = 30;
    if (!only) {
      audio.src = encodeURI(C.audio.src);
      if (FROZEN == null) audio.play().catch(() => { /* sin autoplay: reloj de pared hasta play */ });
      const durReady = new Promise(res => {
        if (isFinite(audio.duration) && audio.duration > 0) return res(audio.duration);
        audio.addEventListener("loadedmetadata", () => res(audio.duration), { once: true });
        audio.addEventListener("error", () => res(NaN), { once: true });
        later(() => res(NaN), 4000);
      });
      const [w, audioDur] = await Promise.all([loadLyrics(C), durReady, loadFonts(C)]);
      words = w;
      dur = isFinite(audioDur) && audioDur > 0 ? audioDur : (words.length ? words[words.length - 1].end + 3 : 30);
    } else {
      await loadFonts(C);
      dur = Math.min(12, Math.max(2, parseFloat(params.get("dur")) || 4.2));
    }
    K.measureCache.clear();
    let p = {};
    try { const q = params.get("p"); if (q && q.length <= 8192) p = JSON.parse(q) || {}; } catch (e) { warn("parámetro p inválido"); }
    if (only && !PIECES.includes(only)) warn(`pieza desconocida: ${only} (${PIECES.join(", ")})`);

    let W = 0, H = 0, scenes = [];
    const ctxOf = () => ({ W, H, u: Math.min(W, H) / 100, C, fonts: C.fonts });
    let ctx;
    function relayout() {
      const box = stage.getBoundingClientRect();
      W = Math.round(box.width); H = Math.round(box.height);
      ctx = ctxOf();
      N.background.resize(W, H);
      scenes = only ? [previewScene(only, C, p, dur)] : buildTimeline(words, dur, C, W / H);
    }
    relayout();
    let audioStarted = false;
    audio.addEventListener("playing", () => { audioStarted = true; });
    let cur = null, curIdx = -1;
    const sceneAt = t => { let lo = 0, hi = scenes.length - 1, ans = 0; while (lo <= hi) { const m = (lo + hi) >> 1; if (scenes[m].t0 <= t) { ans = m; lo = m + 1; } else hi = m - 1; } return ans; };
    function build(sc) {
      if (sc.kind === "intro") return R.intro(sc, ctx);
      if (sc.kind === "outro") return (R.outros[sc.id] || R.outros["noir.outrov1"])(sc, ctx);
      if (sc.kind === "pause") return R.pause(sc, ctx);
      return (R.scenes[sc.layout] || R.scenes.quote)(sc, ctx);
    }
    function render(t) {
      const i = sceneAt(t);
      if (i !== curIdx) {
        if (cur) cur.root.remove();
        cur = build(scenes[i]); curIdx = i;
        type.appendChild(cur.root);
      }
      const sc = scenes[i], d = sc.t1 - sc.t0;
      const lt = Math.min(Math.max(0, t - sc.t0), d);
      const st = cur.update(lt) || {};
      const smoke = Math.max(st.smoke || 0, sc.smoke ? Math.min(K.ease.out(K.prog(lt, 0, 0.6)), 1 - K.prog(lt, d - 0.4, 0.4)) : 0);
      N.background.draw(t, { smoke });
      const f = (st.fade || 0).toFixed(3);
      if (fade.style.opacity !== f) fade.style.opacity = f;
      if (DEBUG) hud.textContent = `t ${t.toFixed(2)} · #${i} ${sc.kind}${sc.layout ? ":" + sc.layout : ""} · ${(sc.words || []).map(w => w.text).join(" ")}`;
    }
    let wall0 = null, forced = FROZEN;
    const loop = only && params.get("loop") !== "0";
    const clock = now => {
      if (forced != null) return forced;
      if (!only && (audioStarted || audio.currentTime > 0)) return audio.currentTime;
      const s = (now - wall0) / 1000;
      return loop ? s % (dur + 0.6) : s;
    };
    function frame(now) {
      if (wall0 === null) wall0 = now;
      render(Math.min(clock(now), dur));
      if (forced == null) requestAnimationFrame(frame);
    }
    addEventListener("resize", () => { relayout(); K.measureCache.clear(); if (cur) cur.root.remove(); cur = null; curIdx = -1; if (forced != null) render(forced); });
    if (DEBUG) hud.style.display = "block";
    root.__noir = { config: C, scenes: () => scenes, seek(t) { forced = t; render(t); }, release() { forced = null; requestAnimationFrame(frame); }, duration: dur };
    if (forced != null) render(forced);
    requestAnimationFrame(frame);
  }

  N.player = { DEFAULTS, DECLARED, PIECES, validate, buildPhrases, buildTimeline, loadLyrics, loadFonts };
  if (!root.__NOIR_NO_BOOT) boot().catch(e => console.error("[lyrics-kinetic-noir] fallo de arranque", e));
})(typeof window !== "undefined" ? window : globalThis);
