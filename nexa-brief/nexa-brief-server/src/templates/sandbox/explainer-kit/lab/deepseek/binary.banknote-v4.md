# binary.banknote · v4

modelo: deepseek-flash · 8.2 s · tokens in 5724 / out 2215

## Pedido

Creá `binary.banknote`: un billete hecho de glifos 0/1: rectángulo apaisado con borde doble, un medallón ovalado a la derecha donde va un retrato muestreado de la imagen src (con B.sampleImage dentro del óvalo), y el valor grande (p. ej. '50') a la izquierda hecho de glifos con B.sampleText. Params: src (image, el retrato), value (por defecto '50'), currency (por defecto '£', va chico junto al valor como texto nítido en ctx.g.top), caption (texto mono debajo del billete, p. ej. 'BILLETE DE 50 LIBRAS · 2021'), morph. En 9:16 el billete va vertical (girado 90°) o más chico pero legible: elegí lo que se vea mejor y explicalo en un comentario. Momento narrativo: 'Hoy su rostro está en el billete de cincuenta libras'.

## Respuesta

```js
(function () {
  const K = Kit, B = Kit.binary, R = Kit.rough, { clamp, prog } = K;
  K.register({
    name: "binary.banknote",
    tags: ["billete", "retrato", "dinero", "historia"],
    layer: "main",
    summary: "Un billete hecho de dígitos 0/1: valor grande a la izquierda, medallón ovalado con retrato muestreado a la derecha. Sirve para el momento en que un rostro pasa a estar impreso en un billete.",
    example: { src: "portrait", value: "50", currency: "£", caption: "BILLETE DE 50 LIBRAS · 2021", morph: 1.2 },
    params: {
      src:      { type: "image",  default: "",   doc: "Retrato que va dentro del medallón." },
      value:    { type: "string", default: "50", doc: "Valor grande del billete." },
      currency: { type: "string", default: "£",  doc: "Símbolo de la moneda (texto nítido)." },
      caption:  { type: "string", default: "",   doc: "Texto mono debajo del billete." },
      morph:    { type: "number", default: 1.0,  doc: "Segundos de armado de la forma." },
    },
    points(ctx, p) {
      // Composición: en 9:16 el billete se dibuja APILADO (valor arriba, medallón abajo)
      // dentro de una caja más alta que ancha; en 16:9 va apaisado clásico.
      // Así el retrato queda grande y legible en celular sin girar nada.
      const portrait = ctx.stage.portrait;
      const box = portrait
        ? B.boxIn(ctx, 0.86, 0.72)   // caja alta: 86% ancho, relación 0.72 (alto/ancho)
        : B.boxIn(ctx, 0.78, 1.85);  // caja apaisada
      const cell = B.cellOf(ctx, 1);
      const parts = [];

      // --- Silueta del billete: rectángulo con borde doble ---
      const bill = B.sampleShape((g, w, h) => {
        g.fillStyle = "#fff";
        // marco exterior
        g.fillRect(0, 0, w, h);
        // hueco interior (deja solo el borde)
        g.globalCompositeOperation = "destination-out";
        g.fillRect(w * 0.035, h * 0.045, w * 0.93, h * 0.91);
        // borde interior fino
        g.globalCompositeOperation = "source-over";
        g.fillStyle = "#fff";
        const ix = w * 0.075, iy = h * 0.095, iw = w * 0.85, ih = h * 0.81;
        g.fillRect(ix, iy, iw, ih);
        g.globalCompositeOperation = "destination-out";
        g.fillRect(ix + w * 0.012, iy + h * 0.016, iw - w * 0.024, ih - h * 0.032);
        g.globalCompositeOperation = "source-over";
      }, box, { cell, edge: true, seed: 11 });
      parts.push(...bill);

      // --- Zona del valor (izquierda en 16:9, arriba en 9:16) ---
      const valueBox = portrait
        ? { x: box.x + box.w * 0.10, y: box.y + box.h * 0.14, w: box.w * 0.80, h: box.h * 0.30 }
        : { x: box.x + box.w * 0.10, y: box.y + box.h * 0.22, w: box.w * 0.42, h: box.h * 0.56 };
      const valuePts = B.sampleText(p.value, valueBox, {
        font: "900 100px 'Inter', sans-serif", cell, fit: "lines",
      });
      parts.push(...valuePts);

      // --- Medallón ovalado con retrato (derecha en 16:9, abajo en 9:16) ---
      const medBox = portrait
        ? { x: box.x + box.w * 0.22, y: box.y + box.h * 0.48, w: box.w * 0.56, h: box.h * 0.44 }
        : { x: box.x + box.w * 0.56, y: box.y + box.h * 0.16, w: box.w * 0.36, h: box.h * 0.68 };
      // máscara ovalada: dibujamos el óvalo blanco y recortamos el retrato dentro
      const ovalPts = B.sampleShape((g, w, h) => {
        g.fillStyle = "#fff";
        g.beginPath();
        g.ellipse(w / 2, h / 2, w * 0.46, h * 0.46, 0, 0, Math.PI * 2);
        g.fill();
      }, medBox, { cell, edge: true, seed: 22 });
      parts.push(...ovalPts);

      // retrato muestreado dentro del óvalo (más chico para que quede dentro del borde)
      const inner = {
        x: medBox.x + medBox.w * 0.10,
        y: medBox.y + medBox.h * 0.10,
        w: medBox.w * 0.80,
        h: medBox.h * 0.80,
      };
      const img = p.src ? ctx.img(p.src) : null;
      if (img) {
        const face = B.sampleImage(img, inner, {
          cell: B.cellOf(ctx, 0.85), contrast: 1.3, threshold: 0.08,
        });
        // recortar a la elipse: descartar puntos fuera del óvalo interior
        const cx = inner.x + inner.w / 2, cy = inner.y + inner.h / 2;
        const rx = inner.w / 2, ry = inner.h / 2;
        const clipped = [];
        for (let i = 0; i < face.x.length; i++) {
          const dx = (face.x[i] - cx) / rx, dy = (face.y[i] - cy) / ry;
          if (dx * dx + dy * dy <= 1) {
            clipped.push({ x: face.x[i], y: face.y[i], a: face.a[i], s: face.s[i], g: face.g[i], c: face.c[i] });
          }
        }
        parts.push(...B.pack(clipped, ctx.family.binary.N));
      }

      return B.pack(parts, ctx.family.binary.N);
    },
    motion: lt => ({ s: 1 + lt * 0.006 }),
    reveal: (lt, b, p) => clamp(lt / Math.max(0.4, p.morph)),
    create(ctx, p) {
      const P = ctx.C.palette, G = ctx.g.top, { u, cx, cy } = ctx.stage, c = ctx.stage.content;
      const portrait = ctx.stage.portrait;
      // Caja del billete (misma que en points) para ubicar los rótulos nítidos.
      const box = portrait ? B.boxIn(ctx, 0.86, 0.72) : B.boxIn(ctx, 0.78, 1.85);
      // Zona del valor (para pegar el símbolo de moneda junto al número).
      const valueBox = portrait
        ? { x: box.x + box.w * 0.10, y: box.y + box.h * 0.14, w: box.w * 0.80, h: box.h * 0.30 }
        : { x: box.x + box.w * 0.10, y: box.y + box.h * 0.22, w: box.w * 0.42, h: box.h * 0.56 };

      return {
        render(lt, b, t) {
          G.clearRect(0, 0, ctx.stage.W, ctx.stage.H);
          const a = B.fadeIO(lt, b.dur, 0.5, 0.4, (p.morph ?? 1) * 0.5);
          if (a <= 0.001) return;

          // Símbolo de moneda: texto nítido, chico, arriba-izquierda del valor.
          const symSize = Math.max(1.6, Math.min(3.2, (valueBox.h / u) * 0.22));
          B.mono(G, p.currency, valueBox.x + u * 0.4, valueBox.y + u * 1.6, {
            u, size: symSize, weight: 700, color: P.ink, alpha: a, align: "left",
          });

          // Caption mono debajo del billete.
          if (p.caption) {
            const capY = Math.min(box.y + box.h + u * 3.2, c.y + c.h - u * 1.2);
            B.mono(G, p.caption, cx, capY, {
              u, size: 1.6, weight: 500, color: P.muted, alpha: a * 0.9, align: "center",
            });
          }
        },
        dispose() {},
      };
    },
  });
})();
```
