/* Hoja con marcas independientes; los tiempos se calculan desde el beat. */
(function () {
  const K = Kit, R = K.rough;
  K.register({
    name: "rough.notemark", tags: ["documento", "nota", "marcador", "sello"], layer: "main",
    summary: "Hoja manuscrita con conceptos destacados por separado en el margen o como sellos. Para ver sellos en stage.html agrega &p={\"title\":\"ACCESO AUTORIZADO\",\"marks\":[\"seguridad\",\"soporte\",\"asuntos legales\"],\"style\":\"stamps\"}.",
    example: { title: "ACCESO AUTORIZADO", marks: ["seguridad", "soporte", "asuntos legales"] },
    params: {
      title: { type: "string", default: "", doc: "Título de la hoja." },
      marks: { type: "array", default: [], doc: "1–5 textos u objetos {text, at}; at es segundo local o ancla @palabras." },
      note: { type: "string", default: "", doc: "Alternativa a marks: conceptos separados por ·." },
      style: { type: "string", default: "marker", options: ["marker", "stamps"], doc: "Marcador en renglón o sellos sobre el papel." },
      side: { type: "string", default: "auto", options: ["auto", "left", "right"], doc: "Margen de las etiquetas marker; auto elige derecha." },
      seed: { type: "string", default: "", doc: "Variante determinista; vacío deriva del contenido y del beat." },
      arrowLen: { type: "number", default: 1, min: 1, max: 1.4, doc: "Multiplicador del largo de las flechas; la semilla suma entre 15 % y 25 %." },
      stagger: { type: "number", default: 0.7, min: 0, doc: "Segundos entre marcas desde 0,8; cada at lo reemplaza." },
    },
    create(ctx, p) {
      const { u, W, H, portrait } = ctx.stage, P = ctx.C.palette, g = R.root(ctx);
      const marker = p.style !== "stamps", left = p.side === "left";
      const source = Array.isArray(p.marks) && p.marks.length ? p.marks : String(p.note || "").split("·");
      const marks = source.map(m => typeof m === "object" && m ? m : { text: String(m) }).filter(m => String(m.text || "").trim()).slice(0, 5);
      const key = p.seed !== undefined && p.seed !== null && p.seed !== "" ? String(p.seed) : JSON.stringify([p.title, p.note, p.marks, p.style, p.side, ctx.beat.i, ctx.beat.t0, ctx.beat.wordIndex]);
      let hash = 2166136261;
      for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619) >>> 0;
      const random = salt => { let state = (hash ^ Math.imul(salt, 2654435761)) >>> 0; return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296); };
      const bw = Math.min(W * 0.92, H * (marker ? (portrait ? 1 : 1) : 0.64));
      const bh = marker ? bw * (portrait ? 1.18 : 0.88) : bw / 0.8;
      const box = { x: (W-bw)/2, y: (H-bh)/2, w: bw, h: bh };
      const w = marker ? box.w * 0.61 : box.w, h = box.h, x = box.x + (marker && left ? box.w - w : 0), y = box.y;
      const fold = w * 0.18;
      const edgeRand = random(1), jitter = scale => (edgeRand()-0.5)*scale;
      const outlinePath = `M${x} ${y} Q${x+w*0.4} ${y+jitter(h*0.012)} ${x+w-fold} ${y+jitter(h*0.004)} L${x+w} ${y+fold} Q${x+w+jitter(w*0.012)} ${y+h*0.55} ${x+w+jitter(w*0.004)} ${y+h} Q${x+w*0.5} ${y+h+jitter(h*0.012)} ${x+jitter(w*0.004)} ${y+h} Q${x+jitter(w*0.012)} ${y+h*0.5} ${x} ${y} Z`;
      const outline = R.shape(ctx, g, (G, o) => [G.path(outlinePath, {...o, roughness: 1.8}), G.path(`M${x+w-fold} ${y} L${x+w-fold+jitter(w*0.008)} ${y+fold+jitter(h*0.005)} L${x+w} ${y+fold}`, {...o, roughness: 1.8})], { width: 1.4, seed: hash });
      const fit = (el, max) => { if (el.getComputedTextLength() > max) { el.setAttribute("textLength", max); el.setAttribute("lengthAdjust", "spacingAndGlyphs"); } };
      const title = R.mono(ctx, g, String(p.title || ""), { x: x+w*0.08, y: y+h*0.15, anchor: "start", size: 3.2, spacing: 0.02, color: P.ink });
      fit(title, w*0.76);
      const rowTop = y+h*0.31, rowGap = h*0.115;
      // Palabras separadas con bucles, ascendentes y descendentes; el avance depende solo del tiempo local.
      const rows = Array.from({length: 6}, (_, i) => {
        const rand = random(20+i), start = x+w*0.09, end = x+w*(i === 5 ? 0.65 : 0.88), yy = rowTop+i*rowGap;
        const words = [], slope = (rand()-0.5)*h*0.016;
        let px = start;
        while (px < end-w*0.025) {
          const wordStart = px, count = 2+Math.floor(rand()*5), base = xx => yy+slope*(xx-start)/(end-start)+Math.sin((xx-start)/w*13+i)*h*0.002;
          let d = `M${px} ${base(px)}`;
          for (let j=0; j<count && px < end-w*0.012; j++) {
            const step = Math.min(end-px, w*(0.014+rand()*0.012)), nx = px+step, kind = rand();
            const high = h*(kind < 0.22 ? 0.024+rand()*0.012 : 0.006+rand()*0.009);
            const low = h*(kind > 0.88 ? 0.018+rand()*0.01 : 0.003+rand()*0.004);
            d += ` C${px+step*0.72} ${base(px)-high*1.5} ${px-step*0.25} ${base(px)-high} ${px+step*0.48} ${base(px)+low} Q${px+step*0.8} ${base(nx)+low*0.6} ${nx} ${base(nx)}`;
            px = nx;
          }
          const path = R.svg("path", {d, fill:"none", stroke:P.muted, "stroke-width":u*(0.25+rand()*0.2), "stroke-linecap":"round", "stroke-linejoin":"round", pathLength:1, "stroke-dasharray":"1 1", "stroke-dashoffset":1}, g);
          words.push({path, start:(wordStart-start)/(end-start), end:(px-start)/(end-start)});
          px += w*(0.012+rand()*0.022);
        }
        return words;
      });
      const entries = marks.map((m, i) => {
        const rowY = rowTop+i*rowGap, group = R.svg("g", { opacity: 0 }, g), text = String(m.text).trim();
        if (marker) {
          const rand = random(80+i), a = x+w*(0.075+rand()*0.012), z = x+w*(0.875+rand()*0.015), tilt = (rand()-0.5)*h*0.009;
          const top = [], bottom = [];
          for (let j=0; j<=12; j++) {
            const xx = a+(z-a)*j/12, center = rowY+tilt*(j/12-0.5), half = h*(0.016+rand()*0.004);
            top.push(`${xx},${center-half}`); bottom.unshift(`${xx+(rand()-0.5)*w*0.004},${center+half}`);
          }
          R.svg("polygon", {points:top.concat(bottom).join(" "), fill:P.accent, opacity:0.69+rand()*0.06}, group);
          R.svg("path", {d:`M${a+w*0.02} ${rowY+h*0.006} Q${(a+z)/2} ${rowY-h*0.003} ${z-w*0.015} ${rowY+tilt*0.5}`, fill:"none", stroke:P.accent, "stroke-width":h*0.013, opacity:0.12}, group);
          const edge = left ? x : x+w, outer = left ? box.x : x+w+w*0.12;
          const factor = (1.15+random(140+i)()*0.10)*Math.max(1, Math.min(1.4, Number(p.arrowLen) || 1));
          const arrowStart = outer + (left ? box.w*0.23 : 0), originalEnd = edge+(left ? -1 : 1)*w*0.06, end = arrowStart+(originalEnd-arrowStart)*factor;
          R.shape(ctx, group, (G, o) => [G.line(arrowStart, rowY+h*0.003, end, rowY, o), G.line(end, rowY, end+(left ? -1 : 1)*w*0.035, rowY-h*0.018, o), G.line(end, rowY, end+(left ? -1 : 1)*w*0.035, rowY+h*0.018, o)], {color:P.accent,width:0.75,seed:hash+960+i}).forEach(el => { el.setAttribute("stroke-dashoffset", 0); });
          const label = R.hand(ctx, group, text, { x: left ? box.x+box.w*0.01 : x+w+w*0.13, y: rowY-h*0.035, anchor: "start", size: 5.8, color: P.accent });
          fit(label, box.w*0.28);
        } else {
          const sw = w*0.66, sh = h*0.077, sx = x+w*0.17, sy = rowY-sh*0.5;
          const stamp = R.svg("g", {transform:`rotate(${i%2 ? 2 : -2} ${x+w/2} ${rowY})`}, group);
          R.svg("rect", {x:sx, y:sy, width:sw, height:sh, fill:P.bg}, stamp);
          const border = R.shape(ctx, stamp, (G,o) => [G.rectangle(sx,sy,sw,sh,o), G.rectangle(sx+w*0.012,sy+h*0.008,sw-w*0.024,sh-h*0.016,o)], {color:P.accent,width:0.7,seed:hash+980+i});
          border.forEach(el => el.setAttribute("stroke-dashoffset", 0));
          const label = R.mono(ctx, stamp, text.toLocaleUpperCase(), {x:x+w/2,y:rowY,size:3.1,spacing:0.02,color:P.accent});
          fit(label, sw*0.88);
        }
        let at = m.at;
        if (typeof at === "string" && at.startsWith("@")) {
          const wi = K.findAnchor(ctx.words, at.slice(1), Math.max(0, ctx.beat.wordIndex));
          at = wi < 0 ? undefined : Math.max(0, ctx.words[wi].start - ctx.beat.t0);
        }
        return {group, at: typeof at === "number" && Number.isFinite(at) ? Math.max(0, at) : 0.8+i*Math.max(0, p.stagger)};
      });
      return { render(lt, b, t) {
        R.draw(outline, lt, {start:0, dur:0.5, t});
        rows.forEach((words,i) => {
          const q = K.prog(lt,0.3+i*0.13,0.65,"linear");
          words.forEach(({path,start,end}) => {
            const progress = Math.max(0, Math.min(1, (q-start)/(end-start)));
            path.setAttribute("stroke-dashoffset", 1-progress);
            path.setAttribute("opacity", progress > 0 ? 1 : 0);
          });
        });
        title.setAttribute("opacity", K.prog(lt,0.2,0.35));
        entries.forEach(({group,at}, i) => {
          const q = K.prog(lt, marker ? Math.max(at, 0.95+i*0.13) : at, 0.3);
          group.setAttribute("opacity", q);
          if (!marker) { const s = 1 + 0.16*(1-q); const cx=x+w/2, cy=rowTop+entries.findIndex(e => e.group === group)*rowGap; group.setAttribute("transform",`translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`); }
        });
        R.exitFx(g,ctx,lt,b);
      }, dispose() { g.remove(); } };
    },
  });
})();
