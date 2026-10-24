/* avatar.js · avatar 2D hecho con UNA imagen: rig de malla con huesos (WebGL2).
 *
 * El dibujo NO se redibuja: cada capa (cuerpo, cabeza, brazos, manos) es un recorte de la imagen
 * original (lo arma tools/build_avatar.py) sobre una malla fina. Los huesos deforman la malla
 * (como Live2D/Spine): en reposo se ve EXACTAMENTE la imagen; en movimiento la tela y la piel
 * se doblan con suavidad. La cara se mueve deformando la misma malla (parpadeo = el ojo se aplasta
 * sobre el párpado, cejas, giro de cabeza con paralaje); la boca que habla y las manos con gestos
 * (abierta, señalar, puño, pulgar…) son dibujos en código (characters/<id>/hands/*.svg) en el
 * mismo trazo y color de la imagen.
 *
 * API:
 *   const ch = await Avatar.load("../_avatar/characters/chica/");
 *   const R = Avatar.renderer();  R.size(w, h);  R.clear();
 *   R.draw(ch, pose, { x, y, h, flip })   // x, y = pies en px de pantalla; h = alto en px
 *   g.drawImage(R.canvas, 0, 0)
 * La pose (formato en AVATAR.md) la arma gestures.js; Avatar.rest() es la pose neutra.
 * Determinista: la imagen sale solo de la pose.
 */
