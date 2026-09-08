// Layout puro y determinista compartido por ImageBg.js y MotionBackdrop.js —
// réplica exacta de la función layout() de
// src/templates/01-image-bg/index.html y src/templates/motion-backdrop/index.html
// (nexa-brief-server). Ambos HTML originales son idénticos byte a byte desde
// el bloque "edge fade" en adelante (todo lo que sigue a la resolución de la
// caja de fondo ix/iy/dw/dh/k + las funciones X/Y) — la única diferencia real
// entre imagen y video es CÓMO se calcula esa caja (imagen: fit simple by
// aspect ratio; video: además maneja rotación y content-box/letterbox). Por
// eso ese cálculo de caja vive en cada componente, y todo lo de acá para abajo
// (edge fade, regions, keepOut, flanking vs. band mode, tipografía) es un
// único módulo sin duplicar ~150 líneas de matemática idéntica.
//
// Sin RNG, sin reloj: función pura de config + tamaño de viewport. Se calcula
// una sola vez por render con React.useMemo en el componente (no depende de
// `frame`, a diferencia del ecualizador que sí es audio-reactivo).

const GUT = 20;
const GAP = 14;

// Mismo mapeo que el <script> de ambos HTML — el string debe ser IDÉNTICO al
// que efectivamente pinta la tipografía (fontFamily del nodo React), o
// fitH/fitW/fitV miden un ancho que no corresponde a lo que se ve.
const FONT_STACKS = {
  default: '"Arial Black","Helvetica Neue",Impact,sans-serif',
  condensed: '"Liberation Sans Narrow","Nimbus Sans Narrow","Ubuntu Condensed",sans-serif',
  'serif-display': '"Liberation Serif","DejaVu Serif","FreeSerif",serif',
  'black-rounded': '"Lato Black",Lato,sans-serif',
};

function resolveFontStack(typography) {
  return FONT_STACKS[typography] || FONT_STACKS.default;
}

// CSS mask-image compartido por #bg (imagen) y #clip (video) en el original
// (--fx/--fy vía custom properties). Acá se interpolan directo como número en
// vez de custom properties, porque el valor ya es estático por render (no
// cambia con el frame) y evita depender de --bg/--fx seteados en :root.
function edgeFadeMaskImage(fx, fy) {
  return (
    `linear-gradient(to right, transparent 0, #000 ${fx}px, #000 calc(100% - ${fx}px), transparent 100%), ` +
    `linear-gradient(to bottom, transparent 0, #000 ${fy}px, #000 calc(100% - ${fy}px), transparent 100%)`
  );
}

// measure() mide a 100px y escala linealmente, igual que el original — usa un
// <canvas> 2D real. Remotion renderiza en Chromium real (no jsdom), así que
// `document` está disponible durante el render tanto en Studio como en
// render-node.mjs/render-lambda.mjs, igual que en el HTML original servido en
// un navegador de verdad.
function makeMeasurer(fontStack) {
  const ctx = document.createElement('canvas').getContext('2d');
  const font = (s) => `900 ${s}px ${fontStack}`;
  return (str) => {
    ctx.font = font(100);
    return ctx.measureText(str).width;
  };
}

function fitH(measure, text, rw, rh) {
  const w100 = measure(text);
  const fs = Math.min((100 * rw) / w100, rh / 0.85);
  return fs > 4 ? {fs, w: (w100 * fs) / 100, h: fs * 0.85, content: text} : null;
}

function fitW(measure, text, rw, rh) {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return null;
  const maxW100 = Math.max(...words.map(measure));
  const fs = Math.min((100 * rw) / maxW100, rh / (words.length * 0.85));
  return fs > 4 ? {fs, w: (maxW100 * fs) / 100, h: words.length * fs * 0.85, content: words.join('\n')} : null;
}

function fitV(measure, text, rw, rh) {
  const chars = text.replace(/\s+/g, '').split('');
  const maxC100 = Math.max(...chars.map(measure));
  const fs = Math.min((100 * rw) / maxC100, rh / (chars.length * 0.85));
  return fs > 4 ? {fs, w: (maxC100 * fs) / 100, h: chars.length * fs * 0.85, content: chars.join('\n')} : null;
}

