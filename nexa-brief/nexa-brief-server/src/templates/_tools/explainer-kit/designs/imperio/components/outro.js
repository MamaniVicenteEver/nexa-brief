/* =============================================================================
   imperio · cierre del canal (lo agrega el motor al final del audio)
   Sin recuadro. V1: mundo completo ligero que se aleja y se apaga; V2: atlas.
   Ambos admiten archivo / papel / foto / componente como fondos alternativos:
   GRACIAS POR VER (rótulo con barras carmesí) → nombre del canal en condensada
   blanca que SUBE con degradé delante del SOL que sale desde abajo con su abanico
   de rayos girando lento → LIKE (alfiler en V1, óvalo en V2) → flecha de línea fina que se dibuja → SUSCRÍBETE en franja carmesí que
   entra con barrido + campana que suena → mensaje de apoyo tipeado → dirección del
   canal con barra carmesí. Fundido a negro al final (tapa grano y viñeta).
   ========================================================================== */
(function () {
  "use strict";
  const K = Kit, IM = Kit.imperio, HK = Kit.imperio.hook, { clamp, prog, ease, lerp } = K;
  const { WHITE, CRIMSON } = HK.COL;
  const THUMB = new Path2D("M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z");

  function wrap(s, max) {
    const out = [""];
    for (const w of String(s || "").split(/\s+/).filter(Boolean)) { const i = out.length - 1, nx = out[i] ? out[i] + " " + w : w; if (out[i] && nx.length > max) out.push(w); else out[i] = nx; }
    return out.filter(Boolean);
  }
  function bell(G, x, y, s, rot, waves = false) {
    G.save(); G.translate(x, y - s * 4.5); G.rotate(rot); G.translate(0, s * 4.5);
    G.fillStyle = WHITE; G.shadowColor = "rgba(8,10,12,.8)"; G.shadowBlur = s * 1.5;
    G.beginPath(); G.moveTo(0, -s * 4.5);
    G.bezierCurveTo(-s * 2.6, -s * 4.5, -s * 3.5, -s * 2.4, -s * 3.5, -s * 0.2); G.lineTo(-s * 3.5, s * 2.4); G.lineTo(-s * 4.7, s * 3.7);
    G.lineTo(s * 4.7, s * 3.7); G.lineTo(s * 3.5, s * 2.4); G.lineTo(s * 3.5, -s * 0.2);
    G.bezierCurveTo(s * 3.5, -s * 2.4, s * 2.6, -s * 4.5, 0, -s * 4.5); G.fill();
    G.beginPath(); G.arc(0, s * 4.5, s * 1.15, 0, Math.PI); G.fill();
    if (waves) {
      G.shadowColor = "transparent"; G.shadowBlur = 0; G.strokeStyle = WHITE; G.lineWidth = s * 0.85; G.lineCap = "round";
      G.beginPath(); G.moveTo(-s * 6, -s * 2.8); G.quadraticCurveTo(-s * 8.2, 0, -s * 6, s * 2.8);
      G.moveTo(s * 6, -s * 2.8); G.quadraticCurveTo(s * 8.2, 0, s * 6, s * 2.8); G.stroke();
    }
    G.restore();
  }

  /* Mundo completo sin hornear el atlas: una imagen vectorial cacheada por tamaño.
     Usa la misma geografía y paleta de Imperio, también en la vista ligera del showcase. */
  function worldBackground(ctx) {
    const { W, H, portrait } = ctx.stage, world = IM.world(), image = document.createElement("canvas");
    image.width = Math.max(1, Math.round(W)); image.height = Math.max(1, Math.round(H));
    const g = image.getContext("2d");
    g.fillStyle = IM.COL.ocean; g.fillRect(0, 0, W, H);
    if (world.ok) {
      const y0 = H * (portrait ? 0.28 : 0.08), y1 = H * (portrait ? 0.66 : 0.92);
      const projection = d3.geoNaturalEarth1().fitExtent([[W * 0.025, y0], [W * 0.975, y1]], { type: "Sphere" });
      const path = d3.geoPath(projection, g);
      g.beginPath(); path(world.land); g.fillStyle = IM.COL.land; g.fill();
      g.beginPath(); path(world.fc); g.strokeStyle = IM.COL.coast; g.lineWidth = Math.max(0.65, W / 1500); g.stroke();
    }
    return {
      render(lt, beat) {
        const G = ctx.g.main, zoom = lerp(1.14, 1, prog(lt, 0, Math.min(2.2, beat.dur * 0.5), "out"));
        G.save(); G.translate(W / 2, H / 2); G.scale(zoom, zoom); G.drawImage(image, -W / 2, -H / 2, W, H); G.restore();
        // El mapa se atenúa al finalizar la despedida, sin ocultar los textos.
        const dim = 0.04 + 0.16 * prog(lt, beat.dur * 0.48, beat.dur * 0.36, "inOut");
        G.save(); G.fillStyle = `rgba(10,12,14,${dim})`; G.fillRect(0, 0, W, H); G.restore();
      },
      dispose() { image.width = image.height = 1; },
    };
  }

  const outro = {
    name: "imperio.outro", tags: ["cierre", "canal", "like", "suscribirse", "sol"], layer: "main", post: 0, opaque: true,
    summary: "Cierre v1 con mapa del mundo completo que se aleja y oscurece, en los colores de Imperio. GRACIAS POR VER → canal en blanco ante el sol carmesí y sus rayos → alfiler LIKE → flecha → SUSCRÍBETE y campana → apoyo tipeado y dirección. Fondo alternativo con bg; tiempos sincronizables con likeAt, subscribeAt, bellAt y supportAt.",
    example: { thanks: "GRACIAS POR VER", channel: "NODEPOLITICS", cta: "SUSCRÍBETE", support: "Apoya el canal y comparte el video.", handle: "youtube.com/@nodepolitics" },
    params: {
      ...K.hook.outroParams({ channel: "NODEPOLITICS", handle: "youtube.com/@nodepolitics", support: "Apoya el canal y comparte el video." }),
      country: { type: "string", default: "", doc: "País foco del fondo atlas (vacío = mundo)." },
      ...K.hook.bgParams(HK.PRESETS),
      dim: { type: "number", default: 0.5, min: 0, max: 1, doc: "Oscurecido del fondo foto/componente." },
      fadeOut: { type: "bool", default: true, doc: "Fundido a negro al final del cierre." },
    },
    mapLook: HK.mapLook, mapWarm: HK.mapWarm,
    create(ctx, p, style = {}) {
      ctx.beat.hideCaptions = true;
      const st = ctx.stage, { W, H, u, portrait } = st, cx = W / 2,
        BG = style.worldBackdrop && p.bg === "dark" ? {
          render() { const G = ctx.g.main; G.save(); G.fillStyle = "#0d0d0d"; G.fillRect(0, 0, W, H); G.restore(); },
          dispose() {},
        } : style.worldBackdrop && (!p.bg || ["auto", "atlas", "world"].includes(p.bg)) ? worldBackground(ctx) : HK.background(ctx, p);
      const name = IM.wordLayout(p.channel, W * (portrait ? 0.84 : 0.6), portrait ? H * 0.09 : H * 0.17, style.textWeight);
      const thanksY = H * (portrait ? 0.17 : 0.12), nameY = H * (portrait ? 0.29 : 0.33);
      /* V2: botones y campana en una fila en móvil; V1 conserva su composición. */
      const compact = portrait && style.compactRow;
      const L = compact ? { x: cx - u * 33.3, y: H * 0.49, w: u * 23, h: u * 10.5 }
        : portrait ? { x: cx - u * 22, y: H * 0.48, w: u * 34, h: u * 13 } : { x: cx - u * 34, y: H * 0.6, w: u * 22, h: u * 9 };
      const B = compact ? { x: cx + u * 7, y: H * 0.49, w: u * 40, h: u * 11 }
        : portrait ? { x: cx + u * 4, y: H * 0.6, w: u * 64, h: u * 14 } : { x: cx + u * 14, y: H * 0.6, w: u * 40, h: u * 10 };
      const bellX = compact ? W - u * 10.5 : B.x + B.w / 2 + u * (portrait ? (style.worldBackdrop ? 5 : 7) : (style.bellWaves ? 9 : 5.5));
      const bellY = B.y, bellS = u * (compact ? 0.8 : portrait ? (style.worldBackdrop ? 0.8 : 0.95) : 0.7);
      const [ax0, ay0, ax1, ay1, amx, amy] = compact
        ? [L.x + L.w / 2 + u * 0.4, L.y, B.x - B.w / 2 - u * 0.4, B.y, (L.x + L.w / 2 + B.x - B.w / 2) / 2, L.y - u * 3]
        : portrait
          ? [L.x + L.w * 0.55, L.y + L.h * 0.1, B.x - B.w * 0.32, B.y - B.h * 0.6, L.x + L.w * 0.9, B.y - B.h * 0.2]
          : [L.x + L.w * 0.58, L.y, B.x - B.w / 2 - u * 2.2, B.y, (L.x + B.x) / 2 - u * 2, L.y - L.h * 1.1];
      const qpt = s => { const a = 1 - s; return [a * a * ax0 + 2 * a * s * amx + s * s * ax1, a * a * ay0 + 2 * a * s * amy + s * s * ay1]; };
      const cta = String(p.cta).toUpperCase(), ctaFs = Math.min(B.h * 0.56, B.w * 0.7 / Math.max(1, IM.measure(cta, IM.wordFont(100, style.textWeight), 1) / 100));
      const sup = wrap(p.support, portrait ? 30 : 56), supFs = u * (portrait ? 3.3 : 2.4);
      const supY = portrait ? H * 0.71 : H * 0.77, handleY = supY + sup.length * supFs * 1.35 + u * (portrait ? 2.5 : 1.6);
      return {
        dispose() { BG.dispose(); },
        render(lt, b, t) {
          const G = ctx.g.main, { likeAt, subAt, bellAt, supAt } = K.hook.outroTimes(p, b.dur);
          if (p.fadeOut) { const fade = prog(lt, b.dur - 0.45, 0.45, "linear"); IM.fx.fade = Math.max(IM.fx.fade, fade); }
          IM.fx.noCapBand = true;
          BG.render(lt, b, t);
          G.save(); G.fillStyle = style.worldBackdrop ? "rgba(10,12,14,.24)" : "rgba(10,12,14,.38)"; G.fillRect(0, 0, W, H); G.restore();
          HK.scrim(G, st, style.worldBackdrop ? 0.45 : 0.8);
          /* sol que sale detrás del nombre */
          const sq = prog(lt, 0.15, 1.1, "out"), R = u * (portrait ? 8 : 7.5), sy = lerp(H + R * 2, nameY - name.h * 0.15, sq);
          IM.rays(G, cx, sy, { n: 30, rot: lt * 0.06, dir: Math.PI / 2, focus: 0.1, len: Math.max(W, H) * 0.62, r0: R, grow: prog(lt, 0.45, 1, "out"), t: lt, alpha: style.worldBackdrop ? 0.27 : 0.55, colors: IM.flagFor(p.country)?.rays });
          IM.sun(G, cx, sy, R, t, { alpha: clamp(sq * 2), flag: IM.flagFor(p.country) });
          HK.kicker(G, p.thanks, cx, thanksY, u * (portrait ? 2.5 : 1.9) * (style.thanksScale ?? 1), prog(lt, 0.05, 0.35));
          IM.word(G, st, { layout: name, x: cx, y: nameY, at: 0.35, weight: style.textWeight }, lt);
          /* LIKE: óvalo fino que se llena de carmesí al "presionarse" */
          const lq = prog(lt, likeAt, 0.35, "back");
          if (lq > 0) {
            const pressed = prog(lt, likeAt + 0.3, 0.16, "out"), bump = 1 + 0.08 * Math.sin(Math.PI * clamp((lt - likeAt - 0.3) / 0.25));
            if (style.worldBackdrop) {
              // Alfiler carmesí que cae, con pulgar blanco; el rótulo se despliega al lado.
              const r = L.h * 0.43, pinX = L.x - L.w * 0.28, drop = (1 - clamp(lq)) * L.h;
              G.save(); G.translate(pinX, L.y - drop); G.scale(lq * bump, lq * bump); G.globalAlpha = clamp(lq * 2);
              G.beginPath(); G.moveTo(0, r * 1.55); G.bezierCurveTo(-r * 0.3, r * 1.02, -r, r * 0.62, -r, -r * 0.2);
              G.arc(0, -r * 0.2, r, Math.PI, 0); G.bezierCurveTo(r, r * 0.62, r * 0.3, r * 1.02, 0, r * 1.55);
              G.fillStyle = CRIMSON; G.fill(); G.strokeStyle = WHITE; G.lineWidth = u * 0.28; G.stroke();
              const isz = r * 1.22; G.save(); G.translate(-isz / 2, -r * 0.2 - isz / 2); G.scale(isz / 24, isz / 24); G.fillStyle = WHITE; G.fill(THUMB); G.restore(); G.restore();
              G.save(); G.globalAlpha = clamp(lq * 2); G.font = `800 ${L.h * 0.4}px Montserrat`; G.letterSpacing = L.h * 0.035 + "px";
              G.fillStyle = WHITE; G.textAlign = "left"; G.textBaseline = "middle"; G.shadowColor = "rgba(8,10,12,.8)"; G.shadowBlur = u;
              G.fillText("LIKE", pinX + r * 1.35, L.y); G.restore();
            } else {
            G.save(); G.translate(L.x, L.y); G.scale(lq * bump, lq * bump); G.globalAlpha = clamp(lq * 2);
            G.beginPath(); G.roundRect(-L.w / 2, -L.h / 2, L.w, L.h, L.h / 2);
            G.fillStyle = style.actionColor ? IM.tone(style.actionColor, 0, 1, 0.95 * pressed) : `rgba(163,18,47,${0.95 * pressed})`; G.fill(); G.strokeStyle = WHITE; G.lineWidth = u * 0.28; G.stroke();
            const isz = L.h * 0.62; G.save(); G.translate(-L.w / 2 + L.h * 0.28, -isz / 2); G.scale(isz / 24, isz / 24); G.fillStyle = WHITE; G.fill(THUMB); G.restore();
            const fs = L.h * 0.42; G.font = `800 ${fs}px Montserrat`; G.letterSpacing = fs * 0.12 + "px"; G.fillStyle = WHITE; G.textAlign = "center"; G.textBaseline = "middle";
            G.fillText("LIKE", L.h * 0.38, fs * 0.04);
            G.restore();
            }
          }
          /* flecha de línea fina que se dibuja */
          if (p.arrow) {
            const a0 = Math.min(likeAt + 0.3, subAt - 0.2), aq = prog(lt, a0, Math.max(0.3, subAt + 0.1 - a0), "inOut");
            if (aq > 0) {
              G.save(); G.strokeStyle = WHITE; G.lineWidth = u * 0.3; G.lineCap = "round"; G.shadowColor = "rgba(8,10,12,.7)"; G.shadowBlur = u;
              G.setLineDash([u * 1.1, u * 0.9]); G.beginPath(); for (let i = 0; i <= 40 * aq; i++) { const [x, y] = qpt(i / 40); i ? G.lineTo(x, y) : G.moveTo(x, y); } G.stroke(); G.setLineDash([]);
              if (aq > 0.95) { const [x1, y1] = qpt(1), [x0, y0] = qpt(0.93), ang = Math.atan2(y1 - y0, x1 - x0), hl = u * 2.2;
                G.beginPath(); G.moveTo(x1 - Math.cos(ang - 0.5) * hl, y1 - Math.sin(ang - 0.5) * hl); G.lineTo(x1, y1); G.lineTo(x1 - Math.cos(ang + 0.5) * hl, y1 - Math.sin(ang + 0.5) * hl); G.stroke(); }
              G.restore();
            }
          }
          /* SUSCRÍBETE: franja carmesí con barrido */
          const sb = prog(lt, subAt, 0.32, "linear");
          if (sb > 0) {
            const e = ease.expoOut(sb), off = W * 0.6 * (1 - e);
            for (let k = sb < 1 ? 3 : 0; k >= 0; k--) {
              G.save(); G.globalAlpha = k ? 0.3 * (1 - e) / k : clamp(sb * 5); G.translate(B.x + off + k * u * 3 * (1 - e), B.y);
              G.fillStyle = style.actionColor ?? CRIMSON; G.shadowColor = "rgba(0,0,0,.45)"; G.shadowBlur = u * 1.5; G.fillRect(-B.w / 2, -B.h / 2, B.w, B.h); G.shadowBlur = 0;
              if (style.worldBackdrop && sb < 1) { G.fillStyle = `rgba(255,255,255,${0.22 * Math.abs(Math.sin(sb * Math.PI * 4))})`; G.fillRect(-B.w / 2, -B.h / 2, B.w, B.h); }
              G.fillStyle = "rgba(255,255,255,.85)"; G.fillRect(-B.w / 2, -B.h / 2, B.w, u * 0.25); G.fillRect(-B.w / 2, B.h / 2 - u * 0.25, B.w, u * 0.25);
              G.font = IM.wordFont(ctaFs, style.textWeight); G.letterSpacing = ctaFs * 0.04 + "px"; G.fillStyle = WHITE; G.textAlign = "center"; G.textBaseline = "alphabetic";
              G.fillText(cta, 0, ctaFs * 0.36); G.restore();
            }
          }
          const bq = prog(lt, bellAt, 0.2, "out");
          if (bq > 0) { const d = lt - bellAt; G.save(); G.globalAlpha = bq; bell(G, bellX, bellY, bellS * (0.7 + 0.3 * bq), Math.sin(d * 16) * Math.exp(-d * 2.6) * 0.45, style.bellWaves); G.restore(); }
          /* apoyo tipeado + dirección con barra carmesí */
          if (lt > supAt) {
            let n = Math.floor((Math.floor(lt * 24) / 24 - supAt) * 48);
            G.save(); G.font = `${style.textWeight ?? 600} ${supFs}px Montserrat`; G.letterSpacing = supFs * 0.02 + "px"; G.fillStyle = "rgba(246,246,248,.92)"; G.textBaseline = "alphabetic"; G.textAlign = "left";
            G.shadowColor = "rgba(8,10,12,.9)"; G.shadowBlur = u;
            sup.forEach((s, i) => { const k = Math.min(s.length, n); n -= k; if (k > 0) { const full = IM.measure(s, G.font, supFs * 0.02); G.fillText(s.slice(0, k), cx - full / 2, supY + i * supFs * 1.35); } });
            const hq = prog(lt, supAt + 0.35, 0.5, "out");
            if (p.handle && hq > 0) {
              const hs = u * (portrait ? 2.9 : 2), txt = String(p.handle); G.font = `800 ${hs}px Montserrat`; G.letterSpacing = hs * 0.08 + "px";
              const tw = IM.measure(txt, G.font, hs * 0.08), bw = hs * 1.4, x0 = cx - (tw + bw + hs * 0.6) / 2;
              G.globalAlpha = hq; G.fillStyle = CRIMSON; G.fillRect(x0, handleY - hs * 0.42, bw * hq, hs * 0.2);
              G.fillStyle = WHITE; G.fillText(txt.slice(0, Math.ceil(txt.length * hq)), x0 + bw + hs * 0.6, handleY);
            }
            G.restore();
          }
        },
      };
    },
  };
  K.register({
    ...outro,
    tags: [...outro.tags, "mapa"],
    params: {
      ...outro.params,
      country: { ...outro.params.country, doc: "País foco cuando bg es archivo; el mundo de auto/atlas/world muestra todos los continentes." },
      bg: { ...outro.params.bg, options: ["auto", "atlas", "world", "dark", "archivo", "papel", "image", "component", "none"], doc: "auto, atlas o world: mapa mundial ligero; dark: fondo oscuro; archivo: atlas histórico; papel: textura; image: foto en src; component: componente en use; none: liso." },
    },
    create(ctx, p) { return outro.create(ctx, p, { worldBackdrop: true, bellWaves: true }); },
  });
  K.register({
    ...outro,
    name: "imperio.outrov2",
    tags: [...outro.tags, "v2", "negrita", "rojo sangre"],
    summary: "Outro v2: GRACIAS POR VER un 45 % más grande, letras en negrita y fondos rojo sangre oscuro en LIKE y SUSCRÍBETE. Conserva el sol naciente, los rayos, la flecha, la campana y los tiempos sincronizables del cierre original. Textos, fondo, tamaño, peso y color editables por JSON; funciona en 9:16 y 16:9.",
    example: { ...outro.example, thanksScale: 1.45, textWeight: 800, actionColor: "#700B1B" },
    params: {
      ...outro.params,
      thanksScale: { type: "number", default: 1.45, min: 1, max: 2, doc: "Escala de GRACIAS POR VER respecto al cierre original (1.45 = 45 % más grande)." },
      textWeight: { type: "number", default: 800, min: 400, max: 900, doc: "Peso tipográfico del nombre del canal, SUSCRÍBETE y el apoyo. 800 = negrita gruesa; GRACIAS y LIKE usan Montserrat 800." },
      actionColor: { type: "color", default: "#700B1B", doc: "Color de relleno de LIKE y SUSCRÍBETE; por defecto rojo sangre oscuro. No cambia el sol ni los rayos." },
    },
    create(ctx, p) {
      return outro.create(ctx, p, { thanksScale: p.thanksScale, textWeight: p.textWeight, actionColor: p.actionColor, compactRow: true, bellWaves: true });
    },
  });
})();
