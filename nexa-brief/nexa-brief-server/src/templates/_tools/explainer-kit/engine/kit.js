/* =============================================================================
   explainer-kit · núcleo
   -----------------------------------------------------------------------------
   Motor de videos explicativos narrados (voz + dibujos que aparecen en el
   momento exacto en que se dicen las palabras). Un video = 4 archivos:
     config.json      paleta, fuentes, subtítulos, familia de componentes
     song.mp3         la narración (el ÚNICO reloj: audio.currentTime)
     lyrics.json      transcripción Whisper con tiempos por palabra
     storyboard.json  lista de beats: { at:"palabras ancla", use:"componente", params:{…} }
   Los componentes viven en components/<familia>/*.js y se registran con
   Kit.register({ name, summary, params, create }). CATALOG.md se genera desde
   ese registro (tools/catalog.py), así la documentación no se desactualiza.

   Reglas que respeta (sandbox/AGENTS.md):
   · el tiempo sale de audio.currentTime (o de seek(t) en un render cuadro a
     cuadro): cada cuadro es función pura del tiempo → buscable y determinista;
   · todo lo configurable sale de config.json / storyboard.json;
   · medidas relativas: el escenario expone `u` (1% del lado corto) y cajas
     de contenido distintas para 9:16 y 16:9.
   ========================================================================== */
