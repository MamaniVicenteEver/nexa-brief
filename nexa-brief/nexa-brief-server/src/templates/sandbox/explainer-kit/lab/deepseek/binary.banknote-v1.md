# binary.banknote · v1

modelo: deepseek-flash · 11.1 s · tokens in 4235 / out 2821

## Pedido

Creá `binary.banknote`: un billete hecho de glifos 0/1: rectángulo apaisado con borde doble, un medallón ovalado a la derecha donde va un retrato muestreado de la imagen src (con B.sampleImage dentro del óvalo), y el valor grande (p. ej. '50') a la izquierda hecho de glifos con B.sampleText. Params: src (image, el retrato), value (por defecto '50'), currency (por defecto '£', va chico junto al valor como texto nítido en ctx.g.top), caption (texto mono debajo del billete, p. ej. 'BILLETE DE 50 LIBRAS · 2021'), morph. En 9:16 el billete va vertical (girado 90°) o más chico pero legible: elegí lo que se vea mejor y explicalo en un comentario. Momento narrativo: 'Hoy su rostro está en el billete de cincuenta libras'.

## Respuesta

```js
(function () {
  const K = Kit, B = Kit.binary, { clamp, lerp } = K;

  // En 9:16 el billete apaisado no entra a lo ancho de `content`, así que lo giramos 90°:
  // el rectángulo se dibuja apaisado en un lienzo virtual y luego se rota -90° alrededor
  // del centro. Así el valor y el medallón quedan apilados verticalmente y se leen bien.
  K.register({
    name: "binary.banknote",
    tags: ["billete", "dinero", "retrato", "historia"],
    layer: "main",
    summary: "Un billete hecho de glifos 0/1: borde doble, valor grande a un lado y medallón con retrato muestreado del src. Sirve para el momento en que un personaje 'termina en un billete'.",
    example: { src: "portrait", value: "50", currency: "£", caption: "BILLETE DE 50 LIBRAS · 2021", morph: 1.0 },
    params: {
      src: { type: "image", default: "", doc: "Retrato que va dentro del medallón." },
      value: { type: "string", default: "50", doc: "Valor grande, hecho de glifos." },
      currency: { type: "string", default: "£", doc: "Símbolo chico junto al valor (texto nítido)." },
      caption: { type: "string", default: "", doc: "Línea mono debajo del billete." },
      morph: { type: "number", default: 1.0, doc: "Segundos de armado." },
    },

    points(ctx, p) {
      const c = ctx.stage.content;
      const portrait = ctx.stage.portrait;
      const cell = B.cellOf(ctx, 1);

      // Caja del billete apaisado, en un lienzo virtual. En 9:16 lo hacemos más chico
      // (para que al girarlo entre a lo alto) y lo rotamos al final.
      const ar = 2.05; // proporción apaisada del billete
      let bw, bh;
      if (portrait) {
        // vertical: el billete girado ocupa a lo alto; su ancho apaisado = alto disponible
        bh = c.h * 0.62;
        bw = bh * ar;
      } else {
        bw = c.w * 0.82;
        bh = bw / ar;
      }
      const bx = c.x + (c.w - bw) / 2;
      const by = c.y + (c.h - bh) / 2;

      const pts = [];

      // --- helpers de muestreo dentro del lienzo virtual ---
      const push = (list) => { for (let i = 0; i < list.length; i++) pts.push(list[i]); };

      // 1) Borde doble del billete (dos rectángulos huecos, hechos de puntos).
      const border = (x, y, w, h, thick) => {
        const out = [];
        const step = cell;
        const nx = Math.max(2, Math.round(w / step));
        const ny = Math.max(2, Math.round(h / step));
        for (let i = 0; i <= nx; i++) {
          const px = x + (w * i) / nx;
          for (let k = 0; k < thick; k++) {
            out.push({ x: px, y: y + k * step, a: 1, s: 1, g: 0, c: 0 });
            out.push({ x: px, y: y + h - k * step, a: 1, s: 1, g: 0, c: 0 });
          }
        }
        for (let j = 0; j <= ny; j++) {
          const py = y + (h * j) / ny;
          for (let k = 0; k < thick; k++) {
            out.push({ x: x + k * step, y: py, a: 1, s: 1, g: 0, c: 0 });
            out.push({ x: x + w - k * step, y: py, a: 1, s: 1, g: 0, c: 0 });
          }
        }
        return out;
      };
      push(border(bx, by, bw, bh, 2));
      const pad = Math.max(cell * 2, bh * 0.06);
      push(border(bx + pad, by + pad, bw - pad * 2, bh - pad * 2, 1));

      // 2) Valor grande a la izquierda, hecho de glifos.
      const valBox = {
        x: bx + pad * 1.4,
        y: by + bh * 0.30,
        w: bw * 0.30,
        h: bh * 0.40,
      };
      const valPts = B.sampleText(String(p.value), valBox, {
        font: "900 100px 'Inter', sans-serif",
        cell,
        fit: "lines",
      });
      push(valPts);

      // 3) Medallón ovalado a la derecha, con el retrato muestreado adentro.
      const medW = bw * 0.34;
      const medH = bh * 0.62;
      const medCx = bx + bw - pad * 1.4 - medW / 2;
      const medCy = by + bh / 2;

      // anillo del medallón (óvalo hueco)
      const ring = [];
      const rx = medW / 2, ry = medH / 2;
      const steps = Math.max(24, Math.round((rx + ry) / cell));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        for (let k = 0; k < 2; k++) {
          const rr = 1 - k * (cell / Math.max(rx, ry));
          ring.push({
            x: medCx + Math.cos(a) * rx * rr,
            y: medCy + Math.sin(a) * ry * rr,
            a: 1, s: 1, g: 0, c: 0,
          });
        }
      }
      push(ring);

      // retrato dentro del óvalo (recortado por máscara elíptica)
      if (p.src && ctx.img) {
        const img = ctx.img(p.src);
        if (img) {
          const inner = {
            x: medCx - rx * 0.86,
            y: medCy - ry * 0.86,
            w: rx * 1.72,
            h: ry * 1.72,
          };
          const imgPts = B.sampleImage(img, inner, { cell, contrast: 1.15, threshold: 0.42 });
          // recortar a la elipse
          const ex = rx * 0.86, ey = ry * 0.86;
          for (let i = 0; i < imgPts.length; i++) {
            const q = imgPts[i];
            const dx = (q.x - medCx) / ex;
            const dy = (q.y - medCy) / ey;
            if (dx * dx + dy * dy <= 1) {
              q.c = 1; // el retrato va en acento
              pts.push(q);
            }
          }
        }
      }

      // 4) Giramos todo el billete en 9:16 (alrededor del centro de content).
      if (portrait) {
        const ccx = c.x + c.w / 2;
        const ccy = c.y + c.h / 2;
        const ang = -Math.PI / 2;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        for (let i = 0; i < pts.length; i++) {
          const q = pts[i];
          const dx = q.x - ccx, dy = q.y - ccy;
          q.x = ccx + dx * ca - dy * sa;
          q.y = ccy + dx * sa + dy * ca;
        }
      }

      return B.pack(pts, ctx.family.binary.N);
    },

    motion: (lt) => ({ s: 1 + lt * 0.006 }),

    reveal: (lt, b, p) => clamp(lt / Math.max(0.001, p.morph)),

    create(ctx, p) {
      const P = ctx.C.palette;
      const G = ctx.g.top;
      const c = ctx.stage.content;
      const u = ctx.stage.u;
      const portrait = ctx.stage.portrait;

      // Posición del rótulo del valor (nítido) y del caption.
      // Replicamos el layout del billete para saber dónde cae el valor.
      const ar = 2.05;
      let bw, bh;
      if (portrait) { bh = c.h * 0.62; bw = bh * ar; }
      else { bw = c.w * 0.82; bh = bw / ar; }
      const bx = c.x + (c.w - bw) / 2;
      const by = c.y + (c.h - bh) / 2;
      const pad = Math.max(B.cellOf(ctx, 1) * 2, bh * 0.06);

      // Punto del valor en el lienzo virtual (antes del giro).
      let vx = bx + pad * 1.4 + bw * 0.15;
      let vy = by + bh * 0.50;
      // Punto del caption (debajo del billete, en el lienzo virtual).
      let capX = bx + bw / 2;
      let capY = by + bh + u * 3.2;

      // Si es vertical, giramos esos puntos igual que los del billete.
      if (portrait) {
        const ccx = c.x + c.w / 2, ccy = c.y + c.h / 2;
        const ang = -Math.PI / 2, ca = Math.cos(ang), sa = Math.sin(ang);
        const rot = (x, y) => {
          const dx = x - ccx, dy = y - ccy;
          return [ccx + dx * ca - dy * sa, ccy + dx * sa + dy * ca];
        };
        [vx, vy] = rot(vx, vy);
        [capX, capY] = rot(capX, capY);
      }

      const valSize = Math.max(2.2 * u, bh * 0.11);
      const curSize = valSize * 0.55;
      const capSize = Math.max(1.6 * u, u * 2.0);

      return {
        render(lt, b, t) {
          G.clearRect(0, 0, ctx.stage.W, ctx.stage.H);

          const a = B.fadeIO(lt, b.dur, 0.5, 0.4, (p.morph ?? 1) * 0.5);

          // Símbolo de moneda chico, arriba-izquierda del valor.
          if (p.currency) {
            B.mono(G, String(p.currency), vx - valSize * 0.55, vy - valSize * 0.55, {
              u, size: curSize / u, weight: 700, color: P.ink, alpha: a, align: "right",
            });
          }

          // Caption mono debajo del billete.
          if (p.caption) {
            B.mono(G, String(p.caption).toUpperCase(), capX, capY, {
              u, size: capSize / u, weight: 500, color: P.muted, alpha: a, align: "center",
            });
          }

          if (lt > b.dur) {
            // salida estándar: los glifos los maneja el motor; acá solo bajamos rótulos
            const q = clamp((lt - b.dur) / 0.6);
            G.globalAlpha = 1 - q;
            G.globalAlpha = 1;
          }
        },
        dispose() {},
      };
    },
  });
})();
```
