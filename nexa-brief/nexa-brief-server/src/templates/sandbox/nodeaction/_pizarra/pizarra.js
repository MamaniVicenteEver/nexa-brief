/* pizarra.js · motor de pizarra plana (réplica de "The English Narratives", ejemplo1).
 *
 * LO FIJO: fondo gris claro liso, SIN cámara (cortes secos), dibujos de línea negra que entran con "pop",
 * texto negro tipeado palabra por palabra, títulos en arco, rótulos verdes; intro y cierre del estándar
 * de producción (núcleo compartido ../../_proto/proto.js).
 * LO QUE CAMBIA: el PERSONAJE (characters/<id>.js, se elige con scene.character o scene.cast), sus poses
 * y caras, y qué dibujos y textos aparecen (assets/scene.json; formato en ../_pizarra/ESCENA.md).
 *
 * Módulos: rig.js (esqueleto, poses, IK, caras, trazos) · characters/*.js (dibujo del personaje) ·
 *          props.js (dibujos) · este archivo (planos, texto, items). Lienzo de diseño 1920×1080.
 */
(() => {
  "use strict";
  const { clamp, lerp, ease, back } = Proto.U;
  const { POSES, mixPose, joints, line } = Pizarra.rig;
  const DW = 1920, DH = 1080;
  const INK = "#151515", BG = "#efefef";
  const FONT = "'DM Sans', 'Inter', sans-serif", SERIF = "'Fraunces', Georgia, serif";
  const seen = new Set();
  const warnOnce = m => { if (!seen.has(m)) { seen.add(m); console.warn("[pizarra]", m); } };
  let CAST = {}, SCENE_CHAR = "palito", SCENE_LOOK = {};

  /** personaje: scene.cast[id] → item → scene.character; el dibujo sale de characters/<id>.js */
  function drawCharacter(g, it, t, ctx) {
    const cast = CAST[it.id] || {};
    const id = it.character || cast.character || SCENE_CHAR;
    const C = Pizarra.characters[id] || (warnOnce("personaje desconocido: " + id), Pizarra.characters.palito);
    const look = { ...SCENE_LOOK, ...(cast.look || {}), ...(it.look || {}) };
    const h = it.h * (C.scale?.height || 1) * (look.height || 1);
    const P = poseAt(it, t);
    const J = joints(it.x, it.y, h, P, t, C.scale || {});
    const o = { lw: Math.max(2.2, h * 0.0052), tube: h * 0.026 * (C.scale?.tube || 1), ink: INK, bg: BG, face: faceAt(it, t), t, P, look, lookX: it.lookX || 0, ...(look.colors || {}) };
    C.draw(g, J, o);
    ctx.hands.set(it.id, { R: J.armR[1], L: J.armL[1], h });
  }

  /* ---------- texto ---------- */
  function wrapWords(g, words, maxW) {
    const lines = [[]]; let w = 0; const sp = g.measureText(" ").width;
    for (const wd of words) {
      const ww = g.measureText(wd.text).width;
      if (lines[lines.length - 1].length && w + sp + ww > maxW) { lines.push([]); w = 0; }
      const L = lines[lines.length - 1]; wd.x = L.length ? w + sp : 0; wd.w = ww; w = wd.x + ww; L.push(wd);
    }
    return lines.map(L => ({ words: L, width: L.length ? L[L.length - 1].x + L[L.length - 1].w : 0 }));
  }
  function drawType(g, it, t, ctx) {
    const size = it.size || 52;
    g.font = `${it.weight || 700} ${size}px ${it.serif ? SERIF : FONT}`;
    const lines = wrapWords(g, it._words, it.maxW || 900);
    const lh = size * (it.lh || 1.28), align = it.align || "center";
    lines.forEach((L, li) => {
      const x0 = align === "left" ? it.x : align === "right" ? it.x - L.width : it.x - L.width / 2;
      const y = it.y + (li - (lines.length - 1) / 2) * lh;
      for (const wd of L.words) {
        const k = (t - wd.t) / 0.2; if (k < 0) continue;
        const sc = lerp(1.35, 1, back(k)), a = clamp(k * 2);
        g.save(); g.globalAlpha *= a; g.translate(x0 + wd.x + wd.w / 2, y - (1 - clamp(k)) * size * 0.25); g.scale(sc, sc);
        g.fillStyle = wd.color || it.color || INK; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(wd.text, 0, 0);
        g.restore();
      }
    });
  }
  function drawArc(g, it, t) { // título en arco que se escribe letra por letra
    const size = it.size || 56, R = it.radius || 620, txt = it.text;
    g.font = `800 ${size}px ${FONT}`; g.fillStyle = it.color || INK; g.textAlign = "center"; g.textBaseline = "middle";
    const widths = [...txt].map(c => g.measureText(c).width), total = widths.reduce((a, b) => a + b, 0) * 1.02;
    const n = Math.floor(clamp((t - it._t0) / (it.dur || 0.6)) * txt.length + 0.0001);
    let acc = -total / 2;
    [...txt].forEach((c, i) => {
      const mid = acc + widths[i] / 2; acc += widths[i] * 1.02;
      if (i >= n) return;
      const ang = mid / R;
      g.save(); g.translate(it.x + Math.sin(ang) * R, it.y + R - Math.cos(ang) * R); g.rotate(ang); g.fillText(c, 0, 0); g.restore();
    });
  }

  /* ---------- escena ---------- */
  function compile(scene, T) {
    const shots = scene.shots.map(s => ({ ...s, t0: T(s.t) }));
    shots.forEach((s, i) => { s.t1 = i + 1 < shots.length ? shots[i + 1].t0 : T(scene.shotsEnd, s.t0 + 600); });
    let n = 0;
    for (const s of shots) for (const it of s.items) {
      it.id = it.id || "i" + n++;
      it._t0 = T(it.at, s.t0);
      it._t1 = it.out != null ? T(it.out) : s.t1;
      if (it.type === "man") it._poses = (it.poses || [{ at: s.t0, pose: it.pose || "stand", face: it.face || "smile" }]).map(p => ({ ...p, _t: T(p.at, s.t0) }));
      if (it.type === "type") {
        const raw = it.words || it.text.split(/\s+/).map(w => ({ text: w }));
        const base = it._t0, step = it.step ?? 0.16;
        it._words = raw.map((w, i) => ({ ...(typeof w === "string" ? { text: w } : w), t: w.at != null ? T(w.at) : base + i * step }));
      }
      if (it.move) it._move = { ...it.move, _t: T(it.move.at, it._t0) };
    }
    return { shots, end: shots[shots.length - 1].t1 };
  }

  function poseAt(it, t) {
    const L = it._poses; let i = 0;
    while (i + 1 < L.length && L[i + 1]._t <= t) i++;
    const cur = POSES[L[i].pose] || POSES.stand;
    if (i === 0 || t - L[i]._t > 0.28) return cur;
    return mixPose(POSES[L[i - 1].pose] || POSES.stand, cur, ease((t - L[i]._t) / 0.28));
  }
  function faceAt(it, t) {
    let f = it._poses[0].face || "smile";
    for (const p of it._poses) if (p._t <= t && p.face) f = p.face;
    return f;
  }

  function drawItem(g, it, t, ctx) {
    const k = (t - it._t0) / (it.pop ?? 0.32);
    if (k < 0 || t >= it._t1) return;
    let x = it.x, y = it.y;
    if (it._move) { const m = ease((t - it._move._t) / (it._move.dur || 0.8)); x = lerp(x, it._move.to[0], m); y = lerp(y, it._move.to[1], m); }
    if (it.hold) { const hd = ctx.hands.get(it.hold.split(":")[0]); if (hd) { const p = hd[it.hold.split(":")[1] || "R"]; x = p[0] + (it.dx || 0); y = p[1] + (it.dy || 0); } }
    g.save();
    if (it.type === "man") { drawCharacter(g, { ...it, x, y }, t, ctx); g.restore(); return; }
    const enter = it.enter || (it.type === "type" || it.type === "arc" ? "none" : "pop");
    if (enter === "pop") { const s = lerp(0.2, 1, back(k)); g.globalAlpha = clamp(k * 3); g.translate(x, y); g.scale(s, s); }
    else if (enter === "fade") { g.globalAlpha = clamp(k); g.translate(x, y); }
    else g.translate(x, y);
    if (it.rot) g.rotate((it.rot * Math.PI) / 180);
    if (it.wiggle) g.rotate(Math.sin(t * 6) * 0.04 * it.wiggle);
    const loc = { ...it, x: 0, y: 0 };
    if (it.type === "prop") (Pizarra.props[it.name] || (warnOnce("dibujo desconocido: " + it.name), Pizarra.props.question))(g, it.s || 160, it, t, it);
    else if (it.type === "type") drawType(g, loc, t, ctx);
    else if (it.type === "arc") drawArc(g, loc, t);
    else if (it.type === "script") { // rótulo verde manuscrito
      g.font = `900 ${it.size || 70}px ${SERIF}`; g.fillStyle = it.color || "#127a3d"; g.textAlign = "center"; g.textBaseline = "middle";
      g.rotate(((it.tilt ?? 4) * Math.PI) / 180); g.fillText(it.text, 0, 0);
    } else if (it.type === "label") {
      g.font = `700 ${it.size || 26}px ${FONT}`; g.fillStyle = INK; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(it.text, 0, 0);
    } else if (it.type === "rule") line(g, [[-it.w / 2, 0], [it.w / 2, 0]], it.lw || 2.5);
    else if (it.type === "vs") { line(g, [[0, -it.h / 2], [0, it.h / 2]], 3); g.font = `800 34px ${FONT}`; g.fillStyle = INK; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("VS", 0, 0); }
    g.restore();
  }

  /* ---------- arranque (núcleo compartido) ---------- */
  Proto.run({
    name: "pizarra",
    fonts: ["700 52px 'DM Sans'", "800 52px 'DM Sans'", "900 52px Fraunces"],
    theme: {
      heavy: "800 $px 'DM Sans'", ui: "'DM Sans'", kickerFont: "700 $px 'DM Sans'", subFont: "700 $px 'DM Sans'",
      accent: "#127a3d", introInk: INK, outroInk: INK, kickerBg: INK, kickerInk: BG, ctaBg: "#d2453a",
      captions: { enabled: false },
      outro: { channel: "NODEACTION", handle: "youtube.com/@nodeaction" },
      outroBg(g, st, k) { g.fillStyle = `rgba(239,239,239,${0.96 * k})`; g.fillRect(0, 0, st.W, st.H); },
      word(g, s, x, y, size, col, center) { g.save(); g.textAlign = center ? "center" : "left"; g.textBaseline = "middle"; g.fillStyle = col; g.fillText(s, x, y); g.restore(); },
    },
    async setup(c) {
      const { scene, T } = c;
      CAST = scene.cast || {}; SCENE_CHAR = scene.character || "palito"; SCENE_LOOK = scene.look || {};
      c.S = compile(scene, T);
      c.ctx = { hands: new Map() };
    },
    shots: c => c.S.shots.map(s => s.t0),
    render(c, t) {
      const { g, st } = c, { W, H } = st;
      g.fillStyle = BG; g.fillRect(0, 0, W, H);
      const sc = Math.min(W / DW, H / DH);
      g.setTransform(sc, 0, 0, sc, (W - DW * sc) / 2, (H - DH * sc) / 2);
      const S = c.S, shot = S.shots.find(s => t >= s.t0 && t < s.t1) || (t >= S.shots[S.shots.length - 1].t0 ? S.shots[S.shots.length - 1] : null);
      c.ctx.hands.clear();
      if (!shot) return;                       // antes del primer plano: pizarra vacía (la intro va encima)
      // los personajes primero (sus manos sostienen dibujos), el resto en orden
      const items = [...shot.items].sort((a, b) => (a.type === "man" ? -1 : 0) - (b.type === "man" ? -1 : 0) || (a.z || 0) - (b.z || 0));
      for (const it of items) drawItem(g, it, t, c.ctx);
    },
  }).catch(e => console.error(e));
})();
