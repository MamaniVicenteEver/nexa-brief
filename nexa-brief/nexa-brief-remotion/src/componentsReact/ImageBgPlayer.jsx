import React, { useEffect, useRef } from "react";
// Importamos la imagen desde assets. Si usas Vite o CRA esto resolverá la ruta base.
import bgImage from "../assets/bg.png";

// Configuración por defecto (simulando config.json)
const DEFAULT_CONFIG = {
  colors: {
    bg: "#FFFFFF",
    ink: "#111111",
  },
  typography: "default", // "default", "condensed", "serif-display", "black-rounded"
  img: {
    src: bgImage,
    w: 1080,
    h: 1920,
  },
  bgMode: "blur", // "blur", "regions", "solid"
  bgRegions: [],
  edgeFade: 0.15,
  texts: {
    left: "AUDIO",
    right: "VISUAL",
  },
  anchorPreference: "middle", // "top", "middle", "bottom"
  subject: {
    top: 600,
    bottom: 1300,
  },
  // Contornos de corte por zonas [y0, y1, xl, xr] en pixeles de la imagen original
  zones: [
    [0, 600, 200, 880],
    [600, 1300, 150, 930],
    [1300, 1920, 200, 880],
  ],
  keepOut: [],
};

const FONT_STACKS = {
  default: `"Arial Black", "Helvetica Neue", Impact, sans-serif`,
  condensed: `"Liberation Sans Narrow", "Nimbus Sans Narrow", "Ubuntu Condensed", sans-serif`,
  "serif-display": `"Liberation Serif", "DejaVu Serif", "FreeSerif", serif`,
  "black-rounded": `"Lato Black", Lato, sans-serif`,
};

