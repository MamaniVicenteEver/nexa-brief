/* =============================================================================
   cronica · cierre del canal (lo agrega el motor al final del audio)
   Sin recuadro: todo flota en el espacio 3D de la crónica, con profundidad de
   campo y polvo. Fondo por defecto: el proyector (haz con polvo y película que
   corre); se cambia por archivo | letras | linea | image | component | none.
   Secuencia: GRACIAS POR VER (letras desde el desenfoque) → CANAL grande (sus
   letras llegan dispersas desde la profundidad y se ALINEAN con rack focus; se
   barre el rótulo gris debajo) → rótulo LIKE que se "presiona" (gris → blanco)
   → línea fina con nodos (la flecha) → placa SUSCRÍBETE de papel rasgado +
   campana que suena → mensaje de apoyo en itálica → youtube.com/@canal.
   Tiempos (likeAt, subscribeAt, bellAt, supportAt) del contrato común.
   ========================================================================== */
(function () {
  "use strict";
  const K = Kit, CR = Kit.cronica, HK = Kit.cronica.hook, { clamp, lerp, prog, ease } = K;
  const INK = "#f4f4f2", DARK = "#161616", NS = "http://www.w3.org/2000/svg";
  const THUMB = "M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z";
  const BELL = "M12 2.6c-.8 0-1.4.6-1.4 1.4v.5C7.9 5.2 6.2 7.6 6.2 10.4v4.2L4.4 17v1h15.2v-1l-1.8-2.4v-4.2c0-2.8-1.7-5.2-4.4-5.9V4c0-.8-.6-1.4-1.4-1.4ZM9.8 19.2a2.2 2.2 0 0 0 4.4 0z";
  const svg = (parent, w, h, vb) => { const s = document.createElementNS(NS, "svg"); s.setAttribute("width", w); s.setAttribute("height", h); s.setAttribute("viewBox", vb || `0 0 ${w} ${h}`); s.style.overflow = "visible"; s.style.display = "block"; parent.appendChild(s); return s; };
  const node = (parent, tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent.appendChild(e); return e; };

  K.register({
    name: "cronica.outro", tags: ["cierre", "canal", "like", "suscribirse", "3d"], layer: "main", post: 0,
    summary: "Cierre del canal SIN recuadro en el espacio 3D de la crónica (bg: proyector | archivo | letras | linea | image con src | component con use/useParams | none). GRACIAS POR VER desde el desenfoque → nombre del canal grande cuyas letras llegan dispersas desde la profundidad y se alinean con rack focus, con el rótulo gris barriéndose debajo → rótulo LIKE que se presiona (gris → blanco) → línea fina con nodos a modo de flecha → placa SUSCRÍBETE de papel rasgado + campana que suena → apoyo en itálica → youtube.com/@canal. Tiempos sincronizables con la despedida narrada.",
    example: { thanks: "GRACIAS POR VER", channel: "CRÓNICA", cta: "SUSCRÍBETE", support: "Tu apoyo nos ayuda a seguir contando historias.", handle: "youtube.com/@cronica" },
    params: {
      ...K.hook.outroParams({ support: "Apoya el canal y comparte el video." }),
      ...K.hook.bgParams(["proyector", "archivo", "letras", "linea"]),
      dim: { type: "number", default: 0.66, min: 0, max: 1, doc: "Oscurecido del fondo foto/componente (el cierre tiene mucho texto)." },
      era: { type: "array", default: [1900, 2020, 10], doc: "Años del fondo 'linea' [desde, hasta, paso]." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage;
      const BG = HK.background(ctx, p, ["proyector", "archivo", "letras", "linea"], { auto: "proyector", seed: 811, text: p.channel });
      const shade = HK.sheet(ctx, { opacity: 0, background: portrait
        ? "linear-gradient(180deg, rgba(8,8,8,.25), rgba(8,8,8,.62) 22%, rgba(8,8,8,.62) 82%, rgba(8,8,8,.25))"
        : "radial-gradient(ellipse 72% 70% at 50% 50%, rgba(8,8,8,.72), rgba(8,8,8,.4) 70%, rgba(8,8,8,.1))" });
      const S = CR.Scene(ctx, { aperture: 5, maxBlur: 4 }), r = K.rng(8123);
      const L = portrait
        ? { thanks: -46, name: -31, like: { x: 0, y: -6, h: 18 }, sub: { x: -9, y: 19, h: 15.5 }, sup: 37, handle: 56 }
        : { thanks: -34, name: -19, like: { x: -36, y: 9, h: 10 }, sub: { x: 22, y: 9, h: 11.2 }, sup: 25, handle: 36 };
      const Y = k => k * u;

      /* GRACIAS POR VER: letras sueltas que entran desde el desenfoque */
      const thS = (portrait ? 4.6 : 2.8) * u, thanks = String(p.thanks).toUpperCase();
      const thIt = S.add({ x: 0, y: Y(L.thanks), z: 0, w: CR.measure(thanks, thS, 500, true, 0.3) + thS * 2, h: thS * 1.5 });
      Object.assign(thIt.a.style, { fontFamily: CR.SERIF, fontStyle: "italic", fontWeight: 500, fontSize: thS + "px", lineHeight: thS * 1.5 + "px", letterSpacing: ".3em", paddingLeft: ".3em", boxSizing: "border-box", textAlign: "center", whiteSpace: "nowrap", color: "rgba(240,240,236,.9)" });
      const thChars = [...thanks].map(c => { const s = K.el("span", null, { display: "inline-block", whiteSpace: "pre", opacity: 0 }, thIt.a); s.textContent = c; return s; });
      const thRule = [-1, 1].map(d => { const it = S.add({ x: d * (CR.measure(thanks, thS, 500, true, 0.3) / 2 + thS * 3.2), y: Y(L.thanks), z: 0, w: thS * 3.2, h: Math.max(1, 0.14 * u), opacity: 0 }); it.a.style.background = "rgba(255,255,255,.6)"; return it; });

      /* CANAL: letras que llegan dispersas desde la profundidad y se alinean */
      const name = String(p.channel).toUpperCase(), SPC = 0.05;
      const fs = Math.min(W * (portrait ? 0.86 : 0.62) / Math.max(1, CR.measure(name, 100, 600, false, SPC)) * 100, (portrait ? 20 : 19) * u);
      const nW = CR.measure(name, fs, 600, false, SPC);
      let nx = -nW / 2;
      const letters = [...name].map((c, i) => {
        const cw = CR.measure(c, fs, 600, false, SPC), x = nx + cw / 2; nx += cw;
        const it = S.add({ x, y: Y(L.name), z: 0, w: cw + fs * 0.2, h: fs * 1.2, opacity: 0 });
        Object.assign(it.a.style, { fontFamily: CR.SERIF, fontWeight: 600, fontSize: fs + "px", lineHeight: fs * 1.2 + "px", textAlign: "center", color: INK, whiteSpace: "pre", textShadow: "0 0 .3em rgba(0,0,0,.6)" });
        it.a.textContent = c;
        it.home = [x, Y(L.name), 0];
        it.from = [x * 1.6 + (r() - 0.5) * 50 * u, Y(L.name) + (r() - 0.5) * 40 * u, (r() < 0.5 ? 1 : -1) * (20 + r() * 40) * u, (r() - 0.5) * 40];
        it.t0 = 0.35 + i * Math.min(0.06, 0.6 / name.length);
        return it;
      });
      const nameBand = S.image({ x: 0, y: Y(L.name) + fs * 0.5, z: -0.6 * u, w: nW * 1.06, h: fs * 0.3, dof: "center", opacity: 0 },
        CR.brushURL(512, Math.max(8, Math.round(512 * fs * 0.3 / (nW * 1.06))), 8201, "#5c5c5c", { m: 0.16, dry: 1 }));
      const ghost = S.add({ x: 0, y: Y(L.name), z: -26 * u, w: nW * 1.6, h: fs * 2.2, opacity: 0 });
      Object.assign(ghost.a.style, { fontFamily: CR.SERIF, fontWeight: 400, fontSize: fs * 1.9 + "px", lineHeight: fs * 2.2 + "px", textAlign: "center", color: "#fff", whiteSpace: "nowrap" });
      ghost.a.textContent = name.slice(0, 1);

      /* rótulo LIKE: gris pincelado → blanco al presionarse */
      const lh = Y(L.like.h), lfs = lh * 0.5, lw = CR.measure("LIKE", lfs, 700, false, 0.08) + lh * 1.9;
      const lx = Y(L.like.x), ly = Y(L.like.y);
      const likeG = S.image({ x: lx, y: ly, z: 0.4 * u, w: lw, h: lh, rz: -1.5, dof: "center", opacity: 0 }, CR.brushURL(320, Math.round(320 * lh / lw), 8301, "#5c5c5c", { m: 0.1, dry: 0.8 }));
      const likeW = S.image({ x: lx, y: ly, z: 0.4 * u, w: lw, h: lh, rz: -1.5, dof: "center", opacity: 0 }, CR.brushURL(320, Math.round(320 * lh / lw), 8301, "#f1f1ef", { m: 0.1, dry: 0.8 }));
      const likeT = S.add({ x: lx, y: ly, z: 0.8 * u, w: lw, h: lh, rz: -1.5, opacity: 0 });
      const likeBox = K.el("div", null, { display: "flex", alignItems: "center", justifyContent: "center", gap: lh * 0.18 + "px", width: "100%", height: "100%" }, likeT.a);
      const thumbSvg = svg(likeBox, lh * 0.56, lh * 0.56, "0 0 24 24"), thumb = node(thumbSvg, "path", { d: THUMB, fill: INK });
      const likeTxt = K.el("span", null, { fontFamily: CR.SERIF, fontWeight: 700, fontSize: lfs + "px", letterSpacing: ".08em", color: INK }, likeBox); likeTxt.textContent = "LIKE";

      /* placa SUSCRÍBETE: papel claro rasgado, letras oscuras */
      const cta = String(p.cta).toUpperCase(), sh = Y(L.sub.h), sfs = sh * 0.52, sw = CR.measure(cta, sfs, 700, false, 0.06) + sh * 1.5;
      const sx = Y(L.sub.x), sy = Y(L.sub.y);
      const subP = S.image({ x: sx, y: sy, z: 0.6 * u, w: sw, h: sh, rz: 1.2, dof: "center", opacity: 0 }, CR.brushURL(360, Math.round(360 * sh / sw), 8401, "#efefec", { m: 0.09, dry: 0.7 }));
      const subT = HK.label(S, cta, { x: sx, y: sy + sh * 0.02, z: 1 * u, size: sfs, weight: 700, spacing: 0.06, color: DARK, shadow: "none", rz: 1.2, lh: 1.9 });
      /* campana (suena: oscilación amortiguada + ondas) */
      const bs = sh * (portrait ? 0.8 : 0.95), bx = sx + sw / 2 + bs * 0.85, bell = S.add({ x: bx, y: sy, z: 1 * u, w: bs * 2, h: bs * 1.6, opacity: 0 });
      const bellSvg = svg(bell.a, bs * 2, bs * 1.6, "-6 0 36 24");
      const bellG = node(bellSvg, "g", {}), bellPath = node(bellG, "path", { d: BELL, fill: INK });
      const waves = [-1, 1].map(d => node(bellSvg, "path", { d: d < 0 ? "M3.6 6.2 A10 10 0 0 0 3.6 15.4" : "M20.4 6.2 A10 10 0 0 1 20.4 15.4", fill: "none", stroke: INK, "stroke-width": 1.3, "stroke-linecap": "round", opacity: 0 }));
      void bellPath;

      /* flecha: línea fina con nodos (el lenguaje de la red de líneas) */
      const a0 = portrait ? [lx - lw * 0.25, ly + lh * 0.62] : [lx + lw / 2 + 1.5 * u, ly - lh * 0.2];
      const a1 = portrait ? [sx - sw * 0.2, sy - sh * 0.68] : [sx - sw / 2 - 1.8 * u, sy - sh * 0.2];
      const am = portrait ? [lx - lw * 0.62, (ly + sy) / 2 + 2 * u] : [(a0[0] + a1[0]) / 2, ly - lh * 1.15];
      const bx0 = Math.min(a0[0], a1[0], am[0]) - 3 * u, by0 = Math.min(a0[1], a1[1], am[1]) - 3 * u, bw = Math.max(a0[0], a1[0], am[0]) + 3 * u - bx0, bh = Math.max(a0[1], a1[1], am[1]) + 3 * u - by0;
      const arrow = S.add({ x: bx0 + bw / 2, y: by0 + bh / 2, z: 0.4 * u, w: bw, h: bh, opacity: 0 });
      const aSvg = svg(arrow.a, bw, bh), P = ([x, y]) => `${(x - bx0).toFixed(1)} ${(y - by0).toFixed(1)}`;
      const sw2 = Math.max(1, 0.2 * u);
      const aPath = node(aSvg, "path", { d: `M${P(a0)} Q${P(am)} ${P(a1)}`, fill: "none", stroke: "rgba(255,255,255,.85)", "stroke-width": sw2, pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 });
      const ang = Math.atan2(a1[1] - am[1], a1[0] - am[0]), hl = 2.2 * u;
      const head = node(aSvg, "path", { d: `M${P([a1[0] - Math.cos(ang - 0.5) * hl, a1[1] - Math.sin(ang - 0.5) * hl])} L${P(a1)} L${P([a1[0] - Math.cos(ang + 0.5) * hl, a1[1] - Math.sin(ang + 0.5) * hl])}`, fill: "none", stroke: "rgba(255,255,255,.9)", "stroke-width": sw2, opacity: 0 });
      const dots = [a0, am].map(pt => node(aSvg, "circle", { cx: pt[0] - bx0, cy: pt[1] - by0, r: Math.max(1.2, 0.36 * u), fill: "rgba(255,255,255,.9)", opacity: 0 }));

      /* apoyo (itálica, renglón a renglón) + dirección */
      const supS = (portrait ? 5.2 : 3.2) * u, supLines = CR.wrap(p.support, supS, 500, true, (portrait ? 86 : 110) * u);
      const sup = supLines.map((l, i) => HK.label(S, l, { x: 0, y: Y(L.sup) + i * supS * 1.3, z: 0.4 * u, size: supS, weight: 500, italic: true, color: "rgba(236,236,232,.88)" }));
      const hS = (portrait ? 4.2 : 2.6) * u, hy = Y(L.handle) + (supLines.length - 1) * supS * 1.3;
      const handle = p.handle ? HK.label(S, String(p.handle), { x: 0, y: hy, z: 0.4 * u, size: hS, weight: 600, spacing: 0.12, color: INK }) : null;
      const hBar = handle ? S.add({ x: -handle.tw / 2 - hS * 1.1, y: hy, z: 0.4 * u, w: Math.max(1, 0.3 * u), h: hS * 1.3, opacity: 0 }) : null;
      if (hBar) hBar.a.style.background = "rgba(255,255,255,.92)";
      const hLine = handle ? S.add({ x: 0, y: hy + hS * 0.95, z: 0.4 * u, w: handle.tw, h: Math.max(1, 0.1 * u), opacity: 0 }) : null;
      if (hLine) hLine.a.style.background = "rgba(255,255,255,.45)";
      /* rayitas sueltas */
      const dashes = Array.from({ length: 6 }, (_, i) => CR.dash(S, (r() - 0.5) * (portrait ? 90 : 160) * u, (r() - 0.5) * (portrait ? 150 : 86) * u, (r() * 6 - 2) * u, r() < 0.35));

      const A = portrait ? { tx: 0, ty: -2 * u, d: 1.04, rx: 5, ry: -5, rz: -1.2, drift: { d: -0.03, ry: 4, rz: 0.8 } }
        : { tx: 0, ty: 0, d: 1.03, rx: 6, ry: -7, rz: -1.5, drift: { d: -0.03, ry: 5, rz: 1 } };
      const shots = { A, u, fp: [0, Y(L.name), 0], inOff: { d: 0.1, ry: -4, tx: -4 * u }, reOff: {} };

      return {
        dispose() { BG.dispose(); S.dispose(); shade.remove(); },
        render(lt, b, t) {
          const { likeAt, subAt, bellAt, supAt } = K.hook.outroTimes(p, b.dur);
          const exit = 1 - prog(lt, b.dur - 0.4, 0.4, "in");
          BG.render(lt, b, t, exit);
          HK.setOp(shade, prog(lt, 0, 0.6, "linear") * exit);
          HK.setOp(S.view, exit);
          const { cam } = CR.camera(lt, Math.max(6, b.dur), shots, 0);
          const [jx, jy] = HK.shake(lt, [likeAt + 0.3, subAt + 0.12], u * 0.35); cam.tx += jx; cam.ty += jy;
          /* gracias */
          thChars.forEach((s, i) => HK.focusIn(s, prog(lt, 0.05 + i * 0.03, 0.5), thS * 0.8));
          thIt.opacity = 1; thRule.forEach(it => HK.sweep(it, prog(lt, 0.3, 0.5, "inOut")));
          /* canal: dispersas → alineadas (y el foco las acompaña) */
          letters.forEach(it => {
            const q = clamp((lt - it.t0) / 0.9), e = ease.expoOut(q), k = 1 - e, f = it.from, h = it.home;
            HK.move(it, lerp(h[0], f[0], k), lerp(h[1], f[1], k), lerp(h[2], f[2], k), f[3] * k);
            it.opacity = clamp(q * 3); it.blur = k * 2.5 * u;
          });
          HK.sweep(nameBand, prog(lt, 1.15, 0.5, "inOut"));
          ghost.opacity = 0.06 * prog(lt, 0.4, 1);
          /* LIKE: entra, y se presiona */
          const lq = prog(lt, likeAt, 0.35, "out"), press = prog(lt, likeAt + 0.3, 0.12, "linear"), pz = Math.sin(clamp((lt - likeAt - 0.3) / 0.25) * Math.PI) * -2.5 * u;
          HK.sweep(likeG, lq); likeG.opacity = lq > 0 ? 1 - press : 0;
          likeW.opacity = press; HK.move(likeW, lx, ly, 0.4 * u + pz, -1.5); HK.move(likeG, lx, ly, 0.4 * u + pz, -1.5);
          const lt2 = prog(lt, likeAt + 0.12, 0.3); likeT.opacity = lt2; likeT.blur = (1 - lt2) * 2 * u; HK.move(likeT, lx, ly, 0.8 * u + pz, -1.5);
          const col = press > 0.5 ? DARK : INK;
          if (likeTxt._c !== col) { likeTxt._c = col; likeTxt.style.color = col; thumb.setAttribute("fill", col); }
          /* flecha */
          if (p.arrow) {
            const s0 = Math.min(likeAt + 0.25, subAt - 0.1), aq = prog(lt, s0, Math.max(0.3, subAt + 0.1 - s0), "inOut");
            arrow.opacity = aq > 0 ? 1 : 0;
            aPath.setAttribute("stroke-dashoffset", (1 - aq).toFixed(3));
            dots.forEach((d, i) => d.setAttribute("opacity", clamp(aq * 3 - i * 1.5).toFixed(2)));
            head.setAttribute("opacity", clamp((aq - 0.85) / 0.15).toFixed(2));
          }
          /* SUSCRÍBETE */
          const sq = prog(lt, subAt, 0.32, "inOut");
          HK.sweep(subP, sq);
          const st2 = prog(lt, subAt + 0.1, 0.3); subT.opacity = st2; subT.blur = (1 - st2) * 2 * u;
          /* campana */
          const bq = prog(lt, bellAt, 0.25, "out");
          bell.opacity = bq; bell.blur = (1 - bq) * 2 * u;
          const d = lt - bellAt, rot = d > 0 ? Math.sin(d * 16) * Math.exp(-d * 2.4) * 26 : 0;
          const rv = rot.toFixed(1); if (bellG._r !== rv) { bellG._r = rv; bellG.setAttribute("transform", `rotate(${rv} 12 3)`); }
          const wv = d > 0 ? clamp(1 - d / 1.4) * 0.85 * (0.6 + 0.4 * Math.abs(Math.sin(d * 16))) : 0;
          waves.forEach(w => w.setAttribute("opacity", wv.toFixed(2)));
          /* apoyo + dirección */
          sup.forEach((it, i) => { const q = prog(lt, supAt + i * 0.15, 0.5); it.opacity = q; it.blur = (1 - q) * 2.5 * u; });
          if (handle) {
            const q = prog(lt, supAt + 0.35, 0.5); handle.opacity = q; handle.blur = (1 - q) * 2 * u;
            hBar.opacity = prog(lt, supAt + 0.3, 0.2);
            HK.sweep(hLine, prog(lt, supAt + 0.5, 0.5, "inOut")); hLine.base = 1;
          }
          dashes.forEach((dd, i) => dd.opacity = prog(lt, 0.4 + i * 0.1, 0.2));
          S.render(cam);
        },
      };
    },
  });
})();
