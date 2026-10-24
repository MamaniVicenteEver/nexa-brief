/* proto.js · núcleo COMPARTIDO de los motores prototipo de la casa de pruebas
 * (nodehistory/_mapas = mapas satelitales · nodeaction/_pizarra = pizarra con personaje).
 *
 * Lo que es igual en todos los videos vive acá UNA vez:
 *   - carga: config.json → assets/config.json, escena, letra (Whisper), fuentes, imágenes
 *   - tiempos: número o "@palabra" ("@dos palabras", "#2", ":end", "+0.3")
 *   - reproductor: el tiempo SIEMPRE sale del audio; ▶ si el navegador bloquea el autoplay
 *   - contrato de grabación window.__promo (seek(t) puro → render cuadro a cuadro)
 *   - subtítulos (grupos de N palabras, estilo y altura por motor/escena)
 *   - INTRO (v1 golpe · v2 pregunta + revelación) y CIERRE de canal con el orden de producción:
 *     gracias → canal → LIKE → flecha → SUSCRÍBETE + campana → apoyo → dirección (sin recuadro).
 *
 * Un motor registra: Proto.run({ name, fonts, theme, async setup(ctx), render(ctx, t), shots?(ctx) }).
 * La escena puede traer: intro {style:"v1"|"v2", …}, outro {…}, captions {…}, end.
 * Determinismo: nada de Math.random/Date/timers; todo sale de t.
 */
