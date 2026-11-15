/* lyrics-decadas · escenas de letra y piezas reutilizables.
   Escena = un fragmento de letra (2–4 palabras). Los caracteres aparecen en el
   instante en que se canta su palabra (times, relativos a la escena).
   Escenas: letras, titulo, barrido, gigante, contador, credito, foto.
   Piezas: tecleo, rodillo (odómetro), etiquetas, puntos, rótulo vertical,
   fragmentos gigantes con foto, firma. */
(function (root) {
  "use strict";
  const DC = root.Decadas, K = DC.core, R = DC.registry;
  const up = s => String(s || "").toLocaleUpperCase("es");

  /* ---------------------------- piezas ---------------------------- */
  /* texto partido en <span> por carácter, para tecleo y rodillo */
  function charText(parent, text, font, size, cls) {
    const box = K.el("div", "dc-text " + (cls || ""), parent);
    K.useFont(box, font, size);
    const spans = [];
    String(text).split("\n").forEach((line, li, all) => {
      const row = K.el("div", "dc-row", box);
      for (const ch of line) { const s = K.el("span", "dc-ch", row); s.textContent = ch === " " ? " " : ch; s.dataset.ch = s.textContent; spans.push(s); }
      if (li < all.length - 1) spans.push(null);
    });
    return { box, spans: spans.filter(Boolean) };
  }
  /* tiempo de aparición de cada carácter (sin saltos de línea) según sus palabras */
  function timesFor(text, words) {
    const out = [], toks = String(text).split(/(\s+)/).filter(x => x.length);
    let wi = 0;
    const W = words && words.length ? words : [{ t: 0, d: 0.3 }];
    for (const tok of toks) {
      const w = W[Math.min(wi, W.length - 1)];
      if (/^\s+$/.test(tok)) { for (const ch of tok) if (ch !== "\n") out.push(w.t); continue; }
      const chars = [...tok], spread = Math.min(0.16, Math.max(0.04, w.d * 0.5));
      chars.forEach((_, k) => out.push(w.t + spread * k / chars.length));
      wi++;
    }
    return out;
  }
  /* tecleo: cada carácter visible desde su tiempo */
  function typeUpdate(spans, times, lt) {
    spans.forEach((s, i) => { s.style.visibility = lt >= (times[i] ?? 0) ? "visible" : "hidden"; });
  }
  /* rodillo: antes de asentarse cada carácter pasa por glifos al azar */
  function rollUpdate(spans, times, lt, rollSec, glyphs, seed) {
    spans.forEach((s, i) => {
      const t0 = times[i] ?? 0;
      if (lt < t0) { s.style.visibility = "hidden"; return; }
      s.style.visibility = "visible";
      const fin = s.dataset.ch;
      if (fin === " " || lt >= t0 + rollSec) { s.textContent = fin; s.style.transform = ""; return; }
      const step = Math.floor((lt - t0) / 0.045);
      const r = K.rng(seed + i * 31 + step * 7);
      s.textContent = /\d/.test(fin) || r() < 0.5 ? glyphs[Math.floor(r() * glyphs.length)] : fin;
      s.style.transform = `translateY(${((1 - (lt - t0) / rollSec) * -18).toFixed(1)}%)`;
    });
  }
  /* etiquetas azules pequeñas que parpadean y cambian de texto */
  function tags(parent, ctx, seed, n, area) {
    const r = K.rng(seed), list = ctx.tags.length ? ctx.tags : ["01"];
    const items = Array.from({ length: n }, (_, i) => {
      const e = K.el("div", "dc-tag", parent);
      K.useFont(e, ctx.fonts.display, ctx.u * r.range(3.2, 4.6));
      e.style.left = (area.x + r.range(0, area.w)).toFixed(0) + "px";
      e.style.top = (area.y + r.range(0, area.h)).toFixed(0) + "px";
      return { e, off: r.int(0, list.length - 1), rate: r.range(0.09, 0.16) };
    });
    return { update(lt) {
      items.forEach((it, i) => {
        const step = Math.floor(lt / it.rate);
        it.e.textContent = list[(it.off + step) % list.length];
        it.e.style.visibility = K.rng(seed + i * 13 + step)() < 0.86 ? "visible" : "hidden";
      });
    } };
  }
  /* rejilla de puntos diminutos */
  function dots(parent, ctx, color) {
    const s = K.svg("svg", { class: "dc-svg", width: ctx.W, height: ctx.H }, parent);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++)
      K.svg("circle", { cx: ctx.W * (0.08 + i * 0.21), cy: ctx.H * (0.12 + j * 0.25), r: Math.max(1, ctx.u * 0.25), fill: color, opacity: 0.5 }, s);
    return s;
  }
  /* rótulo vertical (texto girado 90°) que se desliza */
  function vlabel(parent, ctx, text, color, x, y, size, dir = 1) {
    const e = K.el("div", "dc-vlabel", parent);
    K.useFont(e, ctx.fonts.display, size);
    e.style.color = color; e.textContent = up(text);
    e.style.left = x + "px"; e.style.top = y + "px";
    return { e, update(lt, speed = 1) { e.style.transform = `translate(-50%,-50%) rotate(90deg) translateX(${(dir * lt * ctx.u * 12 * speed).toFixed(1)}px)`; } };
  }
  /* letras gigantes rellenas con foto en semitono (background-clip: text) */
  function photoText(parent, ctx, text, size, photoIdx, color) {
    const e = K.el("div", "dc-photo-text", parent);
    K.useFont(e, ctx.fonts.display, size);
    e.textContent = text;
    const ph = ctx.photos.length ? ctx.photos[photoIdx % ctx.photos.length] : null;
    if (ph) { e.style.backgroundImage = `url(${ph})`; e.classList.add("dc-clip"); }
    else e.style.color = color || ctx.C.colors.white;
    return e;
  }
  /* firma blanca o azul que se dibuja */
  function signature(parent, ctx, seed, x, y, w, h, color) {
    const s = K.svg("svg", { class: "dc-svg", width: ctx.W, height: ctx.H }, parent);
    const p = K.svg("path", { d: K.signaturePath(x, y, w, h, K.rng(seed)), pathLength: 1, fill: "none", stroke: color, "stroke-width": Math.max(1.2, ctx.u * 0.32),
      "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-dasharray": "1 1", "stroke-dashoffset": 1 }, s);
    return { s, update(p01) { K.setDraw(p, p01); } };
  }
  /* fragmentos gigantes con foto que cruzan la pantalla */
  function fragments(parent, ctx, seed, text, count) {
    const r = K.rng(seed), src = up(text).replace(/\s+/g, "") || "AB";
    const items = Array.from({ length: count }, (_, i) => {
      const a = r.int(0, Math.max(0, src.length - 2));
      const e = photoText(parent, ctx, src.slice(a, a + r.int(2, 3)), ctx.H * r.range(0.32, 0.55), seed + i, ctx.C.colors.black);
      e.classList.add("dc-frag");
      const vert = r() < 0.4;
      return { e, x: r.range(-0.2, 0.8) * ctx.W, y: r.range(0.05, 0.75) * ctx.H, vx: r.range(0.6, 1.4) * (r() < 0.5 ? -1 : 1), vert };
    });
    return { update(lt, speed = 1) {
      items.forEach(it => { it.e.style.transform = `translate(${(it.x + it.vx * lt * ctx.u * 30 * speed).toFixed(1)}px, ${it.y.toFixed(1)}px)${it.vert ? " rotate(90deg)" : ""}`; });
    } };
  }
  function bg(rootEl, color) { rootEl.style.background = color; }
  function photoBg(rootEl, ctx, idx) {
    const e = K.el("div", "dc-photo-bg", rootEl);
    const ph = ctx.photos.length ? ctx.photos[idx % ctx.photos.length] : null;
    if (ph) e.style.backgroundImage = `url(${ph})`; else e.style.background = ctx.C.colors.dark;
    return e;
  }
  /* en vertical, los fragmentos largos se parten en dos líneas equilibradas */
  function balance(text, ctx) {
    const words = String(text).split(" ");
    if (ctx.W / ctx.H >= 0.85 || words.length < 2 || text.length <= ctx.C.timing.splitChars) return text;
    let best = 1, diff = 1e9;
    for (let i = 1; i < words.length; i++) { const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length); if (d < diff) { diff = d; best = i; } }
    return words.slice(0, best).join(" ") + "\n" + words.slice(best).join(" ");
  }
  /* texto que cabe en un cuadro y se centra */
  function centered(parent, ctx, text, font, w, h, cls) {
    text = balance(text, ctx);
    const size = K.fit(text, font, w, h * (text.includes("\n") ? 1.6 : 1));
    const holder = K.el("div", "dc-center", parent);
    const T = charText(holder, text, font, size, cls);
    return { holder, ...T, size, text };
  }

  /* ---------------------------- escenas ---------------------------- */
  const C = ctx => ctx.C.colors;

  /* letras gigantes una a una (con foto) y luego el fragmento tecleado */
  R.scenes.letras = (sc, ctx) => {
    const rootEl = K.el("div", "dc-scene"); bg(rootEl, C(ctx).dark);
    const kw = up(sc.keyword.text).replace(/[^\p{L}\p{N}]/gu, "") || up(sc.text).slice(0, 4);
    const letters = [...kw];
    const big = photoText(rootEl, ctx, "", ctx.H * 0.62, sc.seed, C(ctx).white);
    big.classList.add("dc-giant-center");
    const sig = ctx.C.components.signature ? signature(rootEl, ctx, sc.seed, ctx.W * 0.18, ctx.H * 0.48, ctx.W * 0.5, ctx.H * 0.06, C(ctx).white) : null;
    const lab = vlabel(rootEl, ctx, ctx.label, C(ctx).blue, ctx.W * 0.62, ctx.H * 0.62, ctx.u * 5.5, -1);
    const T = centered(rootEl, ctx, up(sc.text), ctx.fonts.display, ctx.W * 0.86, ctx.H * 0.3);
    const times = timesFor(T.text, sc.words);
    const k0 = sc.keyword.t, k1 = k0 + sc.keyword.d;
    return { root: rootEl, update(lt) {
      const building = lt >= k0 && lt < k1;
      big.style.display = building ? "block" : "none";
      if (!building) { big.textContent = ""; big.classList.remove("dc-clip"); big.style.backgroundImage = "none"; big.style.color = ""; }
      T.holder.style.display = building ? "none" : "flex";
      lab.e.style.display = building ? "block" : "none";
      if (building) {
        const i = Math.min(letters.length - 1, Math.floor((lt - k0) / (sc.keyword.d / letters.length)));
        big.textContent = letters[i];
        /* como en la referencia: letras con foto alternan con letras blancas lisas */
        const withPhoto = ctx.photos.length && i % 2 === 0;
        big.classList.toggle("dc-clip", !!withPhoto);
        big.style.backgroundImage = withPhoto ? `url(${ctx.photos[(sc.seed + i) % ctx.photos.length]})` : "none";
        big.style.color = withPhoto ? "transparent" : C(ctx).white;
        lab.update(lt - k0);
        if (sig) sig.update(K.prog(lt, k0, k0 + Math.min(0.5, sc.keyword.d)));
      } else if (sig) sig.update(0);
      typeUpdate(T.spans, times, lt);
    } };
  };

  /* título blanco con etiquetas azules que parpadean */
  R.scenes.titulo = (sc, ctx) => {
    const rootEl = K.el("div", "dc-scene"); bg(rootEl, C(ctx).dark);
    dots(rootEl, ctx, C(ctx).blue);
    const T = centered(rootEl, ctx, up(sc.text), ctx.fonts.display, ctx.W * 0.84, ctx.H * 0.3);
    const times = timesFor(T.text, sc.words);
    const tw = Math.min(ctx.W * 0.84, K.measure(up(sc.text), ctx.fonts.display, T.size));
    const tg = ctx.C.components.tags ? tags(rootEl, ctx, sc.seed, 3, { x: ctx.W / 2 - tw * 0.45, y: ctx.H / 2 - T.size * 0.75, w: tw * 0.8, h: T.size * 0.9 }) : null;
    const mark = ctx.C.components.signature ? signature(rootEl, ctx, sc.seed + 5, ctx.W / 2 + tw * 0.3, ctx.H / 2 + T.size * 0.75, ctx.W * 0.06, ctx.u * 1.4, C(ctx).blue) : null;
    return { root: rootEl, update(lt) {
      typeUpdate(T.spans, times, lt);
      if (tg) tg.update(lt);
      if (mark) mark.update(K.prog(lt, 0.1, 0.5));
      T.holder.style.transform = `scale(${(1 + ctx.C.motion.drift * K.prog(lt, 0, sc.t1 - sc.t0)).toFixed(4)})`;
    } };
  };

  /* fondo celeste, texto negro y barra azul que barre hacia la derecha */
  R.scenes.barrido = (sc, ctx) => {
    const rootEl = K.el("div", "dc-scene"); bg(rootEl, C(ctx).pale);
    dots(rootEl, ctx, C(ctx).black);
    const T = centered(rootEl, ctx, up(sc.text), ctx.fonts.display, ctx.W * 0.8, ctx.H * 0.26, "dc-ink");
    const times = timesFor(T.text, sc.words);
    const tw = Math.min(ctx.W * 0.8, K.measure(up(sc.text), ctx.fonts.display, T.size));
    const bar = K.el("div", "dc-bar", rootEl, { background: C(ctx).blue });
    const D = sc.t1 - sc.t0, x0 = ctx.W / 2 + tw * 0.5, barH = T.size * 0.55;
    return { root: rootEl, update(lt) {
      typeUpdate(T.spans, times, lt);
      const a = K.ease.expo(K.prog(lt, D * 0.62, D * 0.85)), b = K.ease.in(K.prog(lt, D * 0.86, D));
      const x = x0 - tw * 0.08 - a * tw * 0.4;
      bar.style.left = (x - b * x).toFixed(1) + "px";
      bar.style.width = ((ctx.W - x) * a + b * x).toFixed(1) + "px";
      bar.style.top = (ctx.H / 2 - barH / 2 - b * ctx.H).toFixed(1) + "px";
      bar.style.height = (barH + b * ctx.H * 2).toFixed(1) + "px";
      bar.style.display = a > 0 ? "block" : "none";
    } };
  };

  /* letras negras gigantes recortadas sobre foto + texto azul rodante */
  R.scenes.gigante = (sc, ctx) => {
    const rootEl = K.el("div", "dc-scene"); bg(rootEl, C(ctx).pale);
    const ph = photoBg(rootEl, ctx, sc.seed);
    const kw = up(sc.keyword.text).replace(/[^\p{L}\p{N}]/gu, "") || "AB";
    const giant = K.el("div", "dc-giant", rootEl);
    K.useFont(giant, ctx.fonts.display, ctx.H * 1.05);
    giant.style.color = C(ctx).black;
    giant.textContent = kw.slice(0, 3);
    const T = centered(rootEl, ctx, up(sc.text), ctx.fonts.display, ctx.W * 0.82, ctx.H * 0.2, "dc-blue");
    const times = timesFor(T.text, sc.words);
    const sig = ctx.C.components.signature ? signature(rootEl, ctx, sc.seed + 2, ctx.W * 0.2, ctx.H * 0.5, ctx.W * 0.3, ctx.H * 0.05, C(ctx).white) : null;
    const D = sc.t1 - sc.t0;
    return { root: rootEl, update(lt) {
      rollUpdate(T.spans, times, lt, ctx.C.motion.rollSec, ctx.C.motion.rollGlyphs, sc.seed);
      giant.style.transform = `translate(-50%,-50%) translateX(${(-K.prog(lt, 0, D) * ctx.W * 0.18).toFixed(1)}px)`;
      ph.style.transform = `scale(${(1.05 + 0.04 * K.prog(lt, 0, D)).toFixed(4)})`;
      if (sig) sig.update(K.prog(lt, D * 0.3, D * 0.7));
    } };
  };

  /* contador azul con rótulos verticales y fragmentos con foto */
  R.scenes.contador = (sc, ctx) => {
    const rootEl = K.el("div", "dc-scene"); bg(rootEl, C(ctx).pale);
    const fr = ctx.C.components.fragments ? fragments(rootEl, ctx, sc.seed, ctx.label, 2) : null;
    const T = centered(rootEl, ctx, up(sc.text), ctx.fonts.display, ctx.W * 0.84, ctx.H * 0.18, "dc-blue");
    const times = timesFor(T.text, sc.words);
    const lab1 = vlabel(rootEl, ctx, ctx.label, C(ctx).black, ctx.W / 2, ctx.H * 0.2, ctx.u * 6, 1);
    const lab2 = vlabel(rootEl, ctx, ctx.label, C(ctx).black, ctx.W / 2, ctx.H * 0.8, ctx.u * 6, -1);
    return { root: rootEl, update(lt) {
      rollUpdate(T.spans, times, lt, ctx.C.motion.rollSec, ctx.C.motion.rollGlyphs, sc.seed);
      lab1.update(lt, 0.3); lab2.update(lt, 0.3);
      if (fr) fr.update(lt, ctx.C.motion.fragmentSpeed);
    } };
  };

  /* crédito: dos filas a la izquierda, rayas finas y pie tecleado */
  R.scenes.credito = (sc, ctx) => {
    const rootEl = K.el("div", "dc-scene"); bg(rootEl, C(ctx).dark);
    const words = up(sc.text).split(/\s+/);
    const half = Math.ceil(words.length / 2);
    const two = words.length > 1 ? words.slice(0, half).join(" ") + "\n" + words.slice(half).join(" ") : words[0];
    const size = K.fit(two, ctx.fonts.display, ctx.W * 0.62, ctx.H * 0.3);
    const wrap = K.el("div", "dc-credit", rootEl, { left: (ctx.W * 0.09).toFixed(0) + "px" });
    const rule1 = K.el("div", "dc-rule", wrap, { background: C(ctx).white });
    const T = charText(wrap, two, ctx.fonts.display, size, "dc-left");
    const times = timesFor(two, sc.words);
    const cap = K.el("div", "dc-caption", wrap); K.useFont(cap, ctx.fonts.display, Math.max(10, size * 0.2));
    const rule2 = K.el("div", "dc-rule", wrap, { background: C(ctx).white });
    const capText = up(ctx.credit);
    const fl = ctx.C.components.photos ? photoBg(rootEl, ctx, sc.seed + 3) : null;
    const fr = ctx.C.components.fragments ? fragments(rootEl, ctx, sc.seed + 9, ctx.label, 2) : null;
    if (fr) rootEl.querySelectorAll(".dc-frag").forEach(e => { e.style.backgroundImage = "none"; e.classList.remove("dc-clip"); e.style.color = C(ctx).blue; });
    const D = sc.t1 - sc.t0;
    return { root: rootEl, update(lt) {
      typeUpdate(T.spans, times, lt);
      cap.textContent = capText.slice(0, Math.round(capText.length * K.prog(lt, D * 0.15, D * 0.55)));
      rule1.style.width = rule2.style.width = (K.ease.out(K.prog(lt, 0, 0.25)) * ctx.u * 4).toFixed(1) + "px";
      if (fl) fl.style.display = lt >= D * 0.55 && lt < D * 0.55 + ctx.C.transitions.flashSec ? "block" : "none";
      if (fr) { fr.update(lt - D * 0.7, 2.2); rootEl.querySelectorAll(".dc-frag").forEach(e => { e.style.display = lt > D * 0.7 ? "block" : "none"; }); }
    } };
  };

  /* foto en semitono a pantalla completa con el texto encima */
  R.scenes.foto = (sc, ctx) => {
    const rootEl = K.el("div", "dc-scene"); bg(rootEl, C(ctx).dark);
    const ph = photoBg(rootEl, ctx, sc.seed);
    const T = centered(rootEl, ctx, up(sc.text), ctx.fonts.display, ctx.W * 0.8, ctx.H * 0.24, "dc-blue dc-shadow");
    const times = timesFor(T.text, sc.words);
    const lab = vlabel(rootEl, ctx, ctx.label, C(ctx).white, ctx.W * 0.88, ctx.H * 0.5, ctx.u * 5);
    const D = sc.t1 - sc.t0;
    return { root: rootEl, update(lt) {
      typeUpdate(T.spans, times, lt);
      ph.style.transform = `scale(${(1.12 - 0.08 * K.prog(lt, 0, D)).toFixed(4)})`;
      lab.update(lt, 0.4);
    } };
  };

  DC.parts = { timesFor, charText, typeUpdate, rollUpdate, tags, dots, vlabel, photoText, signature, fragments, photoBg, centered, up };
  DC.SCENES = Object.keys(R.scenes);
})(typeof window !== "undefined" ? window : globalThis);
