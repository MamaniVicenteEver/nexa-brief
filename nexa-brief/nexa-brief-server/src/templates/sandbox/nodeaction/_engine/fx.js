/* NodeAction · efectos: proyectiles con estela, destellos, salpicaduras balísticas y manchas.
 *
 * Todo se PRECALCULA en compile (gotas, dónde caen, manchas, charcos) con semillas por
 * impacto: dibujar el instante t solo evalúa fórmulas cerradas (posición = p0 + v·τ + ½·g·τ²).
 * Las manchas del suelo se proyectan punto por punto sobre el plano y = 0, así se aplastan con
 * la perspectiva igual que el suelo real.
 */
(function () {
  "use strict";
  const A = window.Action;
  const { clamp, lerp, ease, rng, hash } = A;
  const TAU = Math.PI * 2, G = 9.8;

  const fx = (A.fx = {});
  let cache = new Map();
  fx.reset = () => { cache = new Map(); };

  /* mancha orgánica (en el marco actual del canvas) */
  fx.blob = function (g, cx, cy, r, seed, n = 10, rough = 0.32) {
    if (r <= 0) return;
    const R = rng(seed), pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + R() * 0.3; const rr = r * (1 - rough / 2 + rough * R()); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    g.beginPath();
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; if (i === 0) g.moveTo(m[0], m[1]); else g.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
    const p = pts[0], q = pts[1 % n]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    g.closePath(); g.fill();
  };

  fx.compile = function (S) {
    const decals = [], drops = [];
    for (const imp of S.impacts) {
      const W = A.weapons[imp.weapon] || A.weapons.paint;
      const R = rng(imp.seed);
      const [n0, n1] = W.droplets || [10, 14];
      const n = Math.round(lerp(n0, n1, R()) * (imp.actor ? 1 : 0.45));
      const p0 = imp.p;
      for (let i = 0; i < n; i++) {
        const v = [imp.dirX * (0.8 + R() * 2.2) + (R() - 0.5) * 1.8, 0.5 + R() * 2.4, (R() - 0.5) * 1.6];
        if (!imp.actor) { v[1] = 0.5 + R() * 1.2; v[0] *= 0.5; v[2] *= 0.6; }
        const r = 0.011 + R() * 0.02;
        const y0 = Math.max(0.01, p0[1]);
        const τ = (v[1] + Math.sqrt(v[1] * v[1] + 2 * G * y0)) / G;
        drops.push({ t0: imp.t, t1: imp.t + τ, p0: [p0[0], y0, p0[2]], v, r, color: imp.color });
        decals.push({ t: imp.t + τ, x: p0[0] + v[0] * τ, z: p0[2] + v[2] * τ, r: r * 1.7, color: imp.color, kind: "dot", seed: hash(`d${imp.seed}:${i}`) });
      }
      if (W.impact === "dust") {
        /* fallo: polvo · impacto en el cuerpo: gotas rojas (W.blood) */
        const c1 = imp.actor ? W.blood || "#b3141b" : "#7a6f60", c2 = imp.actor ? "#8e1b1b" : "#b3aa9a";
        if (!imp.actor) decals.push({ t: imp.t, x: p0[0], z: p0[2], r: 0.035 + R() * 0.03, color: "#cbc3b4", kind: "dot", seed: imp.seed });
        for (const d of drops.slice(-n)) { d.color = c1; if (imp.actor) d.r *= 0.7; }
        for (const d of decals.slice(-n - 1)) if (d.kind === "dot" && d.t > imp.t) d.color = c2;
      } else if (imp.actor) {
        /* rocío detrás del blanco + mancha en el suelo */
        decals.push({ t: imp.t + 0.12, x: p0[0] + imp.dirX * (0.45 + R() * 0.3), z: p0[2] + (R() - 0.5) * 0.4, r: 0.15 + R() * 0.07, color: imp.color, kind: "splat", seed: imp.seed ^ 77 });
      } else if (W.impact === "splat") {
        decals.push({ t: imp.t, x: p0[0], z: p0[2], r: 0.11 + R() * 0.07, color: imp.color, kind: "splat", seed: imp.seed });
      }
    }
    /* charco bajo el cuerpo cuando termina de caer */
    for (const a of S.actors.values()) {
      if (!a.death || a.death.forced && !a.marks.length || a.death.blast) continue;
      if ((A.weapons[a.death.weapon] || {}).impact === "dust") continue;
      const q = S.posAt(a, a.death.t);
      const killer = S.actors.get(a.death.from);
      decals.push({ t: a.death.t + 0.5, x: q.x - a.death.face * 0.42 * a.scale, z: q.z, r: 0.23 * a.scale, color: a.marks.at(-1)?.color || killer?.paint || a.paint, kind: "pool", seed: a.seed });
    }
    /* explosiones: cráter + tierra que vuela + humo */
    const smoke = [];
    for (const b of S.blasts) {
      const R = rng(b.seed), k = b.size;
      decals.push({ t: b.t + 0.05, x: b.at[0], z: b.at[1], r: 0.32 * k, color: "#8f8577", kind: "crater", seed: b.seed });
      for (let i = 0; i < Math.round(9 * k); i++) {
        const an = R() * Math.PI * 2, sp = 1 + R() * 2.4 * Math.sqrt(k);
        const v = [Math.cos(an) * sp * 0.6, 2.2 + R() * 3.2 * Math.sqrt(k), Math.sin(an) * sp * 0.5];
        const τ = (v[1] + Math.sqrt(v[1] * v[1] + 2 * G * 0.05)) / G;
        drops.push({ t0: b.t, t1: b.t + τ, p0: [b.at[0], 0.05, b.at[1]], v, r: 0.02 + R() * 0.035 * k, color: R() < 0.5 ? "#5e5347" : "#7c7062" });
        decals.push({ t: b.t + τ, x: b.at[0] + v[0] * τ, z: b.at[1] + v[2] * τ, r: 0.035 + R() * 0.03, color: "#a99f8f", kind: "dot", seed: hash(`bd${b.seed}:${i}`) });
      }
      for (let i = 0; i < 5 + Math.round(3 * k); i++) {
        smoke.push({ t0: b.t + R() * 0.15, x: b.at[0] + (R() - 0.5) * 0.5 * k, z: b.at[1] + (R() - 0.5) * 0.3 * k, y0: 0.15 + R() * 0.3 * k,
          r0: 0.12 * k, r1: (0.45 + R() * 0.5) * k, rise: (0.6 + R() * 0.9) * k, life: 2.6 + R() * 2.2, shade: Math.round(lerp(120, 185, R())), drift: (R() - 0.3) * 0.5 });
      }
    }
    /* amapolas: florecen sobre el campo (junto a cada caído + algunas sueltas) */
    const PO = S.scene.fx?.poppies;
    if (PO && S.poppiesAt != null) {
      const R = rng(hash("poppies")), spread = PO.spread ?? 4;
      const fallen = [...S.actors.values()].filter(a => a.death && a.death.t < S.poppiesAt);
      const spots = [];
      for (const a of fallen) { const q = S.posAt(a, a.death.t); for (let i = 0; i < (PO.perBody ?? 2); i++) spots.push([q.x + (R() - 0.5) * 1.2, q.z + (R() - 0.5) * 0.8]); }
      const ar = PO.area || S.scene.arena || { x: [-6, 6], z: [4, 14] };
      for (let i = 0; i < (PO.extra ?? 40); i++) spots.push([lerp(ar.x[0], ar.x[1], R()), lerp(ar.z[0], ar.z[1], R())]);
      spots.forEach((p, i) => decals.push({ t: S.poppiesAt + R() * spread, x: p[0], z: p[1], r: 0.1 + R() * 0.07, color: "#c8102e", kind: "poppy", seed: hash(`pp${i}`) }));
    }
    decals.sort((p, q) => p.t - q.t);
    S.decals = decals; S.droplets = drops; S.smoke = smoke;
  };

  /* mancha sobre el suelo (puntos proyectados uno a uno) */
  function groundBlob(g, proj, d, k) {
    const R = rng(d.seed), n = d.kind === "pool" ? 14 : 12, rough = d.kind === "pool" ? 0.28 : 0.55;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + R() * 0.25;
      let rr = d.r * k * (1 - rough / 2 + rough * R());
      if (d.kind === "splat" && i % 3 === 0) rr *= 1.35;
      const P = proj(d.x + Math.cos(a) * rr, 0, d.z + Math.sin(a) * rr * 0.9);
      pts.push([P.x, P.y]);
    }
    g.beginPath();
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; if (i === 0) g.moveTo(m[0], m[1]); else g.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
    g.quadraticCurveTo(pts[0][0], pts[0][1], (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
    g.closePath(); g.fill();
    if (d.kind === "splat") {
      for (let i = 0; i < 5; i++) {
        const a = R() * TAU, dd = d.r * k * (1.3 + R() * 0.8);
        const P = proj(d.x + Math.cos(a) * dd, 0, d.z + Math.sin(a) * dd * 0.9), Q = proj(d.x + Math.cos(a) * dd + 0.03, 0, d.z + Math.sin(a) * dd * 0.9);
        const r = Math.max(0.8, Math.abs(Q.x - P.x) * (0.6 + R()));
        g.beginPath(); g.ellipse(P.x, P.y, r, r * 0.4, 0, 0, TAU); g.fill();
      }
    }
  }

  function quad(g, pts) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fill(); }
  function poppy(g, proj, d, k) {
    const P = proj(d.x, 0, d.z), Q = proj(d.x + d.r, 0, d.z), Z = proj(d.x, 0, d.z + d.r);
    const rx = Math.abs(Q.x - P.x) * k, ry = Math.max(rx * 0.5, Math.abs(Z.y - P.y) * k);
    if (rx < 0.6) return;
    const R = rng(d.seed), rot = R() * TAU;
    g.fillStyle = R() < 0.5 ? "#c8102e" : "#d7262f";
    for (let i = 0; i < 5; i++) { const a = rot + (i / 5) * TAU; g.beginPath(); g.ellipse(P.x + Math.cos(a) * rx * 0.45, P.y + Math.sin(a) * ry * 0.45, rx * 0.5, ry * 0.5, 0, 0, TAU); g.fill(); }
    g.fillStyle = "#1c1a1a"; g.beginPath(); g.ellipse(P.x, P.y, rx * 0.22, ry * 0.22, 0, 0, TAU); g.fill();
  }
  fx.drawGround = function (g, S, t, proj) {
    /* decorados de suelo: trincheras y cráteres viejos */
    for (const pr of S.scene.props || []) {
      if (pr.type === "trench") {
        const w = (pr.w ?? 0.6) / 2, z = pr.from[1];
        g.fillStyle = pr.color || "#ddd5c6"; quad(g, [proj(pr.from[0], 0, z - w), proj(pr.to[0], 0, z - w), proj(pr.to[0], 0, z + w), proj(pr.from[0], 0, z + w)]);
        g.fillStyle = pr.edge || "#bfb5a3"; quad(g, [proj(pr.from[0], 0, z + w - 0.07), proj(pr.to[0], 0, z + w - 0.07), proj(pr.to[0], 0, z + w), proj(pr.from[0], 0, z + w)]);
      } else if (pr.type === "crater") {
        const d = { x: pr.at[0], z: pr.at[1], r: pr.r ?? 0.5, kind: "crater", seed: hash(`pc${pr.at}`), color: pr.color || "#a0968a" };
        crater(g, proj, d, 1);
      }
    }
    for (const d of S.decals) {
      if (d.t > t) break;
      const k = ease.out(clamp((t - d.t) / (d.kind === "pool" ? 0.55 : d.kind === "dot" ? 0.05 : 0.12)));
      g.fillStyle = d.color;
      if (d.kind === "poppy") { poppy(g, proj, d, ease.out(clamp((t - d.t) / 0.7))); continue; }
      if (d.kind === "crater") { crater(g, proj, d, k); continue; }
      if (d.kind === "dot") {
        const P = proj(d.x, 0, d.z), Q = proj(d.x + d.r, 0, d.z), Z = proj(d.x, 0, d.z + d.r);
        const rx = Math.abs(Q.x - P.x) * k, ry = Math.max(0.5, Math.abs(Z.y - P.y) * k);
        if (rx < 0.4) continue;
        g.beginPath(); g.ellipse(P.x, P.y, rx, ry, 0, 0, TAU); g.fill();
      } else groundBlob(g, proj, d, k);
    }
  };

  function crater(g, proj, d, k) {
    g.fillStyle = d.color || "#a0968a";
    groundBlob(g, proj, { ...d, kind: "pool", r: d.r * 1.15 }, k);
    g.fillStyle = "#6f665b";
    groundBlob(g, proj, { ...d, kind: "pool", r: d.r * 0.62, seed: d.seed ^ 9 }, k);
  }
  function star(g, x, y, R, n, inner, fill, stroke, lw, rot = 0) {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * TAU - Math.PI / 2, r = i % 2 ? R * inner : R; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.closePath(); g.fillStyle = fill; g.fill();
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.lineJoin = "round"; g.stroke(); }
  }

  /* boca del arma en el mundo en el instante del disparo (depende del encuadre: se cachea por vista) */
  function muzzleW(S, sh) {
    const key = `${sh.i}|${S.view.W}x${S.view.H}`;
    let m = cache.get(key);
    if (!m) {
      const cam = S.camAt(sh.t0); cam.zoom *= S.view.zoomK || 1;
      const a = S.actors.get(sh.from), st = A.rig.state(a, sh.t0, S, cam);
      m = A.rig.toWorld(st, st.J.muzzle);
      cache.set(key, m);
    }
    return m;
  }

  fx.items = function (S, t, proj) {
    const out = [];
    for (const sh of S.shots) {
      /* destello en la boca del arma */
      if (t >= sh.t0 && t < sh.t0 + 0.09) {
        const W = A.weapons[sh.weapon] || A.weapons.paint;
        if (W.flash) {
          const m = muzzleW(S, sh), P = proj(m[0], m[1], m[2]), u = (t - sh.t0) / 0.09;
          if (P.Dr < 0.5) continue;
          out.push({ x: m[0], z: m[2] - 0.02, draw: () => star(g0(), P.x, P.y, P.s * (W.flashSize ?? 0.11) * (0.7 + 0.5 * Math.sin(Math.PI * u)), 8, 0.42, "#fff6a8", "#262626", Math.max(1, P.s * 0.006), u * 0.4) });
        }
      }
      /* proyectil en vuelo */
      if (t >= sh.t0 && t < sh.t1) {
        const m = muzzleW(S, sh), dur = sh.t1 - sh.t0;
        const at = tt => { const u = clamp((tt - sh.t0) / dur); return [lerp(m[0], sh.p1[0], u), lerp(m[1], sh.p1[1], u) + sh.arc * 4 * u * (1 - u), lerp(m[2], sh.p1[2], u)]; };
        const p = at(t), P = proj(p[0], p[1], p[2]);
        const tail = proj(...at(Math.max(sh.t0, t - 0.06)));
        if (P.Dr < 0.5 || tail.Dr < 0.5) continue;
        const W = A.weapons[sh.weapon] || A.weapons.paint;
        if (W.tracer) {
          const tail2 = proj(...at(Math.max(sh.t0, t - 0.035)));
          if (tail2.Dr < 0.5) continue;
          out.push({ x: p[0], z: p[2], draw: () => {
            const g = g0(), gr = g.createLinearGradient(tail2.x, tail2.y, P.x, P.y);
            gr.addColorStop(0, "rgba(40,36,30,0)"); gr.addColorStop(1, "rgba(40,36,30,0.85)");
            g.strokeStyle = gr; g.lineWidth = Math.max(1, P.s * 0.012); g.lineCap = "round";
            g.beginPath(); g.moveTo(tail2.x, tail2.y); g.lineTo(P.x, P.y); g.stroke();
          } });
          continue;
        }
        out.push({ x: p[0], z: p[2], draw: () => {
          const g = g0(), r = Math.max(1.5, P.s * sh.size);
          const gr = g.createLinearGradient(tail.x, tail.y, P.x, P.y);
          gr.addColorStop(0, hexA(sh.color, 0)); gr.addColorStop(1, hexA(sh.color, 0.55));
          g.strokeStyle = gr; g.lineWidth = r * 1.5; g.lineCap = "round";
          g.beginPath(); g.moveTo(tail.x, tail.y); g.lineTo(P.x, P.y); g.stroke();
          g.fillStyle = "#ffffff"; g.beginPath(); g.arc(P.x, P.y, r * 1.18, 0, TAU); g.fill();
          g.fillStyle = sh.color; g.beginPath(); g.arc(P.x, P.y, r, 0, TAU); g.fill();
          g.fillStyle = "rgba(255,255,255,0.75)"; g.beginPath(); g.arc(P.x - r * 0.3, P.y - r * 0.32, r * 0.3, 0, TAU); g.fill();
        } });
      }
    }
    /* estallido en el impacto (las armas de época solo levantan polvo) */
    for (const imp of S.impacts) {
      if (t < imp.t || t > imp.t + 0.12) continue;
      if ((A.weapons[imp.weapon] || {}).impact === "dust") {
        const P = proj(imp.p[0], imp.p[1], imp.p[2]), u = (t - imp.t) / 0.12;
        if (imp.actor) {
          /* impacto de bala en el cuerpo: estallido rojo breve */
          out.push({ x: imp.p[0], z: imp.p[2] - 0.05, draw: () => { const g = g0(); g.fillStyle = `rgba(196,22,28,${0.95 * (1 - u)})`; fx.blob(g, P.x, P.y, P.s * (0.03 + 0.07 * ease.out(u)), imp.seed, 9, 0.6); } });
        } else {
          out.push({ x: imp.p[0], z: imp.p[2] - 0.05, draw: () => { const g = g0(); g.fillStyle = `rgba(150,140,125,${0.5 * (1 - u)})`; g.beginPath(); g.arc(P.x, P.y, P.s * (0.03 + 0.06 * u), 0, TAU); g.fill(); } });
        }
        continue;
      }
      const P = proj(imp.p[0], imp.p[1], imp.p[2]), u = (t - imp.t) / 0.12;
      out.push({ x: imp.p[0], z: imp.p[2] - 0.05, draw: () => {
        const g = g0();
        g.fillStyle = imp.color; fx.blob(g, P.x, P.y, P.s * (0.05 + 0.1 * ease.out(u)), imp.seed, 9, 0.6);
        if (imp.actor && u < 0.6) star(g, P.x - imp.dirX * P.s * 0.04, P.y - P.s * 0.08, P.s * 0.07, 8, 0.42, "#fff6a8", "#262626", Math.max(1, P.s * 0.007));
      } });
    }
    /* explosiones: fogonazo */
    for (const b of S.blasts) {
      const dt = t - b.t;
      if (dt < 0 || dt > 0.16) continue;
      const P = proj(b.at[0], 0.25 * b.size, b.at[1]), u = dt / 0.16;
      out.push({ x: b.at[0], z: b.at[1] - 0.1, draw: () => {
        const g = g0(), r = P.s * 0.55 * b.size * (0.6 + 0.6 * u);
        const gr = g.createRadialGradient(P.x, P.y, 0, P.x, P.y, r);
        gr.addColorStop(0, `rgba(255,248,215,${1 - u})`); gr.addColorStop(0.45, `rgba(255,170,70,${0.8 * (1 - u)})`); gr.addColorStop(1, "rgba(255,120,40,0)");
        g.fillStyle = gr; g.beginPath(); g.arc(P.x, P.y, r, 0, TAU); g.fill();
      } });
    }
    /* humo: bocanadas que crecen, suben, se corren con el viento y se disipan */
    for (const sm of S.smoke || []) {
      const τ = t - sm.t0;
      if (τ < 0 || τ > sm.life) continue;
      const u = τ / sm.life, e = ease.out(u);
      const x = sm.x + sm.drift * u * 2, y = sm.y0 + sm.rise * e, P = proj(x, y, sm.z);
      if (P.Dr < 0.6) continue;
      const r = Math.max(1, P.s * lerp(sm.r0, sm.r1, e)), al = 0.55 * Math.pow(1 - u, 1.4) * Math.min(1, τ / 0.08);
      out.push({ x: sm.x, z: sm.z - 0.05, draw: () => { const g = g0(); g.fillStyle = `rgba(${sm.shade},${sm.shade - 4},${sm.shade - 10},${al})`; g.beginPath(); g.arc(P.x, P.y, r, 0, TAU); g.fill(); } });
    }
    /* decorados verticales: parapeto de sacos y alambre de púas */
    for (const pr of S.scene.props || []) {
      if (pr.type === "parapet") {
        const z = pr.from[1], h = pr.h ?? 0.42;
        out.push({ z, long: [pr.from[0], pr.to[0]], draw: () => {
          const g = g0(), x0 = pr.from[0], x1 = pr.to[0];
          g.fillStyle = pr.color || "#c7b28a";
          quad(g, [proj(x0, 0, z), proj(x1, 0, z), proj(x1, h, z), proj(x0, h, z)]);
          for (let x = x0; x < x1; x += 0.3) { const P = proj(x + 0.15, h, z), Q = proj(x + 0.3, h, z); g.beginPath(); g.ellipse(P.x, P.y, Math.abs(Q.x - P.x) * 1.05, Math.abs(Q.x - P.x) * 0.5, 0, 0, TAU); g.fill(); }
          g.strokeStyle = pr.edge || "#9d8a63"; g.lineWidth = Math.max(1, proj(x0, 0, z).s * 0.012);
          for (const hh of [h * 0.33, h * 0.66]) { const a = proj(x0, hh, z), b = proj(x1, hh, z); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
        } });
      } else if (pr.type === "wire") {
        const z = pr.from[1], h = pr.h ?? 0.3;
        out.push({ z, long: [pr.from[0], pr.to[0]], draw: () => {
          const g = g0(), x0 = pr.from[0], x1 = pr.to[0], P0 = proj(x0, 0, z);
          g.strokeStyle = pr.color || "#4a4744"; g.lineWidth = Math.max(0.8, P0.s * 0.006);
          for (let x = x0; x <= x1; x += pr.posts ?? 1.4) { const a = proj(x, 0, z), b = proj(x, h * 1.25, z); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
          g.beginPath();
          for (let x = x0; x < x1; x += 0.11) { const C = proj(x, h * 0.55, z), rx = Math.abs(proj(x + 0.09, h * 0.55, z).x - C.x), ry = C.s * h * 0.45; g.moveTo(C.x + rx, C.y); g.ellipse(C.x, C.y, rx, ry, 0, 0, TAU); }
          g.stroke();
        } });
      }
    }
    /* gotas en el aire */
    for (const d of S.droplets) {
      if (t < d.t0 || t >= d.t1) continue;
      const τ = t - d.t0, p = [d.p0[0] + d.v[0] * τ, d.p0[1] + d.v[1] * τ - 0.5 * G * τ * τ, d.p0[2] + d.v[2] * τ];
      const P = proj(p[0], p[1], p[2]);
      if (P.Dr < 0.5) continue;
      out.push({ x: p[0], z: p[2], draw: () => { const g = g0(); g.fillStyle = d.color; g.beginPath(); g.arc(P.x, P.y, Math.max(0.8, P.s * d.r), 0, TAU); g.fill(); } });
    }
    return out;
  };

  /* el contexto 2D activo lo fija drawWorld (fx.items se llama con el mismo canvas) */
  let G0 = null;
  const g0 = () => G0;
  const prevDraw = A.drawWorld;
  A.drawWorld = function (g, S, cam, t) { G0 = g; return prevDraw(g, S, cam, t); };

  function hexA(hex, a) { const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return `rgba(255,45,143,${a})`; const n = parseInt(m[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
})();
