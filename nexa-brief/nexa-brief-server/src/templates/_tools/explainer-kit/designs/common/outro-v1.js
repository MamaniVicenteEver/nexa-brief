/* Cierre común con la misma secuencia y ritmo; cada diseño conserva su lenguaje visual. */
(function () {
  "use strict";
  const K = window.Kit, { clamp, prog } = K;
  const NS = "http://www.w3.org/2000/svg";

  /* Los navegadores pueden bloquear el audio iniciado por el cargador asíncrono.
     El primer gesto del usuario lo desbloquea; el reloj sigue siendo audio.currentTime. */
  if (!window.__kitAudioUnlockInstalled && !document.querySelector("script[data-noboot]")) {
    const audio = document.getElementById("audio");
    if (audio) {
      window.__kitAudioUnlockInstalled = true;
      const unlock = () => {
        if (!audio.src) return;
        if (!audio.paused) { document.removeEventListener("pointerdown", unlock, true); return; }
        audio.play().then(() => document.removeEventListener("pointerdown", unlock, true)).catch(() => {});
      };
      document.addEventListener("pointerdown", unlock, true);
    }
  }


  function svg(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, value, attrs) {
    const e = svg("text", attrs, parent);
    e.textContent = value;
    return e;
  }
  function wrap(value, max) {
    const lines = [""];
    for (const word of String(value || "").split(/\s+/).filter(Boolean)) {
      const i = lines.length - 1, next = lines[i] ? `${lines[i]} ${word}` : word;
      if (lines[i] && next.length > max) lines.push(word);
      else lines[i] = next;
    }
    return lines.filter(Boolean);
  }
  const colors = (P, key, fallback) => P[key] || fallback;
  const THEMES = {
    acuarela: { surface: "paperHi", edge: "rule", type: "'Oswald', sans-serif", treatment: "wash" },
    carta: { surface: "bg2", edge: "line", type: "'Special Elite', serif", treatment: "letter" },
    collage: { surface: "bg2", edge: "accent", type: "'Playfair Display', serif", treatment: "archive" },
    cronica: { surface: "bg2", edge: "swatch", type: "'EB Garamond', serif", treatment: "chronicle" },
    enmienda: { surface: "bg2", edge: "paper", type: "'Oswald', sans-serif", treatment: "dossier" },
    grunge: { surface: "bg2", edge: "accent", type: "'Montserrat', sans-serif", treatment: "grunge" },
    pelicula: { surface: "bg2", edge: "perf", type: "'Montserrat', sans-serif", treatment: "film" },
    periodico: { surface: "paper", edge: "accent", type: "'Libre Caslon Text', serif", treatment: "news" },
    pop: { surface: "paper", edge: "accent", type: "'Archivo', sans-serif", treatment: "pop" },
  };

  function frame(root, theme, P, box, u) {
    const { x, y, w, h } = box, c = colors(P, theme.surface, P.bg2), edge = colors(P, theme.edge, P.accent);
    const base = svg("rect", { x: 0, y: 0, width: box.W, height: box.H, fill: P.bg }, root);
    base.setAttribute("data-outro-backdrop", theme.treatment);
    if (theme.treatment === "wash") {
      svg("circle", { cx: x + w * 0.05, cy: y + h * 0.12, r: u * 15, fill: P.accent, opacity: 0.12 }, root);
      svg("circle", { cx: x + w * 0.94, cy: y + h * 0.88, r: u * 20, fill: P.sepia || P.accent, opacity: 0.1 }, root);
    }
    if (theme.treatment === "pop") {
      svg("rect", { x: x + u * 1.2, y: y + u * 1.1, width: w, height: h, rx: u * 0.8, fill: P.mid || edge, opacity: 0.65 }, root);
    }
    if (theme.treatment === "grunge") {
      const j = u * 1.2;
      svg("path", { d: `M${x-j} ${y+j}L${x+w*.24} ${y-j}L${x+w*.52} ${y+j*.4}L${x+w*.77} ${y-j*.3}L${x+w+j} ${y+j}L${x+w-j} ${y+h*.38}L${x+w+j*.3} ${y+h*.7}L${x+w-j} ${y+h-j}L${x+w*.54} ${y+h+j}L${x+w*.27} ${y+h-j*.2}L${x-j} ${y+h+j}L${x+j} ${y+h*.6}Z`, fill: edge, opacity: 0.72 }, root);
    }
    svg("rect", { x, y, width: w, height: h, rx: theme.treatment === "wash" || theme.treatment === "pop" ? u * 1.2 : 0, fill: c }, root);

    if (theme.treatment === "letter") {
      for (let yy = y + h * 0.2; yy < y + h * 0.88; yy += u * 6.4)
        svg("path", { d: `M${x + u * 3} ${yy}H${x + w - u * 3}`, stroke: edge, "stroke-width": Math.max(1, u * 0.08), opacity: 0.35 }, root);
      svg("path", { d: `M${x + u * 5} ${y + u * 2}V${y + h - u * 2}`, stroke: edge, "stroke-width": Math.max(1, u * 0.12), opacity: 0.55 }, root);
    }
    if (theme.treatment === "archive") {
      svg("rect", { x, y, width: w, height: u * 1.2, fill: edge }, root);
      svg("path", { d: `M${x + u * 3} ${y + h * .2}H${x + w - u * 3}M${x + u * 3} ${y + h * .86}H${x + w - u * 3}`, stroke: P.headline || P.ink, "stroke-width": Math.max(1, u * .12), opacity: .65 }, root);
    }
    if (theme.treatment === "chronicle") {
      svg("rect", { x: x + u * 2, y: y + u * 2, width: w - u * 4, height: h - u * 4, fill: "none", stroke: edge, "stroke-width": Math.max(1, u * .12), opacity: .75 }, root);
      for (const [dx, dy] of [[1,1],[-1,1],[1,-1],[-1,-1]]) svg("path", { d: `M${dx > 0 ? x + u * 2 : x + w - u * 2} ${dy > 0 ? y + u * 7 : y + h - u * 7}v${dy * u * 4}h${dx * u * 4}`, stroke: P.accent, "stroke-width": Math.max(1, u * .2), fill: "none" }, root);
    }
    if (theme.treatment === "dossier") {
      svg("path", { d: `M${x + w*.06} ${y}H${x + w*.94}L${x + w} ${y + u*2}V${y+h}H${x}V${y+u*2}Z`, fill: "none", stroke: edge, "stroke-width": Math.max(1, u * .18), opacity: .8 }, root);
      svg("path", { d: `M${x+w*.72} ${y+u*3}l${u*8} ${-u*2}l${u*8} ${u*2}v${u*2}h${-u*16}Z`, fill: P.tape || P.paper, opacity: .6 }, root);
    }
    if (theme.treatment === "film") {
      for (let yy = y + u * 3; yy < y + h - u * 2; yy += u * 7) {
        svg("rect", { x: x + u * 1.5, y: yy, width: u * 1.8, height: u * 3.2, rx: u * .35, fill: edge, opacity: .9 }, root);
        svg("rect", { x: x + w - u * 3.3, y: yy, width: u * 1.8, height: u * 3.2, rx: u * .35, fill: edge, opacity: .9 }, root);
      }
      svg("path", { d: `M${x+u*5} ${y+h*.13}H${x+w-u*5}M${x+u*5} ${y+h*.9}H${x+w-u*5}`, stroke: edge, "stroke-width": Math.max(1,u*.16), opacity:.8 }, root);
    }
    if (theme.treatment === "news") {
      svg("rect", { x: x + u * 3, y: y + u * 2.4, width: w - u * 6, height: u * 1.3, fill: P.bar || edge }, root);
      for (const dx of [0.34, 0.66]) svg("path", { d: `M${x+w*dx} ${y+h*.21}V${y+h*.88}`, stroke: edge, "stroke-width": Math.max(1,u*.08), opacity:.45 }, root);
      svg("path", { d: `M${x+u*3} ${y+h*.2}H${x+w-u*3}M${x+u*3} ${y+h*.9}H${x+w-u*3}`, stroke: edge, "stroke-width": Math.max(1,u*.18), opacity:.85 }, root);
    }
    if (theme.treatment === "grunge") {
      svg("path", { d: `M${x+w*.18} ${y+h*.18}L${x+w*.82} ${y+h*.18}`, stroke: edge, "stroke-width": u*1.2, opacity:.7 }, root);
    }
    if (theme.treatment === "pop") {
      svg("path", { d: `M${x+u*2} ${y+h*.17}H${x+w-u*2}`, stroke: edge, "stroke-width": u*.55 }, root);
    }
  }

  function makeLike(root, cx, cy, u, P, theme) {
    const g = svg("g", { opacity: 0 }, root), bw = u * 32, bh = u * 9, x = cx - bw / 2, y = cy - bh / 2;
    const rect = svg("rect", { x, y, width: bw, height: bh, rx: theme === "pop" || theme === "acuarela" ? u * 1.4 : u * .25, fill: P.bg2, stroke: P.accent, "stroke-width": Math.max(1, u * .18) }, g);
    const icon = svg("path", { d: "M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z", transform: `translate(${x + u * 3.2} ${y + u * 1.05}) scale(${u * .27})`, fill: P.accent }, g);
    const label = text(g, "LIKE", { x: cx + u * 3.1, y: cy + u * .55, fill: P.ink, "font-family": "Inter, sans-serif", "font-size": u * 2.7, "font-weight": 900, "text-anchor": "middle" });
    const check = text(g, "✓", { x: cx + bw * .34, y: cy + u * .65, fill: P.accentInk || P.bg, "font-family": "Inter, sans-serif", "font-size": u * 2.4, "font-weight": 900, "text-anchor": "middle", opacity: 0 });
    const ripple = svg("circle", { cx, cy, r: u * 4, fill: "none", stroke: P.accent, "stroke-width": u * .35, opacity: 0 }, root);
    return { g, rect, icon, label, check, ripple, cx, cy, bw, bh };
  }

  function makeBell(root, x, y, u, P) {
    const g = svg("g", { opacity: 0 }, root), s = u * .66;
    svg("path", { d: `M${x} ${y-s*4.5}C${x-s*2.5} ${y-s*4.5} ${x-s*3.5} ${y-s*2.4} ${x-s*3.5} ${y-s*.2}V${y+s*2.4}L${x-s*4.7} ${y+s*3.7}H${x+s*4.7}L${x+s*3.5} ${y+s*2.4}V${y-s*.2}C${x+s*3.5} ${y-s*2.4} ${x+s*2.5} ${y-s*4.5} ${x} ${y-s*4.5}Z`, fill: P.accent }, g);
    svg("path", { d: `M${x} ${y-s*3.4}C${x-s*1.9} ${y-s*3.4} ${x-s*2.4} ${y-s*1.7} ${x-s*2.4} ${y-s*.1}V${y+s*2.4}H${x+s*2.4}V${y-s*.1}C${x+s*2.4} ${y-s*1.7} ${x+s*1.9} ${y-s*3.4} ${x} ${y-s*3.4}Z`, fill: P.bg2 }, g);
    svg("path", { d: `M${x-s*1.2} ${y+s*4.2}Q${x} ${y+s*5.6} ${x+s*1.2} ${y+s*4.2}`, fill: "none", stroke: P.accent, "stroke-width": s*.65, "stroke-linecap": "round" }, g);
    svg("path", { d: `M${x-s*5.5} ${y-s*2.4}q${-s*1.6} ${s*1.7} 0 ${s*3.7}M${x+s*5.5} ${y-s*2.4}q${s*1.6} ${s*1.7} 0 ${-s*3.7}`, fill: "none", stroke: P.accent, "stroke-width": s*.55, "stroke-linecap": "round" }, g);
    return g;
  }

  K.outroV1 = function (name, theme, support) {
    const T = THEMES[theme] || THEMES.cronica;
    return {
      name, tags: ["cierre", "canal", "like", "suscribirse"], layer: "main", post: 0,
      summary: `Cierre de canal con secuencia v1 — gracias, NODETECH en grande, LIKE, suscripción, campana y apoyo — adaptada al tratamiento ${theme}. El motor la agrega al final del audio.`,
      example: { thanks: "GRACIAS POR VER", channel: "NODETECH", cta: "SUSCRÍBETE", support, handle: "youtube.com/@nodetech" },
      params: {
        thanks: { type: "string", default: "GRACIAS POR VER", doc: "Mensaje inicial." },
        channel: { type: "string", default: "NODETECH", doc: "Nombre grande del canal." },
        cta: { type: "string", default: "SUSCRÍBETE", doc: "Texto del botón." },
        support: { type: "string", default: support, doc: "Línea de apoyo que aparece al final." },
        handle: { type: "string", default: "youtube.com/@nodetech", doc: "Usuario o dirección del canal." },
        likeAt: { type: "number", default: 1, min: 0, doc: "Segundo de aparición del LIKE." },
        subscribeAt: { type: "number", default: 2.5, min: 0, doc: "Segundo de aparición de la suscripción." },
        bellAt: { type: "number", default: 3.25, min: 0, doc: "Segundo de aparición de la campana." },
        supportAt: { type: "number", default: 3.65, min: 0, doc: "Segundo de aparición del apoyo y usuario." },
      },
      create(ctx, p) {
        ctx.beat.hideCaptions = true;
        const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage;
        const root = svg("g", { "data-component": name }, ctx.layers.svg);
        const box = { W, H, x: W * (portrait ? .07 : .13), y: H * .12, w: W * (portrait ? .86 : .74), h: H * .76 };
        frame(root, T, P, box, u);
        const cx = W / 2, yName = H * (portrait ? .34 : .34);
        const maxName = W * .82, fs = Math.min(u * 13, H * (portrait ? .105 : .15), maxName / Math.max(4, String(p.channel).length * .64));
        const thanksY = yName - fs * .9, brandY = yName + fs * .05;
        const thanks = text(root, String(p.thanks).toUpperCase(), { x: cx, y: thanksY, fill: P.accent, "font-family": T.type, "font-size": u * 2.15, "font-weight": 700, "letter-spacing": u * .32, "text-anchor": "middle", opacity: 0 });
        const brand = text(root, String(p.channel).toUpperCase(), { x: cx, y: brandY, fill: P.ink, "font-family": T.type, "font-size": fs, "font-weight": 900, "text-anchor": "middle", opacity: 0 });
        brand.setAttribute("textLength", Math.min(maxName, Math.max(fs * 3.2, String(p.channel).length * fs * .64)));
        brand.setAttribute("lengthAdjust", "spacingAndGlyphs");
        const rule = svg("path", { d: `M${cx - maxName * .35} ${brandY + u * 1.8}Q${cx} ${brandY + u * 2.4} ${cx + maxName * .35} ${brandY + u * 1.8}`, fill: "none", stroke: P.accent, "stroke-width": Math.max(1, u * .22), "stroke-dasharray": `${maxName}`, "stroke-dashoffset": maxName }, root);
        const likeY = yName + fs * .76 + u * 4.2, like = makeLike(root, cx, likeY, u, P, theme);
        const subY = likeY + u * 13.4, bw = u * (portrait ? 40 : 34), bh = u * 8.8, sub = svg("g", { opacity: 0 }, root);
        const ctaBg = P.accent, ctaInk = P.accentInk || P.bg2 || P.ink;
        if (theme === "grunge") {
          svg("path", { d: `M${cx-bw/2-u} ${subY-bh/2+u}L${cx-bw/2+u} ${subY-bh/2-u*.5}L${cx+bw/2+u} ${subY-bh/2}L${cx+bw/2+u*.3} ${subY+bh/2+u*.5}L${cx-bw/2-u*.4} ${subY+bh/2+u}Z`, fill: ctaBg, stroke: P.ink, "stroke-width": Math.max(1,u*.16) }, sub);
        } else {
          svg("rect", { x: cx-bw/2, y: subY-bh/2, width: bw, height: bh, rx: theme === "pop" || theme === "acuarela" ? u*1.4 : u*.2, fill: ctaBg, stroke: P.ink, "stroke-width": Math.max(1,u*.16) }, sub);
        }
        const cta = text(sub, String(p.cta).toUpperCase(), { x: cx, y: subY + u * .82, fill: ctaInk, "font-family": T.type, "font-size": u * 2.35, "font-weight": 800, "text-anchor": "middle" });
        cta.setAttribute("textLength", Math.min(bw * .78, Math.max(u * 12, String(p.cta).length * u * 1.35)));
        cta.setAttribute("lengthAdjust", "spacingAndGlyphs");
        const bell = makeBell(root, cx + bw/2 + u*6, subY, u, P);
        const lines = wrap(p.support, portrait ? 38 : 74), supportSize = u * (portrait ? 1.28 : 1.38);
        const support = lines.map((line, i) => text(root, line, { x: cx, y: subY + bh/2 + u * (portrait ? 8.4 + i*2.75 : 7.5 + i*2.55), fill: P.muted || P.ink, "font-family": T.type, "font-size": supportSize, "font-weight": 600, "text-anchor": "middle", opacity: 0 }));
        const handle = p.handle ? text(root, p.handle, { x: cx, y: subY + bh/2 + u*(portrait ? 8.4 + lines.length*2.75 : 7.5 + lines.length*2.55), fill: P.accent, "font-family": "Inter, sans-serif", "font-size": u*1.35, "font-weight": 700, "letter-spacing": u*.08, "text-anchor": "middle", opacity: 0 }) : null;
        return {
          render(lt, b) {
            const enter = prog(lt, 0, .55, "out"), nameIn = prog(lt, .22, .68, "out"), exit = 1 - prog(lt, b.dur - .32, .32, "in");
            const scale = Math.min(1, Math.max(.3, (b.dur - .35) / 4.65));
            const likeAt = p.likeAt * scale, subscribeAt = p.subscribeAt * scale;
            const ctaDur = Math.min(.62, b.dur * .12), bellDur = Math.min(.42, b.dur * .1);
            const bellAt = Math.max(p.bellAt * scale, subscribeAt + ctaDur + .04);
            const supportAt = Math.max(p.supportAt * scale, bellAt + bellDur + .04);
            const supportGap = b.dur < 4 ? .04 : .05, supportDur = b.dur < 4 ? .16 : .24;
            root.setAttribute("opacity", clamp(exit).toFixed(3));
            thanks.setAttribute("opacity", (enter * exit).toFixed(3));
            thanks.setAttribute("transform", `translate(0 ${((1-enter)*u*1.8).toFixed(2)})`);
            brand.setAttribute("opacity", (nameIn * exit).toFixed(3));
            brand.setAttribute("transform", `translate(0 ${((1-nameIn)*u*1.7).toFixed(2)}) scale(${(.96+.04*nameIn).toFixed(3)})`);
            rule.setAttribute("stroke-dashoffset", (maxName * (1 - prog(lt,.65,.5,"out"))).toFixed(1));
            const likeIn = prog(lt, likeAt, Math.min(.35, b.dur*.1), "out"), likeOut = 1 - prog(lt, subscribeAt-.05, Math.min(.32,b.dur*.1), "out");
            like.g.setAttribute("opacity", (likeIn * likeOut * exit).toFixed(3));
            like.g.setAttribute("transform", `translate(${cx} ${likeY}) scale(${(.94+.06*likeIn).toFixed(3)}) translate(${-cx} ${-likeY})`);
            const active = prog(lt, likeAt+Math.min(.28,b.dur*.08), Math.min(.22,b.dur*.07), "out") >= 1;
            like.rect.setAttribute("fill", active ? P.accent : P.bg2);
            like.icon.setAttribute("fill", active ? (P.accentInk || P.bg) : P.accent);
            like.label.setAttribute("fill", active ? (P.accentInk || P.bg) : P.ink);
            like.check.setAttribute("opacity", prog(lt, likeAt+Math.min(.42,b.dur*.12), Math.min(.2,b.dur*.06), "out").toFixed(3));
            const ripple = prog(lt, likeAt+Math.min(.35,b.dur*.1), Math.min(.35,b.dur*.1), "out") * (1-prog(lt,subscribeAt-.1,Math.min(.25,b.dur*.08),"out"));
            like.ripple.setAttribute("opacity", (.62*ripple*exit).toFixed(3));
            like.ripple.setAttribute("r", (u*(4+5*prog(lt,likeAt+Math.min(.35,b.dur*.1),Math.min(.35,b.dur*.1),"out"))).toFixed(2));
            const subIn = prog(lt, subscribeAt, ctaDur, "out");
            sub.setAttribute("opacity", (subIn*exit).toFixed(3));
            sub.setAttribute("transform", `translate(0 ${((1-subIn)*u*2).toFixed(2)})`);
            bell.setAttribute("opacity", (prog(lt,bellAt,bellDur,"out")*exit).toFixed(3));
            support.forEach((el,i) => el.setAttribute("opacity", (prog(lt,supportAt+i*supportGap,supportDur,"out")*exit).toFixed(3)));
            if (handle) handle.setAttribute("opacity", (prog(lt,supportAt+lines.length*supportGap,supportDur,"out")*exit).toFixed(3));
          },
          dispose() { root.remove(); like.ripple.remove(); },
        };
      },
    };
  };
})();
