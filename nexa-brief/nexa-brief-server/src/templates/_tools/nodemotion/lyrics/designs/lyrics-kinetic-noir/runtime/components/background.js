/* lyrics-kinetic-noir · fondo generado (sin medios): azul casi negro con resplandor central,
   trazos finos y curvos que derivan con cometas de luz, y humo gris en la parte baja cuando la escena lo pide.
   draw(t, st) es una función pura del tiempo: el mismo t produce el mismo cuadro. */
(function (root) {
  "use strict";
  const N = root.Noir, K = N.core;
  function hexRgb(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const n = parseInt(h.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(",");
  }
  N.background = {
    init(canvas, C) {
      this.c = canvas; this.g = canvas.getContext("2d"); this.C = C;
      const r = K.rng(C.seed * 7 + 3), B = C.background;
      this.lines = Array.from({ length: B.streaks }, () => ({
        y: 0.05 + r() * 0.9, amp: 0.02 + r() * 0.1, ph: r() * Math.PI * 2, fr: 0.4 + r() * 1.3,
        sp: (0.25 + r() * 0.6) * (r() < 0.5 ? -1 : 1), w: 0.6 + r() * 1.3, a: 0.05 + r() * 0.13,
        tilt: (r() - 0.5) * 0.35, head: r() < 0.55, hs: 0.04 + r() * 0.09, ho: r()
      }));
      this.blobs = Array.from({ length: 8 }, (_, i) => ({ x: (i + r() * 0.6) / 8, s: 0.18 + r() * 0.22, sp: 0.3 + r() * 0.5, ph: r() * 6.28, rise: 0.04 + r() * 0.08 }));
      this.ink = hexRgb(C.colors.ink); this.smokeRgb = hexRgb(C.colors.smoke);
    },
    resize(W, H) {
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      this.W = W; this.H = H; this.dpr = dpr;
      this.c.width = Math.round(W * dpr); this.c.height = Math.round(H * dpr);
      this.c.style.width = W + "px"; this.c.style.height = H + "px";
      this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    draw(t, st) {
      const { g, W, H, C } = this, B = C.background;
      g.globalAlpha = 1;
      g.fillStyle = C.colors.bg; g.fillRect(0, 0, W, H);
      const R = Math.max(W, H);
      const rg = g.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, R * 0.75);
      rg.addColorStop(0, C.colors.bg2); rg.addColorStop(1, C.colors.bg);
      g.fillStyle = rg; g.fillRect(0, 0, W, H);

      /* trazos */
      g.lineCap = "round";
      const seg = 28, sc = Math.min(W, H) / 1080;
      for (const L of this.lines) {
        const pts = [];
        for (let i = 0; i <= seg; i++) {
          const x = -0.1 + (1.2 * i) / seg;
          const y = L.y + L.tilt * (x - 0.5) + L.amp * Math.sin(L.fr * x * Math.PI * 2 + L.ph + t * L.sp * B.speed);
          pts.push([x * W, y * H]);
        }
        g.strokeStyle = `rgba(${this.ink},${(L.a * B.intensity).toFixed(3)})`;
        g.lineWidth = L.w * Math.max(0.7, sc * 1.4);
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.stroke();
        if (L.head) {
          const u = ((t * L.hs * B.speed + L.ho) % 1.25) - 0.1;
          const x = u, y = L.y + L.tilt * (x - 0.5) + L.amp * Math.sin(L.fr * x * Math.PI * 2 + L.ph + t * L.sp * B.speed);
          const hx = x * W, hy = y * H, hr = 9 * Math.max(0.6, sc);
          const hg = g.createRadialGradient(hx, hy, 0, hx, hy, hr);
          hg.addColorStop(0, `rgba(${this.ink},${(0.55 * B.intensity).toFixed(3)})`); hg.addColorStop(1, `rgba(${this.ink},0)`);
          g.fillStyle = hg; g.beginPath(); g.arc(hx, hy, hr, 0, Math.PI * 2); g.fill();
        }
      }

      /* humo bajo */
      const sm = st.smoke || 0;
      if (sm > 0) {
        for (const b of this.blobs) {
          const bx = W * (b.x + 0.04 * Math.sin(t * b.sp + b.ph));
          const by = H * (1.04 - b.rise * (1 + Math.sin(t * b.sp * 0.7 + b.ph)));
          const br = R * b.s;
          const sg = g.createRadialGradient(bx, by, 0, bx, by, br);
          sg.addColorStop(0, `rgba(${this.smokeRgb},${(0.42 * sm).toFixed(3)})`);
          sg.addColorStop(0.55, `rgba(${this.smokeRgb},${(0.18 * sm).toFixed(3)})`);
          sg.addColorStop(1, `rgba(${this.smokeRgb},0)`);
          g.fillStyle = sg; g.fillRect(bx - br, by - br, br * 2, br * 2);
        }
      }

      /* viñeta */
      const vg = g.createRadialGradient(W / 2, H / 2, R * 0.3, W / 2, H / 2, R * 0.78);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${B.vignette})`);
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
