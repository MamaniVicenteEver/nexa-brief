/* lyrics-grunge-rojo · escenas de letra.
   Una escena = un fragmento de 1–4 palabras; cada palabra entra cuando se canta
   (sc.words[i].t, relativo a la escena) con una estela horizontal desenfocada.
   Escenas: linea, espaciada, gigante, hud, pila, marco, eco, ancho, dupla, flecha, rojo.
   Variantes por escena (sc.v): color (white|red), doodle, strip (top|bottom|none). */
(function (root) {
  "use strict";
  const G = root.GrungeRojo, K = G.core, R = G.registry, F = G.fondo;
  const up = s => String(s || "").toLocaleUpperCase("es");

  /* ---------------------------- piezas de texto ---------------------------- */
  /* fila de palabras: cada palabra es un <span> con su tiempo */
  function row(parent, words, font, size, color, cls) {
    const e = K.el("div", "gr-row " + (cls || ""), parent);
    K.useFont(e, font, size);
    e.style.color = color;
    const spans = words.map((w, i) => {
      const s = K.el("span", "gr-w", e);
      s.textContent = up(w.text);
      if (i < words.length - 1) e.appendChild(document.createTextNode(" "));
      return { e: s, t: w.t, color };
    });
    return { e, spans };
  }
  /* entrada con estela: desplazamiento + sombra larga que se recoge */
  function enter(spans, lt, ctx, mode = "smear") {
    const E = ctx.C.motion.enterSec;
    for (const s of spans) {
      if (lt < s.t) { s.e.style.visibility = "hidden"; continue; }
      s.e.style.visibility = "visible";
      const p = K.ease.out(K.prog(lt, s.t, s.t + E)), q = 1 - p;
      if (mode === "slam") s.e.style.transform = `scale(${(1 + 0.35 * q).toFixed(3)})`;
      else s.e.style.transform = `translateX(${(-q * 0.35).toFixed(3)}em)`;
      const trail = ctx.C.motion.smear * q;
      const ghost = s.color === ctx.red ? `, ${(-0.04).toFixed(2)}em 0 ${(3).toFixed(0)}px ${ctx.red}` : "";
      s.e.style.textShadow = trail > 0.01 ? `${(-trail * 0.6).toFixed(3)}em 0 ${(trail * 18 + 2).toFixed(1)}px ${s.color}, ${(-trail * 1.2).toFixed(3)}em 0 ${(trail * 30 + 4).toFixed(1)}px ${s.color}${ghost}` : (ghost ? ghost.slice(2) : "none");
      s.e.style.opacity = (0.35 + 0.65 * p).toFixed(3);
    }
  }
  /* reparte las palabras en n filas equilibradas por caracteres */
  function split(words, n) {
    if (n <= 1 || words.length <= 1) return [words];
    const total = words.reduce((a, w) => a + w.text.length, 0), out = [];
    let cur = [], acc = 0, k = 1;
    for (const w of words) {
      cur.push(w); acc += w.text.length;
      if (k < n && acc >= total * k / n && cur.length) { out.push(cur); cur = []; k++; }
    }
    if (cur.length) out.push(cur);
    return out;
  }
  const textOf = ws => up(ws.map(w => w.text).join(" "));
  /* rectángulo de un elemento relativo a la escena (para los garabatos) */
  function boxOf(e, rootEl) {
    const a = e.getBoundingClientRect(), b = rootEl.getBoundingClientRect();
    return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
  }
  function centerBox(parent, cls) { return K.el("div", "gr-center " + (cls || ""), parent); }

  /* esqueleto común: fondo, texto con desgaste, tiras, niebla, garabato diferido */
  function scaffold(sc, ctx) {
    const rootEl = K.el("div", "gr-scene");
    const bg = F.background(rootEl, ctx, sc);
    const fogL = sc.bg === "footage" && ctx.C.components.fog ? F.fog(rootEl, sc.seed) : null;
    const txt = K.el("div", "gr-txt", rootEl);
    const strips = [];
    if (ctx.C.components.paper && sc.v.strip && sc.v.strip !== "none") strips.push(F.tornStrip(rootEl, ctx, sc.v.strip, sc.v.strip === "top" ? 0.13 : 0.15, sc.seed + 11));
    return { rootEl, bg, txt, strips, fogL };
  }
  function finish(S, sc, ctx, parts) {
    const D = sc.t1 - sc.t0;
    let doodle = null, doodleAt = 0;
    return {
      root: S.rootEl,
      update(lt) {
        if (parts.target && !doodle && sc.v.doodle && ctx.C.components.doodles) {
          doodle = G.doodle(S.rootEl, ctx, sc.v.doodle, boxOf(parts.target(), S.rootEl), sc.seed + 5);
          doodleAt = parts.doodleAt ?? Math.min(0.25, D * 0.3);
        }
        S.bg.update(lt, D);
        if (S.fogL) S.fogL.update(lt);
        S.strips.forEach(s => s.update(K.prog(lt, 0, 0.25)));
        parts.update(lt, D);
        if (doodle) doodle(K.prog(lt, doodleAt, doodleAt + ctx.C.motion.doodleSec));
      }
    };
  }
  const portrait = ctx => ctx.W / ctx.H < 0.85;

  /* --------------------------------- escenas --------------------------------- */
  /* una línea condensada roja o blanca (BOWL FULL OF PLENTY) */
  R.scenes.linea = (sc, ctx) => {
    const S = scaffold(sc, ctx), color = sc.v.color === "red" ? ctx.red : ctx.white;
    const rows = split(sc.words, portrait(ctx) && sc.words.length > 2 ? 2 : 1);
    const box = centerBox(S.txt);
    if (sc.v.high) box.style.top = "30%";
    const size = K.fit(rows.map(textOf), ctx.fonts.condensed, ctx.W * 0.86, ctx.H * (portrait(ctx) ? 0.3 : 0.22));
    const R1 = rows.map(ws => row(box, ws, ctx.fonts.condensed, size, color));
    const spans = R1.flatMap(r => r.spans);
    return finish(S, sc, ctx, { target: () => (sc.v.doodleOn === "word" ? spans[sc.key] || spans[0] : R1[R1.length - 1]).e || R1[0].e, update: lt => enter(spans, lt, ctx) });
  };
  /* primera palabra grande + resto pequeño muy espaciado (THE  H O L E  W E  B U I L D) */
  R.scenes.espaciada = (sc, ctx) => {
    const S = scaffold(sc, ctx);
    const box = centerBox(S.txt, "gr-inline");
    const first = [sc.words[0]], rest = sc.words.slice(1);
    const thin = { ...ctx.fonts.thin, tracking: 0.42 };
    const wFirst = K.measure(textOf(first), ctx.fonts.condensed, 100), wRest = rest.length ? K.measure(textOf(rest), thin, 100) * 0.42 : 0;
    const big = Math.min(ctx.W * 0.86 * 100 / (wFirst + wRest + 20), ctx.H * 0.2);
    const A = row(box, first, ctx.fonts.condensed, big, ctx.white);
    const B = rest.length ? row(box, rest, thin, big * 0.42, ctx.white, "gr-spaced") : { spans: [] };
    const spans = [...A.spans, ...B.spans];
    return finish(S, sc, ctx, { target: () => box, update: lt => enter(spans, lt, ctx) });
  };
  /* palabra gigante recortada con eco rojo + resto espaciado (LIKE / B R A W L) */
  R.scenes.gigante = (sc, ctx) => {
    const S = scaffold(sc, ctx);
    const kw = sc.words[sc.key], others = sc.words.filter((_, i) => i !== sc.key);
    const size = Math.min(ctx.H * (portrait(ctx) ? 0.42 : 0.62), K.fit([up(kw.text)], ctx.fonts.condensed, ctx.W * 1.05, ctx.H));
    const gw = K.el("div", "gr-giant", S.txt, { top: (portrait(ctx) ? 30 : 22) + "%" });
    const ghost = row(gw, [kw], ctx.fonts.condensed, size, ctx.red, "gr-ghost");
    const main = row(gw, [kw], ctx.fonts.condensed, size, ctx.white);
    const low = K.el("div", "gr-low", S.txt, { top: (portrait(ctx) ? 62 : 72) + "%" });
    const thin = { ...ctx.fonts.thin, weight: 600, tracking: 0.38 };
    const B = others.length ? row(low, others, thin, K.fit([textOf(others)], thin, ctx.W * 0.8, ctx.H * 0.1), ctx.white) : { spans: [] };
    return finish(S, sc, ctx, { target: () => main.e, update: lt => {
      enter(main.spans, lt, ctx, "slam"); enter(B.spans, lt, ctx);
      const step = Math.floor(lt / 0.07), r = K.rng(sc.seed + step);
      ghost.e.style.visibility = lt >= kw.t ? "visible" : "hidden";
      ghost.e.style.transform = `translate(${(r.range(-1, 1) * ctx.u * 1.6).toFixed(1)}px, ${(r.range(-1, 1) * ctx.u * 0.8).toFixed(1)}px)`;
      gw.style.transform = `translateX(-50%) scale(${(1.04 - 0.04 * K.prog(lt, kw.t, kw.t + 0.4)).toFixed(4)})`;
    } });
  };
  /* iconos de reproductor alrededor de la frase (⏭ ◁ ▷) y palabra roja debajo */
  R.scenes.hud = (sc, ctx) => {
    const S = scaffold(sc, ctx);
    const box = centerBox(S.txt);
    const size = K.fit([textOf(sc.words)], ctx.fonts.condensed, ctx.W * 0.62, ctx.H * 0.15);
    const A = row(box, sc.words, ctx.fonts.condensed, size, ctx.white);
    const kw = sc.words[sc.key];
    const red = K.el("div", "gr-under", S.txt, { top: `calc(50% + ${(size * 0.55).toFixed(0)}px)` });
    const B = row(red, [kw], ctx.fonts.condensed, size * 0.55, ctx.red);
    const s = K.layer(S.rootEl, ctx.W, ctx.H, "gr-hud");
    const y = ctx.H / 2, k = ctx.u * 2.6, xl = ctx.W * 0.1, xr = ctx.W * 0.9;
    const tri = (x, dir) => `M${x},${y - k}L${x + dir * k * 1.5},${y}L${x},${y + k}Z`;
    const icons = [tri(xl, 1) + tri(xl + k * 1.5, 1), tri(xr, -1), `M${xr - k * 4.2},${y - k}L${xr - k * 4.2},${y + k}` + tri(xr - k * 3.6, 1)];
    const ps = K.strokePaths(s, icons, ctx.chalk, Math.max(2, ctx.u * 0.4), "gr-chalk");
    return finish(S, sc, ctx, { target: null, update: lt => {
      enter(A.spans, lt, ctx); enter(B.spans, lt, ctx);
      ps.forEach((p, i) => K.setDraw(p, K.prog(lt, i * 0.05, 0.15 + i * 0.05)));
    } });
  };
  /* tres filas apiladas: dos frases ya cantadas + la actual (YOU'RE DON'T EVEN KNOW / …) */
  R.scenes.pila = (sc, ctx) => {
    const S = scaffold(sc, ctx);
    const box = centerBox(S.txt, "gr-stack");
    const prev = (sc.prev || []).slice(-2).map(t => t.split(/\s+/).map(x => ({ text: x, t: -1 })));
    const all = [...prev, sc.words];
    const share = ctx.H * (portrait(ctx) ? 0.5 : 0.78) / all.length;
    const colors = [ctx.white, ctx.red, ctx.white].slice(3 - all.length);
    const rows = all.map((ws, i) => row(box, ws, ctx.fonts.condensed, K.fit([textOf(ws)], ctx.fonts.condensed, ctx.W * 0.92, share), colors[i], i < all.length - 1 ? "gr-faded" : ""));
    const spans = rows.flatMap(r => r.spans);
    return finish(S, sc, ctx, { target: () => rows[rows.length - 1].e, update: lt => {
      enter(spans, lt, ctx);
      box.style.transform = `translate(-50%,-50%) scale(${(1 + 0.03 * K.prog(lt, 0, sc.t1 - sc.t0)).toFixed(4)})`;
    } });
  };
  /* frase roja dentro de un marco de tiza (MONSTER PART OF ME BUT) */
  R.scenes.marco = (sc, ctx) => {
    const S = scaffold(sc, ctx);
    const box = centerBox(S.txt);
    const rows = split(sc.words, portrait(ctx) && sc.words.length > 2 ? 2 : 1);
    const size = K.fit(rows.map(textOf), ctx.fonts.condensed, ctx.W * 0.78, ctx.H * 0.2);
    const R1 = rows.map(ws => row(box, ws, ctx.fonts.condensed, size, ctx.red));
    sc.v.doodle = "box";
    const holder = { e: box };
    return finish(S, sc, ctx, { target: () => holder.e, doodleAt: 0.02, update: lt => enter(R1.flatMap(r => r.spans), lt, ctx) });
  };
  /* la frase repetida en filas anchas y espaciadas con mancha roja (MY WHOLE COOL ×N) */
  R.scenes.eco = (sc, ctx) => {
    const S = scaffold(sc, ctx);
    const box = centerBox(S.txt, "gr-stack");
    const n = portrait(ctx) ? 4 : 3;
    const wide = { ...ctx.fonts.wide, tracking: 0.2 };
    const size = K.fit([textOf(sc.words)], wide, ctx.W * 0.86, ctx.H * 0.12);
    const rows = Array.from({ length: n }, (_, i) => row(box, sc.words.map(w => ({ ...w, t: w.t + i * 0.04 })), wide, size, ctx.white, i % 2 ? "gr-faded" : ""));
    if (ctx.C.components.doodles) sc.v.doodle = "smear";
    return finish(S, sc, ctx, { target: () => rows[Math.floor(n / 2)].e, doodleAt: 0.15, update: lt => enter(rows.flatMap(r => r.spans), lt, ctx) });
  };
  /* bloque ancho sobre papel rasgado, filas de tamaños distintos (DO NOT / PUT IS ON / THE MAP) */
  R.scenes.ancho = (sc, ctx) => {
    const S = scaffold({ ...sc, bg: "paper" }, ctx);
    const box = centerBox(S.txt, "gr-stack gr-on-paper");
    const rows = split(sc.words, Math.min(3, sc.words.length));
    const wide = ctx.fonts.wide;
    const R1 = rows.map((ws, i) => row(box, ws, wide, K.fit([textOf(ws)], wide, ctx.W * (portrait(ctx) ? 0.9 : 0.6 + 0.12 * ((i + sc.seed) % 3)), ctx.H * 0.2), i % 2 ? ctx.red : ctx.white));
    return finish(S, sc, ctx, { target: () => R1[R1.length - 1].e, update: lt => enter(R1.flatMap(r => r.spans), lt, ctx, "slam") });
  };
  /* palabra blanca grande + palabra roja al lado; el resto se apila debajo en gris (COMPETIC KEEN / HELP THIS) */
  R.scenes.dupla = (sc, ctx) => {
    const S = scaffold({ ...sc, bg: sc.bg === "paper" ? "dark" : sc.bg }, ctx);
    const box = centerBox(S.txt, "gr-stack gr-left");
    const top = sc.words.slice(0, 2), rest = sc.words.slice(2);
    const size = K.fit([textOf(top)], ctx.fonts.condensed, ctx.W * 0.8, ctx.H * 0.18);
    const line1 = K.el("div", "gr-row", box);
    const A = row(line1, [top[0]], ctx.fonts.condensed, size, ctx.white, "gr-inl");
    const B = top[1] ? row(line1, [top[1]], { ...ctx.fonts.thin, weight: 500 }, size * 0.62, ctx.red, "gr-inl gr-sup") : { spans: [] };
    const C = rest.length ? row(box, rest, ctx.fonts.condensed, size * 0.9, ctx.white, "gr-hollow") : { spans: [] };
    return finish(S, sc, ctx, { target: () => A.e, update: lt => { enter(A.spans, lt, ctx); enter(B.spans, lt, ctx); enter(C.spans, lt, ctx); } });
  };
  /* flecha roja que apunta a una frase blanca (→ KELVIN RAISE TILL OFF) */
  R.scenes.flecha = (sc, ctx) => {
    const S = scaffold({ ...sc, v: { ...sc.v, strip: "bottom" } }, ctx);
    const box = centerBox(S.txt);
    box.style.top = "12%";
    const size = K.fit([textOf(sc.words)], ctx.fonts.condensed, ctx.W * 0.6, ctx.H * 0.09);
    const A = row(box, sc.words, ctx.fonts.condensed, size, ctx.white);
    const s = K.layer(S.rootEl, ctx.W, ctx.H, "gr-doodles");
    let arrow = null;
    return finish(S, sc, ctx, { target: null, update: lt => {
      if (!arrow) {
        const b = boxOf(A.e, S.rootEl), y = b.y + b.h / 2, x1 = b.x - ctx.u * 1.5, x0 = Math.max(ctx.u * 2, x1 - ctx.W * 0.14), k = ctx.u * 1.8;
        arrow = K.strokePaths(s, [`M${x0},${y}L${x1},${y}`, `M${x1 - k},${y - k}L${x1},${y}L${x1 - k},${y + k}`], ctx.red, Math.max(3, ctx.u * 0.8), "gr-brush");
      }
      arrow.forEach((p, i) => K.setDraw(p, K.prog(lt, i * 0.1, 0.18 + i * 0.1)));
      enter(A.spans, lt, ctx);
    } });
  };
  /* frase roja con estela fuerte y cruces de tiza (I HAVE THREESOME) */
  R.scenes.rojo = (sc, ctx) => {
    const S = scaffold(sc, ctx);
    const box = centerBox(S.txt);
    const rows = split(sc.words, portrait(ctx) && sc.words.length > 1 ? 2 : 1);
    const size = K.fit(rows.map(textOf), ctx.fonts.condensed, ctx.W * 0.8, ctx.H * 0.28);
    const R1 = rows.map(ws => row(box, ws, ctx.fonts.condensed, size, ctx.red, "gr-blur"));
    sc.v.doodle = ctx.C.components.doodles ? "xmarks" : null;
    return finish(S, sc, ctx, { target: () => box, doodleAt: 0.1, update: lt => {
      enter(R1.flatMap(r => r.spans), lt, ctx);
      box.style.transform = `translate(-50%,-50%) translateX(${(Math.sin(lt * 9) * ctx.u * 0.4).toFixed(1)}px)`;
    } });
  };

  G.parts = { row, enter, split, textOf, boxOf, centerBox, scaffold, finish, up, portrait };
  G.SCENES = Object.keys(R.scenes);
})(typeof window !== "undefined" ? window : globalThis);
