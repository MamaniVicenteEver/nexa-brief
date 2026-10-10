# binary.banknote · v2

modelo: deepseek-flash · 10.9 s · tokens in 4939 / out 2496

## Pedido

Creá `binary.banknote`: un billete hecho de glifos 0/1: rectángulo apaisado con borde doble, un medallón ovalado a la derecha donde va un retrato muestreado de la imagen src (con B.sampleImage dentro del óvalo), y el valor grande (p. ej. '50') a la izquierda hecho de glifos con B.sampleText. Params: src (image, el retrato), value (por defecto '50'), currency (por defecto '£', va chico junto al valor como texto nítido en ctx.g.top), caption (texto mono debajo del billete, p. ej. 'BILLETE DE 50 LIBRAS · 2021'), morph. En 9:16 el billete va vertical (girado 90°) o más chico pero legible: elegí lo que se vea mejor y explicalo en un comentario. Momento narrativo: 'Hoy su rostro está en el billete de cincuenta libras'.

## Respuesta

```js
(function () {
  const K = Kit, B = Kit.binary, { clamp, lerp, prog } = K;
  K.register({
    name: "binary.banknote",
    tags: ["billete", "dinero", "retrato", "historia"],
    layer: "main",
    summary: "Un billete hecho de glifos 0/1: borde doble, valor grande a la izquierda y medallón con retrato muestreado a la derecha. Sirve para el momento en que un personaje aparece en un billete.",
    example: { src: "", value: "50", currency: "£", caption: "BILLETE DE 50 LIBRAS · 2021", morph: 1.0 },
    params: {
      src: { type: "image", default: "", doc: "Retrato que va dentro del medallón." },
      value: { type: "string", default: "50", doc: "Valor grande del billete." },
      currency: { type: "string", default: "£", doc: "Símbolo de la moneda (texto nítido)." },
      caption: { type: "string", default: "", doc: "Rótulo mono debajo del billete." },
      morph: { type: "number", default: 1.0, doc: "Segundos de armado." },
    },

    // El billete es apaisado (ar ≈ 2.1). En 9:16 el content es alto y angosto:
    // un billete apaisado quedaría diminuto, así que lo giramos 90° (queda vertical
    // pero conserva su proporción real) y el valor/medallón se leen igual de grandes.
    points(ctx, p) {
      const c = ctx.stage.content;
      const portrait = ctx.stage.portrait;
      const ar = 2.1;
      // Caja del billete en su orientación natural (apaisado).
      let bw, bh;
      if (portrait) {
        // girado 90°: el "ancho" del billete ocupa el alto del content
        bh = c.h * 0.62;
        bw = bh * ar;
      } else {
        bw = c.w * 0.78;
        bh = bw / ar;
      }
      const bx = { x: c.x + (c.w - bw) / 2, y: c.y + (c.h - bh) / 2, w: bw, h: bh };

      const cell = B.cellOf(ctx, portrait ? 0.85 : 0.75);
      const pad = bh * 0.06;
      const inner = { x: bx.x + pad, y: bx.y + pad, w: bx.w - pad * 2, h: bx.h - pad * 2 };
      const pad2 = bh * 0.045;
      const inner2 = { x: inner.x + pad2, y: inner.y + pad2, w: inner.w - pad2 * 2, h: inner.h - pad2 * 2 };

      // Medallón ovalado a la derecha (en orientación natural).
      const medW = inner2.h * 0.82;
      const medH = inner2.h * 0.94;
      const medCx = inner2.x + inner2.w - medW * 0.62;
      const medCy = inner2.y + inner2.h / 2;
      const medBox = { x: medCx - medW / 2, y: medCy - medH / 2, w: medW, h: medH };

      // Valor grande a la izquierda.
      const valBox = {
        x: inner2.x + inner2.w * 0.02,
        y: inner2.y + inner2.h * 0.12,
        w: inner2.w * 0.5,
        h: inner2.h * 0.76,
      };

      const pts = [];

      // 1) Borde doble del billete (dos rectángulos huecos).
      const border = B.sampleShape((g, w, h) => {
        g.strokeStyle = "#fff";
        g.lineWidth = Math.max(2, h * 0.012);
        g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
        const lw2 = Math.max(2, h * 0.008);
        const inset = h * 0.045;
        g.lineWidth = lw2;
        g.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
      }, bx, { cell, edge: true, jitter: 0.35, seed: 11 });
      pts.push(...border);

      // 2) Retrato dentro del medallón (recortado al óvalo).
      const img = p.src ? ctx.img(p.src) : null;
      if (img) {
        const portraitPts = B.sampleImage(img, medBox, {
          cell: B.cellOf(ctx, portrait ? 0.7 : 0.6),
          contrast: 1.3,
          threshold: 0.08,
        });
        // recortar al óvalo
        const rx = medW / 2, ry = medH / 2;
        for (const pt of portraitPts) {
          const dx = (pt.x - medCx) / rx;
          const dy = (pt.y - medCy) / ry;
          if (dx * dx + dy * dy <= 1) pts.push(pt);
        }
      }

      // 3) Contorno del óvalo (anillo fino).
      const oval = B.sampleShape((g, w, h) => {
        g.strokeStyle = "#fff";
        g.lineWidth = Math.max(2, h * 0.02);
        g.beginPath();
        g.ellipse(w / 2, h / 2, w / 2 - g.lineWidth, h / 2 - g.lineWidth, 0, 0, Math.PI * 2);
        g.stroke();
      }, medBox, { cell, edge: true, jitter: 0.3, seed: 22 });
      pts.push(...oval);

      // 4) Valor grande a la izquierda.
      const valPts = B.sampleText(p.value, valBox, {
        font: "900 100px 'Inter', sans-serif",
        cell: B.cellOf(ctx, portrait ? 0.85 : 0.75),
        fit: "lines",
      });
      pts.push(...valPts);

      // 5) Si es portrait, giramos todos los puntos 90° alrededor del centro del content
      //    para que el billete quede vertical y aproveche el alto.
      if (portrait) {
        const ccx = c.x + c.w / 2, ccy = c.y + c.h / 2;
        for (const pt of pts) {
          const dx = pt.x - ccx, dy = pt.y - ccy;
          pt.x = ccx - dy;
          pt.y = ccy + dx;
        }
      }

      return B.pack(pts, ctx.family.binary.N);
    },

    motion: lt => ({ s: 1 + lt * 0.006 }),

    reveal: (lt, b, p) => clamp(lt / Math.max(0.4, p.morph ?? 1)),

    create(ctx, p) {
      const P = ctx.C.palette, G = ctx.g.top, { u, cx, cy, portrait } = ctx.stage, c = ctx.stage.content;
      const ar = 2.1;
      let bw, bh;
      if (portrait) { bh = c.h * 0.62; bw = bh * ar; }
      else { bw = c.w * 0.78; bh = bw / ar; }
      const bx = { x: c.x + (c.w - bw) / 2, y: c.y + (c.h - bh) / 2, w: bw, h: bh };

      // Posiciones del rótulo de moneda y del caption, en coordenadas de pantalla
      // (después del giro si es portrait).
      const pad = bh * 0.06;
      const inner = { x: bx.x + pad, y: bx.y + pad, w: bx.w - pad * 2, h: bx.h - pad * 2 };
      const pad2 = bh * 0.045;
      const inner2 = { x: inner.x + pad2, y: inner.y + pad2, w: inner.w - pad2 * 2, h: inner.h - pad2 * 2 };
      const valBox = {
        x: inner2.x + inner2.w * 0.02,
        y: inner2.y + inner2.h * 0.12,
        w: inner2.w * 0.5,
        h: inner2.h * 0.76,
      };

      // Punto de anclaje del símbolo de moneda: arriba a la izquierda del valor.
      let curX = valBox.x + valBox.w * 0.05;
      let curY = valBox.y + valBox.h * 0.18;
      let capX = cx, capY = bx.y + bh + u * 3.2;

      if (portrait) {
        const ccx = c.x + c.w / 2, ccy = c.y + c.h / 2;
        const rot = (x, y) => ({ x: ccx - (y - ccy), y: ccy + (x - ccx) });
        const rc = rot(curX, curY); curX = rc.x; curY = rc.y;
        const rcap = rot(cx, bx.y + bh + u * 3.2);
        capX = rcap.x; capY = rcap.y;
      }

      const curSize = Math.max(2.2 * u, bh * 0.09);
      const capSize = Math.max(1.6 * u, u * 1.9);

      return {
        render(lt, b, t) {
          const q = B.fadeIO(lt, b.dur, 0.35, 0.45, (p.morph ?? 1) * 0.5);

          // Símbolo de moneda (nítido, mono, junto al valor).
          if (p.currency) {
            B.mono(G, p.currency, curX, curY, {
              u, size: curSize / u, weight: 700, color: P.ink, alpha: q, align: "left",
            });
          }

          // Caption mono debajo del billete.
          if (p.caption) {
            B.mono(G, p.caption, capX, capY, {
              u, size: capSize / u, weight: 500, color: P.muted, alpha: q, align: "center",
            });
          }
        },
        dispose() {},
      };
    },
  });
})();
```