function bestFit(measure, text, rects, minFS) {
  let bH = null;
  let bV = null;
  let rH = null;
  let rV = null;
  for (const r of rects) {
    if (r.w < 30 || r.h < 30) continue;
    for (const f of [fitH(measure, text, r.w, r.h), fitW(measure, text, r.w, r.h)]) {
      if (f && (!bH || f.fs > bH.fs)) {
        bH = f;
        rH = r;
      }
    }
    const v = fitV(measure, text, r.w, r.h);
    if (v && (!bV || v.fs > bV.fs)) {
      bV = v;
      rV = r;
    }
  }
  if (bH && bH.fs >= minFS) return {...bH, rect: rH}; // 1: horizontal encaja bien
  if (bV && bV.fs >= minFS) return {...bV, rect: rV}; // 2: vertical encaja bien
  const s = bH && bV ? (bH.fs >= bV.fs ? {f: bH, r: rH} : {f: bV, r: rV}) : bH ? {f: bH, r: rH} : bV ? {f: bV, r: rV} : null; // 3: encoger, quedarse con el más grande
  return s ? {...s.f, rect: s.r} : null;
}

// Versión pura de place(): en vez de mutar un nodo del DOM devuelve los datos
// para que el componente React arme el estilo (x/y/w/h/fontSize/content/align).
function place(fit, align, vw, vh) {
  if (!fit) return null;
  const r = fit.rect;
  let x = align === 'right' ? r.x + r.w - fit.w : align === 'band' ? r.x + (r.w - fit.w) / 2 : r.x;
  let y = r.y + (r.h - fit.h) / 2;
  x = Math.max(GUT, Math.min(x, vw - fit.w - GUT));
  y = Math.max(GUT, Math.min(y, vh - fit.h - GUT));
  return {
    x,
    y,
    w: fit.w,
    h: fit.h,
    fontSize: fit.fs,
    content: fit.content,
    textAlign: align === 'band' ? 'center' : align,
  };
}

