/* gestures.js · qué hace el avatar en cada instante: pose = función pura de t.
 *
 *   idle (respira, se balancea, mueve apenas la cabeza y los brazos, el pelo acompaña con retraso)
 *   + parpadeo (agenda determinista)
 *   + labios sincronizados con la voz (lyrics.json de Whisper: sílabas → abrir / "e" / "o")
 *   + acciones del timeline (gestos de brazos y manos, gestos de cabeza, expresiones), cada una con
 *     entrada y salida suaves; se pueden superponer (una expresión mientras saluda).
 *
 * Convenciones de la pose (ver AVATAR.md): L/R = lado de PANTALLA; en cada brazo
 *   up   (°) + = el brazo se abre hacia afuera / arriba,
 *   bend (°) + = el antebrazo sigue girando hacia arriba (saludar), − = cruza por delante del cuerpo,
 *   wrist(°) + = la mano gira hacia afuera,  hand = rest | open | spread | point | fist | thumb.
 *   head.turn −1..1 (+ = mira a la derecha de pantalla), tilt (°, + = horario), nod (+ = baja).
 *
 * Agregar un gesto: AvatarGestures.G.<nombre> = { dur, in, out, apply(P, τ, k, a, S) } (k = 0..1).
 */
(() => {
  "use strict";
  const { clamp } = Avatar.U;
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = k => (k = clamp(k), k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const TAU = Math.PI * 2;
  const wave = (t, per, ph = 0) => Math.sin(TAU * t / per + ph);
  const other = s => (s === "L" ? "R" : "L");
  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zñ]/g, "");

  /* mezcla un brazo hacia un objetivo; la mano dibujada aparece a mitad de la mezcla */
  function armTo(P, side, tg, k) {
    const A = P.arms[side];
    for (const f of ["up", "bend", "wrist"]) if (tg[f] != null) A[f] = lerp(A[f], tg[f], k);
    if (tg.hand && tg.hand !== "rest") {
      const hk = clamp((k - 0.3) / 0.35);
      if (hk > (A.hand === tg.hand ? 0 : A.handK)) { A.hand = tg.hand; A.handK = hk; }
    }
  }
  const mix = (o, f, v, k) => { o[f] = lerp(o[f], v, k); };
  /* lleva la MUÑECA a un punto de la imagen (px en reposo) con la mano a un ángulo absoluto
   * (° desde "hacia abajo", + = hacia afuera; 180 = dedos arriba) — cinemática inversa */
  function reach(P, S, side, at, handAbs, k, hand, rel = null) {
    const r = Avatar.ik(S.ch, side, at);
    armTo(P, side, { up: r.up, bend: r.bend, wrist: rel != null ? rel : handAbs - r.up - r.bend, hand }, k);
  }

  /* ---------- reposo ---------- */
  function idle(P, t, S) {
    const s = S.idle ?? 1;
    P.breathe = wave(t, 4.2);
    P.sway = s * (0.8 * wave(t, 7.3, 0.4) + 0.3 * wave(t, 3.1, 1.3));
    P.lean = s * 0.35 * wave(t, 9.7, 2.0);
    P.head.tilt = s * (1.3 * wave(t, 5.1, 0.7) + 0.45 * wave(t, 2.3, 0.2));
    P.head.turn = s * (0.13 * wave(t, 6.7, 1.1) + 0.04 * wave(t, 1.9));
    P.head.nod = s * 0.12 * wave(t, 3.9, 2.4);
    for (const side of ["L", "R"]) {
      const ph = side === "L" ? 0 : 1.7, A = P.arms[side];
      // en la imagen el brazo TOCA el cuerpo: en reposo solo se mueve hacia adentro (abrirlo deja una rendija)
      A.up = -s * (0.8 + 0.8 * wave(t, 4.2, 0.6 + ph * 0.2));
      A.bend = -s * (0.7 + 0.7 * wave(t, 5.3, ph));
      A.wrist = s * (1.8 * wave(t, 3.7, ph + 0.8));
    }
  }

  /* ---------- parpadeo: cada 2,2–5,5 s; a veces doble ---------- */
  function blinkSchedule(seed, end) {
    const out = []; let t = 0.8 + hash(seed) * 1.5, i = 0;
    while (t < end + 5) {
      out.push(t);
      if (hash(seed * 7 + i * 3.1) < 0.15) out.push(t + 0.28);
      t += 2.2 + hash(seed + i * 1.37) * 3.3; i++;
    }
    return out;
  }
  function blinkAt(S, t) {
    let b = 0;
    for (const t0 of S.blinks) {
      const u = t - t0; if (u < 0) break; if (u > 0.2) continue;
      b = Math.max(b, u < 0.06 ? u / 0.06 : u < 0.09 ? 1 : 1 - (u - 0.09) / 0.09);
    }
    return clamp(b);
  }

  /* ---------- labios: cada palabra se parte en sílabas (grupos de vocales) ---------- */
  const VOWEL = { a: [1, 0.15, 0], e: [0.7, 0.75, 0], i: [0.5, 0.95, 0], o: [0.8, 0, 0.85], u: [0.55, 0, 1] };
  function buildSyllables(words) {
    const out = [];
    for (const w of words) {
      const s = norm(w.word); if (!s) continue;
      const groups = s.match(/[aeiouáéíóú]+/g) || ["a"];
      const d = Math.max(0.06, (w.end - w.start) / groups.length);
      groups.forEach((g, i) => {
        const v = g.match(/[aeiou]/g) || ["a"];
        const V = VOWEL[v[v.length > 1 ? 1 : 0]] || VOWEL.a;   // diptongo: manda la vocal fuerte
        out.push({ s: w.start + i * d, e: w.start + (i + 1) * d, V });
      });
    }
    return out;
  }
  function mouthAt(S, t) {
    let o = 0, wi = 0, ro = 0;
    for (const sy of S.syl) {
      if (sy.s > t + 0.1) break;
      if (sy.e < t - 0.1) continue;
      const u = (t - sy.s + 0.04) / (sy.e - sy.s + 0.06);   // adelanto mínimo: la boca se abre antes del sonido
      if (u <= 0 || u >= 1) continue;
      const k = Math.pow(Math.sin(Math.PI * u), 0.75);
      if (k * sy.V[0] > o) { o = k * sy.V[0]; wi = sy.V[1]; ro = sy.V[2]; }
    }
    return { open: o * (S.talkAmp ?? 0.9), wide: wi, round: ro };
  }
  function speaking(S, t) {   // 0..1: hay voz en este instante (para movimientos de cabeza al hablar)
    let v = 0;
    for (const sy of S.syl) { if (sy.s > t + 0.3) break; if (sy.e > t - 0.3) v = 1; }
    return v;
  }

  /* ---------- gestos ---------- */
  const G = {};
  const side = a => a.side || "R";
  const lookTo = (sd, v) => (sd === "R" ? v : -v);

  // brazos
  G.wave = { dur: 2.6, in: 0.45, out: 0.5, apply(P, τ, k, a) {
    const s = side(a), osc = Math.sin(TAU * 2.1 * τ);
    armTo(P, s, { up: 58, bend: 108 + 6 * osc, wrist: 4 + 16 * osc, hand: "spread" }, k);
    mix(P.head, "tilt", lookTo(s, 4), k); mix(P.brows, "L", 0.45, k); mix(P.brows, "R", 0.45, k);
  } };
  G.point = { dur: 2.2, in: 0.4, out: 0.45, apply(P, τ, k, a) {
    const s = side(a);
    armTo(P, s, { up: 82 + 1.5 * Math.sin(TAU * 0.6 * τ), bend: 6, wrist: -4, hand: "point" }, k);
    mix(P.head, "turn", lookTo(s, 0.55), k); mix(P.head, "tilt", lookTo(s, -2), k);
  } };
  G.idea = { dur: 2.2, in: 0.4, out: 0.45, apply(P, τ, k, a) {
    const s = side(a), b = Math.exp(-Math.pow((τ - 0.55) / 0.18, 2));
    armTo(P, s, { up: 34, bend: 128 + 6 * b, wrist: -6, hand: "point" }, k);
    mix(P.brows, "L", 0.9, k); mix(P.brows, "R", 0.9, k); mix(P.head, "tilt", lookTo(s, 3), k);
  } };
  G.present = { dur: 2.4, in: 0.45, out: 0.5, apply(P, τ, k, a) {
    const s = side(a);
    armTo(P, s, { up: 46 + 2 * Math.sin(TAU * 0.5 * τ), bend: 38, wrist: 22, hand: "open" }, k);
    mix(P.head, "turn", lookTo(s, 0.35), k);
  } };
  G.explain = { dur: 3, in: 0.5, out: 0.5, apply(P, τ, k, a, S) {
    for (const s of ["L", "R"]) {
      const ph = s === "L" ? 0 : 1.9, beat = Math.sin(TAU * 1.25 * τ + ph), o = s === "L" ? -1 : 1;
      // la mano sigue al antebrazo (si gira hacia atrás queda tapada por la manga), un poco hacia arriba
      reach(P, S, s, [S.cx + o * (118 + 6 * beat), 548 - 14 * beat], 0, k, "open", -62 + 10 * beat);
    }
    mix(P.head, "nod", 0.3 * Math.sin(TAU * 1.25 * τ), k);
  } };
  G.think = { dur: 3, in: 0.55, out: 0.55, apply(P, τ, k, a, S) {
    const s = side(a), F = S.ch.rig.face, o = s === "L" ? -1 : 1;
    // la punta del índice bajo el mentón: muñeca a "largo del índice" debajo, dedos arriba
    const tap = 2 * Math.max(0, Math.sin(TAU * 0.8 * τ));
    reach(P, S, s, [F.chin[0] + o * 16, F.chin[1] + 150 + tap], 180 - o * 4, k, "point");
    armTo(P, other(s), { up: 6, bend: -62, wrist: -6, hand: "fist" }, k);
    mix(P.head, "tilt", lookTo(s, -7), k); mix(P.head, "turn", lookTo(s, -0.3), k);
    mix(P.brows, "knit", 0.55, k); mix(P.brows, s === "R" ? "L" : "R", 0.4, k);
  } };
  G.thumbsup = { dur: 2.2, in: 0.4, out: 0.45, apply(P, τ, k, a) {
    const s = side(a), pump = Math.exp(-Math.pow((τ - 0.6) / 0.15, 2));
    armTo(P, s, { up: 26, bend: 112 + 8 * pump, wrist: 4, hand: "thumb" }, k);
    mix(P.head, "tilt", lookTo(s, 5), k); mix(P.head, "nod", -0.3 * pump, k);
  } };
  G.shrug = { dur: 2.2, in: 0.4, out: 0.5, apply(P, τ, k) {
    for (const s of ["L", "R"]) armTo(P, s, { up: 12, bend: 56, wrist: 30, hand: "open" }, k);
    mix(P.head, "tilt", 8, k); mix(P.brows, "L", 0.85, k); mix(P.brows, "R", 0.85, k);
    mix(P.mouth, "round", 0.4, k);
  } };
  G.welcome = { dur: 2.6, in: 0.55, out: 0.55, apply(P, τ, k) {
    for (const s of ["L", "R"]) armTo(P, s, { up: 52 + 2 * Math.sin(TAU * 0.5 * τ), bend: 22, wrist: 14, hand: "spread" }, k);
    mix(P.brows, "L", 0.5, k); mix(P.brows, "R", 0.5, k);
  } };
  G.stop = { dur: 2, in: 0.35, out: 0.45, apply(P, τ, k, a) {
    const s = side(a);
    armTo(P, s, { up: 22, bend: 150, wrist: 8, hand: "open" }, k);
    mix(P.brows, "knit", 0.5, k); mix(P.head, "nod", -0.2, k);
  } };
  G.count = { dur: 2.4, in: 0.4, out: 0.45, apply(P, τ, k, a) {   // "uno, dos": dedo arriba que marca el ritmo
    const s = side(a), beat = Math.abs(Math.sin(Math.PI * 1.6 * τ));
    armTo(P, s, { up: 30, bend: 120 + 10 * beat, wrist: -4, hand: "point" }, k);
  } };
  G.hip = { dur: 3, in: 0.5, out: 0.5, apply(P, τ, k, a) {   // mano al costado, puño
    const s = side(a);
    armTo(P, s, { up: 30, bend: -40, wrist: 10, hand: "fist" }, k);
  } };

  // cabeza
  G.nod = { dur: 1.3, in: 0.15, out: 0.25, apply(P, τ, k) { mix(P.head, "nod", 0.9 * Math.sin(TAU * 1.8 * τ), k); } };
  G.shake = { dur: 1.5, in: 0.15, out: 0.3, apply(P, τ, k) {
    mix(P.head, "turn", 0.7 * Math.sin(TAU * 2.2 * τ), k); mix(P.brows, "knit", 0.4, k);
  } };
  G.tilt = { dur: 2, in: 0.4, out: 0.4, apply(P, τ, k, a) { mix(P.head, "tilt", a.deg ?? 9, k); } };
  G.look = { dur: 2, in: 0.4, out: 0.4, apply(P, τ, k, a) { mix(P.head, "turn", a.to ?? (side(a) === "R" ? 0.75 : -0.75), k); } };

  // expresiones (la cara; se suman a lo que haga el cuerpo)
  G.smile = { dur: 2, in: 0.3, out: 0.4, apply(P, τ, k) { mix(P.brows, "L", 0.3, k); mix(P.brows, "R", 0.3, k); mix(P.eyes, "blink", 0.18, k); } };
  G.happy = { dur: 2, in: 0.3, out: 0.4, apply(P, τ, k) {
    mix(P.eyes, "blink", 0.42, k); mix(P.brows, "L", 0.5, k); mix(P.brows, "R", 0.5, k);
    mix(P.mouth, "open", Math.max(P.mouth.open, 0.45), k); mix(P.mouth, "wide", 0.9, k);
    mix(P.head, "tilt", 5 + 1.5 * Math.sin(TAU * 3 * τ), k);
  } };
  G.surprise = { dur: 1.8, in: 0.18, out: 0.5, apply(P, τ, k) {
    mix(P.brows, "L", 1, k); mix(P.brows, "R", 1, k); mix(P.brows, "knit", -0.2, k);
    mix(P.mouth, "open", 0.75, k); mix(P.mouth, "round", 1, k); mix(P.mouth, "wide", 0, k);
    mix(P, "lean", -1.5, k); mix(P.head, "nod", -0.5, k);
  } };
  G.sad = { dur: 2.4, in: 0.5, out: 0.5, apply(P, τ, k) {
    mix(P.brows, "knit", -0.8, k); mix(P.brows, "L", 0.25, k); mix(P.brows, "R", 0.25, k);
    mix(P.head, "nod", 0.7, k); mix(P.head, "tilt", -4, k); mix(P.eyes, "blink", 0.25, k);
  } };
  G.angry = { dur: 2, in: 0.3, out: 0.4, apply(P, τ, k) {
    mix(P.brows, "knit", 1, k); mix(P.brows, "L", -0.5, k); mix(P.brows, "R", -0.5, k); mix(P.head, "nod", 0.25, k);
  } };
  G.wink = { dur: 0.7, in: 0.12, out: 0.2, apply(P, τ, k, a) {
    const s = a.side || "L"; P.eyes[s] = Math.max(P.eyes[s] || 0, k); mix(P.head, "tilt", lookTo(s, -3), k);
  } };

  // nombres en español
  const ALIAS = { saludar: "wave", senalar: "point", idea: "idea", presentar: "present", explicar: "explain",
    pensar: "think", pulgar: "thumbsup", encoger: "shrug", bienvenida: "welcome", alto: "stop", contar: "count",
    cintura: "hip", si: "nod", no: "shake", inclinar: "tilt", mirar: "look", sonreir: "smile", feliz: "happy",
    sorpresa: "surprise", triste: "sad", enojo: "angry", guino: "wink" };
  const resolve = n => G[n] ? n : G[ALIAS[norm(n)]] ? ALIAS[norm(n)] : null;

  /* ---------- escena compilada ---------- */
  function compile(scene, ctx) {
    const T = ctx.T, warn = m => console.warn("[avatar]", m);
    const acts = [];
    for (const a of scene.timeline || []) {
      const id = resolve(a.do || "");
      if (!id) { warn("gesto desconocido: " + a.do); continue; }
      const g = G[id], t0 = T(a.t, 0), dur = a.dur ?? g.dur;
      acts.push({ ...a, id, g, t0, t1: t0 + dur, dur, in: a.in ?? g.in, out: a.out ?? g.out });
    }
    acts.sort((x, y) => x.t0 - y.t0);
    const S = { ch: ctx.ch, cx: ctx.ch ? ctx.ch.rig.feet[0] : 518, acts, syl: buildSyllables(ctx.words || []), seed: scene.seed ?? 3, idle: scene.idle ?? 1, talkAmp: scene.talk?.amp, talk: scene.talk?.enabled !== false };
    S.blinks = blinkSchedule(S.seed, ctx.END || 600);
    return S;
  }

  function poseRaw(S, t) {
    const P = Avatar.rest();
    idle(P, t, S);
    if (S.talk) {
      const M = mouthAt(S, t); Object.assign(P.mouth, M);
      const sp = speaking(S, t);
      P.head.nod += sp * 0.22 * Math.sin(TAU * t / 0.9);
      P.head.tilt += sp * 0.8 * Math.sin(TAU * t / 2.7 + 0.5);
    }
    P.eyes.blink = blinkAt(S, t);
    for (const a of S.acts) {
      if (t < a.t0 || t > a.t1) continue;
      const τ = t - a.t0, k = ease(τ / a.in) * ease((a.dur - τ) / a.out);
      a.g.apply(P, τ, k, a, S);
    }
    return P;
  }

  function poseAt(S, t) {
    const P = poseRaw(S, t);
    // el pelo sigue a la cabeza con retraso (y un poco de rebote)
    const lag = poseRaw(S, t - 0.14).head.tilt;
    P.hairLag = clamp((lag - P.head.tilt) * 0.9, -6, 6);
    return P;
  }

  window.AvatarGestures = { G, ALIAS, compile, poseAt, resolve };
})();