(() => {
  "use strict";
  const QS = new URLSearchParams(location.search);

  /* ---------- utilidades ---------- */
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = k => (k = clamp(k), k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const easeOut = k => 1 - Math.pow(1 - clamp(k), 3);
  const back = (k, c = 1.7) => { k = clamp(k); return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]/g, "").trim();
  const hex = c => { c = String(c).replace("#", ""); if (c.length === 3) c = [...c].map(x => x + x).join(""); return [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16)); };
  const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };
  const mixW = (c, k) => { const [r, g, b] = hex(c); return `rgb(${[r, g, b].map(v => Math.round(lerp(v, 255, k))).join(",")})`; };
  const U = { clamp, lerp, ease, easeOut, back, norm, hex, rgba, mixW };

  /* ---------- anclas a la voz ---------- */
  function makeTimer(words, tag = "proto") {
    const W = words.map(w => ({ w: norm(w.word), s: w.start, e: w.end }));
    const missing = new Set();
    function T(v, fb = 0) {
      if (v == null) return fb;
      if (typeof v === "number") return v;
      let s = String(v).trim();
      if (!s.startsWith("@")) return isFinite(parseFloat(s)) ? parseFloat(s) : fb;
      s = s.slice(1);
      let off = 0, m = s.match(/([+-]\d+(?:\.\d+)?)$/);
      if (m) { off = parseFloat(m[1]); s = s.slice(0, -m[1].length); }
      let atEnd = false; if (s.endsWith(":end")) { atEnd = true; s = s.slice(0, -4); }
      let nth = 1; m = s.match(/#(\d+)$/); if (m) { nth = +m[1]; s = s.slice(0, -m[0].length); }
      const toks = norm(s).split(/\s+/).filter(Boolean); let hit = 0;
      for (let i = 0; i + toks.length <= W.length; i++)
        if (toks.every((tk, j) => W[i + j].w === tk) && ++hit === nth) return (atEnd ? W[i + toks.length - 1].e : W[i].s) + off;
      if (!missing.has(v)) { missing.add(v); console.warn(`[${tag}] ancla no encontrada:`, v); }
      return fb;
    }
    T.missing = missing;
    return T;
  }

  /* ---------- subtítulos ---------- */
  function buildCaptions(words, end, cfg) {
    const max = cfg.maxWords || 4, gap = cfg.gap ?? 0.45, caps = [];
    let cur = [];
    const flush = () => { if (cur.length) caps.push({ t0: cur[0].start, t1: cur[cur.length - 1].end, text: cur.map(w => w.word.trim()).join(" ").replace(/[.,;:¿?¡!]+$/g, "") }); cur = []; };
    for (const w of words) {
      if (w.start > end) break;
      if (cur.length && (cur.length >= max || w.start - cur[cur.length - 1].end > gap)) flush();
      cur.push(w); if (/[.,;:?!]$/.test(w.word.trim())) flush();
    }
    flush();
    caps.forEach((c, i) => { c.t1 = Math.min(i + 1 < caps.length ? caps[i + 1].t0 : c.t1 + 0.6, c.t1 + 0.6); });
    return caps;
  }
  function drawCaption(g, st, caps, t, cfg) {
    const c = caps.find(c => t >= c.t0 && t < c.t1); if (!c) return;
    const land = st.W > st.H;
    const size = (cfg.size || 34) * st.U * (land ? 1.1 : 1);
    const y = st.H * (land ? cfg.yLandscape ?? 0.915 : cfg.y ?? 0.885);
    const text = cfg.upper === false ? c.text : c.text.toUpperCase(), k = back((t - c.t0) / 0.18);
    g.save(); g.font = `${cfg.weight || 800} ${size}px ${cfg.font || "Montserrat, sans-serif"}`; g.textAlign = "center"; g.textBaseline = "middle";
    g.translate(st.W / 2, y); g.scale(lerp(0.85, 1, k), lerp(0.85, 1, k));
    if (cfg.stroke !== false) { g.lineJoin = "round"; g.lineWidth = size * 0.22; g.strokeStyle = cfg.strokeColor || "#000"; g.strokeText(text, 0, 0); }
    g.fillStyle = cfg.color || "#ffd21a"; g.fillText(text, 0, 0); g.restore();
  }

  /* ---------- INTRO y CIERRE (estándar de producción, dibujado por tema) ---------- */
  // palabras con acento '^x^' por renglón
  function hookWords(text) {
    return String(text || "").split("\n").map(line => {
      const out = []; line.split("^").forEach((seg, k) => seg.split(/\s+/).filter(Boolean).forEach(w => out.push({ w, acc: k % 2 === 1 }))); return out;
    });
  }
  function fitFont(g, lines, font, maxW, maxH) {
    let s = maxH;
    for (const L of lines) { g.font = `${font.replace("$", 100)}`; const w = g.measureText(L.map(x => x.w).join(" ")).width; s = Math.min(s, (maxW / w) * 100); }
    return s;
  }
  function drawIntro(g, st, I, t, th) {
    const dur = I.dur ?? 5, lt = t; if (lt > dur + 0.4) return;
    const word = (s, x, y, sz, c, ce) => th.word(g, s, x === -1 ? st.W / 2 : x, y, sz, c, ce);
    const out = 1 - clamp((lt - dur) / 0.4), W = st.W, H = st.H, port = H > W;
    g.save(); g.globalAlpha = out;
    if (I.dim ?? th.introDim) { g.fillStyle = `rgba(0,0,0,${(I.dim ?? th.introDim) * clamp(lt / 0.5)})`; g.fillRect(0, 0, W, H); }
    const heavy = th.heavy || "900 $px Montserrat", ink = th.introInk || "#fff", acc = th.accent || "#ffd21a";
    if (I.kicker) { // rótulo chico arriba
      const ks = 26 * st.U, k = easeOut((lt - 0.15) / 0.4);
      g.globalAlpha = out * k; g.font = (th.kickerFont || "800 $px Montserrat").replace("$", ks); g.textAlign = "center"; g.textBaseline = "middle";
      const tw = g.measureText(I.kicker.toUpperCase()).width + ks * 1.2;
      g.fillStyle = th.kickerBg || "rgba(0,0,0,.85)"; g.fillRect(W / 2 - tw / 2, H * (port ? 0.3 : 0.24) - ks * 0.8, tw, ks * 1.6);
      g.fillStyle = th.kickerInk || "#fff"; g.fillText(I.kicker.toUpperCase(), W / 2, H * (port ? 0.3 : 0.24));
      g.globalAlpha = out;
    }
    if ((I.style || "v1") === "v1") { // GOLPE: el titular entra palabra por palabra con sacudida
      const lines = hookWords(String(I.text || "").toUpperCase()), at0 = I.wordAt ?? 0.45, stg = I.stagger ?? 0.28;
      const fs = fitFont(g, lines, heavy, W * (port ? 0.88 : 0.76), H * (port ? 0.11 : 0.17));
      let n = 0, sx = 0, sy = 0; const hits = [];
      lines.forEach(L => L.forEach(w => { w.at = at0 + n++ * stg; hits.push(w.at); }));
      for (const h of hits) { const d = lt - h; if (d >= 0 && d < 0.3) { const a = (1 - d / 0.3) * 9 * st.U; sx += Math.sin(d * 71) * a; sy += Math.cos(d * 53) * a * 0.7; } }
      g.translate(sx, sy); g.font = heavy.replace("$", fs); g.textBaseline = "middle"; g.textAlign = "left";
      const y0 = H * (port ? 0.45 : 0.47) - ((lines.length - 1) * fs * 1.02) / 2;
      lines.forEach((L, li) => {
        const sp = g.measureText(" ").width, ws = L.map(w => g.measureText(w.w).width), tot = ws.reduce((a, b) => a + b, 0) + sp * (L.length - 1);
        let x = W / 2 - tot / 2;
        L.forEach((w, i) => {
          const k = (lt - w.at) / 0.22;
          if (k >= 0) {
            const sc = lerp(1.7, 1, back(k, 2.2)); g.save(); g.translate(x + ws[i] / 2, y0 + li * fs * 1.02); g.scale(sc, sc);
            g.globalAlpha = out * clamp(k * 3); word(w.w, -ws[i] / 2, 0, fs, w.acc ? acc : ink); g.restore();
          }
          x += ws[i] + sp;
        });
      });
      if (I.sub) { const ss = 30 * st.U, k = easeOut((lt - (at0 + n * stg + 0.2)) / 0.5); g.globalAlpha = out * k; g.font = (th.subFont || "800 $px Montserrat").replace("$", ss); g.textAlign = "center"; word(I.sub, -1, y0 + lines.length * fs * 1.02 + ss * 0.6, ss, th.subInk || ink, true); }
    } else { // v2 PREGUNTA + REVELACIÓN
      const q = String(I.question || I.text || ""), rev = I.revealAt ?? dur * 0.55, qs = (port ? 54 : 62) * st.U;
      g.font = heavy.replace("$", qs); g.textAlign = "center"; g.textBaseline = "middle";
      const nCh = Math.floor(clamp((lt - 0.3) / Math.max(0.6, rev - 0.6)) * q.length);
      const qa = rev < lt ? 1 - clamp((lt - rev) / 0.35) * 0.55 : 1;
      g.globalAlpha = out * qa; wrapCenter(g, q.slice(0, nCh), W / 2, H * (port ? 0.38 : 0.36), W * (port ? 0.86 : 0.7), qs * 1.12, (s, x, y) => word(s, x, y, qs, ink, true));
      if (lt >= rev && I.answer) {
        const as = (port ? 104 : 130) * st.U, k = (lt - rev) / 0.3, sc = lerp(1.6, 1, back(k, 2.2));
        g.save(); g.globalAlpha = out * clamp(k * 3); g.translate(W / 2, H * (port ? 0.56 : 0.6)); g.scale(sc, sc);
        g.font = heavy.replace("$", as); g.textAlign = "center"; word(String(I.answer).toUpperCase(), 0, 0, as, acc, true); g.restore();
      }
    }
    g.restore();
  }
  function wrapCenter(g, text, cx, cy, maxW, lh, draw) {
    const words = text.split(" "), lines = [""];
    for (const w of words) { const tr = lines[lines.length - 1] ? lines[lines.length - 1] + " " + w : w; if (g.measureText(tr).width > maxW && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = tr; }
    lines.forEach((l, i) => draw(l, cx, cy + (i - (lines.length - 1) / 2) * lh));
  }
  function outroTimes(O, dur) { // mismo contrato que designs/common/hook.js (se comprime si dura poco)
    const sc = Math.min(1, Math.max(0.3, (dur - 0.35) / 4.65));
    const likeAt = (O.likeAt ?? 1) * sc, subAt = Math.max((O.subscribeAt ?? 2.5) * sc, likeAt + 0.25);
    const bellAt = Math.max((O.bellAt ?? 3.25) * sc, subAt + 0.3), supAt = Math.max((O.supportAt ?? 3.65) * sc, bellAt + 0.25);
    return { likeAt, subAt, bellAt, supAt };
  }
  function thumb(g, x, y, s, col) { // pulgar arriba de línea
    g.save(); g.translate(x, y); g.lineJoin = "round"; g.lineWidth = s * 0.08; g.strokeStyle = col; g.fillStyle = "transparent";
    g.beginPath(); g.rect(-s * 0.5, -s * 0.05, s * 0.22, s * 0.5); g.stroke();
    g.beginPath(); g.moveTo(-s * 0.22, -s * 0.02); g.lineTo(-s * 0.05, -s * 0.42); g.quadraticCurveTo(s * 0.08, -s * 0.55, s * 0.06, -s * 0.2);
    g.lineTo(s * 0.42, -s * 0.2); g.quadraticCurveTo(s * 0.55, -s * 0.15, s * 0.45, s * 0.02); g.lineTo(s * 0.36, s * 0.42); g.lineTo(-s * 0.22, s * 0.45); g.closePath(); g.stroke();
    g.restore();
  }
  function bell(g, x, y, s, col, t) {
    g.save(); g.translate(x, y); g.rotate(Math.sin(t * 18) * 0.25 * Math.max(0, 1 - t)); g.fillStyle = col;
    g.beginPath(); g.moveTo(-s * 0.4, s * 0.3); g.quadraticCurveTo(-s * 0.35, -s * 0.45, 0, -s * 0.45); g.quadraticCurveTo(s * 0.35, -s * 0.45, s * 0.4, s * 0.3); g.closePath(); g.fill();
    g.fillRect(-s * 0.48, s * 0.28, s * 0.96, s * 0.1); g.beginPath(); g.arc(0, s * 0.48, s * 0.1, 0, Math.PI * 2); g.fill(); g.restore();
  }
  function drawOutro(g, st, O, t0, dur, t, th) {
    const lt = t - t0; if (lt < 0) return;
    const word = (s, x, y, sz, c, ce) => th.word(g, s, x === -1 ? st.W / 2 : x, y, sz, c, ce);
    const W = st.W, H = st.H, port = H > W, u = st.U * (port ? 1.3 : 1), k0 = clamp(lt / 0.5);
    const T = outroTimes(O, dur), ink = th.outroInk || "#fff", acc = th.accent || "#ffd21a";
    g.save();
    if (th.outroBg) th.outroBg(g, st, k0); else { g.fillStyle = `rgba(0,0,0,${0.86 * k0})`; g.fillRect(0, 0, W, H); }
    const cy = H * (port ? 0.42 : 0.4), heavy = th.heavy || "900 $px Montserrat";
    g.textAlign = "center"; g.textBaseline = "middle";
    // gracias
    g.globalAlpha = easeOut(lt / 0.4); g.font = (th.kickerFont || "800 $px " + (th.ui || "Montserrat")).replace("$", 28 * u); word((O.thanks || "GRACIAS POR VER"), -1, cy - 120 * u, 28 * u, ink, true);
    // canal (grande)
    const cs = (port ? 92 : 110) * u, kc = (lt - 0.25) / 0.35;
    if (kc > 0) { g.save(); g.globalAlpha = clamp(kc * 3); g.translate(W / 2, cy - 30 * u); const sc = lerp(1.4, 1, back(kc, 2)); g.scale(sc, sc); g.font = heavy.replace("$", cs); word(O.channel || "NODEHISTORY", 0, 0, cs, ink, true); g.restore(); }
    // LIKE → flecha → SUSCRÍBETE + campana
    const rowY = cy + 90 * u, likeX = W / 2 - (port ? 190 : 230) * u, subX = W / 2 + (port ? 60 : 80) * u;
    if (lt > T.likeAt) { const k = back((lt - T.likeAt) / 0.3, 2.4); g.save(); g.translate(likeX, rowY); g.scale(k, k); thumb(g, 0, 0, 64 * u, ink); g.font = `800 ${22 * u}px ${th.ui || "Montserrat"}`; g.fillStyle = ink; g.fillText("LIKE", 0, 52 * u); g.restore(); }
    if (O.arrow !== false && lt > T.likeAt + 0.2) {
      const k = easeOut((lt - T.likeAt - 0.2) / Math.max(0.2, T.subAt - T.likeAt - 0.2)), x0 = likeX + 50 * u, x1 = subX - 120 * u;
      g.strokeStyle = acc; g.lineWidth = 5 * u; g.lineCap = "round"; g.beginPath(); g.moveTo(x0, rowY); g.lineTo(lerp(x0, x1, k), rowY); g.stroke();
      if (k > 0.95) { g.beginPath(); g.moveTo(x1 - 14 * u, rowY - 12 * u); g.lineTo(x1, rowY); g.lineTo(x1 - 14 * u, rowY + 12 * u); g.stroke(); }
    }
    if (lt > T.subAt) {
      const k = back((lt - T.subAt) / 0.3, 2.2), bw = 220 * u, bh = 64 * u;
      g.save(); g.translate(subX, rowY); g.scale(k, k);
      g.fillStyle = th.ctaBg || "#e01b24"; g.beginPath(); g.roundRect(-bw / 2 + 30 * u, -bh / 2, bw, bh, 12 * u); g.fill();
      g.fillStyle = "#fff"; g.font = `900 ${26 * u}px ${th.ui || "Montserrat"}`; g.fillText(O.cta || "SUSCRÍBETE", 30 * u, 2 * u); g.restore();
    }
    if (lt > T.bellAt) bell(g, subX + 190 * u, rowY, 46 * u, ink, lt - T.bellAt);
    // apoyo + dirección
    if (lt > T.supAt) {
      const k = easeOut((lt - T.supAt) / 0.4); g.globalAlpha = k;
      g.font = `700 ${24 * u}px ${th.ui || "Montserrat"}`; word(O.support || "Apoya el canal y comparte el video.", -1, rowY + 110 * u, 24 * u, ink, true);
      g.font = `800 ${22 * u}px ${th.ui || "Montserrat"}`; word(O.handle || "", -1, rowY + 150 * u, 22 * u, acc, true);
    }
    g.restore();
  }

  /* ---------- arranque ---------- */
  async function getJSON(urls) {
    for (const u of urls) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) { /* siguiente */ } }
    return null;
  }
  const imgCache = new Map();
  function loadImg(src) {
    if (imgCache.has(src)) return imgCache.get(src);
    const p = new Promise(r => { const im = new Image(); im.onload = () => im.decode().then(() => r(im), () => r(im)); im.onerror = () => { console.warn("[proto] falta imagen", src); r(null); }; im.src = src; });
    imgCache.set(src, p); return p;
  }

  async function run(E) {
    const stage = document.getElementById("stage"), audio = document.getElementById("audio");
    const cfgAll = await getJSON(["config.json", "assets/config.json"]);
    const C = cfgAll?.configs?.[0] || {};
    const scene = await getJSON([C.sceneUrl || "assets/scene.json"]);
    const lyr = C.lyricsUrl ? (await getJSON([C.lyricsUrl])) || { segments: [] } : { segments: [] };
    const words = (lyr.segments || []).flatMap(s => s.words || []).filter(w => w && isFinite(w.start));
    const T = makeTimer(words, E.name);
    await Promise.all((E.fonts || []).map(f => document.fonts.load(f).catch(() => 0)));
    if (audio && C.audio?.src) audio.src = C.audio.src;

    const cv = document.createElement("canvas"); stage.appendChild(cv);
    const g = cv.getContext("2d");
    const st = { W: 0, H: 0, U: 1 };
    const size = () => { st.W = cv.width = innerWidth; st.H = cv.height = innerHeight; st.U = Math.min(st.W, st.H) / 1080; };
    size();
    const ctx = { g, st, T, words, scene, C, U, img: src => imgCache.get(src), loadImg, theme: E.theme };
    await E.setup(ctx);
    await Promise.all([...imgCache.values()]);
    for (const [k, p] of imgCache) imgCache.set(k, await p);

    // duración: escena.end, o última palabra + cola del cierre
    const lastWord = words.length ? words[words.length - 1].end : 10;
    const O = { enabled: true, dur: 6, ...(E.theme.outro || {}), ...(scene.outro || {}) };
    const END = T(scene.end, lastWord + (O.enabled ? O.dur + 0.4 : 1.5));
    const O_T0 = O.enabled ? END - O.dur : Infinity;
    const I = scene.intro ? { dur: 5, ...scene.intro } : null;
    const capCfg = { ...(E.theme.captions || {}), ...(scene.captions || {}) };
    const caps = capCfg.enabled === false ? [] : buildCaptions(words, END, capCfg);
    ctx.END = END; ctx.outroAt = O_T0; ctx.intro = I;

    function render(t) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.filter = "none";
      E.render(ctx, Math.min(t, END - 0.001));
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
      const inIntro = I && t < I.dur + 0.4, inOutro = t >= O_T0;
      if (I) drawIntro(g, st, I, t, E.theme);
      if (O.enabled && inOutro) drawOutro(g, st, O, O_T0, O.dur, Math.min(t, END), E.theme);
      if (!(inIntro && I.hideCaptions !== false && t < I.dur) && !inOutro) drawCaption(g, st, caps, t, capCfg);
    }

    /* reproductor (el tiempo SIEMPRE sale del audio) */
    const FROZEN = QS.has("t") && !QS.has("headless") ? parseFloat(QS.get("t")) : null;
    let forced = FROZEN, t0wall = null;
    const hasAudio = !!(audio && C.audio?.src);
    const clock = now => forced != null ? forced : hasAudio ? audio.currentTime : (t0wall == null ? ((t0wall = now), 0) : ((now - t0wall) / 1000) % END);
    function frame(now) { if (forced == null) render(clock(now)); requestAnimationFrame(frame); }
    addEventListener("resize", () => { size(); E.resize && E.resize(ctx); render(forced ?? clock(performance.now())); });
    const btn = document.createElement("div");
    btn.textContent = "▶";
    btn.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:110px;height:110px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font:48px/110px sans-serif;text-align:center;cursor:pointer;display:none;z-index:9";
    document.body.appendChild(btn);
    const showBtn = v => { btn.style.display = v ? "block" : "none"; };
    function toggle() {
      if (!hasAudio || forced != null) return;
      if (audio.ended || audio.currentTime >= END - 0.05) audio.currentTime = 0;
      if (audio.paused) audio.play().then(() => showBtn(false), () => showBtn(true)); else { audio.pause(); showBtn(true); }
    }
    addEventListener("click", toggle);
    addEventListener("keydown", e => {
      if (e.code === "Space") { e.preventDefault(); toggle(); }
      if (hasAudio && (e.code === "ArrowRight" || e.code === "ArrowLeft")) audio.currentTime = clamp(audio.currentTime + (e.code === "ArrowRight" ? 5 : -5), 0, END);
    });
    if (hasAudio) audio.addEventListener("ended", () => showBtn(true));

    const cuts = (E.shots ? E.shots(ctx) : [0]).filter((v, i, A) => A.indexOf(v) === i && v < END).sort((a, b) => a - b);
    window.__promo = {
      scenes: () => cuts.map((t0, i) => ({ t0, t1: cuts[i + 1] ?? END, type: "shot", seg: { text: "" } })).concat([{ t0: END, t1: END, type: "end", seg: { text: "" } }]),
      total: END,
      async seek(t) { forced = t; render(t); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); },
      release() { forced = null; if (!window.__loop) { window.__loop = 1; requestAnimationFrame(frame); } },
      missingAnchors: () => [...T.missing],
    };
    if (QS.has("headless")) { forced = 0; render(0); return; }
    if (FROZEN != null) { render(FROZEN); return; }
    render(0); window.__loop = 1; requestAnimationFrame(frame);
    if (hasAudio && !QS.has("paused")) audio.play().then(() => showBtn(false), () => showBtn(true)); else if (hasAudio) showBtn(true);
  }

  window.Proto = { run, U, makeTimer, loadImg, outroTimes };
})();