(() => {
  "use strict";
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  const D2R = Math.PI / 180;

  /* ---------- afines 2D [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f ---------- */
  const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  const Tm = (x, y) => [1, 0, 0, 1, x, y];
  const Rm = r => { const c = Math.cos(r), s = Math.sin(r); return [c, s, -s, c, 0, 0]; };
  const Sm = (x, y) => [x, 0, 0, y, 0, 0];

  function loadImg(src) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("[avatar] falta " + src)); im.src = src; });
  }

  /* ---------- pose neutra ---------- */
  const arm = () => ({ up: 0, bend: 0, wrist: 0, hand: "rest", handK: 0 });
  function rest() {
    return {
      lean: 0, breathe: 0, sway: 0,
      head: { tilt: 0, turn: 0, nod: 0 }, hairLag: 0,
      eyes: { blink: 0, L: 0, R: 0 },
      brows: { L: 0, R: 0, knit: 0 },
      mouth: { open: 0, wide: 0, round: 0 },
      arms: { L: arm(), R: arm() },
    };
  }

  /* ---------- carga + mallas ---------- */
  let loaded = 0;
  async function load(base) {
    base = base.replace(/\/?$/, "/");
    const rig = await (await fetch(base + "rig.json")).json();
    const parts = (await (await fetch(base + "parts.json")).json()).parts;
    const imgs = {};
    await Promise.all(Object.entries(parts).map(async ([k, p]) => { imgs[k] = await loadImg(base + p.file); }));
    const hands = {};
    const H = rig.hands || { shapes: [] };
    await Promise.all(H.shapes.map(async id => { hands[id] = await loadImg(base + "hands/" + id + ".svg"); }));
    const ch = { base, rig, parts, imgs, hands, bones: Object.keys(rig.bones) };
    ch.boneIx = Object.fromEntries(ch.bones.map((b, i) => [b, i]));
    ch.layers = rig.layers.map(L => buildMesh(ch, L));
    ch.uid = ++loaded;   // identifica las texturas en la GPU
    return ch;
  }

  function alphaOf(img) {
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    return g.getImageData(0, 0, img.width, img.height).data;
  }

  function buildMesh(ch, L) {
    const P = ch.parts[L.id], img = ch.imgs[L.id], A = alphaOf(img);
    const cs = L.cell || 8, nx = Math.ceil(P.w / cs), ny = Math.ceil(P.h / cs);
    const occ = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let hit = 0;
      for (let y = j * cs; y < Math.min(P.h, (j + 1) * cs) && !hit; y++)
        for (let x = i * cs; x < Math.min(P.w, (i + 1) * cs); x++) if (A[(y * P.w + x) * 4 + 3] > 0) { hit = 1; break; }
      occ[j * nx + i] = hit;
    }
    // una celda de margen: la deformación nunca recorta el borde suavizado
    const use = occ.slice();
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (occ[j * nx + i])
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < nx && b < ny) use[b * nx + a] = 1; }
    const vmap = new Map(), pos = [], uv = [], idx = [];
    const vert = (i, j) => {
      const k = j * (nx + 1) + i;
      if (!vmap.has(k)) {
        vmap.set(k, pos.length / 2);
        const x = Math.min(i * cs, P.w), y = Math.min(j * cs, P.h);
        pos.push(P.x + x, P.y + y); uv.push(x / P.w, y / P.h);
      }
      return vmap.get(k);
    };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (use[j * nx + i]) {
      const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
      idx.push(a, b, c, b, d, c);
    }
    const n = pos.length / 2;
    const m = { id: L.id, slot: L.slot, n, rest: new Float32Array(pos), uv: new Float32Array(uv), idx: new Uint32Array(idx), out: new Float32Array(n * 2) };
    m.bi = new Int16Array(n * 3).fill(-1); m.bw = new Float32Array(n * 3);
    const W = L.weights, B = ch.boneIx;
    for (let v = 0; v < n; v++) {
      const x = m.rest[v * 2], y = m.rest[v * 2 + 1];
      let ws = [];
      if (W.type === "rigid") ws = [[W.bone, 1]];
      else if (W.type === "vertical") { const k = sstep(W.y0, W.y1, y); ws = [[W.from, 1 - k], [W.to, k]]; }
      else if (W.type === "head") {
        const r = Math.hypot(x - W.center[0], y - W.center[1]);
        const k = sstep(W.r0, W.r1, r) * sstep(W.minY, W.minY + 40, y);
        ws = [[W.bone, 1 - k], [W.hair, k]];
      } else if (W.type === "chain") {
        const s = chainParam(W.points, x, y), [b1, b2] = W.blend;
        const s1 = W.points._acc[1], s2 = W.points._acc[2];   // hombro y codo
        let k1 = sstep(s1 - b1, s1 + b1, s);
        const k2 = sstep(s2 - b2, s2 + b2, s);
        // junto al corte del hombro (donde el dibujo no tiene línea) la manga queda fija al torso
        if (W.pin) {
          const pin = ch.rig.cuts[W.pin.cut].line, d = distPoly(pin, x, y);
          k1 *= 1 - (1 - sstep(0, W.pin.r, d)) * (1 - sstep(W.pin.maxY - 30, W.pin.maxY, y));
        }
        ws = [[W.bones[0], 1 - k1], [W.bones[1], k1 * (1 - k2)], [W.bones[2], k1 * k2]];
        if (!m.chain) m.chain = { bones: W.bones.map(b => B[b]), names: W.bones, k: new Float32Array(n * 2) };
        m.chain.k[v * 2] = k1; m.chain.k[v * 2 + 1] = k2;
      }
      ws.filter(w => w[1] > 1e-4).slice(0, 3).forEach(([b, w], k) => { m.bi[v * 3 + k] = B[b]; m.bw[v * 3 + k] = w; });
    }
    if (L.id === "head" && ch.rig.face) faceWeights(ch, m);
    return m;
  }

  function distPoly(pts, x, y) {
    let best = 1e9;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay;
      const k = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
      best = Math.min(best, Math.hypot(x - ax - dx * k, y - ay - dy * k));
    }
    return best;
  }
  // parámetro (longitud de arco) del punto más cercano sobre la polilínea del brazo
  function chainParam(pts, x, y) {
    if (!pts._acc) {
      pts._acc = [0];
      for (let i = 1; i < pts.length; i++) pts._acc.push(pts._acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    let best = 1e9, bs = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      const k = clamp(((x - ax) * dx + (y - ay) * dy) / L2), px = ax + dx * k, py = ay + dy * k, d = Math.hypot(x - px, y - py);
      if (d < best) { best = d; bs = pts._acc[i - 1] + k * Math.sqrt(L2); }
    }
    return bs;
  }

  // pesos de la cara: ojos (parpadeo), cejas, paralaje del giro
  function faceWeights(ch, m) {
    const F = ch.rig.face, n = m.n;
    const ell = (e, x, y, a, b) => 1 - sstep(a, b, Math.hypot((x - e.c[0]) / e.r[0], (y - e.c[1]) / e.r[1]));
    m.f = { eyeL: new Float32Array(n), eyeR: new Float32Array(n), browL: new Float32Array(n), browR: new Float32Array(n), turn: new Float32Array(n) };
    for (let v = 0; v < n; v++) {
      const x = m.rest[v * 2], y = m.rest[v * 2 + 1];
      m.f.eyeL[v] = ell(F.eyes.L, x, y, 1.05, 1.8);
      m.f.eyeR[v] = ell(F.eyes.R, x, y, 1.05, 1.8);
      m.f.browL[v] = ell(F.brows.L, x, y, 0.9, 1.9);
      m.f.browR[v] = ell(F.brows.R, x, y, 0.9, 1.9);
      const r = Math.hypot(x - F.center[0], y - F.center[1]) / F.turn.r;
      m.f.turn[v] = Math.exp(-r * r);
    }
  }

  // deformación de la cara en el espacio de reposo (antes de los huesos)
  function faceDeform(F, f, v, x, y, P) {
    const g = f.turn[v], tr = P.head.turn, nd = P.head.nod;
    let X = x + tr * (F.turn.shift * g + F.turn.hairShift * (1 - g)), Y = y + nd * 4.5 * g;
    for (const s of ["L", "R"]) {
      const e = F.eyes[s], w = f["eye" + s][v];
      if (w > 0) {
        const b = clamp(Math.max(P.eyes.blink, P.eyes[s] || 0));
        if (b > 0) Y += (e.lid - y) * b * w * 0.9;
      }
      const bw = f["brow" + s][v];
      if (bw > 0) {
        const br = F.brows[s], inner = s === "L" ? clamp((x - br.c[0]) / br.r[0] + 0.5) : clamp((br.c[0] - x) / br.r[0] + 0.5);
        Y += bw * (-(P.brows[s] || 0) * 6 + (P.brows.knit || 0) * 4.5 * inner);
        X += bw * (P.brows.knit || 0) * 1.5 * (s === "L" ? 1 : -1) * inner;
      }
    }
    return [X, Y];
  }

  /* ---------- huesos ---------- */
  // signo "hacia afuera" de cada brazo en pantalla (y hacia abajo: + = horario)
  const OUT = { L: 1, R: -1 };
  function boneMatrices(ch, P, place) {
    const rig = ch.rig, F = rig.feet;
    const s = place.h / rig.height, fx = place.flip ? -1 : 1;
    const root = mul(Tm(place.x, place.y), mul(Sm(s * fx, s), Tm(-F[0], -F[1])));
    const loc = {
      chest: { r: P.lean + (P.sway || 0) * 0.5, sy: 1 + (P.breathe || 0) * 0.006 },
      hips: { r: (P.sway || 0) * 0.15 },
      head: { r: P.head.tilt, dy: P.head.nod * 1.5 },
      hair: { r: P.head.tilt + (P.hairLag || 0), dy: P.head.nod * 1.5 },
    };
    for (const side of ["L", "R"]) {
      const a = P.arms[side], o = OUT[side];
      loc["arm" + side] = { r: o * a.up };
      loc["fore" + side] = { r: o * a.bend };    // + = sigue girando hacia arriba; − = cruza el cuerpo
      loc["hand" + side] = { r: o * a.wrist };
    }
    const Mx = {};
    ch._loc = loc;
    for (const b of ch.bones) {
      const B = rig.bones[b], l = loc[b] || {}, [px, py] = B.at;
      const local = mul(Tm(px + (l.dx || 0), py + (l.dy || 0)), mul(Rm((l.r || 0) * D2R), mul(Sm(l.sx || 1, l.sy || 1), Tm(-px, -py))));
      Mx[b] = B.parent ? mul(Mx[B.parent], local) : mul(root, local);
    }
    return ch.bones.map(b => Mx[b]);
  }

  function skin(ch, m, Ms, P) {
    if (m.chain) return skinChain(ch, m, Ms);
    const F = ch.rig.face, face = m.f && F;
    for (let v = 0; v < m.n; v++) {
      let x = m.rest[v * 2], y = m.rest[v * 2 + 1];
      if (face) [x, y] = faceDeform(F, m.f, v, x, y, P);
      let X = 0, Y = 0;
      for (let k = 0; k < 3; k++) {
        const b = m.bi[v * 3 + k]; if (b < 0) break;
        const w = m.bw[v * 3 + k], M = Ms[b];
        X += w * (M[0] * x + M[2] * y + M[4]); Y += w * (M[1] * x + M[3] * y + M[5]);
      }
      m.out[v * 2] = X; m.out[v * 2 + 1] = Y;
    }
  }

  /* Brazos: en vez de promediar matrices (la manga se achica al levantar el brazo), cada vértice gira
   * una FRACCIÓN del ángulo del hombro (k1) y del codo (k2) alrededor de su articulación: la tela
   * conserva el grosor y el pliegue del codo se superpone como una tela real. */
  function skinChain(ch, m, Ms) {
    const B = ch.rig.bones, [cN, aN, fN] = m.chain.names, loc = ch._loc;
    const C = Ms[m.chain.bones[0]], [sx, sy] = B[aN].at, [ex, ey] = B[fN].at;
    const ta = ((loc[aN] || {}).r || 0) * D2R, tf = ((loc[fN] || {}).r || 0) * D2R, K = m.chain.k;
    for (let v = 0; v < m.n; v++) {
      let x = m.rest[v * 2], y = m.rest[v * 2 + 1];
      const k1 = K[v * 2], k2 = K[v * 2 + 1];
      if (k2 > 0) { const a = tf * k2, c = Math.cos(a), s = Math.sin(a), dx = x - ex, dy = y - ey; x = ex + c * dx - s * dy; y = ey + s * dx + c * dy; }
      if (k1 > 0) { const a = ta * k1, c = Math.cos(a), s = Math.sin(a), dx = x - sx, dy = y - sy; x = sx + c * dx - s * dy; y = sy + s * dx + c * dy; }
      m.out[v * 2] = C[0] * x + C[2] * y + C[4]; m.out[v * 2 + 1] = C[1] * x + C[3] * y + C[5];
    }
  }

  /* ---------- boca que habla (dibujo en código, mismo trazo) ---------- */
  function drawMouth(ch, g, P, box, S) {
    const F = ch.rig.face, Mo = F.mouth, [ox, oy] = [box[0], box[1]];
    const X = x => (x - ox) * S, Y = y => (y - oy) * S;
    g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    const o = clamp(P.mouth.open), wi = clamp(P.mouth.wide), ro = clamp(P.mouth.round);
    if (o < 0.04) return false;
    const [lx, ly] = Mo.left, [rx, ry] = Mo.right, [mx, my] = Mo.mid;
    // las comisuras se juntan con la "o" y se abren con la "e"
    const pinch = ro * 7 - wi * 3;
    const Lx = lx + pinch, Rx = rx - pinch * 0.8, Ly = ly - o * 1.5, Ry = ry - o * 0.5;
    const top = my - 3 - o * 2 - ro * 2, bot = my + 2 + o * (12 + ro * 5 - wi * 3);
    // tapa la línea original con piel (borde difuso)
    const [pw, ph] = Mo.patch;
    const grd = g.createRadialGradient(X(Mo.c[0]), Y(Mo.c[1] + 2), 0, X(Mo.c[0]), Y(Mo.c[1] + 2), pw * S);
    grd.addColorStop(0, F.skin); grd.addColorStop(0.72, F.skin); grd.addColorStop(1, F.skin + "00");
    g.save(); g.translate(X(Mo.c[0]), Y(Mo.c[1] + 2)); g.scale(1, ph / pw); g.translate(-X(Mo.c[0]), -Y(Mo.c[1] + 2));
    g.fillStyle = grd; g.beginPath(); g.arc(X(Mo.c[0]), Y(Mo.c[1] + 2), pw * S, 0, 7); g.fill(); g.restore();
    const cx = (Lx + Rx) / 2;
    const shape = () => {
      g.beginPath(); g.moveTo(X(Lx), Y(Ly));
      g.bezierCurveTo(X(Lx + 8), Y(top + 1), X(cx - 6), Y(top), X(cx), Y(top));
      g.bezierCurveTo(X(cx + 8), Y(top), X(Rx - 8), Y(Ry - 1), X(Rx), Y(Ry));
      g.bezierCurveTo(X(Rx - 4), Y(bot - 2), X(cx + 8), Y(bot), X(cx), Y(bot));
      g.bezierCurveTo(X(cx - 9), Y(bot), X(Lx + 3), Y(bot - 3), X(Lx), Y(Ly));
      g.closePath();
    };
    shape(); g.fillStyle = "#3a2222"; g.fill();
    g.save(); shape(); g.clip();
    if (o > 0.35 && ro < 0.6) {   // dientes de arriba
      g.fillStyle = "#fbf7f4"; g.beginPath(); g.ellipse(X(cx), Y(top + 0.5), (Rx - Lx) * 0.36 * S, (2.2 + o * 1.5) * S, 0, 0, 7); g.fill();
    }
    g.fillStyle = "#c9787c"; g.beginPath(); g.ellipse(X(cx + 1), Y(bot + 1), (Rx - Lx) * 0.3 * S, (3 + o * 3.5) * S, 0, 0, 7); g.fill();
    g.restore();
    shape(); g.strokeStyle = F.ink; g.lineJoin = "round"; g.lineCap = "round"; g.lineWidth = 2.6 * S; g.stroke();
    // labio de arriba un poco más marcado (como la línea original)
    g.beginPath(); g.moveTo(X(Lx - 1.5), Y(Ly - 1.5)); g.bezierCurveTo(X(Lx + 8), Y(top + 1), X(cx - 6), Y(top), X(cx), Y(top));
    g.bezierCurveTo(X(cx + 8), Y(top), X(Rx - 8), Y(Ry - 1), X(Rx + 1), Y(Ry - 1)); g.lineWidth = 3.4 * S; g.stroke();
    return true;
  }

  /* ---------- WebGL ---------- */
  const VS = `#version 300 es
in vec2 p; in vec2 uv; uniform vec2 res; out vec2 v;
void main(){ v = uv; gl_Position = vec4(p.x / res.x * 2.0 - 1.0, 1.0 - p.y / res.y * 2.0, 0.0, 1.0); }`;
  const FS = `#version 300 es
precision mediump float; in vec2 v; uniform sampler2D tex; uniform float a; out vec4 o;
void main(){ o = texture(tex, v) * a; }`;

  function renderer() {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error("[avatar] este navegador no tiene WebGL2");
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    const aP = gl.getAttribLocation(prog, "p"), aU = gl.getAttribLocation(prog, "uv");
    const uRes = gl.getUniformLocation(prog, "res"), uA = gl.getUniformLocation(prog, "a");
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const cache = new Map();   // ch.uid → recursos GPU

    function texture(src, mip = true) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    }
    function mesh(n, uv, idx) {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, n * 8, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);
      const ub = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ub); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(aU); gl.vertexAttribPointer(aU, 2, gl.FLOAT, false, 0, 0);
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      return { vao, pb, count: idx.length };
    }
    // cuadrícula simple (boca, manos dibujadas): nx × ny celdas sobre un rectángulo del espacio de reposo
    function quad(x, y, w, h, nx, ny, flipU) {
      const rest = [], uv = [], idx = [];
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { rest.push(x + w * i / nx, y + h * j / ny); uv.push(flipU ? 1 - i / nx : i / nx, j / ny); }
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
      const n = rest.length / 2;
      return { n, rest: new Float32Array(rest), uv: new Float32Array(uv), idx: new Uint32Array(idx), out: new Float32Array(n * 2) };
    }

    function prepare(ch) {
      if (cache.has(ch.uid)) return cache.get(ch.uid);
      const R = { layers: {}, hands: {}, mouth: null };
      for (const m of ch.layers) R.layers[m.id] = { tex: texture(ch.imgs[m.id]), gpu: mesh(m.n, m.uv, m.idx) };
      // manos dibujadas: SVG → lienzo a 3× → textura; un cuadro pegado al hueso de la mano
      const H = ch.rig.hands;
      if (H) for (const id of H.shapes) {
        const c = document.createElement("canvas"); c.width = H.box[0] * 3; c.height = H.box[1] * 3;
        c.getContext("2d").drawImage(ch.hands[id], 0, 0, c.width, c.height);
        R.hands[id] = texture(c);
      }
      if (H) for (const side of ["L", "R"]) {
        const [px, py] = ch.rig.bones["hand" + side].at, [w, h] = H.box, [wx, wy] = H.wrist;
        // L = mano izquierda de pantalla (pulgar hacia afuera, como el SVG); R = espejo
        const q = side === "L" ? quad(px - wx, py - wy, w, h, 1, 1, false) : quad(px - (w - wx), py - wy, w, h, 1, 1, true);
        q.gpu = mesh(q.n, q.uv, q.idx); R.hands["q" + side] = q;
      }
      const F = ch.rig.face;
      if (F && F.mouth) {
        const [cx, cy] = F.mouth.c, bw = 80, bh = 46, S = 4;
        const box = [cx - bw / 2, cy - bh / 2 + 4, bw, bh];
        const c = document.createElement("canvas"); c.width = bw * S; c.height = bh * S;
        const q = quad(box[0], box[1], bw, bh, 4, 3, false); q.gpu = mesh(q.n, q.uv, q.idx);
        R.mouth = { c, g: c.getContext("2d"), box, S, q, tex: texture(c, false), key: "" };
      }
      cache.set(ch.uid, R);
      return R;
    }

    function drawMesh(m, gpu, tex, a) {
      gl.bindVertexArray(gpu.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, gpu.pb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, m.out);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1f(uA, a);
      gl.drawElements(gl.TRIANGLES, gpu.count, gl.UNSIGNED_INT, 0);
    }
    // cuadro pegado a un hueso (y, si es la cara, con la misma deformación que la piel de abajo)
    function skinQuad(ch, q, M, P, faceRef) {
      for (let v = 0; v < q.n; v++) {
        let x = q.rest[v * 2], y = q.rest[v * 2 + 1];
        if (faceRef) {
          const F = ch.rig.face, d = Math.hypot(x - F.center[0], y - F.center[1]) / F.turn.r, g = Math.exp(-d * d);
          x += P.head.turn * (F.turn.shift * g + F.turn.hairShift * (1 - g)); y += P.head.nod * 4.5 * g;
        }
        q.out[v * 2] = M[0] * x + M[2] * y + M[4]; q.out[v * 2 + 1] = M[1] * x + M[3] * y + M[5];
      }
    }

    const api = {
      canvas, gl,
      size(w, h) { if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } gl.viewport(0, 0, w, h); },
      clear() { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); },
      draw(ch, P, place) {
        const R = prepare(ch), Ms = boneMatrices(ch, P, place);
        gl.useProgram(prog); gl.uniform2f(uRes, canvas.width, canvas.height);
        for (const m of ch.layers) {
          const L = R.layers[m.id];
          const side = m.slot ? m.slot.slice(-1) : null, a = side ? P.arms[side] : null;
          const k = a && a.hand !== "rest" && R.hands[a.hand] ? clamp(a.handK ?? 1) : 0;
          if (k < 1) { skin(ch, m, Ms, P); drawMesh(m, L.gpu, L.tex, 1 - k); }
          if (k > 0) {
            const q = R.hands["q" + side];
            skinQuad(ch, q, Ms[ch.boneIx["hand" + side]], P, false);
            drawMesh(q, q.gpu, R.hands[a.hand], k);
          }
          if (m.id === "head" && R.mouth) {
            const Mo = R.mouth, key = [P.mouth.open, P.mouth.wide, P.mouth.round].map(v => v.toFixed(3)).join();
            if (key !== Mo.key) {
              Mo.on = drawMouth(ch, Mo.g, P, Mo.box, Mo.S); Mo.key = key;
              if (Mo.on) { gl.bindTexture(gl.TEXTURE_2D, Mo.tex); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, Mo.c); }
            }
            if (Mo.on) { skinQuad(ch, Mo.q, Ms[ch.boneIx.head], P, true); drawMesh(Mo.q, Mo.q.gpu, Mo.tex, 1); }
          }
        }
        gl.bindVertexArray(null);
        return Ms;
      },
    };
    return api;
  }

  /* ---------- cinemática inversa de un brazo (para gestos con "mano en tal punto") ----------
   * target en px de la imagen en reposo; devuelve { up, bend } con las mismas convenciones de la pose. */
  function ik(ch, side, target, elbowOut = true) {
    const B = ch.rig.bones, S = B["arm" + side].at, E = B["fore" + side].at, W = B["hand" + side].at;
    const l1 = Math.hypot(E[0] - S[0], E[1] - S[1]), l2 = Math.hypot(W[0] - E[0], W[1] - E[1]);
    const dx = target[0] - S[0], dy = target[1] - S[1];
    const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1, l1 + l2 - 1);
    const base = Math.atan2(dy, dx), a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const o = OUT[side];
    const pick = sgn => {
      const sa = base + sgn * a, ex = S[0] + l1 * Math.cos(sa), ey = S[1] + l1 * Math.sin(sa);
      const fa = Math.atan2(target[1] - ey, target[0] - ex);
      const r0 = Math.atan2(E[1] - S[1], E[0] - S[0]), f0 = Math.atan2(W[1] - E[1], W[0] - E[0]);
      const wrap = r => Math.atan2(Math.sin(r), Math.cos(r));
      const rs = wrap(sa - r0), rf = wrap(fa - f0 - rs);
      return { ex, up: o * rs / D2R, bend: o * rf / D2R };
    };
    const A1 = pick(1), A2 = pick(-1);
    // codo hacia afuera del cuerpo (L: x menor; R: x mayor)
    const out1 = side === "L" ? A1.ex < A2.ex : A1.ex > A2.ex;
    const r = (out1 === elbowOut) ? A1 : A2;
    return { up: r.up, bend: r.bend };
  }

  window.Avatar = { load, renderer, rest, ik, U: { clamp, sstep } };
})();