// computeOverlayLayout() — réplica 1:1 de la parte de layout() que es
// IDÉNTICA entre 01-image-bg y motion-backdrop (desde "edge fade" hasta el
// final, sin contar el manejo del <canvas id="eq"> que acá se resuelve aparte
// vía @remotion/media-utils, ver ImageBg.js/MotionBackdrop.js).
//
// `box` = caja ya resuelta del fondo en el viewport ({ix, iy, dw, dh, k}),
// calculada por el caller a partir de sus propias dimensiones/rotación.
// `cb`  = content-box en coordenadas "px crudos" que usan zones/keepOut/
// bgRegions/subject ([0,0,img.w,img.h] para imagen; video.content ya upright
// para video) — X/Y proyectan esas coordenadas al viewport restando el
// origen del content-box, igual que el original.
function computeOverlayLayout({config: C, vw, vh, box, cb}) {
  const {ix, iy, dw, dh, k} = box;
  const X = (px) => ix + (px - cb[0]) * k;
  const Y = (px) => iy + (px - cb[1]) * k;

  const fontStack = resolveFontStack(C.typography);
  const measure = makeMeasurer(fontStack);

  // edge fade: solo en los ejes donde el contenido no llega al borde del
  // viewport; el modo blur funde con el fondo difuminado, así que usa un
  // fade más ancho.
  const fadeK = (C.edgeFade || 0) * (C.bgMode === 'blur' ? 2 : 1);
  const fade = Math.max(24, Math.min(C.bgMode === 'blur' ? 160 : 90, Math.min(dw, dh) * fadeK));
  const fx = C.edgeFade && dw < vw - 1 ? fade : 0;
  const fy = C.edgeFade && dh < vh - 1 ? fade : 0;

  const eqHeight = Math.min(90, Math.max(44, vh * 0.06));
  const minFS = Math.max(26, vh * 0.05);

  // ---- relleno de página detrás del contenido: sólido, regiones o underlay difuminado ----
  const regions = C.bgMode === 'regions' ? C.bgRegions || [] : [];
  // proyecta un rect de región a px de viewport; los lados sobre el borde del
  // content-box se extienden hasta el borde del viewport.
  const proj = (rg) => {
    const [x0, y0, x1, y1] = rg.rect;
    return {
      x0: x0 <= cb[0] ? 0 : X(x0),
      x1: x1 >= cb[2] ? vw : X(x1),
      y0: y0 <= cb[1] ? 0 : Y(y0),
      y1: y1 >= cb[3] ? vh : Y(y1),
    };
  };
  const fillRegions = regions.map((rg) => {
    const p = proj(rg);
    return {left: p.x0, top: p.y0, width: p.x1 - p.x0, height: p.y1 - p.y0, background: rg.color};
  });
  // ink de la región bajo un punto del viewport (ink default si ninguna matchea)
  const inkAt = (px, py) => {
    for (const rg of regions) {
      const p = proj(rg);
      if (px >= p.x0 && px < p.x1 && py >= p.y0 && py < p.y1) return rg.ink || C.colors.ink;
    }
    return C.colors.ink;
  };
  const eqInkFn = regions.length ? (x) => inkAt(x, vh - eqHeight / 2) : null;
  const tint = (p) => (p ? inkAt(p.x + p.w / 2, p.y + p.h / 2) : null);

  // corta rects candidatos por los bordes de región para que el texto nunca quede a caballo entre dos colores
  const cut = (rects) => {
    if (!regions.length) return rects;
    const out = [];
    for (const r of rects) {
      for (const rg of regions) {
        const p = proj(rg);
        const x0 = Math.max(r.x, p.x0);
        const y0 = Math.max(r.y, p.y0);
        const x1 = Math.min(r.x + r.w, p.x1);
        const y1 = Math.min(r.y + r.h, p.y1);
        if (x1 - x0 >= 30 && y1 - y0 >= 30) out.push({x: x0, y: y0, w: x1 - x0, h: y1 - y0});
      }
    }
    return out.length ? out : rects;
  };
  // talla las zonas de texto ya horneado (keepOut) fuera de los candidatos — split guillotina
  const carve = (rects) => {
    let list = rects;
    for (const ko of C.keepOut || []) {
      const kx0 = X(ko[0]);
      const ky0 = Y(ko[1]);
      const kx1 = X(ko[2]);
      const ky1 = Y(ko[3]);
      const next = [];
      for (const r of list) {
        const ox0 = Math.max(r.x, kx0);
        const oy0 = Math.max(r.y, ky0);
        const ox1 = Math.min(r.x + r.w, kx1);
        const oy1 = Math.min(r.y + r.h, ky1);
        if (ox0 >= ox1 || oy0 >= oy1) {
          next.push(r); // sin overlap
          continue;
        }
        if (ox0 - r.x >= 30) next.push({x: r.x, y: r.y, w: ox0 - r.x, h: r.h});
        if (r.x + r.w - ox1 >= 30) next.push({x: ox1, y: r.y, w: r.x + r.w - ox1, h: r.h});
        if (oy0 - r.y >= 30) next.push({x: r.x, y: r.y, w: r.w, h: oy0 - r.y});
        if (r.y + r.h - oy1 >= 30) next.push({x: r.x, y: oy1, w: r.w, h: r.y + r.h - oy1});
      }
      list = next;
    }
    return list;
  };
  const usable = (rects) => carve(cut(rects));

  // rects laterales: un candidato por zona de contorno, por lado
  const rectsL = [];
  const rectsR = [];
  for (const [y0, y1, xl, xr] of C.zones) {
    const ry = Math.max(GUT, Y(y0));
    const ry1 = Math.min(vh - GUT, Y(y1));
    rectsL.push({x: GUT, y: ry, w: X(xl) - GAP - GUT, h: ry1 - ry});
    rectsR.push({x: X(xr) + GAP, y: ry, w: vw - GUT - X(xr) - GAP, h: ry1 - ry});
  }

  // intenta flanquear primero; si CUALQUIERA de los lados no llega a un
  // tamaño legible → modo banda. Ver comentario largo en el HTML original
  // sobre anchorPreference/keepOut — réplica exacta del orden de búsqueda.
  let fL = null;
  let fR = null;
  if (C.anchorPreference || (C.keepOut || []).length) {
    const zoneIndex = {top: 0, middle: 1, bottom: 2}[C.anchorPreference];
    const fallback = [2, 1, 0].filter((i) => i !== zoneIndex && i < rectsL.length);
    const order = zoneIndex !== undefined && zoneIndex < rectsL.length ? [zoneIndex, ...fallback] : fallback;
    for (const i of order) {
      const tryL = bestFit(measure, C.texts.left, usable([rectsL[i]]), minFS);
      const tryR = bestFit(measure, C.texts.right, usable([rectsR[i]]), minFS);
      if (tryL && tryR && tryL.fs >= minFS && tryR.fs >= minFS) {
        fL = tryL;
        fR = tryR;
        break;
      }
    }
  }
  if (!fL || !fR) {
    fL = bestFit(measure, C.texts.left, usable(rectsL), minFS);
    fR = bestFit(measure, C.texts.right, usable(rectsR), minFS);
  }
  const flankOK = fL && fR && fL.fs >= minFS && fR.fs >= minFS;

  let textL = null;
  let textR = null;
  let topShadow = false;

  if (flankOK) {
    // DESKTOP: flanquea el sujeto
    textL = place(fL, 'right', vw, vh);
    textR = place(fR, 'left', vw, vh);
  } else {
    // MOBILE: bandas arriba y abajo
    const bandW = vw - 2 * GUT;
    const topEnd = Math.max(iy, Y(C.subject.top)) - GAP;
    const botStart = Math.max(Y(C.subject.bottom), iy + dh) + GAP;
    const botEnd = vh - eqHeight - GAP;
    const topOK = topEnd - GUT >= 46;
    const botOK = botEnd - botStart >= 46;
    let txtT = C.texts.left;
    let txtB = C.texts.right;
    let bT;
    let bB;
    if (topOK && botOK) {
      bT = {x: GUT, y: GUT, w: bandW, h: topEnd - GUT};
      bB = {x: GUT, y: botStart, w: bandW, h: botEnd - botStart};
    } else if (topOK) {
      // sin espacio abajo → apila ambas palabras arriba
      txtT = `${C.texts.left} ${C.texts.right}`;
      txtB = '';
      bT = {x: GUT, y: GUT, w: bandW, h: topEnd - GUT};
    } else if (botOK) {
      // sin espacio arriba → apila ambas palabras abajo
      txtB = `${C.texts.left} ${C.texts.right}`;
      txtT = '';
      bB = {x: GUT, y: botStart, w: bandW, h: botEnd - botStart};
    } else {
      // el contenido llena el viewport → overlay franja superior
      txtT = `${C.texts.left} ${C.texts.right}`;
      txtB = '';
      bT = {x: GUT, y: GUT, w: bandW, h: vh * 0.16};
      topShadow = true;
    }
    const fitT = txtT && bT ? bestFit(measure, txtT, usable([bT]), 18) : null;
    const fitB = txtB && bB ? bestFit(measure, txtB, usable([bB]), 18) : null;
    textL = place(fitT, 'band', vw, vh);
    textR = place(fitB, 'band', vw, vh);
  }

  if (textL) {
    textL.color = tint(textL) || C.colors.ink;
    if (topShadow) {
      // réplica de `0 0 10px var(--bg), ...` — resuelto directo a
      // C.colors.bg en vez de depender de una custom property en :root.
      textL.textShadow = `0 0 10px ${C.colors.bg}, 0 0 22px ${C.colors.bg}, 0 0 34px ${C.colors.bg}`;
    }
  }
  if (textR) {
    textR.color = tint(textR) || C.colors.ink;
  }

  return {fx, fy, eqHeight, minFS, fillRegions, eqInkFn, textL, textR};
}

module.exports = {
  GUT,
  GAP,
  FONT_STACKS,
  resolveFontStack,
  edgeFadeMaskImage,
  computeOverlayLayout,
};