export default function ImageBgPlayer({ config = DEFAULT_CONFIG, audioSrc }) {
  const stageRef = useRef(null);
  const bgElRef = useRef(null);
  const blurElRef = useRef(null);
  const fillElRef = useRef(null);
  const tLRef = useRef(null);
  const tRRef = useRef(null);
  const eqRef = useRef(null);
  const audioRef = useRef(null);

  const eqInkRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const freqRef = useRef(null);

  useEffect(() => {
    const GUT = 20;
    const GAP = 14;
    const fontStack = FONT_STACKS[config.typography] || FONT_STACKS["default"];

    // Canvas de medición aislado
    const mctx = document.createElement("canvas").getContext("2d");
    const FONT = (s) => `900 ${s}px ${fontStack}`;
    const measure = (str) => {
      mctx.font = FONT(100);
      return mctx.measureText(str).width;
    };

    // Funciones de ajuste de texto
    const fitH = (text, rw, rh) => {
      const w100 = measure(text);
      const fs = Math.min((100 * rw) / w100, rh / 0.85);
      return fs > 4
        ? { fs, w: (w100 * fs) / 100, h: fs * 0.85, content: text }
        : null;
    };

    const fitW = (text, rw, rh) => {
      const words = text.trim().split(/\s+/);
      if (words.length < 2) return null;
      const maxW100 = Math.max(...words.map(measure));
      const fs = Math.min((100 * rw) / maxW100, rh / (words.length * 0.85));
      return fs > 4
        ? {
            fs,
            w: (maxW100 * fs) / 100,
            h: words.length * fs * 0.85,
            content: words.join("\n"),
          }
        : null;
    };

    const fitV = (text, rw, rh) => {
      const chars = text.replace(/\s+/g, "").split("");
      const maxC100 = Math.max(...chars.map(measure));
      const fs = Math.min((100 * rw) / maxC100, rh / (chars.length * 0.85));
      return fs > 4
        ? {
            fs,
            w: (maxC100 * fs) / 100,
            h: chars.length * fs * 0.85,
            content: chars.join("\n"),
          }
        : null;
    };

    const bestFit = (text, rects, minFS) => {
      let bH = null,
        bV = null,
        rH = null,
        rV = null;
      for (const r of rects) {
        if (r.w < 30 || r.h < 30) continue;
        for (const f of [fitH(text, r.w, r.h), fitW(text, r.w, r.h)]) {
          if (f && (!bH || f.fs > bH.fs)) {
            bH = f;
            rH = r;
          }
        }
        const v = fitV(text, r.w, r.h);
        if (v && (!bV || v.fs > bV.fs)) {
          bV = v;
          rV = r;
        }
      }
      if (bH && bH.fs >= minFS) return { ...bH, rect: rH };
      if (bV && bV.fs >= minFS) return { ...bV, rect: rV };
      const s =
        bH && bV
          ? bH.fs >= bV.fs
            ? { f: bH, r: rH }
            : { f: bV, r: rV }
          : bH
          ? { f: bH, r: rH }
          : bV
          ? { f: bV, r: rV }
          : null;
      return s ? { ...s.f, rect: s.r } : null;
    };

    const place = (el, fit, align) => {
      if (!el) return null;
      if (!fit) {
        el.textContent = "";
        return null;
      }
      const vw = window.innerWidth,
        vh = window.innerHeight,
        r = fit.rect;
      el.style.fontSize = fit.fs + "px";
      el.textContent = fit.content;
      let x =
        align === "right"
          ? r.x + r.w - fit.w
          : align === "band"
          ? r.x + (r.w - fit.w) / 2
          : r.x;
      let y = r.y + (r.h - fit.h) / 2;
      x = Math.max(GUT, Math.min(x, vw - fit.w - GUT));
      y = Math.max(GUT, Math.min(y, vh - fit.h - GUT));
      el.style.left = x + "px";
      el.style.top = y + "px";
      el.style.textAlign = align === "band" ? "center" : align;
      return { x, y, w: fit.w, h: fit.h };
    };

    // Layout principal
    const layout = () => {
      const bgEl = bgElRef.current;
      const tL = tLRef.current;
      const tR = tRRef.current;
      const eq = eqRef.current;
      const blurEl = blurElRef.current;
      const fillEl = fillElRef.current;

      if (!bgEl || !tL || !tR || !eq) return;

      tL.style.textShadow = "";
      tR.style.textShadow = "";
      const vw = window.innerWidth,
        vh = window.innerHeight;
      const C = config,
        iw = C.img.w,
        ih = C.img.h;
      const dw = Math.min(vw, (vh * iw) / ih),
        dh = Math.min(vh, (vw * ih) / iw);
      const ix = (vw - dw) / 2,
        iy = (vh - dh) / 2,
        k = dw / iw;

      bgEl.style.left = `${ix}px`;
      bgEl.style.top = `${iy}px`;
      bgEl.style.width = `${dw}px`;
      bgEl.style.height = `${dh}px`;

      const X = (px) => ix + px * k;
      const Y = (px) => iy + px * k;

      const fadeK = (C.edgeFade || 0) * (C.bgMode === "blur" ? 2 : 1);
      const fade = Math.max(
        24,
        Math.min(C.bgMode === "blur" ? 160 : 90, Math.min(dw, dh) * fadeK)
      );
      bgEl.style.setProperty(
        "--fx",
        (C.edgeFade && dw < vw - 1 ? fade : 0) + "px"
      );
      bgEl.style.setProperty(
        "--fy",
        (C.edgeFade && dh < vh - 1 ? fade : 0) + "px"
      );

      const eqH = Math.min(90, Math.max(44, vh * 0.06));
      eq.style.height = eqH + "px";
      const minFS = Math.max(26, vh * 0.05);

      const regions = C.bgMode === "regions" ? C.bgRegions || [] : [];
      if (blurEl) {
        blurEl.style.display = C.bgMode === "blur" ? "block" : "none";
        if (C.bgMode === "blur" && !blurEl.getAttribute("src"))
          blurEl.src = C.img.src;
      }

      const proj = (rg) => {
        const [x0, y0, x1, y1] = rg.rect;
        return {
          x0: x0 <= 0 ? 0 : X(x0),
          x1: x1 >= iw ? vw : X(x1),
          y0: y0 <= 0 ? 0 : Y(y0),
          y1: y1 >= ih ? vh : Y(y1),
        };
      };

      if (fillEl) {
        fillEl.innerHTML = "";
        for (const rg of regions) {
          const p = proj(rg),
            d = document.createElement("div");
          d.style.cssText = `left:${p.x0}px;top:${p.y0}px;width:${
            p.x1 - p.x0
          }px;height:${p.y1 - p.y0}px;background:${rg.color};position:absolute;`;
          fillEl.appendChild(d);
        }
      }

      const inkAt = (px, py) => {
        for (const rg of regions) {
          const p = proj(rg);
          if (px >= p.x0 && px < p.x1 && py >= p.y0 && py < p.y1)
            return rg.ink || C.colors.ink;
        }
        return C.colors.ink;
      };

      eqInkRef.current = regions.length
        ? (x) => inkAt(x, vh - eqH / 2)
        : null;

      const tint = (el, p) => {
        if (p && el) el.style.color = inkAt(p.x + p.w / 2, p.y + p.h / 2);
      };

      const cut = (rects) => {
        if (!regions.length) return rects;
        const out = [];
        for (const r of rects)
          for (const rg of regions) {
            const p = proj(rg);
            const x0 = Math.max(r.x, p.x0),
              y0 = Math.max(r.y, p.y0);
            const x1 = Math.min(r.x + r.w, p.x1),
              y1 = Math.min(r.y + r.h, p.y1);
            if (x1 - x0 >= 30 && y1 - y0 >= 30)
              out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
          }
        return out.length ? out : rects;
      };

      const carve = (rects) => {
        let list = rects;
        for (const ko of C.keepOut || []) {
          const kx0 = X(ko[0]),
            ky0 = Y(ko[1]),
            kx1 = X(ko[2]),
            ky1 = Y(ko[3]);
          const next = [];
          for (const r of list) {
            const ox0 = Math.max(r.x, kx0),
              oy0 = Math.max(r.y, ky0);
            const ox1 = Math.min(r.x + r.w, kx1),
              oy1 = Math.min(r.y + r.h, ky1);
            if (ox0 >= ox1 || oy0 >= oy1) {
              next.push(r);
              continue;
            }
            if (ox0 - r.x >= 30)
              next.push({ x: r.x, y: r.y, w: ox0 - r.x, h: r.h });
            if (r.x + r.w - ox1 >= 30)
              next.push({ x: ox1, y: r.y, w: r.x + r.w - ox1, h: r.h });
            if (oy0 - r.y >= 30)
              next.push({ x: r.x, y: r.y, w: r.w, h: oy0 - r.y });
            if (r.y + r.h - oy1 >= 30)
              next.push({ x: r.x, y: oy1, w: r.w, h: r.y + r.h - oy1 });
          }
          list = next;
        }
        return list;
      };

      const usable = (rects) => carve(cut(rects));

      const rectsL = [],
        rectsR = [];
      for (const [y0, y1, xl, xr] of C.zones) {
        const ry = Math.max(GUT, Y(y0)),
          ry1 = Math.min(vh - GUT, Y(y1));
        rectsL.push({ x: GUT, y: ry, w: X(xl) - GAP - GUT, h: ry1 - ry });
        rectsR.push({
          x: X(xr) + GAP,
          y: ry,
          w: vw - GUT - X(xr) - GAP,
          h: ry1 - ry,
        });
      }

      let fL = null,
        fR = null;
      if (C.anchorPreference || (C.keepOut || []).length) {
        const zoneIndex = { top: 0, middle: 1, bottom: 2 }[C.anchorPreference];
        const fallback = [2, 1, 0].filter(
          (i) => i !== zoneIndex && i < rectsL.length
        );
        const order =
          zoneIndex !== undefined && zoneIndex < rectsL.length
            ? [zoneIndex, ...fallback]
            : fallback;
        for (const i of order) {
          const tryL = bestFit(C.texts.left, usable([rectsL[i]]), minFS);
          const tryR = bestFit(C.texts.right, usable([rectsR[i]]), minFS);
          if (tryL && tryR && tryL.fs >= minFS && tryR.fs >= minFS) {
            fL = tryL;
            fR = tryR;
            break;
          }
        }
      }
      if (!fL || !fR) {
        fL = bestFit(C.texts.left, usable(rectsL), minFS);
        fR = bestFit(C.texts.right, usable(rectsR), minFS);
      }

      const flankOK = fL && fR && fL.fs >= minFS && fR.fs >= minFS;

      if (flankOK) {
        tint(tL, place(tL, fL, "right"));
        tint(tR, place(tR, fR, "left"));
      } else {
        const bandW = vw - 2 * GUT;
        const topEnd = Math.max(iy, Y(C.subject.top)) - GAP;
        const botStart = Math.max(Y(C.subject.bottom), iy + dh) + GAP;
        const botEnd = vh - eqH - GAP;
        const topOK = topEnd - GUT >= 46,
          botOK = botEnd - botStart >= 46;
        let txtT = C.texts.left,
          txtB = C.texts.right,
          bT,
          bB;
        if (topOK && botOK) {
          bT = { x: GUT, y: GUT, w: bandW, h: topEnd - GUT };
          bB = { x: GUT, y: botStart, w: bandW, h: botEnd - botStart };
        } else if (topOK) {
          txtT = C.texts.left + " " + C.texts.right;
          txtB = "";
          bT = { x: GUT, y: GUT, w: bandW, h: topEnd - GUT };
        } else if (botOK) {
          txtB = C.texts.left + " " + C.texts.right;
          txtT = "";
          bB = { x: GUT, y: botStart, w: bandW, h: botEnd - botStart };
        } else {
          txtT = C.texts.left + " " + C.texts.right;
          txtB = "";
          bT = { x: GUT, y: GUT, w: bandW, h: vh * 0.16 };
          tL.style.textShadow =
            "0 0 10px var(--bg), 0 0 22px var(--bg), 0 0 34px var(--bg)";
        }
        tint(
          tL,
          place(tL, txtT && bT ? bestFit(txtT, usable([bT]), 18) : null, "band")
        );
        tint(
          tR,
          place(tR, txtB && bB ? bestFit(txtB, usable([bB]), 18) : null, "band")
        );
      }

      const dpr = window.devicePixelRatio || 1;
      eq.width = vw * dpr;
      eq.height = eqH * dpr;
      const c = eq.getContext("2d");
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Manejador de resize con animation frame
    let rq = false;
    const handleResize = () => {
      if (!rq) {
        rq = true;
        requestAnimationFrame(() => {
          rq = false;
          layout();
        });
      }
    };

    window.addEventListener("resize", handleResize);
    layout();

    // Loop de render del Canvas Ecualizador
    let animationFrameId;
    const drawEqualizer = () => {
      const eq = eqRef.current;
      if (eq) {
        const ec = eq.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const w = eq.width / dpr;
        const h = eq.height / dpr;
        const BARS = 64;

        ec.clearRect(0, 0, w, h);
        const bw = w / BARS;
        const mid = h / 2;

        if (analyserRef.current && freqRef.current) {
          analyserRef.current.getByteFrequencyData(freqRef.current);
        }

        for (let i = 0; i < BARS; i++) {
          const v = freqRef.current
            ? freqRef.current[Math.floor((i * freqRef.current.length) / BARS)] / 255
            : 0;
          const bh = Math.max(2, v * (h - 6));
          ec.fillStyle = eqInkRef.current
            ? eqInkRef.current(i * bw + bw / 2)
            : config.colors.ink;
          ec.fillRect(i * bw + bw * 0.18, mid - bh / 2, bw * 0.64, bh);
        }
      }
      animationFrameId = requestAnimationFrame(drawEqualizer);
    };

    drawEqualizer();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [config]);

  // Handler para reproducir audio al interactuar (Autoplay policy support)
  const initAudio = async () => {
    const audio = audioRef.current;
    if (!audio || audioCtxRef.current) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const src = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      src.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      freqRef.current = new Uint8Array(analyser.frequencyBinCount);

      if (ctx.state === "suspended") await ctx.resume();
      await audio.play();
    } catch (e) {
      console.warn("Autoplay bloqueado o no soportado en este contexto", e);
    }
  };

  const fontStack = FONT_STACKS[config.typography] || FONT_STACKS["default"];

  return (
    <div
      ref={stageRef}
      onClick={initAudio}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: config.colors.bg,
        cursor: "pointer",
        userSelect: "none",
        fontFamily: fontStack,
      }}
    >
      {/* Imagen difuminada de fondo */}
      <img
        ref={blurElRef}
        src={config.img.src}
        alt=""
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          objectFit: "cover",
          zIndex: 0,
          filter: "blur(50px) saturate(1.15)",
          transform: "scale(1.15)",
          display: config.bgMode === "blur" ? "block" : "none",
        }}
      />

      {/* Regiones de fondo */}
      <div id="bgfill" ref={fillElRef} style={{ position: "fixed", inset: 0, zIndex: 0 }} />

      {/* Imagen Principal */}
      <img
        ref={bgElRef}
        src={config.img.src}
        alt="Background"
        style={{
          position: "fixed",
          objectFit: "contain",
          zIndex: 1,
          WebkitMaskImage: `
            linear-gradient(to right, transparent 0, #000 var(--fx, 0px), #000 calc(100% - var(--fx, 0px)), transparent 100%),
            linear-gradient(to bottom, transparent 0, #000 var(--fy, 0px), #000 calc(100% - var(--fy, 0px)), transparent 100%)
          `,
          WebkitMaskComposite: "source-in",
          maskImage: `
            linear-gradient(to right, transparent 0, #000 var(--fx, 0px), #000 calc(100% - var(--fx, 0px)), transparent 100%),
            linear-gradient(to bottom, transparent 0, #000 var(--fy, 0px), #000 calc(100% - var(--fy, 0px)), transparent 100%)
          `,
          maskComposite: "intersect",
        }}
      />

      {/* Textos tipográficos */}
      <div
        ref={tLRef}
        style={{
          position: "fixed",
          zIndex: 3,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "-0.02em",
          lineHeight: 0.85,
          color: config.colors.ink,
          whiteSpace: "pre-line",
          pointerEvents: "none",
        }}
      />
      <div
        ref={tRRef}
        style={{
          position: "fixed",
          zIndex: 3,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "-0.02em",
          lineHeight: 0.85,
          color: config.colors.ink,
          whiteSpace: "pre-line",
          pointerEvents: "none",
        }}
      />

      {/* Canvas del Ecualizador */}
      <canvas
        ref={eqRef}
        style={{
          position: "fixed",
          left: 0,
          bottom: 0,
          width: "100vw",
          zIndex: 4,
          pointerEvents: "none",
        }}
      />

      {/* Audio opcional */}
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          loop
          preload="auto"
          style={{ display: "none" }}
        />
      )}
    </div>
  );
}