(function () {
  "use strict";
  const doc = document;

  /* ----------------------------- matemática ----------------------------- */
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const inv = (a, b, v) => clamp((v - a) / (b - a || 1e-9));
  const ease = {
    linear: p => p,
    in: p => p * p * p,
    out: p => 1 - Math.pow(1 - p, 3),
    inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    expoOut: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    back: p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
    sine: p => -(Math.cos(Math.PI * p) - 1) / 2,
  };
  /** progreso 0..1 de una animación que empieza en `start` y dura `dur` (con easing) */
  const prog = (t, start, dur, e = "out") => (ease[e] || ease.out)(clamp((t - start) / (dur || 1e-9)));
  function rng(seed) {                          /* mulberry32: mismo seed → misma secuencia */
    let a = (seed >>> 0) || 1;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  /* los signos se quitan SIN partir la palabra: "Berners-Lee" → "bernerslee" (igual en anclas y en la transcripción) */
  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ñ\s]+/g, "").replace(/\s+/g, " ").trim();

  /* ------------------------------ registro ------------------------------ */
  const registry = new Map(), families = new Map(), fonts = new Set();
  /**
   * Registra un componente.
   * def = { name:"familia.nombre", summary:"una línea", tags:[…], example:{…params},
   *         params:{ clave:{ type, default, doc, required?, min?, max?, options? } },
   *         create(ctx, p) → { render(lt, beat), dispose?(), points?(), hold? } }
   * `type`: string | number | color | bool | enum | image | icon | array | object
   */
  function register(def) {
    if (!/^[a-z]+\.[a-zA-Z0-9]+$/.test(def.name)) throw new Error(`Kit.register: nombre inválido ${def.name}`);
    if (typeof def.create !== "function") throw new Error(`Kit.register: ${def.name} sin create()`);
    def.params = def.params || {};
    registry.set(def.name, def);
  }
  /** runtime opcional por familia: setup(ctx) una vez, frame(t, ctx) cada cuadro (antes de los beats) */
  const family = (name, rt) => families.set(name, rt);
  /** valida y completa parámetros con sus defaults; resuelve colores "palette.x" */
  function resolveParams(def, raw, C) {
    const out = {}, errs = [];
    for (const [k, spec] of Object.entries(def.params)) {
      let v = raw && raw[k] !== undefined ? raw[k] : spec.default;
      if (v === undefined && spec.required) errs.push(`falta '${k}'`);
      if (spec.type === "number" && v != null) { v = +v; if (spec.min != null) v = Math.max(spec.min, v); if (spec.max != null) v = Math.min(spec.max, v); }
      if (spec.type === "enum" && v != null && spec.options && !spec.options.includes(v)) { errs.push(`'${k}'=${v} no está en ${spec.options}`); v = spec.default; }
      if (spec.type === "color" && typeof v === "string" && v.startsWith("palette.")) v = C.palette[v.slice(8)] || v;
      out[k] = v;
    }
    for (const k of Object.keys(raw || {})) if (!(k in def.params)) errs.push(`parámetro desconocido '${k}'`);
    if (errs.length) console.warn(`[kit] ${def.name}: ${errs.join("; ")}`);
    return out;
  }
  /** catálogo legible (lo usa tools/catalog.py y el prompt del director) */
  const catalog = () => [...registry.values()].map(d => ({
    name: d.name, summary: d.summary, tags: d.tags || [], layer: d.layer || "main",
    params: Object.fromEntries(Object.entries(d.params).map(([k, s]) => [k, { type: s.type, default: s.default, doc: s.doc, required: !!s.required, options: s.options, min: s.min, max: s.max }])),
    example: d.example || null,
  }));

  /* ------------------------------ escenario ------------------------------ */
  /** cajas en px según orientación: content = zona del dibujo, caption = subtítulos */
  function makeStage(W, H) {
    const portrait = H > W, u = Math.min(W, H) / 100;
    const content = portrait ? { x: 0.06 * W, y: 0.1 * H, w: 0.88 * W, h: 0.6 * H }
                             : { x: 0.12 * W, y: 0.08 * H, w: 0.76 * W, h: 0.7 * H };
    const caption = portrait ? { y: 0.79 * H, h: 0.1 * H } : { y: 0.86 * H, h: 0.09 * H };
    return { W, H, u, portrait, content, caption, cx: content.x + content.w / 2, cy: content.y + content.h / 2 };
  }

  /* ------------------------------ helpers DOM ------------------------------ */
  function el(tag, cls, css, parent) {
    const e = tag === "svg" || tag === "g" || tag === "path" ? doc.createElementNS("http://www.w3.org/2000/svg", tag) : doc.createElement(tag);
    if (cls) e.setAttribute("class", cls);
    if (css) Object.assign(e.style, css);
    if (parent) parent.appendChild(e);
    return e;
  }
  const imgCache = new Map();
  /** carga una imagen una sola vez (el director espera todas antes del primer cuadro) */
  function image(src) {
    if (!imgCache.has(src)) imgCache.set(src, new Promise(res => {
      const im = new Image(); im.decoding = "async";
      im.onload = () => {
        if (typeof im.decode === "function") im.decode().catch(() => {}).then(() => res(im));
        else res(im);
      };
      im.onerror = () => { console.warn("[kit] no carga", src); res(null); };
      im.src = src;
    }));
    return imgCache.get(src);
  }
  const loaded = new Map();               /* src → HTMLImageElement ya decodificada */

  /* ------------------------------ transcripción ------------------------------ */
  function wordsOf(lyrics) {
    const out = [];
    for (const s of lyrics?.segments || []) for (const w of s.words || []) {
      const text = String(w.word || "").trim();
      if (text) out.push({ text, start: +w.start, end: +(w.end ?? w.start + 0.3), n: norm(text) });
    }
    return out;
  }
  /** "Las combinaciones posibles" → índice de la 1ª palabra, buscando desde `from` */
  function findAnchor(words, anchor, from = 0) {
    const toks = norm(anchor).split(/\s+/).filter(Boolean);
    if (!toks.length) return -1;
    for (let i = from; i < words.length; i++) {
      let ok = true;
      for (let k = 0; k < toks.length && ok; k++) ok = words[i + k] && words[i + k].n === toks[k];
      if (ok) return i;
    }
    /* tolerancia: Whisper a veces une/separa palabras → probar solo la primera palabra */
    for (let i = from; i < words.length; i++) if (words[i].n === toks[0] || words[i].n.startsWith(toks[0])) return i;
    return -1;
  }
  /**
   * Resuelve el storyboard a tiempos absolutos:
   *   at:"texto ancla" | t:segundos   (+ offset)    → t0
   *   until:"texto" | dur:segundos | (siguiente beat de la misma capa) → t1
   */
  function resolveBeats(sb, words, total) {
    const beats = [], miss = [];
    let cursor = 0;
    sb.beats.forEach((b, i) => {
      let t0 = b.t, wi = -1;
      if (t0 == null && b.at) {
        wi = findAnchor(words, b.at, cursor);
        if (wi < 0) { miss.push(b.at); wi = findAnchor(words, b.at, 0); }
        t0 = wi >= 0 ? words[wi].start : (beats.length ? beats[beats.length - 1].t0 + 2 : 0);
        if (wi >= 0) cursor = wi;
      }
      t0 = Math.max(0, (t0 ?? 0) + (b.offset ?? sb.defaults?.offset ?? -0.12));
      beats.push({ ...b, i, t0, wordIndex: wi, layer: b.layer || registry.get(b.use)?.layer || "main" });
    });
    if (miss.length) console.warn("[kit] anclas no encontradas:", miss);
    /* parámetros anclados a palabras: "@seguimos" → segundos desde el inicio del beat hasta
       que la voz dice esa palabra (para sincronizar eventos internos: un ✓, una aguja…) */
    beats.forEach(b => {
      if (!b.params) return;
      const p2 = {};
      for (const [k, v] of Object.entries(b.params)) {
        if (typeof v === "string" && v.startsWith("@")) {
          const wi = findAnchor(words, v.slice(1), Math.max(0, b.wordIndex));
          p2[k] = wi >= 0 ? Math.max(0, words[wi].start - b.t0) : undefined;
          if (wi < 0) miss.push(v);
        } else p2[k] = v;
      }
      b.params = p2;
    });
    beats.forEach((b, i) => {
      if (b.dur != null) b.t1 = b.t0 + b.dur;
      else if (b.until) { const wi = findAnchor(words, b.until, Math.max(0, b.wordIndex)); b.t1 = wi >= 0 ? words[wi].start : b.t0 + 3; }
      else { const nx = beats.slice(i + 1).find(x => x.layer === b.layer); b.t1 = nx ? nx.t0 : total; }
      b.dur = Math.max(0.2, b.t1 - b.t0);
    });
    if (miss.length) console.warn("[kit] anclas no encontradas:", miss);
    return beats;
  }

  /* ------------------------------ subtítulos ------------------------------ */
  /** agrupa palabras en frases cortas (≤ maxWords, corta en puntuación o pausas) */
  function captionChunks(words, o) {
    const chunks = []; let cur = [];
    const push = () => { if (cur.length) chunks.push({ words: cur, t0: cur[0].start, t1: cur[cur.length - 1].end }); cur = []; };
    words.forEach((w, i) => {
      const gap = cur.length ? w.start - cur[cur.length - 1].end : 0;
      if (cur.length && (cur.length >= o.maxWords || gap > o.gap)) push();
      cur.push(w);
      if (/[.!?…:;]$/.test(w.text) || (/,$/.test(w.text) && cur.length >= 3)) push();
    });
    push();
    chunks.forEach((c, i) => { const nx = chunks[i + 1]; c.t1 = Math.min(c.t1 + o.hold, nx ? nx.t0 : c.t1 + o.hold); });
    return chunks;
  }

  /** mezcla profunda (objetos), los arrays y valores simples de `b` reemplazan a los de `a` */
  function deepMerge(a, b) {
    if (!b || typeof b !== "object" || Array.isArray(b)) return b === undefined ? a : b;
    const out = { ...(a || {}) };
    for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === "object" && !Array.isArray(v) ? deepMerge(out[k], v) : v;
    return out;
  }

  /* ------------------------------ director ------------------------------ */
  async function loadJSON(...urls) {
    for (const u of urls) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) {} }
    return null;
  }

  /**
   * Arranca un video.  opts = { root, configUrls:[…] }
   * Expone window.__promo = { scenes(), seek(t) → Promise, release() } para
   * el render cuadro a cuadro (mismo contrato que las plantillas promo-*).
   */
  async function boot(opts = {}) {
    const raw = opts.config || await loadJSON(...(opts.configUrls || ["config.json", "assets/config.json"]));
    const C0 = raw && raw.configs ? raw.configs[0] : raw;
    if (!C0) throw new Error("[kit] sin config");
    /* el diseño (designs/<d>/design.json) da los valores por defecto: paleta, fuentes, subtítulos,
       cierre…; el config.json del video solo escribe lo que cambia */
    const D = opts.design || window.Kit.design || null;
    const C = deepMerge(D?.defaults || {}, C0);
    if (!C.family && D) C.family = D.family;
    const QS = new URLSearchParams(location.search);
    const FROZEN = QS.has("t") ? parseFloat(QS.get("t")) : null;
    const CONTROLLED = QS.get("controls") === "1";
    const SYNTHETIC_CLOCK = CONTROLLED && QS.get("clock") === "synthetic";
    /* Solo el reproductor normal prioriza el primer cuadro; capturas y relojes sintéticos
       conservan la precarga completa para que sus cuadros sigan siendo deterministas. */
    const PREVIEW_FIRST_FRAME = CONTROLLED && !SYNTHETIC_CLOCK && FROZEN == null;
    const root = opts.root || doc.getElementById("stage");
    root.style.background = C.palette.bg;
    doc.body.style.background = C.palette.bg;

    const [lyrics, sb] = await Promise.all([opts.lyrics || loadJSON(C.lyricsUrl), opts.storyboard || loadJSON(C.storyboardUrl)]);
    const words = wordsOf(lyrics);
    const audio = doc.getElementById("audio") || {
      readyState: 1, duration: 0, currentTime: 0, paused: true,
      addEventListener() {}, play() { return Promise.resolve(); },
    };
    /* el loader puede haberlo asignado ya: reasignar el mismo src reinicia la carga */
    if (C.audio?.src && audio.getAttribute?.("src") !== C.audio.src) audio.src = C.audio.src;
    const lyricsDuration = Number(lyrics?.metadata?.duration);
    const durationEstimate = Number.isFinite(lyricsDuration) && lyricsDuration > 0
      ? lyricsDuration
      : (words.at(-1)?.end ?? 10) + 2;
    /* La vista viva usa la duración de la transcripción y no descarga el audio
       antes de pintar. Capturas y renders siguen tomando la duración real del audio. */
    const total = opts.total || (PREVIEW_FIRST_FRAME ? durationEstimate : await new Promise(res => {
      const done = () => res(isFinite(audio.duration) && audio.duration > 0 ? audio.duration : durationEstimate);
      if (audio.readyState >= 1) done(); else { audio.addEventListener("loadedmetadata", done, { once: true }); setTimeout(done, 3000); }
    }));
    const START_AT = clamp(opts.startAt ?? 0, 0, total);
    const INITIAL_TIME = FROZEN != null ? clamp(FROZEN, 0, total) : START_AT;
    /* cierre (gracias por ver · canal · suscribite · apoyo): se agrega solo al final del audio
       (la narración deja varios segundos de silencio para esto). config.outro.enabled=false lo apaga.
       Con cierre con voz (tools/outro.py) config.outro.start/dur dicen dónde empieza la voz del cierre. */
    const SB = sb ? { ...sb, beats: [...sb.beats] } : { beats: [] };
    const O = C.outro;
    if (O && O.enabled !== false && !SB.beats.some(b => /\.outro$/.test(b.use))) {
      const use = O.use || `${C.family}.outro`;
      if (registry.has(use)) {
        /* nunca encima de la voz: empieza después de la última palabra (y dura lo que quede) */
        const lastWord = words.length ? words[words.length - 1].end + 0.35 : 0;
        const t0 = O.start != null ? O.start : Math.max(total - Math.min(O.dur ?? 5, total * 0.3), lastWord);
        const dur = total - t0, p = {};
        for (const k of Object.keys(registry.get(use).params)) if (O[k] !== undefined) p[k] = O[k];
        if (dur >= 2.5) SB.beats.push({ t: t0, offset: 0, use, params: p, dur, hideCaptions: true });
      }
    }
    const beats = resolveBeats(SB, words, total);

    /* En la reproducción en vivo se esperan solo las imágenes visibles al abrir.
       Las demás se precargan después del primer cuadro; las capturas mantienen la carga completa. */
    const wait = (pr, ms) => Promise.race([pr, new Promise(r => setTimeout(r, ms))]);
    /* La vista en vivo no debe quedarse esperando fuentes remotas: usa el fallback
       en el primer cuadro y el bucle vuelve a dibujar cuando la fuente termine de cargar. */
    const fontWaitMs = PREVIEW_FIRST_FRAME ? 700 : 10000;
    const fontLoads = [...new Set([...(C.fonts?.load || []), ...fonts])].map(f => wait(doc.fonts.load(f).catch(() => {}), fontWaitMs));
    const imgs = new Set();
    const firstFrameImgs = new Set();
    for (const b of beats) {
      const activeAtInitial = INITIAL_TIME >= b.t0 &&
        INITIAL_TIME < b.t1 + (registry.get(b.use)?.post ?? (C.transition?.overlap ?? 0.6));
      for (const [k, v] of Object.entries(b.params || {})) {
        if (registry.get(b.use)?.params?.[k]?.type !== "image" || !v) continue;
        imgs.add(v);
        if (!PREVIEW_FIRST_FRAME || activeAtInitial) firstFrameImgs.add(v);
      }
    }
    const loadImage = async src => {
      const im = await image(src);
      if (im) loaded.set(src, im);
    };
    await Promise.all([...fontLoads, ...[...firstFrameImgs].map(loadImage)]);
    if (!PREVIEW_FIRST_FRAME) await wait(doc.fonts.ready, 10000);
    const deferredImgs = PREVIEW_FIRST_FRAME
      ? [...imgs].filter(src => !firstFrameImgs.has(src))
      : [];

    /* capas: fondo (canvas), principal (canvas + svg), overlay (dom), subtítulos */
    let stage = makeStage(root.clientWidth || innerWidth, root.clientHeight || innerHeight);
    const layers = {};
    const mkCanvas = (cls, z) => { const c = el("canvas", cls, { position: "absolute", inset: "0", width: "100%", height: "100%", zIndex: z }, root); return c; };
    layers.bg = mkCanvas("k-bg", 0);
    layers.main = mkCanvas("k-main", 1);
    layers.svg = el("svg", "k-svg", { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", zIndex: 2, overflow: "visible" }, root);
    layers.dom = el("div", "k-dom", { position: "absolute", inset: "0", zIndex: 3, pointerEvents: "none" }, root);
    layers.top = mkCanvas("k-top", 4);
    layers.cap = el("div", "k-cap", { position: "absolute", left: "0", right: "0", zIndex: 5, textAlign: "center", pointerEvents: "none" }, root);
    const dpr = opts.dpr || Math.min(2, window.devicePixelRatio || 1);
    function size() {
      stage = makeStage(root.clientWidth || innerWidth, root.clientHeight || innerHeight);
      for (const k of ["bg", "main", "top"]) { layers[k].width = Math.round(stage.W * dpr); layers[k].height = Math.round(stage.H * dpr); }
      layers.svg.setAttribute("viewBox", `0 0 ${stage.W} ${stage.H}`);
      Object.assign(layers.cap.style, { top: stage.caption.y + "px", height: stage.caption.h + "px" });
    }
    size();

    const ctx = {
      C, words, beats, total, layers, dpr, Kit,
      get stage() { return stage; },
      g: { bg: layers.bg.getContext("2d"), main: layers.main.getContext("2d"), top: layers.top.getContext("2d") },
      img: src => loaded.get(src) || null,
      family: {},
    };
    for (const [name, rt] of families) if (rt.setup) ctx.family[name] = rt.setup(ctx) || {};

    /* instancias de beats: se crean al entrar a su ventana y se destruyen al salir */
    const live = new Map();
    const PRE = 0.0, POST = C.transition?.overlap ?? 0.6;
    function instance(b) {
      let inst = live.get(b.i);
      if (!inst) {
        const def = registry.get(b.use);
        if (!def) { console.warn("[kit] componente desconocido", b.use); inst = { render() {}, dispose() {} }; }
        else {
          const p = resolveParams(def, b.params, C);
          const r = rng(hash(`${C.seed ?? 1}:${b.i}:${b.use}`));
          try { inst = def.create({ ...ctx, stage, beat: b, rng: r, def }, p) || {}; } catch (e) { console.error("[kit] create falló", b.use, e); inst = {}; }
          inst.p = p;
        }
        live.set(b.i, inst);
      }
      return inst;
    }
    const capChunks = captionChunks(words, { maxWords: C.captions?.maxWords ?? 5, gap: C.captions?.gap ?? 0.6, hold: C.captions?.hold ?? 0.35 });
    let capKey = "";

    function renderCaptions(t) {
      if (C.captions?.enabled === false) return;
      const ch = capChunks.find(c => t >= c.t0 - 0.05 && t < c.t1);
      const hide = beats.some(b => b.hideCaptions && t >= b.t0 && t < b.t1);
      const key = ch && !hide ? ch.t0 + "|" + ch.words.filter(w => w.start <= t + 0.02).length : "";
      if (key === capKey) return;
      capKey = key; layers.cap.innerHTML = "";
      if (!key) return;
      const box = el("div", "k-cap-line", { display: "inline-block", maxWidth: "86%" }, layers.cap);
      ch.words.forEach((w, i) => {
        if (w.start > t + 0.02) return;
        const cur = i === ch.words.filter(x => x.start <= t + 0.02).length - 1;
        el("span", cur ? "k-w k-w-cur" : "k-w", null, box).textContent = w.text + " ";
      });
    }

    function render(t) {
      t = clamp(t, 0, total);
      for (const k of ["bg", "main", "top"]) { const g = ctx.g[k]; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, stage.W, stage.H); }
      for (const [name, rt] of families) if (rt.frame) rt.frame(t, ctx, ctx.family[name]);
      const active = beats.filter(b => t >= b.t0 - PRE && t < b.t1 + (registry.get(b.use)?.post ?? POST));
      const ids = new Set(active.map(b => b.i));
      for (const [i, inst] of live) if (!ids.has(i)) { try { inst.dispose && inst.dispose(); } catch (e) {} live.delete(i); }
      /* orden de dibujo: capa main primero, overlay después; dentro, por inicio */
      active.sort((a, b) => (a.layer === b.layer ? a.t0 - b.t0 : a.layer === "main" ? -1 : 1));
      for (const b of active) {
        const inst = instance(b);
        try { inst.render && inst.render(t - b.t0, b, t); } catch (e) { console.error("[kit] render falló", b.use, e); }
      }
      for (const [name, rt] of families) if (rt.post) rt.post(t, ctx, ctx.family[name]);
      renderCaptions(t);
      if (opts.hud) opts.hud(t, active);
    }

    /* reloj: audio si suena; si no (sin gesto del usuario) reloj de pared */
    let forced = FROZEN, t0wall = null;
    const LOOP = QS.has("loop");          /* galería: repetir en bucle sin audio */
    /* ?controls=1 (modal de la app, ver engine/player.js): el audio es el único reloj,
       así pausa/adelantar/retroceder muestran el cuadro exacto y se sigue dibujando en pausa */
    const clock = now => forced != null ? forced
      : CONTROLLED ? (SYNTHETIC_CLOCK ? (window.__nexaClock?.currentTime || 0) : (audio.currentTime || 0))
      : (!audio.paused && audio.currentTime > 0) ? audio.currentTime
      : (t0wall == null ? (t0wall = now, START_AT) : LOOP ? START_AT + ((now - t0wall) / 1000) % Math.max(total - START_AT, 0.001) : START_AT + (now - t0wall) / 1000);
    function frame(now) {
      const t = clock(now);
      render(t);
      /* Al llegar al final se conserva el último cuadro; solo ?loop habilita otro ciclo. */
      if (forced == null && (LOOP || CONTROLLED || t < total)) requestAnimationFrame(frame);
    }
    addEventListener("resize", () => { size(); for (const inst of live.values()) inst.dispose && inst.dispose(); live.clear(); for (const [name, rt] of families) if (rt.resize) rt.resize(ctx, ctx.family[name]); });

    window.__promo = {
      scenes: () => beats.map(b => ({ t0: b.t0, t1: b.t1, type: b.use, seg: { text: b.at || "" } })).concat([{ t0: total, t1: total, type: "end", seg: { text: "" } }]),
      async seek(t) { forced = t; render(t); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); },
      release() { forced = null; requestAnimationFrame(frame); },
      beats, total, words,
    };
    if (FROZEN == null && !QS.has("paused") && !CONTROLLED) audio.play().catch(() => {});
    /* Dibuja antes de anunciar que el reproductor está listo: el audio no debe revelar
       un canvas todavía vacío. Esperamos dos frames para que el navegador pinte el inicial. */
    render(clock(performance.now()));
    requestAnimationFrame(frame);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (deferredImgs.length) setTimeout(() => {
      let next = 0;
      const worker = async () => {
        while (next < deferredImgs.length) {
          const src = deferredImgs[next++];
          const im = await image(src);
          if (im) loaded.set(src, im);
        }
      };
      const workers = Array.from({ length: Math.min(2, deferredImgs.length) }, () => worker());
      void Promise.all(workers).catch(error => console.warn("[kit] precarga en segundo plano falló", error));
    }, 0);
    return ctx;
  }

  window.Kit = { register, family, registry, fonts, catalog, resolveParams, boot, el, image, loaded, makeStage, deepMerge,
                 clamp, lerp, inv, ease, prog, rng, hash, norm, wordsOf, findAnchor, captionChunks };
})();
