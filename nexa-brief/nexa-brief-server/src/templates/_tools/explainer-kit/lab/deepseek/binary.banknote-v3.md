# binary.banknote · v3

modelo: deepseek-flash · 11.9 s · tokens in 5370 / out 2459

## Pedido

Creá `binary.banknote`: un billete hecho de glifos 0/1: rectángulo apaisado con borde doble, un medallón ovalado a la derecha donde va un retrato muestreado de la imagen src (con B.sampleImage dentro del óvalo), y el valor grande (p. ej. '50') a la izquierda hecho de glifos con B.sampleText. Params: src (image, el retrato), value (por defecto '50'), currency (por defecto '£', va chico junto al valor como texto nítido en ctx.g.top), caption (texto mono debajo del billete, p. ej. 'BILLETE DE 50 LIBRAS · 2021'), morph. En 9:16 el billete va vertical (girado 90°) o más chico pero legible: elegí lo que se vea mejor y explicalo en un comentario. Momento narrativo: 'Hoy su rostro está en el billete de cincuenta libras'.

## Respuesta

```js
(function () {
  const K = Kit, B = Kit.binary, { clamp, prog } = K;

  // ── Layout ────────────────────────────────────────────────────────────────
  // El billete es apaisado (ar ~2.1). En 16:9 entra cómodo: ocupa ~78% del ancho
  // de content y ~55% del alto. En 9:16 content es 0.88W × 0.60H (más alto que
  // ancho): un rectángulo apaisado quedaría chico. En vez de girarlo (el texto
  // del valor y el retrato se leerían torcidos, prohibido por las reglas), lo
  // achicamos hasta que entre a lo ancho y lo centramos: el billete ocupa ~92%
  // del ancho de content y ~40% del alto. Sigue siendo legible porque el valor
  // y el retrato son grandes dentro del billete.
  //
  // Cajas (en fracciones de content, portrait=true):
  //   billete:  x 0.04..0.96  y 0.28..0.68   (ar 2.1)
  //   valor:    dentro del billete, mitad izquierda
  //   medallón: dentro del billete, mitad derecha
  //   caption:  y 0.74 (debajo del billete, franja pie)
  // En 16:9:
  //   billete:  x 0.11..0.89  y 0.20..0.72
  //   caption:  y 0.80

  K.register({
    name: "binary.banknote",
    tags: ["billete", "dinero", "retrato", "historia"],
    layer: "main",
    summary: "Un billete hecho de dígitos 0/1: borde doble, valor grande a la izquierda y medallón ovalado con un retrato muestreado a la derecha. Sirve para el momento en que un personaje 'termina en un billete'.",
    example: { src: "", value: "50", currency: "£", caption: "BILLETE DE 50 LIBRAS · 2021", morph: 1.0 },
    params: {
      src:      { type: "image",  default: "", doc: "Retrato que va dentro del medallón." },
      value:    { type: "string", default: "50", doc: "Valor grande del billete." },
      currency: { type: "string", default: "£", doc: "Símbolo de la moneda (texto nítido)." },
      caption:  { type: "string", default: "", doc: "Texto mono debajo del billete." },
      morph:    { type: "number", default: 1.0, doc: "Segundos de armado." },
    },

    points(ctx, p) {
      const c = ctx.stage.content;
      const portrait = ctx.stage.portrait;

      // Caja del billete (apaisada, ar ≈ 2.1)
      const ar = 2.1;
      let bw, bh;
      if (portrait) {
        bw = c.w * 0.92;
        bh = bw / ar;
      } else {
        bw = c.w * 0.78;
        bh = bw / ar;
        if (bh > c.h * 0.55) { bh = c.h * 0.55; bw = bh * ar; }
      }
      const bx = c.x + (c.w - bw) / 2;
      const by = c.y + (c.h - bh) / 2 - (portrait ? c.h * 0.02 : 0);

      const cell = B.cellOf(ctx, 1);
      const pts = [];

      // ── Borde exterior (marco) ──────────────────────────────────────────
      // Rectángulo hueco: dibujamos el marco como 4 bandas gruesas.
      const mw = Math.max(cell * 2.2, bh * 0.035); // grosor del marco
      const drawFrame = (g, w, h, inset, thick) => {
        g.fillRect(inset, inset, w - inset * 2, thick);
        g.fillRect(inset, h - inset - thick, w - inset * 2, thick);
        g.fillRect(inset, inset, thick, h - inset * 2);
        g.fillRect(w - inset - thick, inset, thick, h - inset * 2);
      };

      // Borde exterior
      const framePts = B.sampleShape((g, w, h) => {
        drawFrame(g, w, h, 0, mw);
      }, { x: bx, y: by, w: bw, h: bh }, { cell, edge: false });
      pts.push(...framePts);

      // Borde interior (doble línea)
      const inset2 = mw * 2.0;
      const innerPts = B.sampleShape((g, w, h) => {
        drawFrame(g, w, h, inset2, Math.max(cell * 1.2, mw * 0.45));
      }, { x: bx, y: by, w: bw, h: bh }, { cell, edge: false });
      pts.push(...innerPts);

      // ── Medallón ovalado a la derecha ───────────────────────────────────
      const medW = bw * 0.30;
      const medH = bh * 0.66;
      const medCx = bx + bw * 0.76;
      const medCy = by + bh * 0.50;

      // Aro del medallón (óvalo hueco)
      const ringPts = B.sampleShape((g, w, h) => {
        const cx = w / 2, cy = h / 2;
        const rx = w / 2, ry = h / 2;
        const thick = Math.max(cell * 1.6, w * 0.06);
        g.beginPath();
        g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        g.ellipse(cx, cy, rx - thick, ry - thick, 0, 0, Math.PI * 2);
        g.fill("evenodd");
      }, { x: medCx - medW / 2, y: medCy - medH / 2, w: medW, h: medH }, { cell, edge: false });
      pts.push(...ringPts);

      // ── Retrato dentro del medallón ─────────────────────────────────────
      const img = p.src ? ctx.img(p.src) : null;
      if (img) {
        const innerW = medW * 0.78;
        const innerH = medH * 0.78;
        const imgPts = B.sampleImage(img, {
          x: medCx - innerW / 2,
          y: medCy - innerH / 2,
          w: innerW,
          h: innerH,
        }, { cell: B.cellOf(ctx, 0.9), contrast: 1.3, threshold: 0.08 });
        pts.push(...imgPts);
      }

      // ── Valor grande a la izquierda ─────────────────────────────────────
      const valBox = {
        x: bx + bw * 0.08,
        y: by + bh * 0.18,
        w: bw * 0.42,
        h: bh * 0.64,
      };
      const valPts = B.sampleText(p.value, valBox, {
        font: "900 100px 'Inter', sans-serif",
        cell: B.cellOf(ctx, 1.1),
        fit: "lines",
      });
      pts.push(...valPts);

      return B.pack(pts, ctx.family.binary.N);
    },

    motion: lt => ({ s: 1 + lt * 0.006 }),

    reveal: (lt, b, p) => clamp(lt / Math.max(0.4, p.morph)),

    create(ctx, p) {
      const c = ctx.stage.content;
      const portrait = ctx.stage.portrait;
      const u = ctx.stage.u;
      const G = ctx.g.top;

      // Recalcular la caja del billete igual que en points() para ubicar los rótulos.
      const ar = 2.1;
      let bw, bh;
      if (portrait) {
        bw = c.w * 0.92;
        bh = bw / ar;
      } else {
        bw = c.w * 0.78;
        bh = bw / ar;
        if (bh > c.h * 0.55) { bh = c.h * 0.55; bw = bh * ar; }
      }
      const bx = c.x + (c.w - bw) / 2;
      const by = c.y + (c.h - bh) / 2 - (portrait ? c.h * 0.02 : 0);

      const medCx = bx + bw * 0.76;
      const medCy = by + bh * 0.50;
      const medW = bw * 0.30;

      // Símbolo de moneda: texto nítido junto al valor.
      const curSize = Math.max(u * 2.4, bh * 0.10);
      const curX = bx + bw * 0.08;
      const curY = by + bh * 0.18;

      return {
        render(lt, b, t) {
          G.clearRect(0, 0, ctx.stage.W, ctx.stage.H);

          const a = B.fadeIO(lt, b.dur, 0.5, 0.4, (p.morph ?? 1) * 0.5);
          if (a <= 0.001) return;

          // Símbolo de moneda (nítido, mono)
          B.mono(G, p.currency, curX, curY + curSize * 0.9, {
            u, size: curSize / u, weight: 700, color: "#fff", alpha: a, align: "left",
          });

          // Caption debajo del billete
          if (p.caption) {
            const capY = by + bh + (portrait ? c.h * 0.06 : c.h * 0.08);
            B.mono(G, p.caption, c.x + c.w / 2, capY, {
              u, size: Math.max(1.6, u * 1.8 / u), weight: 500,
              color: "#fff", alpha: a * 0.85, align: "center",
            });
          }
        },
        dispose() {},
      };
    },
  });
})();
```
