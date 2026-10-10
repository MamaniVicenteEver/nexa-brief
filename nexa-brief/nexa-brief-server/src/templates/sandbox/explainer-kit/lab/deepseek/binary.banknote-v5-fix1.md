# binary.banknote · v5-fix1

modelo: deepseek-flash · 6.7 s · tokens in 8055 / out 2106

## Pedido

Creá `binary.banknote`: un billete hecho de glifos 0/1: rectángulo apaisado con borde doble, un medallón ovalado a la derecha donde va un retrato muestreado de la imagen src (con B.sampleImage dentro del óvalo), y el valor grande (p. ej. '50') a la izquierda hecho de glifos con B.sampleText. Params: src (image, el retrato), value (por defecto '50'), currency (por defecto '£', va chico junto al valor como texto nítido en ctx.g.top), caption (texto mono debajo del billete, p. ej. 'BILLETE DE 50 LIBRAS · 2021'), morph. En 9:16 el billete va vertical (girado 90°) o más chico pero legible: elegí lo que se vea mejor y explicalo en un comentario. Momento narrativo: 'Hoy su rostro está en el billete de cincuenta libras'.

## Respuesta

```js
/* generado por deepseek-flash · prompt prompts/component-author.md · v5 — revisar antes de usar */
(function () {
  const K = Kit, B = Kit.binary, { clamp, prog } = K;
  K.register({
    name: "binary.banknote",
    tags: ["billete", "dinero", "retrato", "historia"],
    layer: "main",
    summary: "Un billete hecho de glifos 0/1: marco doble, medallón ovalado con un retrato muestreado y el valor grande a la izquierda. Sirve para el momento en que un personaje 'termina en un billete'.",
    example: { src: "", value: "50", currency: "£", caption: "BILLETE DE 50 LIBRAS · 2021", morph: 1.0 },
    params: {
      src: { type: "image", default: "", doc: "Retrato que va dentro del medallón ovalado." },
      value: { type: "string", default: "50", doc: "Valor grande, hecho de glifos." },
      currency: { type: "string", default: "£", doc: "Símbolo de la moneda, texto nítido junto al valor." },
      caption: { type: "string", default: "", doc: "Línea mono debajo del billete." },
      morph: { type: "number", default: 1.0, doc: "Segundos de armado de la forma." },
    },

    // En 9:16 el billete apaisado se vería como una tirita. Preferimos mantenerlo
    // APILADO: valor arriba, medallón abajo, con el marco apaisado pero más alto
    // (proporción ~1.15 en vez de ~2.2). Así el retrato queda grande y legible
    // sin girar nada. En 16:9 va apaisado clásico (proporción ~2.1).
    points(ctx, p) {
      const portrait = ctx.stage.portrait;
      const ar = portrait ? 1.15 : 2.1;
      const bx = B.boxIn(ctx, portrait ? 0.86 : 0.78, ar);
      const cell = B.cellOf(ctx, portrait ? 0.85 : 0.9);
      const parts = [];

      // --- marco doble (rectángulo exterior + interior) ---
      const frame = B.sampleShape((g, w, h) => {
        g.fillStyle = "#fff";
        g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = "destination-out";
        const t = Math.max(2, h * 0.035);
        g.fillRect(t, t, w - 2 * t, h - 2 * t);
        const t2 = Math.max(1, h * 0.018);
        g.fillRect(t * 2.2, t * 2.2, w - 4.4 * t, h - 4.4 * t);
        g.fillRect(t * 2.2 + t2, t * 2.2 + t2, w - 4.4 * t - 2 * t2, h - 4.4 * t - 2 * t2);
      }, bx, { cell, edge: true, seed: 11 });
      parts.push(...frame);

      // --- medallón ovalado (a la derecha en 16:9, abajo en 9:16) ---
      const medW = portrait ? bx.w * 0.62 : bx.w * 0.34;
      const medH = portrait ? bx.h * 0.46 : bx.h * 0.72;
      const medX = portrait ? bx.x + (bx.w - medW) / 2 : bx.x + bx.w - medW - bx.w * 0.06;
      const medY = portrait ? bx.y + bx.h - medH - bx.h * 0.10 : bx.y + (bx.h - medH) / 2;
      const medBox = { x: medX, y: medY, w: medW, h: medH };

      // anillo del medallón (silueta de un óvalo hueco)
      const ring = B.sampleShape((g, w, h) => {
        g.fillStyle = "#fff";
        g.beginPath();
        g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        g.fill();
        g.globalCompositeOperation = "destination-out";
        const t = Math.max(2, h * 0.05);
        g.beginPath();
        g.ellipse(w / 2, h / 2, w / 2 - t, h / 2 - t, 0, 0, Math.PI * 2);
        g.fill();
      }, medBox, { cell, edge: true, seed: 22 });
      parts.push(...ring);

      // --- retrato dentro del medallón ---
      const img = p.src ? ctx.img(p.src) : null;
      if (img) {
        const inner = {
          x: medBox.x + medBox.w * 0.10,
          y: medBox.y + medBox.h * 0.10,
          w: medBox.w * 0.80,
          h: medBox.h * 0.80,
        };
        const face = B.sampleImage(img, inner, {
          cell: B.cellOf(ctx, portrait ? 0.75 : 0.8),
          contrast: 1.3,
          threshold: 0.08,
        });
        // recortar a la elipse del medallón
        const ecx = medBox.x + medBox.w / 2, ecy = medBox.y + medBox.h / 2;
        const rx = medBox.w * 0.40, ry = medBox.h * 0.40;
        for (const q of face) {
          const dx = (q.x - ecx) / rx, dy = (q.y - ecy) / ry;
          if (dx * dx + dy * dy <= 1) parts.push(q);
        }
      }

      // --- valor grande a la izquierda (o arriba en 9:16) ---
      const valBox = portrait
        ? { x: bx.x + bx.w * 0.10, y: bx.y + bx.h * 0.10, w: bx.w * 0.80, h: bx.h * 0.34 }
        : { x: bx.x + bx.w * 0.08, y: bx.y + bx.h * 0.18, w: bx.w * 0.46, h: bx.h * 0.64 };
      const val = B.sampleText(String(p.value), valBox, {
        font: "900 100px 'Inter', sans-serif",
        cell: B.cellOf(ctx, portrait ? 0.9 : 1.0),
        fit: "lines",
      });
      parts.push(...val);

      return B.pack(parts, ctx.family.binary.N);
    },

    motion: lt => ({ s: 1 + lt * 0.006 }),

    reveal: (lt, b, p) => clamp(lt / Math.max(0.4, p.morph ?? 1)),

    create(ctx, p) {
      const P = ctx.C.palette;
      const G = ctx.g.top;
      const { u, portrait } = ctx.stage;
      const c = ctx.stage.content;

      // caja del billete (misma fórmula que en points)
      const ar = portrait ? 1.15 : 2.1;
      const bx = B.boxIn(ctx, portrait ? 0.86 : 0.78, ar);

      // posición del símbolo de moneda: junto al valor, arriba-izq del billete
      const curX = bx.x + bx.w * (portrait ? 0.10 : 0.08);
      const curY = bx.y + bx.h * (portrait ? 0.10 : 0.20);

      // caption debajo del billete
      const capY = Math.min(bx.y + bx.h + u * 4, c.y + c.h - u * 2);

      return {
        render(lt, b, t) {
          const a = B.fadeIO(lt, b.dur, 0.5, 0.4, (p.morph ?? 1) * 0.5);

          // símbolo de moneda nítido, chico, junto al valor
          if (p.currency) {
            B.mono(G, String(p.currency), curX, curY, {
              u, size: portrait ? 3.2 : 3.6, weight: 700,
              color: P.ink, alpha: a, align: "left",
            });
          }

          // caption mono debajo
          if (p.caption) {
            B.mono(G, String(p.caption), c.x + c.w / 2, capY, {
              u, size: 1.6, color: P.muted, alpha: a * 0.9, align: "center",
            });
          }
        },
        dispose() {},
      };
    },
  });
})();

```
