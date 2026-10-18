/* NodeAction · rig3d: personajes con VOLUMEN (esqueleto 3D dibujado en 2D, estilo sticker).
 *
 * Se activa por escena con  "render": "3d"  en scene.json (si no, sigue rig.js: nada del trabajo 2D se
 * pierde). Misma interfaz que rig.js (state / draw / shadow / toWorld), así el resto del motor no cambia.
 *
 * Idea (estudio: docs/investigaciones/nodeaction-escenas-de-accion-2026-10.md §10): cada personaje es UN
 * cuerpo en el espacio. La pose sale del rig 2D (andares, saltos, rodilla en tierra, caídas…, en el plano
 * "adelante–arriba" del personaje) y se extiende a 3D: izquierda/derecha separadas, orientado según su
 * rumbo en el mundo (suavizado). La cámara proyecta cada articulación: de frente, de costado o de 3/4 es
 * el mismo cuerpo — no hay vistas que cambiar ni "papel que gira".
 *   · torso = caja (ancho, alto, profundidad): frente con la bandera, espalda (mochila), costados más oscuros
 *   · cabeza = esfera: la cara se corre sobre ella según hacia dónde mira; casco Brodie / Stahlhelm / visera
 *   · fusil = segmento 3D: apuntando, va al blanco REAL (la bala sale por donde apunta, desde cualquier lado)
 *   · piezas ordenadas por profundidad (pintor) + contorno blanco de la silueta + borde fino entre piezas
 */
