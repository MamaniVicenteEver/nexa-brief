/* NodeAction · rig: esqueleto 2D articulado, poses, cinemática inversa y dibujo "sticker".
 *
 * Cada personaje es un esqueleto de 2 piernas (muslo + canilla), torso, cabeza y 2 brazos
 * (brazo + antebrazo). Una POSE no guarda ángulos sino OBJETIVOS: dónde van los pies (en el
 * marco del suelo) y las manos (desde el hombro); la cinemática inversa (ik) resuelve rodillas
 * y codos. Así las poses se mezclan entre sí sin romper el cuerpo y los pies apoyan de verdad.
 *
 * Capas de una pose en el instante t (de abajo hacia arriba):
 *   quieto | locomoción (caminar/correr, fase = distancia recorrida) → rodilla en tierra →
 *   salto → poses con nombre (victory, cheer…) → apuntar (brazos hacia el blanco, en pantalla) →
 *   retroceso del disparo → estremecimiento por impacto → muerte (cae de espaldas y queda tendido).
 *
 * Coordenadas locales: x hacia donde mira el personaje, y hacia arriba, origen en el suelo
 * bajo la cadera. 1 unidad = altura del personaje.
 */
(function () {
  "use strict";
  const A = window.Action;
  const { clamp, lerp, smooth, ease } = A;
  const TAU = Math.PI * 2;

  const L = (A.LIMBS = { thigh: 0.235, shin: 0.235, up: 0.165, fore: 0.16, torso: 0.3, sh: 0.262 });

  /* andares: speed u/s · stride (u por ciclo completo) · stance (fracción del ciclo con el pie
     apoyado) · lift (altura del pie en el vuelo) · rootY (altura de cadera) · bob · lean ·
     arm (amplitud del braceo) · R (largo mano-hombro) · fwd/up (desplazamiento de la mano) */
  A.GAITS = {
    walk:   { speed: 1.0, stride: 0.62, stance: 0.58, lift: 0.055, rootY: 0.43, bob: 0.008, lean: 0.05, arm: 0.32, R: 0.29, fwd: 0.0, up: 0.0 },
    strafe: { speed: 1.6, stride: 0.8, stance: 0.5, lift: 0.08, rootY: 0.42, bob: 0.012, lean: 0.02, arm: 0.2, R: 0.28, fwd: 0.0, up: 0.0 },
    run:    { speed: 4.0, stride: 1.55, stance: 0.27, lift: 0.2, rootY: 0.41, bob: 0.026, lean: 0.24, arm: 0.95, R: 0.23, fwd: 0.05, up: 0.07 },
    sprint: { speed: 5.4, stride: 1.9, stance: 0.22, lift: 0.23, rootY: 0.4, bob: 0.032, lean: 0.32, arm: 1.15, R: 0.22, fwd: 0.07, up: 0.09 },
    /* marcha cargada, fusil cruzado sobre el pecho ("port arms"): infantería de época */
    march:  { speed: 0.55, stride: 0.5, stance: 0.6, lift: 0.045, rootY: 0.432, bob: 0.008, lean: 0.14, arm: 0, R: 0.29, fwd: 0.0, up: 0.0, port: true },
  };

  /* estilos (look): colores "$body" / "$paint" / "$accent" se resuelven por personaje */
  A.styles = {
    hero:    { head: "bob", headR: 0.15, torsoW: 0.118, torso: "#121212", limb: "#121212", limbW: 0.062, hand: "#f7f4ee", hair: "#121212", face: "#f7f4ee" },
    trooper: { head: "visor", headR: 0.12, torsoW: 0.13, torso: "$body", limb: "#151515", limbW: 0.052, hand: "#f7f4ee", helmet: "$body", visor: "#161616", face: "#f7f4ee" },
    ink:     { head: "visor", headR: 0.12, torsoW: 0.12, torso: "#171717", limb: "#171717", limbW: 0.054, hand: "#f7f4ee", helmet: "#171717", visor: "$accent", face: "#f7f4ee" },
    plain:   { head: "plain", headR: 0.115, torsoW: 0.07, torso: "#151515", limb: "#151515", limbW: 0.055, hand: "#151515", face: "#151515" },
    /* soldado de época: torso con la bandera del bando, casco ("brodie" británico · "stahl" alemán), mochila */
    soldier: { head: "brodie", headR: 0.11, torsoW: 0.13, torso: "$flag", limb: "$body", limbW: 0.054, hand: "#f4efe6", face: "#f4efe6", helmet: "$helmet", pack: "#4c4636" },
  };

  /* ------------------------------ banderas ------------------------------
     Se dibujan en un rectángulo (x, y) abajo-izquierda, w × h, con y hacia arriba. Sirven para el
     torso ("torso": "$flag") y para cualquier tela. Presets por código de país o {stripes, dir}. */
  const H3 = (a, b, c) => ({ stripes: [a, b, c], dir: "h" }), V3 = (a, b, c) => ({ stripes: [a, b, c], dir: "v" });
  A.flags = {
    uk: { draw: "uk" }, us: { draw: "us" }, jp: { draw: "jp" }, tr: { draw: "tr" }, ottoman: { draw: "tr" }, cl: { draw: "cl" },
    "de-empire": H3("#151515", "#f4f4f4", "#d21f1f"), de: H3("#151515", "#dd0000", "#ffce00"), fr: V3("#0055a4", "#f4f4f4", "#ef4135"),
    it: V3("#009246", "#f4f4f4", "#ce2b37"), mx: { ...V3("#006847", "#f4f4f4", "#ce1126"), dot: "#8a5a2b" }, es: { stripes: ["#c60b1e", "#ffc400", "#ffc400", "#c60b1e"], dir: "h" },
    ru: H3("#f4f4f4", "#0039a6", "#d52b1e"), ua: { stripes: ["#0057b7", "#ffd700"], dir: "h" }, pl: { stripes: ["#f4f4f4", "#dc143c"], dir: "h" },
    nl: H3("#ae1c28", "#f4f4f4", "#21468b"), be: V3("#151515", "#fdda24", "#ef3340"), ie: V3("#169b62", "#f4f4f4", "#ff883e"),
    ar: { ...H3("#74acdf", "#f4f4f4", "#74acdf"), dot: "#f6b40e" }, pe: V3("#d91023", "#f4f4f4", "#d91023"), bo: H3("#d52b1e", "#f9e300", "#007934"),
    co: { stripes: ["#fcd116", "#fcd116", "#003893", "#ce1126"], dir: "h" }, ve: H3("#ffcc00", "#00247d", "#cf142b"), br: { stripes: ["#009c3b"], dir: "h", dot: "#ffdf00" },
    cn: { stripes: ["#de2910"], dir: "h", dot: "#ffde00" }, kr: { stripes: ["#f4f4f4"], dir: "h", dot: "#cd2e3a" }, gr: { stripes: ["#0d5eaf", "#f4f4f4", "#0d5eaf", "#f4f4f4", "#0d5eaf"], dir: "h" },
    "confederate-free": H3("#7d7d7d", "#bdbdbd", "#7d7d7d"),
  };
  function drawFlag(g, spec, x, y, w, h) {
    const F = typeof spec === "string" ? A.flags[spec] || { stripes: [spec], dir: "h" } : spec || { stripes: ["#888"] };
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    const m = Math.min(w, h), bar = (c, th, horiz) => { g.fillStyle = c; horiz ? g.fillRect(x, y + h / 2 - th / 2, w, th) : g.fillRect(x + w / 2 - th / 2, y, th, h); };
    const diag = (c, th) => { g.strokeStyle = c; g.lineWidth = th; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + h); g.moveTo(x, y + h); g.lineTo(x + w, y); g.stroke(); };
    if (F.draw === "uk") {
      g.fillStyle = "#1f3c88"; g.fillRect(x, y, w, h);
      /* proporciones oficiales: cruz roja 1/5 de la altura, borde blanco hasta 1/3; aspas más finas */
      diag("#f4f4f4", m * 0.2); diag("#c8102e", m * 0.07);
      bar("#f4f4f4", m * 0.33, true); bar("#f4f4f4", m * 0.33, false); bar("#c8102e", m * 0.2, true); bar("#c8102e", m * 0.2, false);
    } else if (F.draw === "us") {
      for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? "#f4f4f4" : "#b22234"; g.fillRect(x, y + h - (i + 1) * h / 13, w, h / 13 + 0.001); }
      const cw = w * 0.5, ch = h * 7 / 13; g.fillStyle = "#3c3b6e"; g.fillRect(x, y + h - ch, cw, ch);
      g.fillStyle = "#f4f4f4"; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(x + cw * (0.2 + 0.3 * i), y + h - ch * (0.2 + 0.3 * j), m * 0.05, 0, TAU); g.fill(); }
    } else if (F.draw === "jp") {
      g.fillStyle = "#f4f4f4"; g.fillRect(x, y, w, h); g.fillStyle = "#bc002d"; g.beginPath(); g.arc(x + w / 2, y + h / 2, m * 0.3, 0, TAU); g.fill();
    } else if (F.draw === "tr") {
      g.fillStyle = "#e30a17"; g.fillRect(x, y, w, h); g.fillStyle = "#f4f4f4"; g.beginPath(); g.arc(x + w * 0.42, y + h / 2, m * 0.3, 0, TAU); g.fill();
      g.fillStyle = "#e30a17"; g.beginPath(); g.arc(x + w * 0.5, y + h / 2, m * 0.24, 0, TAU); g.fill();
    } else if (F.draw === "cl") {
      g.fillStyle = "#f4f4f4"; g.fillRect(x, y + h / 2, w, h / 2); g.fillStyle = "#d52b1e"; g.fillRect(x, y, w, h / 2);
      g.fillStyle = "#0039a6"; g.fillRect(x, y + h / 2, w * 0.4, h / 2); g.fillStyle = "#f4f4f4"; g.beginPath(); g.arc(x + w * 0.2, y + h * 0.75, m * 0.08, 0, TAU); g.fill();
    } else {
      const S = F.stripes || ["#888"], n = S.length;
      for (let i = 0; i < n; i++) { g.fillStyle = S[i]; F.dir === "v" ? g.fillRect(x + i * w / n, y, w / n + 0.001, h) : g.fillRect(x, y + h - (i + 1) * h / n, w, h / n + 0.001); }
      if (F.dot) { g.fillStyle = F.dot; g.beginPath(); g.arc(x + w / 2, y + h / 2, m * 0.16, 0, TAU); g.fill(); }
    }
    g.restore();
  }
  A.drawFlag = drawFlag;
  const OUT = "#ffffff", EDGE = "rgba(0,0,0,0.13)";
  const col = (v, a) => (v === "$body" ? a.body : v === "$paint" ? a.paint : v === "$accent" ? a.accent : v === "$helmet" ? a.helmet || a.body : v === "$flag" ? a.body : v);

  /* ------------------------------ poses ------------------------------ */
  function P(o) {
    return Object.assign({ rootY: 0.447, lean: 0.03, head: 0, fF: [0.075, 0], fB: [-0.065, 0], hF: [0.035, -0.285], hB: [-0.035, -0.285], gunA: -1.3, rot: 0, pivY: 0, lift: 0 }, o);
  }
  function mix(a, b, w) {
    if (w <= 0) return a; if (w >= 1) return { ...b };
    const o = {};
    for (const k in a) { const va = a[k], vb = b[k] ?? va; o[k] = Array.isArray(va) ? [lerp(va[0], vb[0], w), lerp(va[1], vb[1], w)] : typeof va === "number" ? lerp(va, vb, w) : w < 0.5 ? va : vb; }
    return o;
  }
  A.pose = { P, mix };

  function idle(a, t, armed) {
    const b = 0.0045 * Math.sin(t * 2.6 + (a.seed % 97));
    return P({ rootY: 0.447 + b, lean: 0.03, fF: [0.075, 0], fB: [-0.065, 0],
      hF: armed ? [0.14, -0.19] : [0.035, -0.285], hB: armed ? [0.03, -0.25] : [-0.035, -0.285], gunA: armed ? -0.55 : -1.3 });
  }
  function foot(p, G) {
    p = ((p % 1) + 1) % 1;
    const half = (G.stance * G.stride) / 2;
    if (p < G.stance) return [half - (p / G.stance) * 2 * half, 0];
    const u = (p - G.stance) / (1 - G.stance);
    return [-half + ease.sine(u) * 2 * half, G.lift * Math.sin(Math.PI * u)];
  }
  function loco(G, dist, dirSign, armed) {
    const ph = (dist * dirSign) / G.stride;
    const aF = -G.arm * Math.cos(TAU * ph), aB = -aF;
    const hand = ang => [G.fwd + G.R * Math.sin(ang), -G.R * Math.cos(ang) + G.up];
    return P({
      rootY: G.rootY - G.bob * Math.cos(2 * TAU * ph), lean: G.lean * (dirSign > 0 ? 1 : -0.35), head: -G.lean * 0.4,
      fF: foot(ph, G), fB: foot(ph + 0.5, G),
      hF: G.port && armed ? [0.13, -0.05 + 0.006 * Math.sin(TAU * ph)] : armed ? [0.17 + 0.03 * Math.sin(aF), -0.12 + 0.02 * Math.cos(aF)] : hand(aF),
      hB: G.port && armed ? [0.02, -0.13] : hand(aB), gunA: G.port && armed ? 0.62 : armed ? -0.25 : -1.3,
    });
  }
  const KNEEL = P({ rootY: 0.265, lean: 0.16, head: -0.1, fF: [0.24, 0], fB: [-0.27, 0.02], hF: [0.15, -0.1], hB: [0.03, -0.18], gunA: -0.2 });
  function jumpPose(seg, u, armed) {
    const v = clamp((u - 0.16) / 0.68), tuck = Math.sin(Math.PI * v), air = u > 0.16 && u < 0.84;
    const sq = u <= 0.16 ? Math.sin((Math.PI / 2) * (u / 0.16)) : u >= 0.84 ? Math.sin((Math.PI / 2) * ((1 - u) / 0.16)) : 0;
    const stand = P({ rootY: 0.445 - 0.13 * sq, lean: 0.18 * sq, fF: [0.09, 0], fB: [-0.07, 0], hF: armed ? [0.16, -0.12] : [-0.12, -0.22], hB: [-0.16, -0.2], gunA: armed ? -0.3 : -1.3 });
    if (!air) return stand;
    if (seg.style === "hop") return mix(stand, P({ ...stand, rootY: 0.44, lean: 0.05, fF: [0.12, 0.09], fB: [-0.08, 0.06] }), tuck);
    const p = mix(stand, P({ rootY: 0.42, lean: 0.14, head: -0.05, fF: [0.14, 0.27], fB: [0.0, 0.22], hF: armed ? [0.2, 0.02] : [0.18, 0.1], hB: [-0.22, 0.14], gunA: armed ? 0.1 : -1 }), tuck);
    if (seg.style === "flip") { p.rot = TAU * ease.io(v); p.pivY = 0.45; }
    return p;
  }
  /* poses con nombre: se usan con {"do":"pose","name":…}; (τ = segundos desde que empezó) */
  A.poses = {
    victory: τ => P({ rootY: 0.45, lean: -0.06, head: 0.2, fF: [0.13, 0], fB: [-0.11, 0], hF: [0.04, 0.31], hB: [-0.09, -0.16], gunA: 1.45 + 0.05 * Math.sin(τ * 3) }),
    cheer: τ => P({ rootY: 0.45 + 0.02 * Math.abs(Math.sin(τ * 6)), lean: -0.04, head: 0.15, fF: [0.1, 0], fB: [-0.09, 0], hF: [0.1, 0.3], hB: [-0.08, 0.31], gunA: 1.4 }),
    surrender: () => P({ rootY: 0.44, lean: -0.02, head: -0.1, fF: [0.08, 0], fB: [-0.07, 0], hF: [0.12, 0.24], hB: [-0.12, 0.24], gunA: 1.2 }),
    point: () => P({ rootY: 0.447, lean: 0.02, head: 0.05, fF: [0.1, 0], fB: [-0.08, 0], hF: [0.3, 0.06], hB: [-0.04, -0.27], gunA: 0.15 }),
    ready: τ => P({ rootY: 0.44, lean: 0.06, fF: [0.12, 0], fB: [-0.1, 0], hF: [0.2, -0.08], hB: [0.1, -0.12], gunA: -0.15 + 0.03 * Math.sin(τ * 2) }),
    /* tendido boca abajo, vivo (cuerpo a tierra, en un cráter) */
    prone: τ => P({ rootY: 0.445, lean: 0, head: 0.45, fF: [0.05, 0], fB: [-0.06, 0.01], hF: [0.26, 0.06], hB: [0.21, 0.02], gunA: 0.05 + 0.02 * Math.sin(τ * 0.8), rot: -1.47, pivY: 0, lift: 0.045 }),
    /* agachado esperando (en la trinchera) */
    crouch: τ => P({ rootY: 0.27, lean: 0.32, head: -0.15, fF: [0.17, 0], fB: [-0.2, 0.0], hF: [0.14, -0.06], hB: [0.04, -0.12], gunA: 0.95 + 0.01 * Math.sin(τ) }),
    /* silbato a la boca */
    whistle: () => P({ rootY: 0.447, lean: -0.02, head: 0.12, fF: [0.08, 0], fB: [-0.07, 0], hF: [0.07, 0.13], hB: [-0.03, -0.27], gunA: -1.2 }),
  };

  /* ------------------------------ estado en t ------------------------------ */
  function win(t0, t1, t, i = 0.16, o = 0.22) { return Math.min(smooth(t0, t0 + i, t), 1 - smooth(t1, t1 + o, t)); }
  function aimAt(a, t) {
    let best = null, w = 0;
    for (const r of a.aims) { if (t < r.t0 || t > r.t1 + 0.25) continue; const ww = win(r.t0, r.t1, t); if (ww > w || (best && ww === w && r.t0 > best.t0)) { w = ww; best = r; } }
    return { w, r: best };
  }
  function targetPt(S, r, t) {
    if (r.target != null) { const b = S.actors.get(r.target); if (b) return A.chestW(S, b, t); }
    if (r.at) return [r.at[0], r.at[1] ?? 0.6, r.at[2] ?? 8];
    return null;
  }
  function facingAt(a, t, S, x) {
    if (a.death && t >= a.death.t) return a.death.face;
    const am = aimAt(a, t);
    if (am.w > 0.15 && am.r) { const p = targetPt(S, am.r, t); if (p && Math.abs(p[0] - x) > 0.05) return Math.sign(p[0] - x); }
    let best = null;
    for (const tr of a.turns) if (tr.t <= t && (!best || tr.t >= best.t)) best = tr;
    for (const r of a.aims) if (r.t1 <= t && (!best || r.t1 >= best.t)) best = { t: r.t1, r };
    if (!best) return a.face0;
    const tt = best.r || (best.target != null ? { target: best.target } : null);
    if (tt) { const p = targetPt(S, tt, best.r ? best.t : t), q = S.posAt(a, best.r ? best.t : t); if (p && Math.abs(p[0] - q.x) > 0.05) return Math.sign(p[0] - q.x); return a.face0; }
    return best.dir || a.face0;
  }

  A.rig = {};

  /* ------------------------------ vista (perfil / espaldas / frente) ------------------------------
     Cada personaje tiene un RUMBO en el mundo (hacia su blanco si apunta, hacia donde camina, el último
     rumbo si está quieto; cast[].away = true → hacia el fondo +z). La vista sale de comparar ese rumbo
     con la cámara (que puede girar, yaw): se aleja de la cámara → DE ESPALDAS; viene hacia la cámara →
     DE FRENTE; cruza → DE PERFIL (mirando a izquierda o derecha en pantalla). Al cambiar de vista el
     muñeco "gira": se angosta hasta 0 y se abre en la otra (0,3 s). cast[].view = "side" → siempre perfil. */
  function headingAt(a, t, S) {
    if (a.death && t >= a.death.t) return a.death.head ?? (a.death.head = headingAt(a, a.death.t - 1e-3, S));
    const q = S.posAt(a, t);
    const am = aimAt(a, t);
    if (am.w > 0.2 && am.r) { const tp = targetPt(S, am.r, t); if (tp && Math.hypot(tp[0] - q.x, tp[2] - q.z) > 0.05) return [tp[0] - q.x, tp[2] - q.z]; }
    const segDir = sg => { const d = [sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]]; return Math.hypot(d[0], d[1]) > 0.15 ? d : null; };
    if (q.seg) { const d = segDir(q.seg); if (d) return d; }
    for (let i = a.motion.length - 1; i >= 0; i--) if (a.motion[i].t0 <= t) { const d = segDir(a.motion[i]); if (d) return d; }
    return a.def.away ? [0, 1] : [facingAt(a, t, S, q.x), 0];
  }
  function viewAt(a, t, S, cam) {
    cam = cam || S.camAt(t);
    const h = headingAt(a, t, S);
    const hf = h[0] * cam.fwd[0] + h[1] * cam.fwd[1], hr = h[0] * cam.right[0] + h[1] * cam.right[1];
    /* caer, estar cuerpo a tierra y apuntar se dibujan SIEMPRE de perfil (se leen mejor) */
    const dead = a.death && t >= a.death.t;
    let prone = false;
    for (const r of a.poses) if (r.name === "prone" && t >= r.t0 - 0.3 && t <= r.t1 + 0.3) prone = true;
    const aiming = aimAt(a, t).w > 0.15;
    if (a.def.view !== "side" && !dead && !prone && !aiming && Math.abs(hf) > 1.2 * Math.abs(hr)) return { v: hf > 0 ? "back" : "front", sface: 1, key: hf > 0 ? "b" : "f" };
    const len = Math.hypot(h[0], h[1]) || 1;
    const sf = Math.abs(hr) > 0.08 * len ? Math.sign(hr) : a.seed % 2 ? 1 : -1;
    return { v: "side", sface: sf, key: "s" + sf };
  }
  const TURN = 0.3;
  function turnAt(a, t, S, key) {
    if (a.death && Math.abs(t - a.death.t) < TURN) return 1;
    for (let j = 1; j <= 8; j++) {
      const dt = j * (TURN / 16);
      if (viewAt(a, t - dt, S).key !== key || viewAt(a, t + dt, S).key !== key) return Math.max(0.06, dt / (TURN / 2));
    }
    return 1;
  }
  A.rig.state = function (a, t, S, cam) {
    const m = S.posAt(a, t);
    const armed = !!a.weapon;
    const sty = { ...(A.styles[a.style] || A.styles.trooper), ...(a.def.look || {}) };
    const face = facingAt(a, t, S, m.x);
    const VW = viewAt(a, t, S, cam), sface = VW.sface;
    const seg = m.seg;
    let p = idle(a, t, armed);
    let moving = false, grip2 = true;

    if (seg && seg.kind === "move") {
      const G = A.GAITS[seg.gait] || A.GAITS.run;
      const dr = (seg.b[0] - seg.a[0]) * cam.right[0] + (seg.b[1] - seg.a[1]) * cam.right[1];
      const dirSign = Math.abs(dr) < 0.05 ? 1 : Math.sign(dr) === sface ? 1 : -1;
      const te = Math.min(seg.t1, seg.cut ?? seg.t1);
      const w = Math.min(smooth(seg.t0, seg.t0 + 0.14, t), 1 - smooth(te - 0.14, te, t));
      p = mix(p, loco(G, m.dist, dirSign, armed), w);
      moving = w > 0.3; grip2 = !(moving && (seg.gait === "run" || seg.gait === "sprint"));
    }
    let kn = 0;
    for (const k of a.kneels) kn = Math.max(kn, win(k.t0, k.t1, t, 0.2, 0.22));
    if (kn > 0) p = mix(p, KNEEL, kn);
    if (seg && seg.kind === "jump") {
      p = jumpPose(seg, clamp((t - seg.t0) / (seg.t1 - seg.t0)), armed);
      grip2 = false;
    }
    for (const r of a.poses) { const w = win(r.t0, r.t1, t, 0.25, 0.3); if (w > 0) p = mix(p, (A.poses[r.name] || A.poses.victory)(t - r.t0), w); }

    /* apuntar: el ángulo se mide EN PANTALLA (hombro → pecho del blanco proyectados), así el
       brazo apunta exactamente a donde va a viajar la bola aunque el blanco esté en otra profundidad */
    const am = aimAt(a, t);
    let aimA = null, aimDir = null, aimW = 0;
    if (am.w > 0 && am.r && armed) {
      const tp = targetPt(S, am.r, t);
      if (tp) {
        const sc = a.scale, sh = [m.x, m.lift + (p.rootY + Math.cos(p.lean) * L.sh) * sc, m.z];
        const P1 = A.project(cam, S.view, sh[0], sh[1], sh[2]), P2 = A.project(cam, S.view, tp[0], tp[1], tp[2]);
        const lx = P2.x - P1.x, ly = -(P2.y - P1.y), ll = Math.hypot(lx, ly) || 1;
        aimDir = [lx / ll, ly / ll]; aimW = am.w;
        aimA = clamp(Math.atan2(ly, lx * sface), -1.25, 1.35);
        const d = [Math.cos(aimA), Math.sin(aimA)];
        const q = { ...p, hF: [d[0] * 0.305, d[1] * 0.305], gunA: aimA, head: lerp(p.head, aimA * 0.25, 0.7) };
        if (grip2) { q.hB = [d[0] * 0.235 - 0.015, d[1] * 0.235 - 0.035]; q.lean = lerp(p.lean, -0.02, 0.5); }
        p = mix(p, q, am.w);
      }
    }
    /* retroceso del arma */
    for (const s of a.shots) {
      const dt = t - s.t;
      if (dt < 0 || dt > 0.14) continue;
      const k = 1 - dt / 0.14, A0 = p.gunA, d = [Math.cos(A0), Math.sin(A0)];
      p = { ...p, hF: [p.hF[0] - d[0] * 0.05 * k, p.hF[1] - d[1] * 0.05 * k], gunA: A0 + 0.35 * k, lean: p.lean - 0.04 * k };
    }
    /* impacto que no mata: estremecimiento */
    for (const h of a.hits) {
      const dt = t - h.t;
      if (dt < 0 || dt > 0.3 || (a.death && h.t >= a.death.t)) continue;
      const k = 1 - smooth(0, 0.3, dt);
      p = { ...p, lean: p.lean - 0.3 * k, head: p.head - 0.3 * k };
    }
    let lying = 0;
    if (a.death && t >= a.death.t) {
      const τ = t - a.death.t;
      const style = a.death.style || "back";
      let q, rot;
      if (style === "back") {
        q = mix(p, { ...p, lean: p.lean - 0.4, head: p.head - 0.3, hF: [0.06, 0.2], hB: [-0.16, 0.2], gunA: 0.9 }, smooth(0, 0.1, τ));
        q = mix(q, P({ rootY: 0.445, lean: 0, head: 0.3, fF: [0.07, 0.0], fB: [-0.05, 0.0], hF: [0.12, 0.3], hB: [-0.12, 0.27], gunA: 1.6 }), smooth(0.1, 0.45, τ));
        const f = clamp((τ - 0.06) / 0.46);
        rot = (Math.PI / 2) * ease.in(f);
        if (τ > 0.52 && τ < 0.76) rot -= 0.15 * Math.sin((Math.PI * (τ - 0.52)) / 0.24);
      } else {
        /* de frente (tropieza) o doblando las rodillas primero (más lento) */
        const kn = style === "knees" ? 0.38 : 0;
        q = mix(p, { ...p, lean: p.lean + 0.35, head: p.head + 0.25, hF: [0.12, -0.1], hB: [0.05, -0.15], gunA: -0.6 }, smooth(0, 0.12, τ));
        if (kn) q = mix(q, { ...KNEEL, lean: 0.35, hF: [0.1, -0.15], gunA: -0.8 }, smooth(0.05, kn, τ) * (1 - smooth(kn + 0.1, kn + 0.4, τ)));
        q = mix(q, P({ rootY: 0.445, lean: 0, head: 0.45, fF: [0.05, 0], fB: [-0.06, 0.01], hF: [0.27, 0.08], hB: [0.2, 0.0], gunA: 0.1 }), smooth(kn + 0.1, kn + 0.5, τ));
        const f = clamp((τ - 0.08 - kn) / 0.5);
        rot = -(Math.PI / 2) * ease.in(f);
        if (τ > kn + 0.58 && τ < kn + 0.8) rot += 0.12 * Math.sin((Math.PI * (τ - kn - 0.58)) / 0.22);
      }
      q.rot = rot; q.pivY = 0; q.lift = 0.035 * smooth(0.4, 0.6, τ);
      p = q; lying = Math.abs(rot) / (Math.PI / 2);
    }
    const J = joints(p, sty, A.weapons[a.weapon]?.muzzle ?? 0.17);
    let hidden = !!a.def.hidden;
    for (const v of a.vis) if (v.t <= t) hidden = !v.on;
    const lieDir = p.rot < 0 ? 1 : -1;
    const view = VW.v, turnK = turnAt(a, t, S, VW.key);
    let proneW = 0;
    for (const r of a.poses) if (r.name === "prone") proneW = Math.max(proneW, win(r.t0, r.t1, t, 0.25, 0.3));
    const st = { a, t, x: m.x, z: m.z, y: m.lift, face, sface, right: cam.right, p, J, sty, lying: view === "side" ? lying : 0, lieDir, aimA, aimDir, aimW, moving, hidden, view, turnK, m, proneW, kn };
    /* de espaldas / de frente apuntando: la boca del arma sale del hombro hacia el blanco en pantalla */
    if (view !== "side" && aimDir && aimW > 0.3) {
      const tw = sty.torsoW * 1.12, shY = p.rootY + L.torso - 0.03, gl = 0.12 + 0.3 * Math.abs(aimDir[0]);
      const s0 = [(view === "back" ? 1 : -1) * tw * 0.42, shY + 0.02];
      J.muzzle = [s0[0] + aimDir[0] * gl, s0[1] + aimDir[1] * gl]; st.sface = 1;
    }
    return st;
  };

  /* ------------------------------ cinemática ------------------------------ */
  /* 2 huesos: articulación hacia `pref` (rodillas adelante-arriba, codos atrás-abajo) */
  function ik(a, t, l1, l2, pref) {
    const dx = t[0] - a[0], dy = t[1] - a[1], d = Math.hypot(dx, dy) || 1e-6;
    const dm = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-3, d));
    const ux = dx / d, uy = dy / d, th = Math.atan2(uy, ux);
    const al = Math.acos(clamp((l1 * l1 + dm * dm - l2 * l2) / (2 * l1 * dm), -1, 1));
    const j1 = [a[0] + l1 * Math.cos(th + al), a[1] + l1 * Math.sin(th + al)];
    const j2 = [a[0] + l1 * Math.cos(th - al), a[1] + l1 * Math.sin(th - al)];
    const s1 = j1[0] * pref[0] + j1[1] * pref[1], s2 = j2[0] * pref[0] + j2[1] * pref[1];
    return { j: s1 >= s2 ? j1 : j2, e: [a[0] + ux * dm, a[1] + uy * dm] };
  }
  const KNEE = [1, 0.25], ELBOW = [-1, -1];
  const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
  function joints(p, sty, gunLen = 0.17) {
    const H = [0, p.rootY], u = [Math.sin(p.lean), Math.cos(p.lean)];
    const N = [H[0] + u[0] * L.torso, H[1] + u[1] * L.torso];
    const S = [H[0] + u[0] * L.sh, H[1] + u[1] * L.sh];
    const ha = p.lean * 0.6 + p.head;
    const C = [N[0] + Math.sin(ha) * sty.headR * 0.95, N[1] + Math.cos(ha) * sty.headR * 0.95];
    const lF = ik(H, p.fF, L.thigh, L.shin, KNEE), lB = ik(H, p.fB, L.thigh, L.shin, KNEE);
    const aF = ik(S, add(S, p.hF), L.up, L.fore, ELBOW), aB = ik(S, add(S, p.hB), L.up, L.fore, ELBOW);
    const J = {
      H, N, S, C, ha, chest: [lerp(H[0], N[0], 0.58), lerp(H[1], N[1], 0.58)],
      kF: lF.j, fF: lF.e, tF: [lF.e[0] + 0.05, lF.e[1]], kB: lB.j, fB: lB.e, tB: [lB.e[0] + 0.05, lB.e[1]],
      eF: aF.j, hF: aF.e, eB: aB.j, hB: aB.e, gunA: p.gunA,
    };
    if (p.rot || p.lift) {
      const c = Math.cos(p.rot), s = Math.sin(p.rot), pv = [0, p.pivY];
      for (const k of Object.keys(J)) {
        const v = J[k]; if (!Array.isArray(v)) continue;
        const x = v[0] - pv[0], y = v[1] - pv[1];
        J[k] = [pv[0] + x * c - y * s, pv[1] + x * s + y * c + p.lift];
      }
      J.ha += p.rot; J.gunA += p.rot;
    }
    const g = [Math.cos(J.gunA), Math.sin(J.gunA)];
    J.muzzle = [J.hF[0] + g[0] * gunLen - g[1] * 0.012, J.hF[1] + g[1] * gunLen + g[0] * 0.012];
    J.torsoA = Math.atan2(J.N[0] - J.H[0], J.N[1] - J.H[1]);
    return J;
  }
  /* punto local → mundo */
  /* para rig3d.js (lectura): rumbo, apuntar y blanco, colores y banderas */
  A.rig.heading = headingAt; A.rig.aimAt = aimAt; A.rig.targetPt = targetPt; A.rig.col = col;

  /* punto local del dibujo → mundo: la x local corre por el eje DERECHO de la cámara (con el lado en pantalla) */
  A.rig.toWorld = (st, v) => { const r = st.right || [1, 0], k = (st.view === "side" ? st.sface : 1) * v[0] * st.a.scale; return [st.x + r[0] * k, st.y + v[1] * st.a.scale, st.z + r[1] * k]; };

  /* ------------------------------ dibujo ------------------------------ */
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  const style = (g, pass, c) => (pass === "fill" ? c : pass === "out" ? OUT : EDGE);
  const grow = (pass, o, ew) => (pass === "fill" ? 0 : pass === "out" ? o : o + ew);

  function limb(pts, w, c) {
    return (g, pass, o, ew) => {
      g.strokeStyle = style(g, pass, c); g.lineWidth = w + 2 * grow(pass, o, ew);
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke();
    };
  }
  function dot(c, r, color, rim) {
    return (g, pass, o, ew) => {
      g.fillStyle = style(g, pass, color); g.beginPath(); g.arc(c[0], c[1], r + grow(pass, o, ew), 0, TAU); g.fill();
      if (pass === "fill" && rim) { g.strokeStyle = rim; g.lineWidth = 0.012; g.stroke(); }
    };
  }
  function head(J, sty, a) {
    return (g, pass, o, ew) => {
      const r = sty.headR;
      g.save(); g.translate(J.C[0], J.C[1]); g.rotate(-J.ha);
      if (pass !== "fill") {
        const e = grow(pass, o, ew);
        g.fillStyle = style(g, pass); g.beginPath(); g.arc(0, 0, r * (sty.head === "bob" ? 1.08 : sty.head === "stahl" ? 1.12 : 1.05) + e, 0, TAU); g.fill();
        if (sty.head === "brodie") { rr(g, -r * 1.32 - e, r * 0.16 - e, r * 2.64 + 2 * e, r * 0.16 + 2 * e, r * 0.08 + e); g.fill(); }
        g.restore(); return;
      }
      if (sty.head === "brodie" || sty.head === "stahl") {
        g.fillStyle = col(sty.face, a); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
        g.fillStyle = col(sty.helmet, a);
        if (sty.head === "brodie") {
          /* casco británico Brodie: plato chato de ala ancha */
          g.beginPath(); g.ellipse(0, r * 0.24, r * 0.95, r * 0.72, 0, 0, Math.PI); g.fill();
          rr(g, -r * 1.32, r * 0.16, r * 2.64, r * 0.16, r * 0.08); g.fill();
        } else {
          /* casco alemán Stahlhelm: cúpula alta con faldón atrás */
          g.beginPath(); g.ellipse(0, r * 0.12, r * 1.07, r * 0.92, 0, 0, Math.PI); g.fill();
          g.beginPath(); g.moveTo(-r * 1.07, r * 0.14); g.lineTo(-r * 1.14, -r * 0.42); g.lineTo(-r * 0.62, -r * 0.5); g.lineTo(-r * 0.5, r * 0.14); g.closePath(); g.fill();
          rr(g, -r * 0.2, r * 0.04, r * 1.32, r * 0.13, r * 0.06); g.fill();
        }
        g.restore(); return;
      }
      if (sty.head === "plain") { g.fillStyle = col(sty.face, a); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.restore(); return; }
      g.fillStyle = col(sty.face, a); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(0, 0, r * (sty.head === "bob" ? 1.08 : 1.05), 0, TAU); g.clip();
      if (sty.head === "bob") {
        /* melena: todo negro salvo la cara (abajo-adelante), con 3 mechones que gotean sobre ella */
        g.fillStyle = col(sty.hair, a); g.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
        g.fillStyle = col(sty.face, a);
        g.beginPath(); g.moveTo(-r * 0.12, -r * 0.02); g.lineTo(r * 1.2, -r * 0.02); g.lineTo(r * 1.2, -r * 1.2); g.lineTo(-r * 0.12, -r * 1.2); g.closePath(); g.fill();
        g.fillStyle = col(sty.hair, a);
        for (const [x, w, len] of [[0.12, 0.36, 0.62], [0.52, 0.3, 0.44], [0.86, 0.28, 0.26]]) {
          const top = -r * 0.0, cx = x * r, hw = (w * r) / 2, tip = top - len * r;
          g.beginPath(); g.moveTo(cx - hw, top + r * 0.02);
          g.bezierCurveTo(cx - hw, tip + hw * 0.9, cx - hw * 0.35, tip, cx, tip);
          g.bezierCurveTo(cx + hw * 0.35, tip, cx + hw, tip + hw * 0.9, cx + hw, top + r * 0.02);
          g.closePath(); g.fill();
        }
      } else {
        /* casco del color del equipo + visera oscura con brillo */
        g.fillStyle = col(sty.helmet, a); g.fillRect(-r * 1.2, r * 0.04, r * 2.4, r * 1.3);
        g.fillStyle = col(sty.visor, a); rr(g, -r * 0.15, -r * 0.44, r * 1.35, r * 0.5, r * 0.18); g.fill();
        g.strokeStyle = "rgba(255,255,255,0.65)"; g.lineWidth = r * 0.07; g.lineCap = "round";
        g.beginPath(); g.moveTo(r * 0.18, -r * 0.13); g.lineTo(r * 0.72, -r * 0.13); g.stroke();
      }
      g.restore(); g.restore();
    };
  }
  function gun(J, a) {
    return (g, pass, o, ew) => {
      g.save(); g.translate(J.hF[0], J.hF[1]); g.rotate(J.gunA);
      const e = grow(pass, o, ew);
      g.fillStyle = style(g, pass, "#1c1c1c");
      rr(g, -0.035 - e, -0.024 - e, 0.2 + 2 * e, 0.048 + 2 * e, 0.018 + e); g.fill();
      rr(g, -0.03 - e, -0.085 - e, 0.042 + 2 * e, 0.075 + 2 * e, 0.014 + e); g.fill();
      g.fillStyle = style(g, pass, a.paint); g.beginPath(); g.arc(0.05, 0.058, 0.035 + e, 0, TAU); g.fill();
      if (pass === "fill") { g.fillStyle = "rgba(255,255,255,0.7)"; g.beginPath(); g.arc(0.04, 0.07, 0.01, 0, TAU); g.fill(); }
      g.restore();
    };
  }
  /* torso relleno con la bandera del bando (recortado a la cápsula del torso) */
  function flagTorso(J, w, a) {
    const base = limb([J.H, J.N], w, a.body);
    return (g, pass, o, ew) => {
      if (pass !== "fill" || !a.flag) return base(g, pass, o, ew);
      const len = Math.hypot(J.N[0] - J.H[0], J.N[1] - J.H[1]);
      g.save(); g.translate(J.H[0], J.H[1]); g.rotate(-J.torsoA);
      rr(g, -w / 2, -w / 2, w, len + w, w / 2); g.clip();
      drawFlag(g, a.flag, -w / 2, -w / 2, w, len + w);
      g.restore();
    };
  }
  function pack(J, sty, a) {
    return (g, pass, o, ew) => {
      const e = grow(pass, o, ew), w = sty.torsoW;
      g.save(); g.translate(J.H[0], J.H[1]); g.rotate(-J.torsoA);
      g.fillStyle = style(g, pass, col(sty.pack, a)); rr(g, -w * 0.5 - 0.075 - e, 0.11 - e, 0.085 + 2 * e, 0.15 + 2 * e, 0.025 + e); g.fill();
      g.restore();
    };
  }
  function longGun(J, a, kind) {
    return (g, pass, o, ew) => {
      g.save(); g.translate(J.hF[0], J.hF[1]); g.rotate(J.gunA);
      const e = grow(pass, o, ew);
      if (kind === "mg") {
        g.fillStyle = style(g, pass, "#2b2b2b"); rr(g, -0.1 - e, -0.032 - e, 0.48 + 2 * e, 0.064 + 2 * e, 0.02 + e); g.fill();
        rr(g, -0.06 - e, -0.1 - e, 0.05 + 2 * e, 0.08 + 2 * e, 0.012 + e); g.fill();
      } else {
        g.fillStyle = style(g, pass, "#2a2622"); rr(g, -0.06 - e, -0.013 - e, 0.42 + 2 * e, 0.026 + 2 * e, 0.01 + e); g.fill();
        g.fillStyle = style(g, pass, "#6a4e32"); rr(g, -0.24 - e, -0.042 - e, 0.2 + 2 * e, 0.05 + 2 * e, 0.015 + e); g.fill();
        rr(g, -0.06 - e, -0.022 - e, 0.36 + 2 * e, 0.034 + 2 * e, 0.012 + e); g.fill();
        if (pass === "fill") { g.strokeStyle = "#cfcfcf"; g.lineWidth = 0.011; g.lineCap = "round"; g.beginPath(); g.moveTo(0.36, 0); g.lineTo(0.46, 0); g.stroke(); }
      }
      g.restore();
    };
  }
  function marks(J, a, t) {
    return (g, pass) => {
      if (pass !== "fill") return;
      for (const mk of a.marks) {
        if (t < mk.t) continue;
        const k = A.ease.out(clamp((t - mk.t) / 0.09));
        const R = A.rng(mk.seed);
        const cx = J.chest[0] + (R() - 0.5) * 0.06, cy = J.chest[1] + (R() - 0.4) * 0.07;
        g.fillStyle = mk.color;
        A.fx.blob(g, cx, cy, (mk.small ? 0.052 : 0.075) * k, mk.seed, 9, 0.35);
        if (!mk.small) for (let i = 0; i < 4; i++) { const an = R() * TAU, d = (0.09 + R() * 0.06) * k; g.beginPath(); g.arc(cx + Math.cos(an) * d, cy + Math.sin(an) * d, 0.012 + R() * 0.012, 0, TAU); g.fill(); }
      }
    };
  }
  function group(g, parts, o, ew) {
    if (ew) for (const f of parts) f(g, "edge", o, ew);
    for (const f of parts) f(g, "out", o, ew);
    for (const f of parts) f(g, "fill", o, ew);
  }

  /* ------------------------------ dibujo de espaldas ------------------------------ */
  /* de espaldas (front = false) o de frente (front = true): mismo esqueleto plano, cambia el orden de
     dibujo (de frente, brazos y fusil van delante del cuerpo y se ve la cara) */
  function drawBack(g, st, k, front) {
    const a = st.a, sty = st.sty, p = st.p, t = st.t;
    const o = Math.max(0.02, 2.2 / k) * (sty.outline ?? 1.15), ew = 0;
    const limbC = col(sty.limb, a), lw = sty.limbW, tw = sty.torsoW * 1.12;
    /* caída (de espaldas a cámara): se le doblan las rodillas y se desploma hacia el fondo */
    let fall = 0, dip = 0, tilt = 0;
    if (a.death && t >= a.death.t) {
      const τ = t - a.death.t, R = A.rng(a.seed);
      dip = smooth(0, 0.3, τ); fall = ease.in(clamp((τ - 0.18) / 0.5)); tilt = (R() - 0.5) * 0.5 * fall;
    }
    fall = Math.max(fall, st.proneW);
    const rootY = lerp(p.rootY, 0.3, dip * (1 - fall));
    /* piernas: alternan arriba/abajo (pasos que se alejan) */
    const seg = st.m.seg, G = seg && seg.kind === "move" ? A.GAITS[seg.gait] || A.GAITS.walk : null;
    const ph = G ? st.m.dist / G.stride : 0, crouch = clamp((0.445 - rootY) / 0.18);
    const legs = [-1, 1].map(L => {
      const q = ph + (L > 0 ? 0 : 0.5);
      const lift = G ? Math.max(0, Math.sin(TAU * q)) * G.lift * 1.6 : 0, step = G ? 0.03 * Math.cos(TAU * q) : 0;
      const hip = [L * 0.055, rootY], foot = [L * (0.07 + 0.03 * crouch), lift + step];
      const knee = [L * (0.065 + 0.07 * crouch), lerp(hip[1], foot[1], 0.5) + lift * 0.4 - 0.02 * crouch];
      return [hip, knee, foot, [foot[0] + L * 0.012, foot[1] - 0.012]];
    });
    let N = [0, rootY + L.torso * Math.cos(p.lean * 0.6)], H = [0, rootY];
    let shY = N[1] - 0.03, C = [0, N[1] + sty.headR * 0.95];
    const armed = !!a.weapon, swing = G ? 0.03 * Math.sin(TAU * ph) : 0;
    let arms = [-1, 1].map(L => armed
      ? [[L * tw * 0.5, shY], [L * (tw * 0.5 + 0.055), shY - 0.15], [L * 0.03, shY - 0.21]]
      : [[L * tw * 0.5, shY], [L * (tw * 0.5 + 0.03), shY - 0.15], [L * (tw * 0.5 + 0.02), shY - 0.29 + L * swing]]);
    /* tendido visto desde atrás (cae hacia el fondo / cuerpo a tierra): piernas abiertas cerca,
       torso y cabeza más lejos (más arriba en pantalla, achatados), brazos extendidos hacia adelante */
    /* port arms visto desde atrás: el fusil asoma sobre el hombro izquierdo, al costado de la cabeza */
    let gunLine = [[0.13, rootY + 0.05], [-0.31, N[1] + 0.22]];
    if (fall > 0) {
      const sq = (x, y) => [x, y];
      const lieLegs = [-1, 1].map(L => [sq(L * 0.05, 0.07), sq(L * 0.1, 0.035), sq(L * 0.13, 0.0), sq(L * 0.145, -0.01)]);
      for (let i = 0; i < 2; i++) legs[i] = legs[i].map((pt, j) => [lerp(pt[0], lieLegs[i][j][0], fall), lerp(pt[1], lieLegs[i][j][1], fall)]);
      const lieArms = [-1, 1].map(L => [[L * tw * 0.5, 0.2], [L * 0.15, 0.26], [L * 0.19, 0.31]]);
      arms = arms.map((ar, i) => ar.map((pt, j) => [lerp(pt[0], lieArms[i][j][0], fall), lerp(pt[1], lieArms[i][j][1], fall)]));
      H = [0, lerp(H[1], 0.07, fall)]; N = [0, lerp(N[1], 0.22, fall)]; shY = lerp(shY, 0.2, fall);
      C = [0, lerp(C[1], 0.3, fall)];
      gunLine = gunLine.map((pt, j) => [lerp(pt[0], [0.18, 0.3][j], fall), lerp(pt[1], [0.02, 0.2][j], fall)]);
    }
    /* apuntando (de espaldas o de frente): fusil al hombro, hacia el blanco en pantalla (izquierda/derecha) */
    const aw = armed && st.aimDir && fall < 0.05 ? smooth(0.3, 0.8, st.aimW) : 0;
    let aimGun = null;
    if (aw > 0) {
      const sd = front ? -1 : 1, d = st.aimDir, gl = 0.12 + 0.3 * Math.abs(d[0]);
      const s0 = [sd * tw * 0.42, shY + 0.02], tip = [s0[0] + d[0] * gl, s0[1] + d[1] * gl];
      const aimArms = [[[sd * tw * 0.5, shY], [sd * (tw * 0.5 + 0.03), shY - 0.08], [s0[0] + d[0] * 0.04, s0[1] + d[1] * 0.04 - 0.02]],
                       [[-sd * tw * 0.5, shY], [-sd * tw * 0.2, shY - 0.1], [s0[0] + d[0] * gl * 0.55, s0[1] + d[1] * gl * 0.55 - 0.015]]];
      const order = sd > 0 ? [1, 0] : [0, 1];
      arms = arms.map((ar, i) => ar.map((pt, j) => [lerp(pt[0], aimArms[order[i]][j][0], aw), lerp(pt[1], aimArms[order[i]][j][1], aw)]));
      aimGun = [[lerp(gunLine[0][0], s0[0] - d[0] * 0.08, aw), lerp(gunLine[0][1], s0[1] - d[1] * 0.08, aw)], [lerp(gunLine[1][0], tip[0], aw), lerp(gunLine[1][1], tip[1], aw)]];
    }
    /* fusil con forma: culata de madera (en line[0]), cañón y bayoneta pasando line[1] */
    const gunPart = line => (gg, pass, oo) => {
      const e = grow(pass, oo, ew), dx = line[1][0] - line[0][0], dy = line[1][1] - line[0][1], L = Math.hypot(dx, dy) || 1e-3;
      gg.save(); gg.translate(line[0][0], line[0][1]); gg.rotate(Math.atan2(dy, dx));
      /* como el Lee-Enfield: madera casi hasta la punta (culata ancha + guardamano), boca de acero, cerrojo y bayoneta */
      gg.fillStyle = style(gg, pass, "#6a4e32");
      rr(gg, -0.03 - e, -0.036 - e, L * 0.3 + 2 * e, 0.072 + 2 * e, 0.02 + e); gg.fill();
      rr(gg, L * 0.25 - e, -0.022 - e, L * 0.62 + 2 * e, 0.044 + 2 * e, 0.014 + e); gg.fill();
      gg.fillStyle = style(gg, pass, "#2a2622");
      rr(gg, L * 0.84 - e, -0.013 - e, L * 0.2 + 2 * e, 0.026 + 2 * e, 0.01 + e); gg.fill();
      if (pass === "fill") {
        gg.fillStyle = "#2a2622"; rr(gg, L * 0.3, 0.012, 0.035, 0.03, 0.01); gg.fill();
        gg.strokeStyle = "#cfcfcf"; gg.lineWidth = 0.011; gg.lineCap = "round"; gg.beginPath(); gg.moveTo(L * 1.04, 0); gg.lineTo(L * 1.04 + 0.1, 0); gg.stroke();
      }
      gg.restore();
    };
    g.save();
    if (tilt) g.rotate(tilt);
    const back = [];
    if (armed && !aimGun && !front) back.push(gunPart(gunLine));
    const armParts = arms.map(ar => limb(ar, lw * 0.92, limbC));
    if (!front && !aimGun) back.push(...armParts);
    const body = [
      ...legs.map(l => limb(l, lw, limbC)),
      sty.torso === "$flag" ? flagTorso({ H, N, torsoA: 0 }, tw, a) : limb([H, N], tw, col(sty.torso, a)),
      dot(H, tw * 0.5, sty.torso === "$flag" ? limbC : col(sty.torso, a)),
    ];
    const packY = lerp(H[1], N[1], 0.33), packH = Math.max(0.05, (N[1] - H[1]) * 0.55);
    if (sty.pack && !front) body.push((gg, pass, oo) => {
      const e = grow(pass, oo, ew); gg.fillStyle = style(gg, pass, col(sty.pack, a)); rr(gg, -0.065 - e, packY - e, 0.13 + 2 * e, packH + 2 * e, 0.025 + e); gg.fill();
      /* bandera en la mochila (vista de espaldas) */
      if (pass === "fill" && a.flag && sty.packFlag !== false) { gg.save(); rr(gg, -0.065, packY, 0.13, packH, 0.025); gg.clip(); drawFlag(gg, a.flag, -0.065, packY, 0.13, packH); gg.restore(); }
    });
    if (sty.pack && front) body.push((gg, pass) => { if (pass !== "fill") return; gg.strokeStyle = col(sty.pack, a); gg.lineWidth = 0.014; for (const sd of [-1, 1]) { gg.beginPath(); gg.moveTo(sd * tw * 0.38, N[1] - 0.01); gg.lineTo(-sd * tw * 0.15, H[1] + 0.04); gg.stroke(); } });
    body.push(marks({ chest: [0, lerp(H[1], N[1], 0.55)] }, a, t));
    body.push((gg, pass, oo) => {
      const r = sty.headR, e = grow(pass, oo, ew);
      gg.save(); gg.translate(C[0], C[1]); if (fall > 0) gg.scale(1, lerp(1, 0.7, fall));
      if (pass !== "fill") {
        gg.fillStyle = style(gg, pass); gg.beginPath(); gg.arc(0, 0, r * 1.1 + e, 0, TAU); gg.fill();
        if (sty.head === "brodie") { gg.beginPath(); gg.ellipse(0, r * 0.2, r * 1.38 + e, r * 0.3 + e, 0, 0, TAU); gg.fill(); }
        gg.restore(); return;
      }
      if (front) {
        /* de frente: cara + casco con el ala/visera hacia la cámara */
        gg.fillStyle = col(sty.face, a); gg.beginPath(); gg.arc(0, 0, r, 0, TAU); gg.fill();
        gg.fillStyle = col(sty.helmet || sty.limb, a);
        if (sty.head === "stahl") { gg.beginPath(); gg.ellipse(0, r * 0.12, r * 1.1, r * 0.95, 0, 0, Math.PI); gg.fill(); for (const sd of [-1, 1]) { gg.beginPath(); gg.ellipse(sd * r * 0.95, -r * 0.1, r * 0.22, r * 0.42, 0, 0, TAU); gg.fill(); } rr(gg, -r * 1.05, r * 0.05, r * 2.1, r * 0.16, r * 0.07); gg.fill(); }
        else if (sty.head === "brodie") { gg.beginPath(); gg.ellipse(0, r * 0.32, r * 0.92, r * 0.7, 0, 0, Math.PI); gg.fill(); gg.beginPath(); gg.ellipse(0, r * 0.25, r * 1.38, r * 0.27, 0, 0, TAU); gg.fill(); }
        else if (sty.head === "bob") { gg.fillStyle = col(sty.hair, a); gg.beginPath(); gg.ellipse(0, r * 0.25, r * 1.06, r * 0.85, 0, 0, Math.PI); gg.fill(); }
        else if (sty.head === "visor") { gg.beginPath(); gg.ellipse(0, r * 0.08, r * 1.04, r * 0.95, 0, 0, Math.PI); gg.fill(); gg.fillStyle = col(sty.visor, a); rr(gg, -r * 0.8, -r * 0.42, r * 1.6, r * 0.45, r * 0.18); gg.fill(); }
        gg.restore(); return;
      }
      gg.fillStyle = "#3b2f25"; gg.beginPath(); gg.arc(0, 0, r, 0, TAU); gg.fill();   /* nuca / pelo */
      gg.fillStyle = col(sty.face, a); gg.fillRect(-r * 0.32, -r * 1.05, r * 0.64, r * 0.4);   /* cuello */
      gg.fillStyle = col(sty.helmet || sty.limb, a);
      if (sty.head === "stahl") { gg.beginPath(); gg.ellipse(0, -r * 0.05, r * 1.1, r * 1.0, 0, Math.PI * 1.08, Math.PI * 1.92, true); gg.fill(); }
      else if (sty.head === "brodie") { gg.beginPath(); gg.ellipse(0, r * 0.3, r * 0.95, r * 0.75, 0, 0, Math.PI); gg.fill(); gg.beginPath(); gg.ellipse(0, r * 0.2, r * 1.38, r * 0.3, 0, 0, TAU); gg.fill(); }
      else if (sty.head === "bob") { gg.fillStyle = col(sty.hair, a); gg.beginPath(); gg.arc(0, 0, r * 1.05, 0, TAU); gg.fill(); }
      else { gg.beginPath(); gg.arc(0, r * 0.1, r * 1.02, 0, Math.PI); gg.fill(); }
      gg.restore();
    });
    /* delante del cuerpo: de frente, brazos y fusil cruzado; apuntando, el fusil al hombro */
    const frontParts = [];
    if (front && armed && !aimGun) frontParts.push(gunPart([[-0.12, rootY + 0.06], [0.16, N[1] + 0.2]]));
    if (front || aimGun) frontParts.push(...armParts);
    if (aimGun) frontParts.push(gunPart(aimGun));
    group(g, back, o, ew); group(g, body, o, ew); if (frontParts.length) group(g, frontParts, o, ew);
    g.restore();
  }

  A.rig.draw = function (g, st, S, proj) {
    const a = st.a, J = st.J, sty = st.sty;
    if (st.hidden) return;
    const P0 = proj(st.x, st.y, st.z), k = P0.s * a.scale;
    if (k < 2) return;
    g.save();
    /* vista de dron: el personaje se acorta un poco en vertical cuanto más mira hacia abajo la cámara */
    const ky = 1 - 0.3 * Math.sin(Math.max(0, S.cam?.pitch || 0));
    g.translate(P0.x, P0.y);
    if (st.view !== "side") {
      g.scale(k * st.turnK, -k * ky); g.lineCap = "round"; g.lineJoin = "round";
      drawBack(g, st, k, st.view === "front"); g.restore(); return;
    }
    g.scale(st.sface * k * st.turnK, -k * ky);
    g.lineCap = "round"; g.lineJoin = "round";
    const o = Math.max(0.02, 2.2 / k) * (sty.outline ?? 1.15), ew = S.view.light ? Math.max(0.006, 1 / k) : 0;
    const limbC = col(sty.limb, a), lw = sty.limbW, armW = lw * 0.92;
    const back = [limb([J.S, J.eB, J.hB], armW, limbC), dot(J.hB, 0.04, col(sty.hand, a), "#1a1a1a")];
    const body = [
      limb([J.H, J.kB, J.fB, J.tB], lw, limbC), limb([J.H, J.kF, J.fF, J.tF], lw, limbC),
      ...(sty.pack ? [pack(J, sty, a)] : []),
      sty.torso === "$flag" ? flagTorso(J, sty.torsoW, a) : limb([J.H, J.N], sty.torsoW, col(sty.torso, a)),
      dot(J.H, sty.torsoW * 0.52, sty.torso === "$flag" ? col(sty.limb, a) : col(sty.torso, a)),
      marks(J, a, st.t), head(J, sty, a),
    ];
    const front = [limb([J.S, J.eF, J.hF], armW, limbC)];
    const wk = A.weapons[a.weapon]?.draw || "pistol";
    if (a.weapon) front.push(wk === "pistol" ? gun(J, a) : longGun(J, a, wk));
    front.push(dot(J.hF, 0.042, col(sty.hand, a), "#1a1a1a"));
    group(g, back, o, ew); group(g, body, o, ew); group(g, front, o, ew);
    g.restore();
  };

  A.rig.shadow = function (g, st, proj) {
    if (st.hidden) return;
    const a = st.a, sc = a.scale;
    const cx = st.x + st.lieDir * st.sface * (st.right?.[0] ?? 1) * 0.45 * sc * st.lying, w = lerp(0.3, 0.62, st.lying) * sc;
    const P = proj(cx, 0, st.z), Px = proj(cx + w, 0, st.z), Pz = proj(cx, 0, st.z + 0.12 * sc);
    const rx = Math.abs(Px.x - P.x), ry = Math.max(1, Math.abs(Pz.y - P.y) * 1.4);
    const alpha = 0.22 * (1 - clamp(st.y / 1.1));
    if (rx < 1 || alpha <= 0.01) return;
    g.save(); g.translate(P.x, P.y); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, `rgba(0,0,0,${alpha})`); gr.addColorStop(0.6, `rgba(0,0,0,${alpha * 0.55})`); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
    g.restore();
  };
})();
