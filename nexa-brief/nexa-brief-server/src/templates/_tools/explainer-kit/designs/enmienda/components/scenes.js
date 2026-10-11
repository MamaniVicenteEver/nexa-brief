/* =============================================================================
   enmienda · escenas de imagen
   map (mapa de tinta mundo→país, barras que gotean, puntos, texto extendido),
   flag (bandera ondeando con texto mixto), archive (foto de archivo + lower
   third, marco de película, barrotes), cutout (figuras que se revelan desde una
   silueta blanca), tapes (nombres en cinta negra → muro de ladrillos), wall
   (muro con placa; se abre), inmates (fila de siluetas rayadas → placa con cifra),
   bars (barrotes que barren + celda), graph (gráfico de línea con cámara),
   pictogram (infografía de figuras), collage (constelación + cifra).
   ========================================================================== */
(function () {
  const K = Kit, E = Kit.enm, { clamp, lerp, prog, ease } = K;
  const deg = d => d * Math.PI / 180;
  const lines = s => String(s ?? "").split("\n").map(x => x.trim()).filter(Boolean);
  const PAPER = "#cfc9bd";

  /* ================================================================= map */
  function ne(lon, lat) {                         /* proyección Natural Earth I */
    const l = lat * Math.PI / 180, l2 = l * l, l4 = l2 * l2;
    return [lon * Math.PI / 180 * (0.8707 - 0.131979 * l2 + l4 * (-0.013791 + l4 * (0.003971 * l2 - 0.001529 * l4))), -l * (1.007226 + l2 * (0.015085 + l4 * (-0.044475 + 0.028874 * l2 - 0.005916 * l4)))];
  }
  function bbox(rings, P) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; rings.forEach(r => { for (let i = 0; i < r.length; i += 2) { const [x, y] = P(r[i], r[i + 1]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }); return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; }
  function fitP(P, bb, box) { const s = Math.min(box.w / bb.w, box.h / bb.h), ox = box.x + (box.w - bb.w * s) / 2 - bb.x0 * s, oy = box.y + (box.h - bb.h * s) / 2 - bb.y0 * s; return (lo, la) => { const [x, y] = P(lo, la); return [ox + x * s, oy + y * s]; }; }
  function pathOf(rings, P) {
    const p = new Path2D();
    rings.forEach(r => {
      /* anillos que cruzan el antimeridiano (Rusia, Fiyi): se "desenrollan" sumando 360° */
      let off = 0, prev = r[0];
      for (let i = 0; i < r.length; i += 2) {
        if (i) { const d = r[i] - prev; if (d < -180) off += 360; else if (d > 180) off -= 360; }
        prev = r[i]; const [x, y] = P(r[i] + off, r[i + 1]); i ? p.lineTo(x, y) : p.moveTo(x, y);
      }
      p.closePath();
    });
    return p;
  }

  K.register({
    name: "enmienda.map", tags: ["mapa", "país", "lugar", "apertura", "geografía"], layer: "main", post: 0.6,
    summary: "Mapa de tinta sobre negro (siluetas de papel gastado): el mundo aparece parpadeando con un país resaltado; un barrido de vetas disuelve el resto y el país viaja al centro. Opciones: barras negras que gotean (barrotes), mitad oscura del país con frontera punteada (que se funde al unirse), puntos dispersos, ciudad con rótulo en caja negra y texto extendido encima.",
    example: { from: "world", zoomAt: 2.4, label: "BERLÍN" },
    params: {
      from: { type: "enum", options: ["world", "country"], default: "world", doc: "world = empieza con el planisferio." },
      zoomAt: { type: "number", default: 2.4, doc: "Segundo en que el mundo se disuelve y el país viaja al centro." },
      country: { type: "enum", options: ["DE"], default: "DE", doc: "País (geometría incluida en assets/geo.js)." },
      label: { type: "string", default: "", doc: "Ciudad con rótulo (clave de ENM_GEO.cities, p. ej. 'BERLÍN')." },
      labelAt: { type: "number", default: 0.6, doc: "Segundo del rótulo (después del viaje)." },
      bars: { type: "number", default: -1, doc: "Segundo en que gotean las barras negras (-1 = no)." },
      split: { type: "bool", default: false, doc: "Oscurece el Este con frontera punteada." },
      mergeAt: { type: "number", default: -1, doc: "Segundo en que el Este se aclara y la frontera se borra (-1 = no)." },
      dots: { type: "number", default: 0, doc: "Cantidad de puntos dispersos sobre el país." },
      text: { type: "string", default: "", doc: "Texto extendido encima ('\\n' renglones)." },
      textAt: { type: "number", default: 0.5, doc: "Segundo del texto." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, GEO = window.ENM_GEO, r = ctx.rng;
      if (!GEO) { console.warn("[enmienda] falta assets/geo.js"); return { render() {} }; }
      const worldBox = portrait ? { x: W * 0.03, y: H * 0.32, w: W * 0.94, h: H * 0.3 } : { x: W * 0.13, y: H * 0.12, w: W * 0.74, h: H * 0.7 };
      const cBox = portrait ? { x: W * 0.08, y: H * 0.2, w: W * 0.84, h: H * 0.5 } : { x: W * 0.3, y: H * 0.13, w: W * 0.4, h: H * 0.7 };
      const PW = fitP(ne, bbox(GEO.world, ne), worldBox);
      const crs = GEO[p.country], hl = GEO.highlight[p.country], lat0 = 51;
      const eq = (lo, la) => [lo * Math.cos(lat0 * Math.PI / 180), -la];
      const PC = fitP(eq, bbox(crs, eq), cBox);
      const worldPath = pathOf(GEO.world, PW), hlPath = pathOf(hl, PW);
      /* capa del mundo cacheada (gris de papel) */
      const WL = E.mk(W, H, 1.5), g = WL.g;
      g.save(); g.clip(worldPath); g.fillStyle = "#5d5a56"; g.fillRect(0, 0, W, H); g.globalAlpha = 0.5; g.drawImage(E.paper(21, 1024, 640, 150), 0, 0, W, H); g.restore();
      g.save(); g.clip(hlPath); g.fillStyle = PAPER; g.fillRect(0, 0, W, H); g.restore();
      const D = E.dissolver(311, 200, 112, { aniso: 7, angle: -0.6, cell: 4, soft: 0.12 });
      const border = GEO.DE_border, near = GEO.near || {};
      const tex = E.paper(23, 1024, 640, 212);
      const dotPts = []; if (p.dots) { const pp = pathOf(crs, PC), M = E.mk(4, 4).g; let guard = 0; while (dotPts.length < p.dots && guard++ < p.dots * 40) { const x = cBox.x + r() * cBox.w, y = cBox.y + r() * cBox.h; if (M.isPointInPath(pp, x, y)) dotPts.push([x, y, r()]); } }
      const barsN = portrait ? 20 : 26, barSeeds = Array.from({ length: barsN }, () => [r() * 0.9, 0.85 + r() * 0.3]);
      const city = p.label && GEO.cities[p.label];
      return {
        render(lt, b) {
          const G = ctx.g.main, oq = E.outQ(lt, b, 0.6);
          const zq = p.from === "world" ? prog(lt, p.zoomAt, 1.2, "inOut") : 1, t2 = p.from === "world" ? lt - p.zoomAt - 1.2 : lt;
          let fade = p.from === "world" ? prog(lt, 0, 1.9, "linear") : prog(lt, 0, 0.35);
          if (fade < 1) fade *= 0.8 + 0.2 * K.rng(Math.floor(lt * 24))();
          G.save(); G.globalAlpha = fade * (1 - oq);
          E.camera(G, ctx.stage, lt, { push: 0.008, drift: 0.2 });
          /* el resto del mundo se disuelve en vetas diagonales */
          if (zq < 1) {
            if (zq <= 0) G.drawImage(WL.c, 0, 0, W, H);
            else E.masked(G, WL.c, D.at(1 - zq), 0, 0, W, H);
          }
          if (zq > 0) {
            const P = (lo, la) => { const a = PW(lo, la), c = PC(lo, la); return [lerp(a[0], c[0], ease.inOut(zq)), lerp(a[1], c[1], ease.inOut(zq))]; };
            /* vecinos tenues (contexto) */
            
            const cp = pathOf(zq < 1 ? hl : crs, P);
            G.save(); G.clip(cp); G.fillStyle = PAPER; G.fillRect(0, 0, W, H); G.globalAlpha *= 0.55; G.drawImage(tex, 0, 0, W, H);
            G.globalAlpha = 1;
            /* Este oscurecido + frontera punteada */
            if (p.split && zq >= 1) {
              const mq = p.mergeAt >= 0 ? prog(lt, p.mergeAt, 0.9, "inOut") : 0;
              const ep = new Path2D(); for (let i = 0; i < border.length; i += 2) { const [x, y] = P(border[i], border[i + 1]); i ? ep.lineTo(x, y) : ep.moveTo(x, y); }
              [[16, 50.2], [16, 55.5], [10.9, 55.5]].forEach(([lo, la]) => { const [x, y] = P(lo, la); ep.lineTo(x, y); }); ep.closePath();
              G.save(); G.clip(ep); G.fillStyle = `rgba(20,19,18,${0.62 * (1 - mq) * clamp(t2 / 0.4)})`; G.fillRect(0, 0, W, H); G.restore();
              G.save(); G.setLineDash([ctx.stage.u * 0.6, ctx.stage.u * 0.45]); G.strokeStyle = `rgba(30,28,26,${0.9 * (1 - mq)})`; G.lineWidth = Math.max(1, ctx.stage.u * 0.22); G.beginPath();
              for (let i = 0; i < border.length; i += 2) { const [x, y] = P(border[i], border[i + 1]); i ? G.lineTo(x, y) : G.moveTo(x, y); } G.stroke(); G.restore();
            }
            /* barras que gotean (el país se vuelve barrotes) */
            if (p.bars >= 0 && lt > p.bars) {
              const bb = { x: cBox.x, y: cBox.y, w: cBox.w, h: cBox.h }, sp = bb.w / barsN;
              G.fillStyle = "#000";
              barSeeds.forEach(([d, len], i) => { const q = prog(lt, p.bars + d * 0.9, 0.7, "in"); if (q > 0) G.fillRect(bb.x + i * sp + sp * 0.28, bb.y - 2, sp * 0.44, bb.h * len * q + 2); });
            }
            G.restore();
            /* puntos dispersos */
            dotPts.forEach(([x, y, d], i) => { const q = prog(t2, d * 1.4, 0.15); if (q <= 0) return; G.fillStyle = `rgba(28,26,24,${0.75 * q})`; G.beginPath(); G.arc(x, y, ctx.stage.u * 0.32, 0, 7); G.fill(); });
            /* ciudad con rótulo en caja negra (se tipea) */
            if (city && zq >= 1) {
              const lq = prog(t2, p.labelAt, 0.5, "linear");
              if (lq > 0) {
                const [x, y] = P(city[0], city[1]), u = ctx.stage.u, fs = u * (portrait ? 2.4 : 1.9);
                G.fillStyle = "#f0ede8"; G.strokeStyle = "#111"; G.lineWidth = u * 0.15; G.beginPath(); G.arc(x, y, u * 0.55, 0, 7); G.fill(); G.stroke();
                const txt = p.label.slice(0, Math.ceil(p.label.length * lq)); G.font = E.font("wide", fs, 800); const tw = G.measureText(txt).width;
                const bx = x + u * 1.2, by = y - u * 5.2;
                G.strokeStyle = "#111"; G.beginPath(); G.moveTo(x, y); G.lineTo(x, by + fs * 0.6); G.lineTo(bx, by + fs * 0.6); G.stroke();
                G.fillStyle = "#121212"; G.fillRect(bx, by - fs * 0.35, tw + fs * 0.8, fs * 1.45);
                G.fillStyle = "#efece6"; G.fillText(txt, bx + fs * 0.4, by + fs * 0.75);
              }
            }
          }
          /* texto extendido encima (golpe seco por renglón) */
          if (p.text) {
            const Ls = lines(p.text), fs = Math.min(E.fit(Ls.reduce((a, s) => s.length > a.length ? s : a, ""), "wide", W * (portrait ? 0.88 : 0.5), H * 0.12, 800), H * 0.12);
            G.save(); G.textAlign = "center"; G.font = E.font("wide", fs, 800); G.fillStyle = "#f3f1ed"; G.shadowColor = "rgba(0,0,0,.6)"; G.shadowBlur = fs * 0.3;
            Ls.forEach((s, i) => { if (t2 >= p.textAt + i * 0.3) G.fillText(s.toUpperCase(), W / 2, H * 0.5 + (i - (Ls.length - 1) / 2) * fs * 0.92 + fs * 0.36); });
            G.restore();
          }
          G.restore();
        },
      };
    },
  });

  /* ================================================================= title */
  K.register({
    name: "enmienda.title", tags: ["apertura", "título", "mapa"], layer: "main", post: 0.6,
    summary: "Apertura en frío del documental: planisferio de tinta que aparece parpadeando con el país resaltado, barrido de vetas que deja solo el país en el centro y barras negras que gotean sobre él (barrotes). Rótulo chico extendido arriba y título opcional encima.",
    example: { kicker: "BERLÍN · 9 NOV 1989", zoomAt: 1.9, bars: 3.3 },
    params: {
      text: { type: "string", default: "", doc: "Título encima (extendida; vacío = sin título, como la referencia)." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba." },
      country: { type: "enum", options: ["DE"], default: "DE", doc: "País resaltado." },
      zoomAt: { type: "number", default: 1.9, doc: "Segundo del barrido mundo → país." },
      bars: { type: "number", default: 3.3, doc: "Segundo en que gotean los barrotes (-1 = no)." },
      textAt: { type: "number", default: 0.4, doc: "Segundo del título (después del viaje)." },
    },
    create(ctx, p) {
      const map = K.registry.get("enmienda.map").create(ctx, { ...K.resolveParams(K.registry.get("enmienda.map"), {}, ctx.C), from: "world", zoomAt: p.zoomAt, bars: p.bars, country: p.country, text: p.text, textAt: p.textAt });
      const { W, H } = ctx.stage;
      return {
        render(lt, b, t) {
          map.render(lt, b, t);
          if (!p.kicker) return;
          const G = ctx.g.main, u = ctx.stage.u, a = prog(lt, 0.3, 0.6, "linear") * (1 - E.outQ(lt, b, 0.6));
          G.save(); G.globalAlpha = a; G.fillStyle = "#e9e6e0"; G.font = E.font("wide", u * 1.6, 800); G.letterSpacing = u * 0.2 + "px"; G.textAlign = "center";
          G.fillText(p.kicker.toUpperCase(), W / 2, H * 0.1); G.fillStyle = "rgba(233,230,224,.5)"; G.fillRect(W / 2 - u * 3, H * 0.1 + u * 1.4, u * 6, Math.max(1, u * 0.12)); G.restore();
        },
      };
    },
  });

  /* ================================================================= flag */
  K.register({
    name: "enmienda.flag", tags: ["bandera", "nación", "título"], layer: "main", post: 0.7,
    summary: "Bandera de tela ondeando en blanco y negro (la cámara se aleja desde un primer plano girado) con texto de tamaños mezclados encima: palabras chicas condensadas a los lados y una palabra ENORME extendida al medio (como 'TO ALL AMERICANS').",
    example: { bands: "de", text: "EL ^MURO^ MÁS FAMOSO" },
    params: {
      bands: { type: "enum", options: ["de", "stripes"], default: "de", doc: "de = tres franjas horizontales; stripes = rayas con cantón de estrellas." },
      text: { type: "string", default: "", doc: "Texto; '^PALABRA^' es la grande del medio." },
      textAt: { type: "number", default: 1.1, doc: "Segundo del texto." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, FW = portrait ? W * 0.9 : W * 0.62, FH = FW * 0.6;
      const F = E.mk(FW, FH, 1.5), g = F.g;
      if (p.bands === "de") { ["#151413", "#5b5854", "#bdb7ac"].forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * FH / 3, FW, FH / 3 + 1); }); }
      else {
        for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? "#cfc9be" : "#2a2826"; g.fillRect(0, i * FH / 13, FW, FH / 13 + 1); }
        g.fillStyle = "#1a1918"; g.fillRect(0, 0, FW * 0.4, FH * 7 / 13); g.fillStyle = "#d8d2c6";
        for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) { const x = FW * 0.4 * (i + 0.5 + (j % 2) * 0.25) / 6.3, y = FH * 7 / 13 * (j + 0.5) / 5; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? FH * 0.012 : FH * 0.03; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }
      }
      g.globalCompositeOperation = "multiply"; g.globalAlpha = 0.5; E.pattern(g, E.fibers(41), 0, 0, FW, FH); g.globalCompositeOperation = "source-over"; g.globalAlpha = 0.22; E.pattern(g, E.grunge(43), 0, 0, FW, FH, 0.5); g.globalAlpha = 1;
      const m = String(p.text).match(/^(.*?)\^(.+?)\^(.*)$/), left = m ? m[1].trim() : "", big = m ? m[2].trim() : String(p.text).trim(), right = m ? m[3].trim() : "";
      let bigFs = E.fit(big, "wide", FW * (portrait ? 0.7 : 0.48), FH * 0.55, 800);
      /* que el renglón entero (chica + GRANDE + chica) quepa en el cuadro */
      const tot = E.measure(big.toUpperCase(), "wide", bigFs, 800) + E.measure((left + right).toUpperCase(), "grot", bigFs * 0.42, 600) + bigFs * 0.4;
      if (tot > W * 0.92) bigFs *= W * 0.92 / tot;
      const BL = E.inkText(big.toUpperCase(), { kind: "wide", px: bigFs, color: "#ebe7df", wear: 0.55, seed: 51 });
      const sFs = bigFs * 0.42, SL = left ? E.inkText(left.toUpperCase(), { kind: "grot", px: sFs, weight: 600, color: "#e2ddd4", wear: 0.5, seed: 52 }) : null;
      const SR = right ? E.inkText(right.toUpperCase(), { kind: "grot", px: sFs, weight: 600, color: "#e2ddd4", wear: 0.5, seed: 53 }) : null;
      return {
        render(lt, b) {
          const G = ctx.g.main, oq = E.outQ(lt, b, 0.7), q = prog(lt, 0, 1.3, "inOut");
          G.save(); G.globalAlpha = (1 - oq * 0.9) * prog(lt, 0.25, 0.5, "linear");
          E.camera(G, ctx.stage, lt, { push: 0.01, zoom: lerp(3.2, 1, q) * (1 + oq * 1.8), rot: deg(lerp(-24, -1.5, q)), drift: 0.3, cx: W / 2, cy: H * 0.48 });
          const x0 = W / 2 - FW / 2, y0 = H * 0.46 - FH / 2, sw = 3;
          for (let x = 0; x < FW; x += sw) {
            const k = x / FW, ph = k * Math.PI * 2 * 1.4 - lt * 2.3, dy = Math.sin(ph) * FH * 0.035 * (k + 0.15);
            G.drawImage(F.c, x * F.dpr, 0, sw * F.dpr, F.c.height, x0 + x, y0 + dy, sw + 0.6, FH);
            const sh = Math.cos(ph) * 0.22 * (k + 0.35);
            G.fillStyle = sh > 0 ? `rgba(255,255,255,${sh * 0.35})` : `rgba(0,0,0,${-sh})`; G.fillRect(x0 + x, y0 + dy, sw + 0.6, FH);
          }
          if (p.text) {
            const tq = prog(lt, p.textAt, 0.35, "expoOut"), tq2 = prog(lt, p.textAt + 0.12, 0.35, "expoOut");
            const total = BL.w + (SL ? SL.w : 0) + (SR ? SR.w : 0), bx = W / 2 - total / 2 + (SL ? SL.w : 0), by = y0 + FH * 0.62;
            G.save(); G.shadowColor = "rgba(0,0,0,.55)"; G.shadowBlur = bigFs * 0.2;
            if (tq > 0) { G.globalAlpha = tq; if (tq < 1) G.filter = `blur(${((1 - tq) * 8).toFixed(1)}px)`; G.drawImage(BL.c, bx + (1 - tq) * W * 0.04, by - BL.base, BL.w, BL.h); G.filter = "none"; }
            if (SL && tq > 0) { G.globalAlpha = tq; G.drawImage(SL.c, bx - SL.w - sFs * 0.1, by - SL.base, SL.w, SL.h); }
            if (SR && tq2 > 0) { G.globalAlpha = tq2; G.drawImage(SR.c, bx + BL.w + sFs * 0.05, by - SR.base - bigFs * 0.06, SR.w, SR.h); }
            G.restore();
          }
          G.restore();
        },
      };
    },
  });

  /* ================================================================= archive */
  K.register({
    name: "enmienda.archive", tags: ["foto", "archivo", "persona", "lugar", "entrevista"], layer: "main", post: 0.25,
    summary: "Foto de archivo en blanco y negro contrastado a pantalla completa (o dentro de un marco de película proyectada), empuje lento de cámara, lower-third de entrevista (NOMBRE / cargo / institución en Barlow Condensed) y, opcional, barrotes desenfocados en primer plano que entran de golpe.",
    example: { src: "assets/media/schabowski.jpg", name: "Günter Schabowski", role: "Vocero del partido", org: "SED · RDA" },
    params: {
      src: { type: "image", required: true, doc: "Foto." },
      focus: { type: "array", default: [0.5, 0.45], doc: "Punto de interés [x,y] 0..1 para el encuadre." },
      zoom: { type: "number", default: 1.04, doc: "Zoom inicial (≥1)." },
      push: { type: "number", default: 0.02, doc: "Empuje por segundo." },
      frame: { type: "enum", options: ["full", "film"], default: "full", doc: "film = cuadro de película con esquinas redondeadas sobre negro." },
      in: { type: "enum", options: ["cut", "fade"], default: "cut", doc: "fade = sube desde negro." },
      name: { type: "string", default: "", doc: "Lower-third: nombre." },
      role: { type: "string", default: "", doc: "Lower-third: cargo (gris)." },
      org: { type: "string", default: "", doc: "Lower-third: institución / lugar." },
      bars: { type: "number", default: -1, doc: "Segundo en que entran barrotes desenfocados (-1 = no)." },
    },
    create(ctx, p) {
      const { W, H } = ctx.stage, ph = E.photo(ctx.img(p.src), "bw");
      return {
        render(lt, b) {
          const G = ctx.g.main;
          if (lt > b.dur + 0.04) return;
          G.save(); G.fillStyle = "#000"; G.fillRect(0, 0, W, H);
          G.globalAlpha = p.in === "fade" ? prog(lt, 0, 0.5, "linear") : 1;
          const z = p.zoom + p.push * lt;
          if (ph) {
            if (p.frame === "film") {
              const [jx, jy] = E.boil(3, lt, ctx.stage.u * 0.15, 24), fw = W * 0.86, fh = H * 0.84, x = (W - fw) / 2 + jx, y = (H - fh) / 2 + jy;
              G.save(); G.beginPath(); G.roundRect(x, y, fw, fh, Math.min(fw, fh) * 0.05); G.clip(); E.cover(G, ph, x, y, fw, fh, p.focus, z); G.restore();
              G.save(); G.globalAlpha *= 0.5; E.vignette(G, W, H, 0.7, 0.3); G.restore();
            } else E.cover(G, ph, 0, 0, W, H, p.focus, z);
          }
          if (p.bars >= 0 && lt >= p.bars) {
            const bt = lt - p.bars; G.save(); G.filter = `blur(${(ctx.stage.u * 0.9).toFixed(1)}px)`; G.fillStyle = "#4a4743";
            for (let i = -1; i < 7; i++) { const x = W * (0.05 + i * 0.16) + bt * W * 0.012; G.fillRect(x, -10, W * 0.022, H + 20); G.fillStyle = "rgba(160,155,148,.5)"; G.fillRect(x, -10, W * 0.005, H + 20); G.fillStyle = "#4a4743"; }
            [0.3, 0.62].forEach(y => G.fillRect(-10, H * y, W + 20, H * 0.022));
            G.restore();
          }
          E.vignette(G, W, H, 0.45, 0.45);
          G.restore();
          E.lowerThird(G, ctx.stage, lt, b, { name: p.name, role: p.role, org: p.org, at: 0.45 });
        },
      };
    },
  });

  /* ================================================================= cutout */
  K.register({
    name: "enmienda.cutout", tags: ["personas", "fotos", "revelado", "grupo"], layer: "main", post: 0.3,
    summary: "Figuras recortadas de fotos de archivo que aparecen una a una sobre negro: primero una silueta blanca sobreexpuesta con brillo y después se 'revela' la foto (como los presos de 1900 que se van sumando).",
    example: { src1: "assets/media/muro-gente.jpg", src2: "assets/media/mauerspecht.jpg", src3: "assets/media/leipzig.jpg" },
    params: {
      src1: { type: "image", required: true, doc: "Foto 1." }, src2: { type: "image", default: "", doc: "Foto 2." },
      src3: { type: "image", default: "", doc: "Foto 3." }, src4: { type: "image", default: "", doc: "Foto 4." },
      stagger: { type: "number", default: 0.45, doc: "Segundos entre figura y figura." },
      name: { type: "string", default: "", doc: "Lower-third opcional: nombre." },
      role: { type: "string", default: "", doc: "Lower-third: cargo." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, r = ctx.rng;
      const srcs = [p.src1, p.src2, p.src3, p.src4].filter(Boolean);
      const n = Math.max(3, srcs.length + 1), order = [1, 0, 2, 3, 4].slice(0, n);
      const figs = order.map((slot, i) => {
        const im = ctx.img(srcs[i % srcs.length]), w = portrait ? W * 0.42 : W * 0.19, h = H * (portrait ? 0.46 : 0.66);
        const cx = portrait ? W * (0.3 + (slot % 2) * 0.4) : W * (0.5 + (slot - (n - 1) / 2) * 0.17), cy = portrait ? H * (0.32 + Math.floor(slot / 2) * 0.3) : H * 0.55;
        const C = E.mk(w, h, 1.5), g = C.g, ph = E.photo(im, "bw");
        if (ph) E.cover(g, ph, 0, 0, w, h, [0.15 + r() * 0.7, 0.4], 1.6 + r() * 0.6);
        /* máscara de figura: elipse alta con bordes suaves */
        g.globalCompositeOperation = "destination-in";
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, 0.5); gr.addColorStop(0, "#000"); gr.addColorStop(0.55, "#000"); gr.addColorStop(1, "rgba(0,0,0,0)");
        g.save(); g.translate(w / 2, h * 0.5); g.scale(w, h); g.fillStyle = gr; g.fillRect(-0.5, -0.5, 1, 1); g.restore();
        const S = E.mk(w, h, 1), s = S.g; s.drawImage(C.c, 0, 0, w, h); s.globalCompositeOperation = "source-in"; s.fillStyle = "#f2efe9"; s.fillRect(0, 0, w, h);
        return { C: C.c, S: S.c, w, h, cx, cy, t: 0.15 + i * p.stagger };
      });
      return {
        render(lt, b) {
          const G = ctx.g.main;
          if (lt > b.dur + 0.04) return;
          G.save(); G.fillStyle = "#000"; G.fillRect(0, 0, W, H);
          E.spot(G, W / 2, H * 0.55, W * 0.45, H * 0.45, 0.07);
          E.camera(G, ctx.stage, lt, { push: 0.012, drift: 0.3 });
          figs.forEach(f => {
            const a = prog(lt, f.t, 0.3, "linear"), dev = prog(lt, f.t + 0.3, 0.55, "inOut");
            if (a <= 0) return;
            const x = f.cx - f.w / 2, y = f.cy - f.h / 2;
            G.save(); G.globalAlpha = a * (1 - dev); G.shadowColor = "rgba(255,255,255,.5)"; G.shadowBlur = f.w * 0.08; G.drawImage(f.S, x, y, f.w, f.h); G.restore();
            if (dev > 0) { G.save(); G.globalAlpha = dev; G.drawImage(f.C, x, y, f.w, f.h); G.restore(); }
          });
          G.restore();
          E.lowerThird(G, ctx.stage, lt, b, { name: p.name, role: p.role, at: 1.0 });
        },
      };
    },
  });

  /* ================================================================= tapes */
  function brickWall(seed, w, h, bh) {
    return E.memo(`brick${seed}:${w | 0}:${h | 0}:${bh | 0}`, () => {
      const T = E.mk(w, h, 1), g = T.g, r = K.rng(seed), bw = bh * 3.1;
      g.fillStyle = "#2a2826"; g.fillRect(0, 0, w, h);
      for (let y = 0, row = 0; y < h; y += bh, row++) for (let x = (row % 2) * -bw / 2; x < w; x += bw) {
        const v = 150 + r() * 70 | 0; g.fillStyle = `rgb(${v},${v - 2},${v - 5})`; g.fillRect(x + bh * 0.08, y + bh * 0.08, bw - bh * 0.16, bh - bh * 0.16);
      }
      g.globalAlpha = 0.45; g.drawImage(E.grunge(61, 512), 0, 0, w, h); g.globalAlpha = 1;
      return T.c;
    });
  }
  K.register({
    name: "enmienda.tapes", tags: ["lista", "nombres", "memoria", "cinta", "muro"], layer: "main", post: 0.3,
    summary: "Pared de tiras de cinta negra con textos manuscritos en blanco (nombre / fecha / lugar), bajo un foco que se enciende y deriva; opcionalmente la cámara se aleja y las tiras se vuelven los ladrillos de un muro con una placa en el centro.",
    example: { items: ["MADRE\nBERLÍN ESTE\nSEPARADA", "HERMANO\nBERLÍN OESTE\nSEPARADO"], toWall: 3, plaque: "UNA CALLE\nDOS MUNDOS" },
    params: {
      items: { type: "array", required: true, doc: "Textos de cada tira ('\\n' = renglón, hasta 3)." },
      toWall: { type: "number", default: -1, doc: "Segundo en que se aleja y se vuelve muro de ladrillos (-1 = no)." },
      plaque: { type: "string", default: "", doc: "Placa del muro ('\\n' renglones)." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, r = ctx.rng, AW = W * 1.4, AH = H * 1.4;
      const T = E.mk(AW, AH, 1.5), g = T.g, fs = portrait ? W * 0.034 : H * 0.032, th = fs * 4.4, rowH = th * 1.42;
      g.fillStyle = "#cfcecb"; g.fillRect(0, 0, AW, AH); g.globalAlpha = 0.4; g.drawImage(E.paper(71, 1024, 640, 200), 0, 0, AW, AH); g.globalAlpha = 1;
      let k = 0;
      for (let y = th * 0.2, row = 0; y < AH; y += rowH, row++) {
        for (let x = -r() * W * 0.15; x < AW;) {
          const t = String(p.items[k++ % p.items.length]).toUpperCase().split("\n");
          g.font = E.font("hand", fs); const tw = Math.max(...t.map(s => g.measureText(s).width)), w = tw + fs * (4 + r() * 4);
          E.tape(g, x + w / 2, y + th / 2, w, th, (r() - 0.5) * 0.02, r() * 1e5 | 0);
          g.fillStyle = "#e9e5dd"; t.forEach((s, i) => g.fillText(s, x + fs * (1.5 + r()), y + th * 0.33 + i * fs * 1.15));
          x += w + fs * (1 + r() * 3);
        }
      }
      return {
        render(lt, b) {
          const G = ctx.g.main;
          if (lt > b.dur + 0.04) return;
          const wq = p.toWall >= 0 ? prog(lt, p.toWall, 0.8, "inOut") : 0;
          G.save(); G.fillStyle = "#000"; G.fillRect(0, 0, W, H);
          G.save();
          E.camera(G, ctx.stage, lt, { push: 0.01, rot: deg(-2.5 + lt * 0.3), zoom: lerp(1, 0.28, wq), drift: 0.4 });
          if (wq < 1) { G.globalAlpha = 1 - clamp(wq * 1.6 - 0.5); G.drawImage(T.c, W / 2 - AW / 2, H / 2 - AH / 2, AW, AH); }
          if (wq > 0) { const bw = brickWall(73, W * 3.6, H * 3.6, H * 0.075); G.globalAlpha = clamp(wq * 1.8 - 0.4); G.drawImage(bw, W / 2 - W * 1.8, H / 2 - H * 1.8, W * 3.6, H * 3.6); }
          G.restore();
          /* foco que se enciende y deriva */
          const on = prog(lt, 0, 0.7, "linear"), sx = W * (0.48 + Math.sin(lt * 0.4) * 0.06), sy = H * (0.5 + Math.cos(lt * 0.3) * 0.05);
          const R = Math.hypot(W, H) * lerp(0.42, 0.55, wq), gr = G.createRadialGradient(sx, sy, R * 0.15, sx, sy, R);
          gr.addColorStop(0, `rgba(0,0,0,${1 - on})`); gr.addColorStop(1, `rgba(0,0,0,${lerp(0.9, 0.75, wq)})`); G.fillStyle = gr; G.fillRect(0, 0, W, H);
          if (wq > 0.6 && p.plaque) {
            const pq = prog(lt, p.toWall + 0.9, 0.3, "linear"), Ls = lines(p.plaque), pf = H * 0.022, pw = W * (portrait ? 0.4 : 0.15), ph = pf * (Ls.length * 1.3 + 1);
            G.globalAlpha = pq; G.fillStyle = "#0b0b0b"; G.fillRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph); G.strokeStyle = "#7a7671"; G.lineWidth = 1; G.strokeRect(W / 2 - pw / 2 + 3, H / 2 - ph / 2 + 3, pw - 6, ph - 6);
            G.fillStyle = "#eeebe5"; G.font = E.font("wide", pf, 800); G.textAlign = "center"; Ls.forEach((s, i) => G.fillText(s.toUpperCase(), W / 2, H / 2 + (i - (Ls.length - 1) / 2) * pf * 1.3 + pf * 0.36));
          }
          G.restore();
        },
      };
    },
  });

  /* ================================================================= wall */
  K.register({
    name: "enmienda.wall", tags: ["muro", "placa", "barrera", "apertura"], layer: "main", post: 0.3,
    summary: "Muro de ladrillos gris bajo un foco, con una placa negra chica en el centro; puede ABRIRSE: los ladrillos del centro caen uno a uno (stop-motion) dejando pasar una luz blanca.",
    example: { plaque: "23:30\nLA DECISIÓN", openAt: 2 },
    params: {
      plaque: { type: "string", default: "", doc: "Texto de la placa ('\\n' renglones)." },
      openAt: { type: "number", default: -1, doc: "Segundo (o '@palabra') en que empiezan a caer ladrillos (-1 = no)." },
      openSec: { type: "number", default: 2.4, doc: "Segundos que tarda en abrirse el hueco." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, bh = ctx.stage.u * 7.5, bw = bh * 3.1, WW = W * 1.2, WH = H * 1.2;
      const wall = brickWall(81, WW, WH, bh), r = ctx.rng, holes = [];
      for (let y = 0, row = 0; y < WH; y += bh, row++) for (let x = (row % 2) * -bw / 2; x < WW; x += bw) {
        const cx = x + bw / 2 - WW / 2, cy = y + bh / 2 - WH / 2, d = Math.hypot(cx / (portrait ? 0.7 : 1.4), cy);
        if (d < H * 0.3) holes.push({ x, y, d, k: d / (H * 0.3) * 0.75 + r() * 0.25, rot: (r() - 0.5) * 2 });
      }
      holes.sort((a, b) => a.k - b.k);
      return {
        render(lt, b) {
          const G = ctx.g.main;
          if (lt > b.dur + 0.04) return;
          G.save(); G.fillStyle = "#000"; G.fillRect(0, 0, W, H);
          E.camera(G, ctx.stage, lt, { push: 0.012, drift: 0.2 });
          const ox = W / 2 - WW / 2, oy = H / 2 - WH / 2;
          G.drawImage(wall, ox, oy, WW, WH);
          if (p.openAt >= 0 && lt >= p.openAt) {
            const st = E.stop(lt - p.openAt, 10);
            holes.forEach(h => {
              const t0 = h.k * p.openSec; if (st < t0) return;
              const ft = lt - p.openAt - t0;
              G.fillStyle = "#f4f1ea"; G.fillRect(ox + h.x, oy + h.y, bw, bh);
              if (ft < 0.7) { G.save(); G.translate(ox + h.x + bw / 2, oy + h.y + bh / 2 + 9.8 * ft * ft * H * 0.15); G.rotate(h.rot * ft); G.globalAlpha = 1 - ft / 0.7; G.drawImage(wall, (h.x) * (wall.width / WW), h.y * (wall.height / WH), bw * (wall.width / WW), bh * (wall.height / WH), -bw / 2, -bh / 2, bw, bh); G.restore(); }
            });
            const o = prog(lt, p.openAt + 0.3, p.openSec, "linear"); E.spot(G, W / 2, H / 2, W * 0.4, H * 0.35, 0.5 * o, "255,252,245");
          }
          G.restore();
          const R = Math.hypot(W, H) * 0.5, gr = G.createRadialGradient(W / 2, H / 2, R * 0.12, W / 2, H / 2, R);
          gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.88)"); G.fillStyle = gr; G.fillRect(0, 0, W, H);
          if (p.plaque) {
            const Ls = lines(p.plaque), pf = H * 0.024, pw = Math.max(...Ls.map(s => E.measure(s.toUpperCase(), "wide", pf, 800))) + pf * 2, ph = pf * (Ls.length * 1.3 + 1);
            const a = prog(lt, 0.4, 0.3, "linear") * (p.openAt >= 0 ? 1 - prog(lt, p.openAt, 0.3) : 1);
            G.save(); G.globalAlpha = a; G.fillStyle = "#0b0b0b"; G.fillRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph); G.strokeStyle = "#8a857f"; G.strokeRect(W / 2 - pw / 2 + 3, H / 2 - ph / 2 + 3, pw - 6, ph - 6);
            G.fillStyle = "#eeebe5"; G.font = E.font("wide", pf, 800); G.textAlign = "center"; Ls.forEach((s, i) => G.fillText(s.toUpperCase(), W / 2, H / 2 + (i - (Ls.length - 1) / 2) * pf * 1.3 + pf * 0.36)); G.restore();
          }
        },
      };
    },
  });

  /* ================================================================= inmates */
  function stripes(G, path, x, y, w, h, n, dark = "#0c0c0c", light = "#d9d5cd") {
    G.save(); G.translate(x, y); G.clip(path); G.fillStyle = dark; G.fillRect(0, 0, w, h); G.fillStyle = light;
    for (let i = 0; i < n; i++) if (i % 2) G.fillRect(0, h * (0.22 + i * 0.78 / n), w, h * 0.78 / n * 0.95);
    G.restore();
  }
  K.register({
    name: "enmienda.inmates", tags: ["cifra", "personas", "dato", "presos"], layer: "main", post: 0.3,
    summary: "Fila de siluetas con uniforme a rayas sobre pared de papel gris, desenfocadas, que la cámara recorre; un latigazo lleva a un primer plano de una figura con una placa negra en el pecho: CIFRA grande + rótulo + nota (como '878,400').",
    example: { number: "140", label: "MURIERON EN EL MURO", sub: "1961 — 1989" },
    params: {
      number: { type: "string", required: true, doc: "Cifra de la placa." },
      label: { type: "string", default: "", doc: "Rótulo bajo la cifra." },
      sub: { type: "string", default: "", doc: "Nota chica." },
      whipAt: { type: "number", default: 1.0, doc: "Segundo del latigazo al primer plano." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, bg = E.paper(91, 1024, 640, 178);
      const fh = H * 0.5, fw = fh * 0.42, P = E.person(fw, fh), bw = portrait ? W * 1.1 : W * 0.5, bhh = H * 1.15, B = E.bust(bw, bhh);
      return {
        render(lt, b) {
          const G = ctx.g.main;
          if (lt > b.dur + 0.04) return;
          G.save(); G.drawImage(bg, 0, 0, W, H);
          const wq = prog(lt, p.whipAt, 0.32, "inOut"), sm = Math.sin(wq * Math.PI) * W * 0.5;
          if (wq < 1) {
            G.save(); G.translate(-lt * W * 0.04 - wq * W * 1.2, 0); G.filter = `blur(${(3 + sm / W * 20).toFixed(1)}px)`;
            for (let i = -2; i < 14; i++) stripes(G, P, W * 0.06 + i * fw * 1.35, H * 0.45 - fh * 0.45, fw, fh, 18);
            G.restore();
          }
          if (wq > 0) {
            G.save(); G.translate((1 - wq) * W * 1.2, 0); G.translate(W / 2, H / 2); const s = 1 + Math.max(0, lt - p.whipAt) * 0.012; G.scale(s, s); G.translate(-W / 2, -H / 2);
            if (wq < 1) G.filter = `blur(${(sm / W * 18).toFixed(1)}px)`;
            [-1, 1].forEach(k => stripes(G, B, W / 2 - bw / 2 + k * bw * 1.05, H * 0.12, bw, bhh, 22));
            stripes(G, B, W / 2 - bw / 2, -H * 0.1, bw, bhh, 22);
            /* placa */
            const pw = portrait ? W * 0.78 : W * 0.34, ph = pw * 0.55, px = W / 2 - pw / 2, py = H * (portrait ? 0.5 : 0.56);
            G.fillStyle = "#121212"; G.shadowColor = "rgba(0,0,0,.4)"; G.shadowBlur = 12; G.beginPath(); G.roundRect(px, py, pw, ph, pw * 0.02); G.fill(); G.shadowColor = "transparent";
            G.globalAlpha = 0.3; E.pattern(G, E.grunge(93), px, py, pw, ph); G.globalAlpha = 1;
            G.textAlign = "center"; G.fillStyle = "#dcd8d0"; const nf = E.fit(p.number, "cond", pw * 0.7, ph * 0.5, 700);
            G.font = E.font("cond", nf, 700); G.letterSpacing = nf * 0.03 + "px"; G.fillText(p.number, W / 2, py + ph * 0.48);
            G.fillRect(px + pw * 0.12, py + ph * 0.58, pw * 0.76, Math.max(1, ph * 0.012));
            G.font = E.font("cond", ph * 0.13, 700); G.letterSpacing = ph * 0.01 + "px"; G.fillText(String(p.label).toUpperCase(), W / 2, py + ph * 0.75);
            G.font = E.font("cond", ph * 0.075, 600); G.fillStyle = "#9d9891"; G.fillText(String(p.sub).toUpperCase(), W / 2, py + ph * 0.87);
            G.restore();
          }
          G.restore();
          E.vignette(G, W, H, 0.6, 0.3);
        },
      };
    },
  });

  /* ================================================================= bars */
  K.register({
    name: "enmienda.bars", tags: ["encierro", "palabras", "barrotes", "celda"], layer: "main", post: 0.4,
    summary: "Barrotes: palabra gastada sobre negro con barras de luz desenfocadas que pasan en primer plano; la cámara se aleja y la palabra queda dentro de una celdita dibujada; las palabras siguientes llegan letra por letra desde lejos, sobre un fondo de rayas verticales tenues.",
    example: { texts: ["LARGA", "Y ABURRIDA", "UNA HORA"] },
    params: {
      texts: { type: "array", required: true, doc: "Palabras/frases en orden (la 1ª va con barrotes)." },
      at: { type: "array", default: [], doc: "Segundos de cada cambio (vacío = repartidos)." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, r = ctx.rng, n = p.texts.length;
      const fs = portrait ? W * 0.17 : H * 0.19;
      const items = p.texts.map((s, i) => { const Ls = lines(String(s).toUpperCase().replace(" ", "\n")); return Ls.map((ln, j) => ({ L: E.inkText(ln, { kind: "grot", px: fs, color: "#d6d0c5", wear: 0.85, seed: 160 + i * 3 + j }), letters: [...ln].map((ch, k) => ({ ch, dx: (r() - 0.5) * W * 0.8, dy: (r() - 0.5) * H * 0.8, s: 2 + r() * 3, d: r() * 0.35 })) })); });
      const D = items.map((_, i) => E.dissolver(170 + i, 140, 60, { streak: true }));
      const streaks = Array.from({ length: 40 }, () => [r(), 0.3 + r() * 0.7]);
      return {
        render(lt, b) {
          const G = ctx.g.main;
          if (lt > b.dur + 0.4) return;
          const ats = p.at.length ? p.at : p.texts.map((_, i) => i === 0 ? 0 : 1.6 + (i - 1) * Math.max(0.8, (b.dur - 1.6) / Math.max(1, n - 1)));
          let cur = 0; ats.forEach((a, i) => { if (lt >= a) cur = i; });
          G.save(); G.fillStyle = "#000"; G.fillRect(0, 0, W, H);
          const cq = prog(lt, 1.0, 0.5, "inOut");
          if (cq > 0) { G.save(); G.globalAlpha = 0.18 * cq; G.fillStyle = "#8d8780"; streaks.forEach(([x, a]) => { G.globalAlpha = 0.12 * cq * a; G.fillRect(x * W, 0, W * 0.006, H); }); G.restore(); }
          G.save(); E.camera(G, ctx.stage, lt, { push: 0.01, drift: 0.2 });
          items.forEach((lnArr, i) => {
            const t0 = ats[i] ?? 0, t1 = ats[i + 1] ?? b.dur + 0.4, local = lt - t0;
            if (local < 0 || lt > t1 + 0.4) return;
            const outP = 1 - prog(lt, t1, 0.35, "linear");
            const s = i === 0 ? lerp(1, 0.38, cq) : 1;
            G.save(); G.translate(W / 2, H / 2); G.scale(s, s); G.translate(-W / 2, -H / 2);
            lnArr.forEach((ln, j) => {
              const L = ln.L, x = W / 2 - L.w / 2, y = H / 2 + (j - (lnArr.length - 1) / 2) * fs * 0.95 - L.base + fs * 0.36;
              if (i === 0 || local > 0.75) { if (outP < 1) E.masked(G, L.c, D[i].at(outP), x, y, L.w, L.h); else G.drawImage(L.c, x, y, L.w, L.h); return; }
              /* letras que llegan desde lejos */
              let lx = x + fs * 0.15;
              ln.letters.forEach(l => {
                const q = prog(local, l.d, 0.4, "expoOut"), cw = E.measure(l.ch, "grot", fs, 700);
                G.save(); G.globalAlpha = clamp(q * 2); if (q < 0.95) G.filter = `blur(${((1 - q) * 8).toFixed(1)}px)`;
                G.translate(lx + cw / 2 + l.dx * (1 - q), y + L.base - fs * 0.36 + l.dy * (1 - q)); G.scale(lerp(l.s, 1, q), lerp(l.s, 1, q));
                G.font = E.font("grot", fs, 700); G.fillStyle = "#d6d0c5"; G.textAlign = "center"; G.fillText(l.ch, 0, fs * 0.36); G.restore();
                lx += cw;
              });
            });
            /* celdita dibujada alrededor de la 1ª palabra */
            if (i === 0 && cq > 0.5) {
              const w = Math.max(...lnArr.map(l => l.L.w)) * 1.15, h = fs * lnArr.length * 1.15, a = clamp(cq * 2 - 1) * outP;
              G.save(); G.globalAlpha = a; G.strokeStyle = "#d6d0c5"; G.lineWidth = fs * 0.05; G.strokeRect(W / 2 - w / 2, H / 2 - h / 2, w, h);
              for (let k = 1; k < 9; k++) { G.beginPath(); G.moveTo(W / 2 - w / 2 + k * w / 9, H / 2 - h / 2); G.lineTo(W / 2 - w / 2 + k * w / 9, H / 2 + h / 2); G.stroke(); } G.restore();
            }
            G.restore();
          });
          G.restore();
          /* barras de luz desenfocadas en primer plano (fase 1) */
          if (lt < 1.5) {
            const a = 1 - prog(lt, 1.0, 0.45, "linear"); G.save(); G.globalAlpha = a; G.filter = `blur(${(fs * 0.08).toFixed(1)}px)`;
            const bars = cq > 0.05 ? 12 : 3, bwid = cq > 0.05 ? W * 0.025 : W * 0.13;
            for (let k = 0; k < bars; k++) {
              const x = ((k / bars + lt * (cq > 0.05 ? 0.6 : 0.12)) % 1.2 - 0.1) * W * (cq > 0.05 ? 1 : 1.3) - (cq > 0.05 ? 0 : W * 0.15);
              G.fillStyle = "#c9c3b8"; G.fillRect(x, -20, bwid, H + 40); G.globalAlpha = a * 0.4; E.pattern(G, E.fibers(5), x, -20, bwid, H + 40); G.globalAlpha = a;
            }
            G.restore();
          }
          G.restore();
        },
      };
    },
  });

  /* ================================================================= graph */
  K.register({
    name: "enmienda.graph", tags: ["gráfico", "datos", "evolución", "tiempo"], layer: "main", post: 0.3,
    summary: "Gráfico de línea fino sobre negro con puntos y líneas verticales al eje: la cámara arranca pegada e inclinada sobre el primer punto, recorre la línea mientras se dibuja y se aleja; el título se estampa con parpadeo y al final la cámara se zambulle en el último punto.",
    example: { title: "SALIDAS\nHACIA EL\nOESTE", points: ["ENE", "MAR", "MAY", "JUL", "AGO", "SEP", "OCT", "NOV"], values: [0.05, 0.07, 0.1, 0.15, 0.3, 0.45, 0.6, 1] },
    params: {
      title: { type: "string", default: "", doc: "Título (3 renglones cortos)." },
      points: { type: "array", required: true, doc: "Etiquetas del eje X." },
      values: { type: "array", default: [], doc: "Valores 0..1 (vacío = crecimiento exponencial)." },
      dive: { type: "bool", default: true, doc: "Zambullida final en el último punto." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, n = p.points.length;
      const vals = p.values.length === n ? p.values : p.points.map((_, i) => Math.pow((i + 1) / n, 2.4));
      const gx0 = W * 0.06, gx1 = W * 0.94, gy = H * 0.86, gh = H * (portrait ? 0.45 : 0.62);
      const pts = vals.map((v, i) => [gx0 + (i + 0.5) / n * (gx1 - gx0), gy - v * gh]);
      return {
        render(lt, b) {
          const G = ctx.g.main;
          if (lt > b.dur + 0.04) return;
          const u = ctx.stage.u, dq = prog(lt, 0.1, Math.max(1.2, b.dur * 0.55), "inOut"), head = dq * (n - 1);
          const hi = Math.min(n - 2, Math.floor(head)), f = head - hi, hp = [lerp(pts[hi][0], pts[hi + 1][0], f), lerp(pts[hi][1], pts[hi + 1][1], f)];
          const zoom = lerp(3.4, 1, ease.inOut(clamp(dq * 1.15))), dive = p.dive ? prog(lt, b.dur - 0.6, 0.6, "in") : 0;
          const tx = lerp(hp[0], W / 2, ease.inOut(clamp(dq * 1.15))), ty = lerp(hp[1], H / 2, ease.inOut(clamp(dq * 1.15)));
          G.save(); G.fillStyle = "#070707"; G.fillRect(0, 0, W, H); G.globalAlpha = 0.6; E.pattern(G, E.grunge(201), 0, 0, W, H, 1); G.globalAlpha = 1;
          G.save();
          const last = pts[n - 1], Z = zoom * (1 + dive * 7), cx = lerp(tx, last[0], dive), cy = lerp(ty, last[1], dive);
          G.translate(W / 2, H / 2); G.rotate(deg(-12) * (1 - ease.inOut(clamp(dq * 1.3)))); G.scale(Z, Z); G.translate(-cx, -cy);
          const lw = Math.max(0.6, u * 0.11) / Math.sqrt(Z);
          G.strokeStyle = "rgba(200,194,185,.35)"; G.lineWidth = lw; G.beginPath(); G.moveTo(gx0, gy); G.lineTo(gx1, gy); G.stroke();
          G.fillStyle = "rgba(200,194,185,.35)"; G.font = E.font("cond", u * 1.0, 600);
          for (let k = 1; k <= 4; k++) { G.fillRect(gx0 - u * 0.6, gy - k * gh / 4, u * 0.8, lw); }
          G.strokeStyle = "#d5cfc5"; G.lineWidth = lw * 1.4; G.beginPath(); G.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i <= hi; i++) G.lineTo(pts[i][0], pts[i][1]); G.lineTo(hp[0], hp[1]); G.stroke();
          pts.forEach((pt, i) => {
            if (i > head + 0.01) return;
            G.strokeStyle = "rgba(213,207,197,.45)"; G.lineWidth = lw; G.beginPath(); G.moveTo(pt[0], pt[1]); G.lineTo(pt[0], gy); G.stroke();
            G.fillStyle = "#e3ded5"; G.beginPath(); G.arc(pt[0], pt[1], u * 0.42, 0, 7); G.fill();
            G.fillStyle = "#b9b3a9"; G.font = E.font("cond", u * 1.6, 600); G.textAlign = "center"; G.fillText(String(p.points[i]), pt[0], gy + u * 2.4);
          });
          G.restore();
          if (p.title) {
            const tq = prog(lt, b.dur * 0.42, 0.35, "linear"), fl = tq < 1 ? (K.rng(Math.floor(lt * 24) + 7)() < 0.5 ? 0.35 : 1) : 1, Ls = lines(p.title), tf = Math.min(H * 0.05, W * 0.06);
            G.save(); G.globalAlpha = tq * fl * (1 - dive); G.fillStyle = "#d9d4cb"; G.font = E.font("grot", tf, 500); G.letterSpacing = tf * 0.04 + "px";
            const x = W * (portrait ? 0.08 : 0.12), y = H * 0.14;
            G.fillRect(x, y - tf * 1.2, tf * 0.7, tf * 0.08);
            Ls.forEach((s, i) => G.fillText(s.toUpperCase(), x, y + i * tf * 1.02));
            G.fillRect(x, y + Ls.length * tf * 1.02 - tf * 0.55, tf * 0.7, tf * 0.08); G.restore();
          }
          G.restore();
        },
      };
    },
  });

  /* ================================================================= pictogram */
  K.register({
    name: "enmienda.pictogram", tags: ["infografía", "proporción", "dato", "personas", "porcentaje"], layer: "main", post: 0.3,
    summary: "Infografía sobre negro: título extendido chico con etiqueta en caja, fila de figuras humanas grises que suben desde el piso con UNA a rayas resaltada y la proporción debajo ('1 DE 3'); después la cámara entra en la figura rayada y aparece una grilla de figuras con la cifra grande arriba ('40,2 %').",
    example: { title: "PROBABILIDAD DE CRUZAR", tag: "BERLÍN ESTE", ratio: "1 DE 3", big: "MILES", note: "EN LOS PUESTOS FRONTERIZOS" },
    params: {
      title: { type: "string", default: "", doc: "Título (extendida chica)." },
      tag: { type: "string", default: "", doc: "Etiqueta en caja bajo el título." },
      ratio: { type: "string", default: "", doc: "Proporción bajo la fila (p. ej. '1 DE 17')." },
      row: { type: "number", default: 17, doc: "Figuras en la fila." },
      big: { type: "string", default: "", doc: "Cifra grande de la grilla." },
      note: { type: "string", default: "", doc: "Nota bajo la grilla." },
      gridAt: { type: "number", default: 0, doc: "Segundo del pase a la grilla (0 = 45 % del beat; -1 = sin grilla)." },
      cols: { type: "number", default: 22, doc: "Columnas de la grilla." },
      rows: { type: "number", default: 5, doc: "Filas de la grilla." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, r = ctx.rng, cols = portrait ? Math.round(p.cols * 0.55) : p.cols;
      const rowN = portrait ? Math.min(p.row, 9) : p.row, hiIdx = Math.floor(rowN / 2);
      const grid = Array.from({ length: cols * p.rows }, () => ({ d: r(), hi: r() < 0.3 }));
      const title = (G, x, y, s, f) => { G.font = E.font("wide", f, 800); G.textAlign = "center"; G.fillStyle = "#e9e6e0"; G.fillText(s.toUpperCase(), x, y); };
      return {
        render(lt, b) {
          const G = ctx.g.main;
          if (lt > b.dur + 0.04) return;
          const ga = p.gridAt === -1 ? 1e9 : (p.gridAt || b.dur * 0.45), zq = prog(lt, ga - 0.45, 0.45, "in"), u = ctx.stage.u;
          G.save(); G.fillStyle = "#060606"; G.fillRect(0, 0, W, H);
          if (lt < ga) {
            G.save(); E.camera(G, ctx.stage, lt, { push: -0.01, zoom: 1.05 * (1 + zq * 9), cx: W / 2 + (hiIdx - (rowN - 1) / 2) * W * 0.045 * (1 - zq * 0), cy: H * 0.55, drift: 0.1 });
            const fh = Math.min(H * (portrait ? 0.16 : 0.26), W * 0.85 / rowN / 1.35 / 0.42), fw = fh * 0.42, sp = Math.min(W * 0.85 / rowN, fw * 1.25), x0 = W / 2 - sp * rowN / 2, base = H * 0.68;
            const P = E.person(fw, fh);
            for (let i = 0; i < rowN; i++) {
              const q = prog(lt, 0.15 + Math.abs(i - hiIdx) * 0.04, 0.45, "out"), x = x0 + i * sp + (sp - fw) / 2;
              G.save(); G.beginPath(); G.rect(x - 2, base - fh, fw + 4, fh); G.clip(); G.translate(x, base - fh * q);
              if (i === hiIdx) stripes(G, P, 0, 0, fw, fh, 16, "#0c0c0c", "#e5e1d9"); else { G.fillStyle = "#5c5853"; G.fill(P); }
              G.restore();
            }
            G.fillStyle = "rgba(220,215,206,.4)"; G.fillRect(W * 0.2, base + u * 0.8, W * 0.6, Math.max(1, u * 0.08));
            if (p.ratio) { G.globalAlpha = prog(lt, 0.7, 0.3); title(G, W / 2, base + u * 5, p.ratio, u * 2.6); }
            G.restore();
            G.save(); G.globalAlpha = prog(lt, 0.05, 0.3) * (1 - zq);
            if (p.title) title(G, W / 2, H * 0.14, p.title, u * (portrait ? 2.6 : 2));
            if (p.tag) { const tf = u * 1.3, tw = E.measure(p.tag.toUpperCase(), "wide", tf, 800) + tf * 2; G.strokeStyle = "rgba(230,226,218,.6)"; G.strokeRect(W / 2 - tw / 2, H * 0.17, tw, tf * 2.1); title(G, W / 2, H * 0.17 + tf * 1.45, p.tag, tf); }
            G.restore();
          } else {
            const gq = prog(lt, ga, 0.6, "out"); G.save(); E.camera(G, ctx.stage, lt - ga, { push: -0.012, zoom: lerp(1.6, 1, gq), drift: 0.1 });
            const fh = H * (portrait ? 0.07 : 0.085), fw = fh * 0.42, sx = Math.min(W * 0.84 / cols, fw * 1.45), sy = fh * 1.18, x0 = W / 2 - sx * cols / 2, y0 = H * 0.36;
            const P = E.person(fw, fh);
            grid.forEach((c, i) => {
              const col = i % cols, row = Math.floor(i / cols), q = prog(lt - ga, 0.1 + c.d * 0.9, 0.3, "out");
              if (q <= 0) return; const x = x0 + col * sx, y = y0 + row * sy;
              G.save(); G.beginPath(); G.rect(x - 1, y, fw + 2, fh); G.clip(); G.translate(x, y + fh * (1 - q)); G.fillStyle = c.hi ? "#d9d5cc" : "#4f4b47"; G.fill(P); G.restore();
            });
            G.fillStyle = "rgba(220,215,206,.4)"; G.fillRect(W * 0.2, y0 - u * 1.4, W * 0.6, Math.max(1, u * 0.08)); G.fillRect(W * 0.2, y0 + p.rows * sy + u * 0.6, W * 0.6, Math.max(1, u * 0.08));
            if (p.tag) title(G, W / 2, y0 - u * 8.2, p.tag, u * 1.3);
            if (p.big) title(G, W / 2, y0 - u * 3, p.big, u * (portrait ? 5 : 4.4));
            if (p.note) title(G, W / 2, y0 + p.rows * sy + u * 3.6, p.note, u * 1.3);
            G.restore();
          }
          G.restore();
        },
      };
    },
  });

  /* ================================================================= collage */
  K.register({
    name: "enmienda.collage", tags: ["resumen", "cifra", "fecha", "constelación"], layer: "main", post: 0.3,
    summary: "Constelación de recortes (fotos, rótulos, numerales) que nace de un punto girando y se abre; después se oscurece y aparece un bloque de dato al centro: rótulo chico, CIFRA que cuenta hacia arriba y nota, entre filetes.",
    example: { src1: "assets/media/mauerbau.jpg", src2: "assets/media/leipzig.jpg", words: ["IX·XI", "1961", "RDA"], kicker: "3 DE OCTUBRE", big: "1990", sub: "ALEMANIA · UN SOLO PAÍS" },
    params: {
      src1: { type: "image", default: "", doc: "Foto 1." }, src2: { type: "image", default: "", doc: "Foto 2." },
      src3: { type: "image", default: "", doc: "Foto 3." }, src4: { type: "image", default: "", doc: "Foto 4." },
      words: { type: "array", default: [], doc: "Rótulos sueltos del collage." },
      kicker: { type: "string", default: "", doc: "Rótulo sobre la cifra." },
      big: { type: "string", default: "", doc: "Cifra (si es número, cuenta hacia arriba)." },
      sub: { type: "string", default: "", doc: "Nota bajo la cifra." },
      from: { type: "number", default: 0, doc: "Valor inicial del conteo." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, r = ctx.rng, items = [];
      [p.src1, p.src2, p.src3, p.src4].filter(Boolean).forEach((s, i) => { const ph = E.photo(ctx.img(s), "bw"); if (ph) items.push({ ph, x: (r() - 0.5) * 0.55, y: (r() - 0.5) * 0.45, w: 0.1 + r() * 0.07, rot: (r() - 0.5) * 0.1 }); });
      p.words.forEach((s, i) => items.push({ word: String(s), kind: ["serif", "heavy", "wide", "stencil"][i % 4], x: (r() - 0.5) * 0.6, y: (r() - 0.5) * 0.5, f: 0.03 + r() * 0.04 }));
      const num = parseInt(String(p.big).replace(/\D/g, ""), 10), isNum = /^\s*[\d.,]+\s*$/.test(p.big);
      return {
        render(lt, b) {
          const G = ctx.g.main;
          if (lt > b.dur + 0.04) return;
          const zq = prog(lt, 0, 1.0, "out"), dim = prog(lt, 1.3, 0.5), u = ctx.stage.u;
          G.save(); G.fillStyle = "#070707"; G.fillRect(0, 0, W, H);
          G.save(); G.translate(W / 2, H * 0.48); G.rotate(deg(-20) * (1 - zq)); const s = lerp(0.04, 1, zq) * (1 + lt * 0.01); G.scale(s, s);
          G.globalAlpha = lerp(1, 0.32, dim);
          const SW = portrait ? W * 1.6 : W;
          items.forEach(it => {
            G.save(); G.translate(it.x * SW, it.y * H); G.rotate(it.rot || 0);
            if (it.ph) { const w = it.w * SW, h = w * 0.72; E.cover(G, it.ph, -w / 2, -h / 2, w, h, [0.5, 0.45], 1.1); }
            else { G.fillStyle = "#cfc9be"; G.font = E.font(it.kind, it.f * H); G.textAlign = "center"; G.fillText(it.word.toUpperCase(), 0, 0); }
            G.restore();
          });
          G.restore();
          if (dim > 0) {
            G.save(); G.globalAlpha = dim; G.textAlign = "center"; G.fillStyle = "#e9e6e0";
            const bf = portrait ? W * 0.17 : H * 0.15, cy = H * 0.5;
            G.font = E.font("cond", u * 2, 700); G.letterSpacing = u * 0.25 + "px"; G.fillText(String(p.kicker).toUpperCase(), W / 2, cy - bf * 0.72);
            G.fillRect(W / 2 - bf * 1.3, cy - bf * 0.58, bf * 2.6, Math.max(1, u * 0.1));
            let shown = p.big; if (isNum && num > 0) { const c = Math.round(lerp(p.from, num, prog(lt, 1.35, 0.9, "out"))); shown = String(c); }
            G.font = E.font("cond", bf, 700); G.letterSpacing = bf * 0.02 + "px"; G.fillText(shown, W / 2, cy + bf * 0.32);
            G.fillRect(W / 2 - bf * 1.3, cy + bf * 0.5, bf * 2.6, Math.max(1, u * 0.1));
            G.font = E.font("cond", u * 1.8, 600); G.fillStyle = "#a29d95"; G.fillText(String(p.sub).toUpperCase(), W / 2, cy + bf * 0.5 + u * 3.2);
            G.restore();
          }
          G.restore();
        },
      };
    },
  });
})();
