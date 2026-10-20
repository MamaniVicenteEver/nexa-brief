/* =============================================================================
   atlas · cierre del canal (lo agrega el motor al final del audio)
   SIN recuadro: la cámara se aleja al mundo entero (con todo lo encendido y los
   alfileres del video) y el mapa se apaga como el final de la referencia.
   Orden fijo: GRACIAS POR VER → canal (condensada gigante) → alfiler LIKE que
   cae con el pulgar en el sello → ruta cian que viaja → placa SUSCRÍBETE que se
   enciende con el parpadeo de los países + campana que suena → apoyo tipeado →
   youtube.com/@canal subrayado en cian.
   ========================================================================== */
(function () {
  const K = Kit, A = Kit.atlas, { clamp, lerp, prog, ease } = K;
  const THUMB = new Path2D("M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z");
  const BLINK = [0.38, 0.72, 0.72, 0.15, 1, 0.5, 0.5, 1];
  function wrap(s, max) {
    const out = [""];
    for (const w of String(s || "").split(/\s+/).filter(Boolean)) { const i = out.length - 1, nx = out[i] ? out[i] + " " + w : w; if (out[i] && nx.length > max) out.push(w); else out[i] = nx; }
    return out.filter(Boolean);
  }
  function bell(G, x, y, s, rot, ink, paper) {
    G.save(); G.translate(x, y); G.rotate(rot);
    G.fillStyle = paper; G.strokeStyle = ink; G.lineWidth = s * 0.5;
    G.beginPath(); G.moveTo(0, -s * 4.5);
    G.bezierCurveTo(-s * 2.6, -s * 4.5, -s * 3.5, -s * 2.4, -s * 3.5, -s * 0.2); G.lineTo(-s * 3.5, s * 2.4); G.lineTo(-s * 4.7, s * 3.7);
    G.lineTo(s * 4.7, s * 3.7); G.lineTo(s * 3.5, s * 2.4); G.lineTo(s * 3.5, -s * 0.2);
    G.bezierCurveTo(s * 3.5, -s * 2.4, s * 2.6, -s * 4.5, 0, -s * 4.5); G.closePath(); G.fill(); G.stroke();
    G.beginPath(); G.arc(0, s * 4.4, s * 1.1, 0, Math.PI); G.fill(); G.stroke();
    G.beginPath(); G.arc(0, -s * 4.9, s * 0.65, 0, 7); G.fill();
    G.restore();
  }

  K.register({
    name: "atlas.outro", tags: ["cierre", "canal", "like", "suscribirse", "mapa"], layer: "main", post: 0,
    mapDim: 0.62,
    summary: "Cierre del canal SIN recuadro: la cámara se aleja al mundo entero con todo lo encendido y el mapa se apaga (final de la referencia). GRACIAS POR VER → canal en condensada gigante → alfiler LIKE que cae con el pulgar en el sello → ruta cian → placa blanca SUSCRÍBETE que se enciende con el parpadeo de los países + campana → apoyo tipeado → youtube.com/@canal. Tiempos sincronizables con la despedida (likeAt, subscribeAt, bellAt, supportAt).",
    example: { thanks: "GRACIAS POR VER", channel: "NODEPOLITICS", cta: "SUSCRÍBETE", support: "Apoya el canal y comparte el mapa.", handle: "youtube.com/@nodepolitics" },
    params: {
      ...K.hook.outroParams({ channel: "NODEPOLITICS", support: "Apoya el canal y comparte el mapa.", handle: "youtube.com/@nodepolitics" }),
      ...K.hook.bgParams(["world", "dark"]),
      dim: { type: "number", default: 0.6, min: 0, max: 1, doc: "Oscurecido del fondo foto/componente." },
    },
    world() { return [{ at: 0, cam: { pose: A.camFor({ region: "world" }), dur: 1.6, push: 0.008 } }]; },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, P = ctx.C.palette, cx = W / 2;
      const name = String(p.channel).toUpperCase();
      const fs = Math.min(A.fit(name, "cond", W * (portrait ? 0.86 : 0.62), 1e9, 700), H * (portrait ? 0.1 : 0.19));
      const thanksY = H * (portrait ? 0.2 : 0.16), nameY = H * (portrait ? 0.29 : 0.33) + fs * 0.34;
      /* fila LIKE → SUSCRÍBETE: horizontal en 16:9, escalonada en 9:16 */
      const R = u * (portrait ? 8 : 5.6), likeFs = u * (portrait ? 5.2 : 4);
      const like = portrait ? { x: W * 0.24, y: H * 0.53 } : { x: W * 0.25, y: H * 0.68 };
      const B = portrait ? { x: W * 0.47, y: H * 0.615, w: W * 0.62, h: u * 13 } : { x: W * 0.6, y: H * 0.6, w: u * 40, h: u * 10.5 };
      const bellX = B.x + B.w / 2 + u * (portrait ? 7.5 : 6.5), bellS = u * (portrait ? 0.95 : 0.8);
      const cta = String(p.cta).toUpperCase(), ctaFs = Math.min(A.fit(cta, "label", B.w * 0.8, 1e9), B.h * 0.55);
      const arrow = (() => {
        const x0 = like.x + R * 1.2 + A.measure("LIKE", "label", likeFs) + u * 1.5, y0 = like.y - R * 1.5;
        const x1 = B.x - B.w / 2 - u * 1.5, y1 = B.y, mx = (x0 + x1) / 2, my = Math.min(y0, y1) - u * (portrait ? 3 : 7);
        const pts = []; for (let k = 0; k <= 24; k++) { const s = k / 24, a = 1 - s; pts.push([a * a * x0 + 2 * a * s * mx + s * s * x1, a * a * y0 + 2 * a * s * my + s * s * y1]); }
        return portrait ? pts.map(([x, y], k) => { const s = k / 24; return [lerp(like.x + R * 0.4, B.x - B.w * 0.32, s), lerp(like.y + u * 1.5, B.y - B.h / 2 - u * 1.2, s) + Math.sin(s * Math.PI) * u * 2]; }) : pts;
      })();
      const sup = wrap(p.support, portrait ? 30 : 56), supFs = u * (portrait ? 3.6 : 2.8);
      const supY = H * (portrait ? 0.72 : 0.79), handleY = supY + sup.length * supFs * 1.2 + u * (portrait ? 2.8 : 2.2);
      const BG = K.hook.bg(ctx, p, { auto: "world", presets: { world: () => {}, dark: G => { G.fillStyle = "#0b0b0a"; G.fillRect(0, 0, W, H); } } });
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main, { likeAt, subAt, bellAt, supAt } = K.hook.outroTimes(p, b.dur);
          const exit = 1 - prog(lt, b.dur - 0.4, 0.4, "in");
          G.save(); G.globalAlpha = exit;
          BG.render(lt, b);
          /* GRACIAS POR VER */
          const ta = prog(lt, 0.1, 0.4, "linear");
          if (ta > 0) {
            const px = u * (portrait ? 2.6 : 2.1);
            G.save(); G.globalAlpha *= ta; G.font = A.font("ui", px, 800); G.letterSpacing = px * 0.22 + "px"; G.textAlign = "center"; G.textBaseline = "middle";
            G.shadowColor = "#000"; G.shadowBlur = px; G.fillStyle = "rgba(240,240,238,.92)"; G.fillText(String(p.thanks).toUpperCase(), cx, thanksY); G.restore();
          }
          /* canal: entra cerrando la interletra (como el título) */
          const nq = prog(lt, 0.3, 0.7, "out");
          if (nq > 0) {
            G.save(); G.globalAlpha *= clamp(nq * 1.4); G.font = A.font("cond", fs * (1.05 - 0.05 * nq), 700); G.letterSpacing = fs * 0.08 * (1 - nq) + "px";
            G.textAlign = "center"; G.shadowColor = "rgba(0,0,0,.8)"; G.shadowBlur = fs * 0.18; G.fillStyle = "#f0f0ee"; G.fillText(name, cx, nameY);
            G.shadowColor = "transparent"; const w = G.measureText(name).width; G.fillStyle = P.accent; G.fillRect(cx - w / 2 * nq, nameY + fs * 0.14, w * nq, Math.max(2, u * 0.35));
            G.restore();
          }
          /* alfiler LIKE (cae como los países) con el pulgar en el sello */
          const la = lt - likeAt;
          if (la >= 0) {
            const qd = clamp(la / 0.12), dy = -(1 - ease.out(qd)) * R * 1.3, sc = la < 0.12 ? lerp(0.72, 1.12, qd) : 1 + 0.12 * Math.exp(-(la - 0.12) * 13) * Math.cos((la - 0.12) * 26);
            A.pin(G, like.x, like.y + dy, R * sc, { P, seal: "none", alpha: clamp(qd * 1.6) });
            const pressed = la > 0.35, hx = like.x, hy = like.y + dy - R * 1.5 * sc, isz = R * 0.95 * sc;
            G.save(); G.globalAlpha *= clamp(qd * 1.6); G.translate(hx - isz / 2, hy - isz / 2); G.scale(isz / 24, isz / 24);
            G.fillStyle = P.accentInk; G.fill(THUMB);
            if (!pressed) { G.fillStyle = P.ink; G.translate(12, 12); G.scale(0.78, 0.78); G.translate(-12, -12); G.fill(THUMB); }
            G.restore();
            const lq = prog(la, 0.3, 0.18, "out");
            if (lq > 0) A.label(G, "LIKE", hx + R * 1.1 * sc + (1 - lq) * -R * 0.8, hy, likeFs, { alpha: lq, color: P.ink, halo: "rgba(0,0,0,.85)" });
          }
          /* ruta cian del LIKE a SUSCRÍBETE */
          if (p.arrow) {
            const a0 = Math.min(likeAt + 0.25, subAt - 0.2), dur = Math.max(0.3, subAt + 0.1 - a0), aq = prog(lt, a0, dur, "inOut");
            if (aq > 0) {
              const n = Math.max(2, Math.ceil(arrow.length * aq));
              G.save(); G.strokeStyle = P.accent; G.lineWidth = Math.max(2, u * 0.45); G.setLineDash([u * 1.4, u * 0.9]); G.lineCap = "round";
              G.shadowColor = P.accent; G.shadowBlur = u * 1.2;
              G.beginPath(); arrow.slice(0, n).forEach(([x, y], k) => (k ? G.lineTo(x, y) : G.moveTo(x, y))); G.stroke();
              if (aq >= 0.98) {
                const [x1, y1] = arrow[arrow.length - 1], [x0, y0] = arrow[arrow.length - 3], ang = Math.atan2(y1 - y0, x1 - x0), hl = u * 2.2;
                G.setLineDash([]); G.fillStyle = P.accent; G.beginPath(); G.moveTo(x1 + Math.cos(ang) * hl * 0.4, y1 + Math.sin(ang) * hl * 0.4);
                G.lineTo(x1 + Math.cos(ang + 2.5) * hl, y1 + Math.sin(ang + 2.5) * hl); G.lineTo(x1 + Math.cos(ang - 2.5) * hl, y1 + Math.sin(ang - 2.5) * hl); G.fill();
              }
              G.restore();
            }
          }
          /* placa SUSCRÍBETE: se enciende como un país (parpadeo de 8 cuadros gris → blanco) */
          const sa = lt - subAt;
          if (sa >= 0) {
            const fr = Math.floor(sa * A.FPS), m = fr < BLINK.length ? BLINK[fr] : 1;
            G.save(); G.translate(B.x, B.y); G.shadowColor = "rgba(0,0,0,.5)"; G.shadowBlur = u * 1.6; G.shadowOffsetY = u * 0.4;
            G.fillStyle = P.deep; G.fillRect(-B.w / 2, -B.h / 2 + u * 0.7, B.w, B.h);
            G.shadowColor = "transparent"; G.fillStyle = P.accent; G.fillRect(-B.w / 2, -B.h / 2 + u * 0.45, B.w, B.h);
            G.fillStyle = A.mix(P.land, P.ink, m); G.fillRect(-B.w / 2, -B.h / 2, B.w, B.h);
            G.strokeStyle = P.line; G.lineWidth = Math.max(1, u * 0.12); G.strokeRect(-B.w / 2, -B.h / 2, B.w, B.h);
            G.globalAlpha *= clamp((m - 0.3) * 2); G.font = A.font("label", ctaFs); G.textAlign = "center"; G.textBaseline = "middle"; G.fillStyle = P.accentInk;
            G.fillText(cta, 0, ctaFs * 0.04);
            G.restore();
          }
          /* campana que suena */
          const bq = prog(lt, bellAt, 0.18, "out");
          if (bq > 0) {
            const d = lt - bellAt, rot = Math.sin(d * 16) * Math.exp(-d * 2.6) * 0.45;
            G.save(); G.globalAlpha *= bq; bell(G, bellX, B.y, bellS * (0.7 + 0.3 * bq), rot, P.accentInk, P.ink);
            const rays = clamp(1 - d / 1.3);
            if (rays > 0) { G.strokeStyle = `rgba(86,226,242,${rays})`; G.lineWidth = bellS * 0.5; G.lineCap = "round"; for (const s of [-1, 1]) { G.beginPath(); G.arc(bellX, B.y, bellS * (6.4 + (1 - rays) * 1.6), s < 0 ? Math.PI * 0.8 : -Math.PI * 0.2, s < 0 ? Math.PI * 1.2 : Math.PI * 0.2); G.stroke(); } }
            G.restore();
          }
          /* apoyo tipeado + dirección del canal */
          if (lt > supAt) {
            let n = Math.floor((lt - supAt) * 45);
            G.save(); G.textAlign = "center"; G.textBaseline = "alphabetic"; G.shadowColor = "#000"; G.shadowBlur = u * 1.1;
            G.font = A.font("cond", supFs, 700); G.letterSpacing = supFs * 0.02 + "px"; G.fillStyle = "rgba(226,226,222,.9)";
            sup.forEach((s, i) => { const k = Math.min(s.length, n); n -= k; if (k > 0) G.fillText(s.slice(0, k), cx, supY + i * supFs * 1.2); });
            const hq = prog(lt, supAt + 0.35, 0.4, "linear");
            if (p.handle && hq > 0) {
              const hs = u * (portrait ? 2.7 : 2), txt = String(p.handle);
              G.font = A.font("ui", hs, 800); G.letterSpacing = hs * 0.1 + "px"; G.fillStyle = P.ink;
              G.fillText(txt.slice(0, Math.ceil(txt.length * hq)), cx, handleY);
              const w = G.measureText(txt).width; G.shadowColor = "transparent"; G.fillStyle = P.accent; G.fillRect(cx - w / 2, handleY + hs * 0.5, w * hq, Math.max(2, u * 0.25));
            }
            G.restore();
          }
          G.restore();
        },
      };
    },
  });
})();