(function () {
  "use strict";
  const A = window.Action;
  const { clamp, lerp, smooth } = A;
  const TAU = Math.PI * 2;
  const R3 = (A.rig3d = {});

  /* medidas del cuerpo (unidades de personaje) */
  const B = { hipW: 0.06, shW: 0.105, kneeW: 0.065, footW: 0.075, torsoW: 0.15, torsoD: 0.095 };

  const v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    lerp: (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)],
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  };

  /* rumbo suavizado (promedio de los últimos 0,3 s): el cuerpo gira, no salta */
  function headingSmooth(a, t, S) {
    let x = 0, z = 0;
    for (let i = 0; i < 6; i++) { const h = A.rig2d.heading(a, t - i * 0.06, S), l = Math.hypot(h[0], h[1]) || 1; x += h[0] / l; z += h[1] / l; }
    const l = Math.hypot(x, z) || 1;
    return [x / l, z / l];
  }

  R3.state = function (a, t, S, cam) {
    const st = A.rig2d.state(a, t, S, cam);         /* pose 2D (plano adelante–arriba) ya resuelta */
    const J = st.J, sc = a.scale, sty = st.sty;
    const h = headingSmooth(a, t, S);
    const f = [h[0], 0, h[1]], s = [h[1], 0, -h[0]], up = [0, 1, 0];     /* adelante · derecha · arriba */
    const base = [st.x, st.y, st.z];
    /* punto del plano 2D (u adelante, v arriba) + w a la derecha → mundo */
    const W = (p, w = 0) => v3.add(base, v3.add(v3.add(v3.mul(f, p[0] * sc), v3.mul(up, p[1] * sc)), v3.mul(s, w * sc)));
    /* lado: la pierna/brazo "F" del 2D es la derecha (+s) y la "B" la izquierda */
    const P = {
      hipR: W(J.H, B.hipW), hipL: W(J.H, -B.hipW), kneeR: W(J.kF, B.kneeW), kneeL: W(J.kB, -B.kneeW),
      footR: W(J.fF, B.footW), footL: W(J.fB, -B.footW), toeR: W(J.tF, B.footW), toeL: W(J.tB, -B.footW),
      H: W(J.H), N: W(J.N), shR: W(J.S, B.shW), shL: W(J.S, -B.shW), C: W(J.C),
      elR: W(J.eF, B.shW + 0.03), elL: W(J.eB, -B.shW - 0.03), haR: W(J.hF, B.shW * 0.6), haL: W(J.hB, -B.shW * 0.6),
    };
    /* eje del torso (de la cadera al cuello) y su "adelante" real (las caídas lo rotan) */
    const tUp = v3.norm(v3.sub(P.N, P.H));
    let tF = v3.sub(f, v3.mul(tUp, f[0] * tUp[0] + f[1] * tUp[1] + f[2] * tUp[2]));
    tF = Math.hypot(...tF) < 0.05 ? v3.mul(up, (st.p.rot || 0) > 0 ? 1 : -1) : v3.norm(tF);
    /* ---- fusil 3D: cruzado sobre el pecho (marcha) o al hombro apuntando al blanco ---- */
    let gun = null, muzzleW = null;
    const wk = A.weapons[a.weapon]?.draw;
    if (a.weapon) {
      const len = (wk === "mg" ? 0.5 : wk === "rifle" ? 0.62 : 0.24) * sc;
      const port = { butt: v3.add(W(J.H, B.hipW * 1.2), v3.mul(tF, 0.08 * sc)), tip: v3.add(v3.add(P.N, v3.mul(s, -0.17 * sc)), v3.add(v3.mul(tUp, 0.2 * sc), v3.mul(tF, 0.09 * sc))) };
      if (wk === "pistol" || !wk) { port.butt = P.haR; port.tip = v3.add(P.haR, v3.mul(v3.norm(v3.sub(P.haR, P.elR)), len)); }
      let g = port;
      const am = A.rig2d.aimAt(a, t), tp = am.r ? A.rig2d.targetPt(S, am.r, t) : null;
      const aw = tp && !(a.death && t >= a.death.t) ? smooth(0.15, 0.85, am.w) : 0;
      if (aw > 0) {
        const sh = v3.add(P.shR, v3.mul(s, -0.03 * sc));
        const d = v3.norm(v3.sub(tp, sh));
        const aim = { butt: v3.add(sh, v3.mul(d, -0.12 * sc)), tip: v3.add(sh, v3.mul(d, len - 0.12 * sc)) };
        g = { butt: v3.lerp(port.butt, aim.butt, aw), tip: v3.lerp(port.tip, aim.tip, aw) };
      }
      /* retroceso */
      for (const sh of a.shots) { const dt = t - sh.t; if (dt >= 0 && dt < 0.14) { const k = (1 - dt / 0.14) * 0.05 * sc, d = v3.norm(v3.sub(g.tip, g.butt)); g = { butt: v3.sub(g.butt, v3.mul(d, k)), tip: v3.sub(g.tip, v3.mul(d, k)) }; } }
      const dir = v3.norm(v3.sub(g.tip, g.butt));
      /* manos sobre el arma (gatillo y guardamano) y codos hacia afuera/abajo */
      if (wk !== "pistol" && wk) {
        P.haR = v3.add(g.butt, v3.mul(dir, 0.16 * sc)); P.haL = v3.add(g.butt, v3.mul(dir, 0.36 * sc));
        P.elR = v3.add(v3.lerp(P.shR, P.haR, 0.5), v3.add(v3.mul(up, -0.07 * sc), v3.mul(s, 0.05 * sc)));
        P.elL = v3.add(v3.lerp(P.shL, P.haL, 0.5), v3.add(v3.mul(up, -0.07 * sc), v3.mul(s, -0.04 * sc)));
      }
      gun = { butt: g.butt, tip: g.tip, kind: wk || "pistol" };
      muzzleW = g.tip;
    }
    return { ...st, three: true, P, f, s, up, tUp, tF, gun, muzzleW, J: { muzzle: "W" }, sty };
  };

  R3.toWorld = (st, v) => (st.muzzleW && v === st.J.muzzle ? st.muzzleW : [st.x, st.y + 0.6 * st.a.scale, st.z]);

  /* ------------------------------ dibujo ------------------------------ */
  const OUT = "#ffffff";
  function shade(hex, k) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return hex;
    const n = parseInt(m[1], 16), c = x => Math.round(clamp(x * k, 0, 255));
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  }

  R3.draw = function (g, st, S, proj) {
    if (st.hidden) return;
    const a = st.a, P = st.P, sty = st.sty, col = A.rig2d.col;
    const pr = {}; for (const k in P) pr[k] = proj(P[k][0], P[k][1], P[k][2]);
    const k0 = pr.H.s * a.scale;
    if (k0 < 2) return;
    const o = Math.max(1.4, k0 * 0.024) * (sty.outline ?? 1.1);           /* borde blanco (px) */
    const limbC = col(sty.limb, a), lw = sty.limbW;
    const parts = [];
    const seg = (pts, w, c, d) => parts.push({ d, kind: "seg", pts: pts.map(q => [q.x, q.y]), w: pts.map(q => w * q.s * a.scale), c });
    const depth = (...qs) => qs.reduce((m, q) => m + q.D, 0) / qs.length;

    /* piernas y brazos (cápsulas que se afinan con la distancia; lo lejano un poco más oscuro) */
    const far = side => (pr[side === "R" ? "hipR" : "hipL"].D > pr.H.D ? 0.86 : 1);
    seg([pr.hipR, pr.kneeR, pr.footR, pr.toeR], lw, shade(limbC, far("R")), depth(pr.kneeR, pr.footR));
    seg([pr.hipL, pr.kneeL, pr.footL, pr.toeL], lw, shade(limbC, far("L")), depth(pr.kneeL, pr.footL));
    seg([pr.shR, pr.elR, pr.haR], lw * 0.92, shade(limbC, pr.shR.D > pr.N.D ? 0.86 : 1), depth(pr.elR, pr.haR) - 0.001);
    seg([pr.shL, pr.elL, pr.haL], lw * 0.92, shade(limbC, pr.shL.D > pr.N.D ? 0.86 : 1), depth(pr.elL, pr.haL) - 0.001);
    for (const hk of ["haR", "haL"]) parts.push({ d: pr[hk].D - 0.002, kind: "dot", x: pr[hk].x, y: pr[hk].y, r: 0.04 * pr[hk].s * a.scale, c: col(sty.hand, a), rim: "#1a1a1a" });

    /* torso: caja; caras visibles según la cámara */
    const tw = (sty.torsoW ?? 0.13) * 1.12 * a.scale / 2, td = B.torsoD * a.scale / 2;
    const Hb = v3.add(P.H, v3.mul(st.tUp, -0.03 * a.scale)), Nt = v3.add(P.N, v3.mul(st.tUp, 0.005));
    const side3 = v3.norm([st.tF[2] * st.tUp[1] - st.tF[1] * st.tUp[2], st.tF[0] * st.tUp[2] - st.tF[2] * st.tUp[0], st.tF[1] * st.tUp[0] - st.tF[0] * st.tUp[1]]);
    const cor = (bu, sw, fd) => { const q = v3.add(v3.add(bu ? Nt : Hb, v3.mul(side3, sw * tw)), v3.mul(st.tF, fd * td)); return proj(q[0], q[1], q[2]); };
    const C8 = {}; for (const bu of [0, 1]) for (const sw of [-1, 1]) for (const fd of [-1, 1]) C8[`${bu}${sw}${fd}`] = cor(bu, sw, fd);
    const body = sty.torso === "$flag" ? a.body : col(sty.torso, a);
    const faces = [
      { q: ["0-11", "011", "111", "1-11"], c: body, flag: sty.torso === "$flag" ? a.flag : null, front: true },
      { q: ["01-1", "0-1-1", "1-1-1", "11-1"], c: shade(body, 0.92), back: true },
      { q: ["011", "01-1", "11-1", "111"], c: shade(body, 0.8) },
      { q: ["0-1-1", "0-11", "1-11", "1-1-1"], c: shade(body, 0.8) },
      { q: ["1-11", "111", "11-1", "1-1-1"], c: shade(body, 1.05) },
    ];
    for (const fc of faces) {
      const pts = fc.q.map(k => C8[k]);
      const area = pts.reduce((m, p, i) => { const q = pts[(i + 1) % 4]; return m + (p.x * q.y - q.x * p.y); }, 0);
      if (area <= 0) continue;                                  /* cara de espaldas a la cámara (canvas: y hacia abajo) */
      parts.push({ d: depth(...pts) + 0.0005, kind: "quad", pts: pts.map(p => [p.x, p.y]), c: fc.c, flag: fc.flag });
    }
    /* mochila (caja chica en la espalda) */
    if (sty.pack) {
      const pc = v3.add(v3.lerp(Hb, Nt, 0.62), v3.mul(st.tF, -(td + 0.035 * a.scale)));
      const pw = 0.055 * a.scale, ph = 0.08 * a.scale, pd = 0.035 * a.scale;
      const pk = (u, sw, fd) => { const q = v3.add(v3.add(v3.add(pc, v3.mul(st.tUp, u * ph)), v3.mul(side3, sw * pw)), v3.mul(st.tF, fd * pd)); return proj(q[0], q[1], q[2]); };
      const pf = [[[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]];
      for (const fq of pf) {
        const pts = fq.map(([u, sw, fd]) => pk(u, sw, fd));
        const area = pts.reduce((m, p, i) => { const q = pts[(i + 1) % 4]; return m + (p.x * q.y - q.x * p.y); }, 0);
        if (area >= 0) continue;   /* (las caras de la mochila están en el orden inverso al del torso) */
        parts.push({ d: depth(...pts), kind: "quad", pts: pts.map(p => [p.x, p.y]), c: shade(col(sty.pack, a), fq === pf[0] ? 1 : 0.85) });
      }
    }
    /* marcas de impacto en el pecho (rojas) */
    const marks = a.marks.filter(m => st.t >= m.t);
    if (marks.length) {
      const mc = v3.add(v3.lerp(Hb, Nt, 0.6), v3.mul(st.tF, td * 1.02)), mp = proj(mc[0], mc[1], mc[2]);
      parts.push({ d: mp.D - 0.0007, kind: "marks", x: mp.x, y: mp.y, r: 0.05 * mp.s * a.scale, marks });
    }
    /* cabeza (esfera + cara que se corre + casco) */
    parts.push({ d: pr.C.D, kind: "head" });
    /* fusil 3D */
    if (st.gun) {
      const gb = proj(...st.gun.butt), gt = proj(...st.gun.tip);
      parts.push({ d: depth(gb, gt) - 0.003, kind: "gun", gb, gt, gk: st.gun.kind });
    }

    parts.sort((p, q) => q.d - p.d);

    /* 1) contorno blanco de toda la silueta */
    g.save(); g.lineCap = "round"; g.lineJoin = "round";
    const headR = (sty.headR ?? 0.11) * pr.C.s * a.scale;
    for (const p of parts) drawPart(g, p, "out", o);
    g.fillStyle = OUT; g.beginPath(); g.arc(pr.C.x, pr.C.y, headR * 1.1 + o, 0, TAU); g.fill();
    /* 2) piezas de atrás hacia adelante, cada una con un borde fino (separa lo que se superpone) */
    for (const p of parts) {
      if (p.kind === "head") { drawHead(g, st, pr, headR, o * 0.5, S); continue; }
      drawPart(g, p, "edge", o * 0.45);
      drawPart(g, p, "fill", 0);
    }
    g.restore();
  };

  function drawPart(g, p, pass, e) {
    const c = pass === "fill" ? null : OUT;
    if (p.kind === "seg") {
      g.strokeStyle = c || p.c;
      for (let i = 0; i + 1 < p.pts.length; i++) {
        g.lineWidth = (p.w[i] + p.w[i + 1]) / 2 + 2 * e;
        g.beginPath(); g.moveTo(p.pts[i][0], p.pts[i][1]); g.lineTo(p.pts[i + 1][0], p.pts[i + 1][1]); g.stroke();
      }
    } else if (p.kind === "dot") {
      g.fillStyle = c || p.c; g.beginPath(); g.arc(p.x, p.y, p.r + e, 0, TAU); g.fill();
      if (pass === "fill" && p.rim) { g.strokeStyle = p.rim; g.lineWidth = Math.max(0.6, p.r * 0.3); g.stroke(); }
    } else if (p.kind === "quad") {
      g.beginPath(); p.pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath();
      if (pass !== "fill") { g.strokeStyle = OUT; g.lineWidth = 2 * e; g.stroke(); g.fillStyle = OUT; g.fill(); return; }
      g.fillStyle = p.c; g.fill();
      if (p.flag) {
        /* bandera mapeada a la cara frontal (transformación afín del rectángulo) */
        const [p0, p1, , p3] = p.pts;
        g.save(); g.clip(); g.transform(p1[0] - p0[0], p1[1] - p0[1], p3[0] - p0[0], p3[1] - p0[1], p0[0], p0[1]);
        A.drawFlag(g, p.flag, 0, 0, 1, 1); g.restore();
      }
    } else if (p.kind === "marks") {
      if (pass !== "fill") return;
      for (const m of p.marks) { g.fillStyle = m.color; A.fx.blob(g, p.x, p.y, p.r, m.seed, 9, 0.4); }
    } else if (p.kind === "gun") {
      const { gb, gt } = p, dx = gt.x - gb.x, dy = gt.y - gb.y, L = Math.hypot(dx, dy) || 1e-3, sc = (gb.s + gt.s) / 2;
      g.save(); g.translate(gb.x, gb.y); g.rotate(Math.atan2(dy, dx));
      const fillC = (col) => (pass === "fill" ? col : OUT), ee = pass === "fill" ? 0 : e;
      const box = (x, w, h, col) => { g.fillStyle = fillC(col); g.beginPath(); g.roundRect ? g.roundRect(x - ee, -h / 2 - ee, w + 2 * ee, h + 2 * ee, h / 2) : g.rect(x - ee, -h / 2 - ee, w + 2 * ee, h + 2 * ee); g.fill(); };
      if (p.gk === "mg") { box(0, L, 0.06 * sc, "#2b2b2b"); }
      else if (p.gk === "pistol") { box(0, L, 0.045 * sc, "#1c1c1c"); }
      else {
        box(0, L * 0.3, 0.07 * sc, "#6a4e32"); box(L * 0.25, L * 0.62, 0.042 * sc, "#6a4e32"); box(L * 0.84, L * 0.18, 0.024 * sc, "#2a2622");
        if (pass === "fill") { g.strokeStyle = "#cfcfcf"; g.lineWidth = Math.max(0.8, 0.011 * sc); g.beginPath(); g.moveTo(L * 1.02, 0); g.lineTo(L * 1.02 + 0.1 * sc * Math.min(1, L / (0.5 * sc)), 0); g.stroke(); }
      }
      g.restore();
    }
  }

  /* cabeza: esfera de piel/pelo; la cara se corre hacia donde mira (giro real), casco proyectado */
  function drawHead(g, st, pr, r, e, S) {
    const a = st.a, sty = st.sty, col = A.rig2d.col, P = st.P;
    const C = pr.C;
    const fw = v3.add(P.C, v3.mul(st.tF, (sty.headR ?? 0.11) * a.scale * 0.55)), fp = S.proj(fw[0], fw[1], fw[2]);
    const toCam = fp.D < C.D;                                    /* la cara mira hacia la cámara */
    g.save();
    g.fillStyle = OUT; g.beginPath(); g.arc(C.x, C.y, r + e, 0, TAU); g.fill();
    g.beginPath(); g.arc(C.x, C.y, r, 0, TAU); g.clip();
    g.fillStyle = sty.head === "bob" ? col(sty.hair, a) : "#3b2f25"; g.fillRect(C.x - r, C.y - r, 2 * r, 2 * r);
    /* cara: disco corrido hacia el "adelante" proyectado (de frente centrado, de perfil media luna) */
    g.fillStyle = col(sty.face, a);
    const off = toCam ? 1 : -1, cx = lerp(C.x, fp.x, 1.6), cy = lerp(C.y, fp.y, 1.6);
    if (toCam || Math.hypot(fp.x - C.x, fp.y - C.y) > r * 0.25) { g.beginPath(); g.arc(cx, cy, r * (toCam ? 0.95 : 0.8), 0, TAU); g.fill(); }
    if (off < 0) { g.fillStyle = sty.head === "bob" ? col(sty.hair, a) : "#3b2f25"; }
    g.restore();
    /* casco: ala (anillo horizontal proyectado) + cúpula */
    const helmC = col(sty.helmet || sty.limb, a), hr = (sty.headR ?? 0.11) * a.scale;
    const ring = (rad, dy, n = 14) => { const pts = []; for (let i = 0; i < n; i++) { const an = (i / n) * TAU; const q = v3.add(v3.add(P.C, v3.mul(st.tUp, dy)), v3.add(v3.mul(st.tF, Math.cos(an) * rad), v3.mul([st.tF[2], 0, -st.tF[0]], Math.sin(an) * rad))); pts.push(S.proj(q[0], q[1], q[2])); } return pts; };
    const poly = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fill(); };
    if (sty.head === "brodie" || sty.head === "stahl" || sty.head === "visor") {
      const top = S.proj(...v3.add(P.C, v3.mul(st.tUp, hr * (sty.head === "brodie" ? 0.38 : 0.2))));
      if (sty.head === "brodie") { poly(ring(hr * 1.42, hr * 0.18), OUT); poly(ring(hr * 1.32, hr * 0.18), helmC); }
      g.fillStyle = helmC; g.beginPath(); g.arc(top.x, top.y, r * (sty.head === "stahl" ? 1.02 : 0.92), Math.PI, 0); g.fill();
      if (sty.head === "stahl") { poly(ring(hr * 1.12, -hr * 0.02, 16).filter((_, i) => i > 3 && i < 13), helmC); }
      if (sty.head === "visor" && toCam) { g.fillStyle = col(sty.visor, a); g.beginPath(); g.ellipse(lerp(C.x, fp.x, 1.2), lerp(C.y, fp.y, 1.2) + r * 0.05, r * 0.7, r * 0.26, 0, 0, TAU); g.fill(); }
    }
  }

  R3.shadow = function (g, st, proj) {
    if (st.hidden) return;
    const a = st.a, P = st.P;
    /* sombra bajo el cuerpo: centrada entre pies y cadera, se estira si está tendido */
    const cx = (P.footR[0] + P.footL[0] + P.H[0] * 2) / 4, cz = (P.footR[2] + P.footL[2] + P.H[2] * 2) / 4;
    const lyingAxis = [P.N[0] - P.H[0], P.N[2] - P.H[2]], lyingL = Math.hypot(...lyingAxis);
    const rad = 0.24 * a.scale + lyingL * 0.6;
    const pts = [];
    for (let i = 0; i < 16; i++) { const an = (i / 16) * TAU; const q = proj(cx + Math.cos(an) * rad, 0, cz + Math.sin(an) * rad * 0.7); pts.push(q); }
    const alpha = 0.2 * (1 - clamp(st.y / 1.1));
    g.save(); g.fillStyle = `rgba(0,0,0,${alpha})`;
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fill();
    g.restore();
  };
})();
