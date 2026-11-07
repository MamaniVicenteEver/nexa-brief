/* NodeAction · núcleo del motor de escenas de acción.
 *
 * Una escena es SOLO DATOS (assets/scene.json): elenco, equipos, acciones en el tiempo,
 * cámara y, opcionalmente, un "plan" que el director (planner.js) convierte en acciones.
 * El motor compila esos datos a pistas por personaje y dibuja cualquier instante t como
 * función pura de t: window.__promo.seek(t) da el mismo cuadro en cualquier orden
 * (mismo contrato que las plantillas promo-* y el explainer-kit → se graba con
 * _tools/commercial/render_promo.py).
 *
 * Mundo: x = izquierda/derecha, z = profundidad (lejos = mayor), y = altura (suelo = 0).
 * Unidad = altura de un personaje (~1,7 m). Archivos: core.js (esto) · rig.js (esqueleto,
 * poses y dibujo de personajes) · fx.js (proyectiles, pintura, destellos) · planner.js (director).
 */
(function () {
  "use strict";
  const A = (window.Action = window.Action || {});
  const PLAYER_CONTROLS = new URLSearchParams(location.search).get("controls") === "1";
  const SCRIPT_SRC = document.currentScript && document.currentScript.src;
  const bridgeReady = PLAYER_CONTROLS && SCRIPT_SRC ? new Promise(resolve => {
    if (window.NexaPlayerBridge) return resolve(true);
    const script = document.createElement("script");
    script.src = new URL("../../../_tools/player/bridge.js", SCRIPT_SRC).href;
    script.onload = () => resolve(true);
    script.onerror = () => { console.warn("[action] no se pudo cargar el puente de controles"); resolve(false); };
    document.head.appendChild(script);
  }) : Promise.resolve(false);

  /* ------------------------------ utilidades ------------------------------ */
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0)); return u * u * (3 - 2 * u); };
  const ease = {
    io: u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
    out: u => 1 - Math.pow(1 - u, 3),
    in: u => u * u,
    sine: u => -(Math.cos(Math.PI * u) - 1) / 2,
  };
  function hash(s) { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /* perfil de velocidad trapezoidal: acelera, crucero, frena (u y resultado en 0..1) */
  function trap(u, a = 0.2) {
    u = clamp(u); const v = 1 / (1 - a);
    if (u < a) return (0.5 * v * u * u) / a;
    if (u > 1 - a) return 1 - (0.5 * v * (1 - u) * (1 - u)) / a;
    return 0.5 * v * a + v * (u - a);
  }
  Object.assign(A, { clamp, lerp, smooth, ease, hash, rng, trap });

  /* ------------------------------ narración y anclas ------------------------------ */
  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
  function wordsOf(lyrics) {
    const out = [];
    for (const s of lyrics?.segments || []) for (const w of s.words || []) {
      const text = String(w.word ?? w.text ?? "").trim();
      if (text && isFinite(+w.start)) out.push({ text, n: norm(text), start: +w.start, end: +(w.end ?? w.start) });
    }
    return out;
  }
  /* "@palabra" · "@dos palabras" · "@palabra#2" (2.ª aparición) · "@palabra:end" · "@palabra+0.3" */
  function findAnchor(words, spec, cursor) {
    const m = /^@(.+?)(?:#(\d+))?(:end)?([+-]\d*\.?\d+)?$/.exec(String(spec).trim());
    if (!m) return null;
    const toks = m[1].split(/\s+/).map(norm).filter(Boolean);
    const nth = m[2] ? +m[2] : 0, useEnd = !!m[3], off = m[4] ? parseFloat(m[4]) : 0;
    let count = 0;
    for (let i = nth ? 0 : cursor.i; i <= words.length - toks.length; i++) {
      if (!toks.every((tk, j) => words[i + j].n === tk)) continue;
      if (nth && ++count < nth) continue;
      if (!nth) cursor.i = i;
      return (useEnd ? words[i + toks.length - 1].end : words[i].start) + off;
    }
    return null;
  }
  A.wordsOf = wordsOf; A.findAnchor = findAnchor;

  /* ------------------------------ armas ------------------------------ */
  /* speed u/s · arc = flecha de la parábola (u) por segundo de vuelo · lethal = 1 impacto basta */
  A.weapons = {
    paint: { speed: 15, arc: 0.35, size: 0.036, flash: true, impact: "splat", droplets: [12, 18], kick: 1 },
    rock:  { speed: 9, arc: 2.2, size: 0.05, flash: false, impact: "thud", droplets: [3, 5], kick: 0, color: "#8a8178" },
    /* armas de época: trazadora fina, polvo al fallar, marca oscura al acertar */
    rifle: { speed: 38, arc: 0.04, size: 0.011, flash: true, flashSize: 0.05, impact: "dust", droplets: [1, 3], tracer: true, color: "#3a3631", mark: "#c4161c", blood: "#b3141b", draw: "rifle", muzzle: 0.36, fall: "mixed" },
    mg:    { speed: 42, arc: 0.03, size: 0.011, flash: true, flashSize: 0.07, impact: "dust", droplets: [1, 2], tracer: true, color: "#3a3631", mark: "#c4161c", blood: "#b3141b", draw: "mg", muzzle: 0.4, fall: "mixed" },
  };

  /* ------------------------------ compilación ------------------------------ */
  function makeActor(def, scene, i) {
    const team = scene.teams?.[def.team] || {};
    const paint = def.paint || def.color || team.paint || team.color || "#ff2d8f";
    const body = def.body || def.color || team.body || team.color || "#1a1a1a";
    return {
      id: def.id, i, def, team: def.team, style: def.style || team.style || "trooper", body, paint,
      accent: def.accent || team.accent || paint, hero: !!def.hero,
      helmet: def.helmet || team.helmet || body, flag: def.flag || team.flag || null, vis: [],
      pos0: [def.pos?.[0] ?? 0, def.pos?.[1] ?? 8], face0: def.face || 1, hp: def.hp ?? 1, scale: def.scale || 1,
      weapon: def.weapon === undefined ? "paint" : def.weapon, seed: hash(def.id),
      motion: [], aims: [], shots: [], kneels: [], poses: [], turns: [], hits: [], marks: [], death: null,
    };
  }

  /* posición de un segmento de movimiento (move | jump) en t; respeta el corte (seg.cut) */
  function segAt(seg, t) {
    const te = Math.min(t, seg.cut ?? seg.t1);
    const u = clamp((te - seg.t0) / Math.max(1e-6, seg.t1 - seg.t0));
    if (seg.kind === "move") {
      const p = trap(u, seg.acc ?? 0.2);
      return { x: lerp(seg.a[0], seg.b[0], p), z: lerp(seg.a[1], seg.b[1], p), lift: 0, u, dist: seg.d0 + seg.dist * p };
    }
    const v = clamp((u - 0.16) / 0.68);
    return { x: lerp(seg.a[0], seg.b[0], v), z: lerp(seg.a[1], seg.b[1], v), lift: seg.height * 4 * v * (1 - v), u, dist: seg.d0 };
  }

  function compile(scene, words, opts = {}) {
    const warnings = [];
    const warn = (msg, ev) => { if (!ev?.auto) warnings.push(msg); };
    const actors = new Map();
    (scene.cast || []).forEach((d, i) => {
      if (!d.id) return warnings.push(`cast[${i}] sin id`);
      if (actors.has(d.id)) return warnings.push(`id repetido en cast: ${d.id}`);
      actors.set(d.id, makeActor(d, scene, i));
    });

    /* el director puede pedir anclas ("@palabra") con su propio cursor */
    const resolvePlanT = spec => {
      if (typeof spec === "number") return spec;
      if (typeof spec === "string" && spec.trim()[0] === "@") { const t = findAnchor(words, spec, { i: 0 }); if (t == null) warnings.push(`plan: ancla no encontrada: ${spec}`); return t; }
      return spec == null ? null : parseFloat(spec);
    };
    /* el director genera acciones a partir de "plan"; las acciones manuales se suman */
    let events = (scene.timeline || []).map((e, k) => ({ ...e, k }));
    if (scene.plan && A.plan) {
      try { events = events.concat(A.plan(scene, actors, { warnings, anchor: spec => resolvePlanT(spec) }).map((e, k) => ({ ...e, auto: true, k: 1e5 + k }))); }
      catch (e) { warnings.push("plan falló: " + e.message); console.error(e); }
    }

    /* tiempos: número · "+0.4" (tras la acción anterior del mismo personaje) · "@palabra" */
    const lastEnd = {}, cursor = { i: 0 };
    let lastT = 0;
    const resolveT = (spec, actor) => {
      if (typeof spec === "number") return spec;
      if (spec && typeof spec === "object") return resolveT(spec.at, actor) + (spec.offset || 0);
      if (spec == null) return lastEnd[actor] ?? lastT;
      const s = String(spec).trim();
      if (s[0] === "+") return (lastEnd[actor] ?? lastT) + parseFloat(s.slice(1));
      if (s[0] === "@") {
        const t = findAnchor(words, s, cursor);
        if (t == null) { warnings.push(`ancla no encontrada: ${s}`); return lastEnd[actor] ?? lastT; }
        return t;
      }
      return parseFloat(s) || 0;
    };
    /* orden del archivo para resolver anclas y "+x"; después, orden por tiempo */
    const timed = events.filter(e => e.actor != null && !e.camera).map(e => {
      const t = resolveT(e.t, e.actor);
      lastT = t;
      const dur = e.do === "aim" ? (e.dur ?? 1) : e.do === "kneel" || e.do === "crouch" ? (e.dur ?? 1.5) : e.do === "pose" ? (e.dur ?? 2) : e.do === "shoot" ? 0.25 : 0;
      lastEnd[e.actor] = t + dur;
      return { ...e, t };
    });
    cursor.i = 0;   /* la cámara busca sus anclas desde el principio */
    const camKeys = (scene.camera?.keys || []).map(k => ({ ...k }));
    const endKeys = camKeys.filter(k => typeof k.t === "string" && /^end/.test(k.t));
    for (const k of camKeys) if (typeof k.t !== "number" && !endKeys.includes(k)) k.t = resolveT(k.t, "__cam");
    for (const e of events.filter(e => e.camera)) camKeys.push({ ...e.camera, t: resolveT(e.t, "__cam") });
    timed.sort((a, b) => a.t - b.t || a.k - b.k);

    const S = { scene, actors, words, warnings, total: 0, shots: [], impacts: [], decals: [], droplets: [], blasts: [], sounds: [], tint: [] };
    S.posAt = posAt;

    /* posición en t (sin la muerte: la muerte corta los segmentos) */
    function posAt(a, t) {
      let base = { x: a.pos0[0], z: a.pos0[1], lift: 0, dist: 0 }, seg = null;
      for (const s of a.motion) {
        if (t < s.t0) break;
        const r = segAt(s, t);
        if (t < Math.min(s.t1, s.cut ?? s.t1)) { seg = s; base = r; break; }
        base = { ...r, lift: 0 };
      }
      /* muerto en el aire: cae al suelo en 0,25 s */
      if (a.death && t > a.death.t && a.death.lift > 0) base.lift = a.death.lift * Math.max(0, 1 - ((t - a.death.t) / 0.25) ** 2);
      return { ...base, seg };
    }
    const cutAt = (a, t) => { for (const s of a.motion) if (t > s.t0 && t < Math.min(s.t1, s.cut ?? s.t1)) s.cut = t; };

    /* acciones → pistas */
    for (const e of timed) {
      const a = actors.get(e.actor);
      if (!a) { warn(`acción de un personaje que no existe: ${e.actor}`, e); continue; }
      const t = e.t;
      const go = e.do || "move";
      if (["move", "walk", "run", "sprint", "strafe", "march", "jump"].includes(go)) {
        cutAt(a, t);
        const p = posAt(a, t);
        const from = [p.x, p.z];
        const to = e.to ? [e.to[0], e.to[1]] : e.by ? [from[0] + e.by[0], from[1] + (e.by[1] || 0)] : from;
        const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
        if (go === "jump") {
          const dur = e.dur ?? 0.9;
          a.motion.push({ kind: "jump", t0: t, t1: t + dur, a: from, b: to, dist, height: e.height ?? 0.7, style: e.style || "tuck" });
        } else {
          const gait = go === "move" ? (e.gait || "run") : go;
          const G = A.GAITS?.[gait] || { speed: 3 };
          const dur = e.dur ?? Math.max(0.25, dist / (e.speed || G.speed));
          a.motion.push({ kind: "move", t0: t, t1: t + dur, a: from, b: to, dist, gait, acc: e.acc ?? (gait === "walk" ? 0.25 : 0.18) });
        }
        a.motion.sort((x, y) => x.t0 - y.t0);
        if (Math.abs(to[0] - from[0]) > 0.05) a.turns.push({ t, dir: Math.sign(to[0] - from[0]), move: true });
      } else if (go === "aim") {
        a.aims.push({ t0: t, t1: t + (e.dur ?? 1), target: e.target, at: e.at });
      } else if (go === "shoot" || go === "throw") {
        const aim = { t0: t - (e.ready ?? 0.3), t1: t + 0.22, target: e.target, at: e.at, shot: true, ready: e.ready ?? 0.3 };
        a.shots.push({ t, target: e.target, at: e.at, hit: e.hit !== false, lethal: e.lethal !== false, weapon: e.weapon || a.weapon || "paint", auto: !!e.auto, k: e.k, impactAt: e.impactAt != null ? resolveT(e.impactAt, e.actor) : null, aim });
        a.aims.push(aim);
      } else if (go === "kneel" || go === "crouch") {
        a.kneels.push({ t0: t, t1: t + (e.dur ?? 1.5) });
      } else if (go === "pose") {
        a.poses.push({ t0: t, t1: t + (e.dur ?? 2), name: e.name || "victory" });
      } else if (go === "face") {
        a.turns.push({ t, dir: e.dir, target: e.target });
      } else if (go === "hide" || go === "show") {
        a.vis.push({ t, on: go === "show" });
      } else if (go === "whistle") {
        a.poses.push({ t0: t, t1: t + (e.dur ?? 1.0), name: "whistle" });
        S.sounds.push({ t: t + 0.15, kind: "whistle", actor: a.id });
      } else if (go === "die") {
        if (!a.death) a.death = { t, from: e.from || null, face: a.face0, lift: 0, forced: true };
      } else warn(`acción desconocida "${go}" (${e.actor})`, e);
    }

    /* distancia acumulada (para el ciclo de piernas) */
    for (const a of actors.values()) {
      let d = 0;
      for (const s of a.motion) { s.d0 = d; d += s.kind === "move" ? s.dist : 0; }
      a.aims.sort((x, y) => x.t0 - y.t0);
      a.vis.sort((x, y) => x.t - y.t);
    }

    /* eventos del mundo (sin actor): explosiones sueltas y bombardeos */
    const Rw = rng(hash(`world:${scene.seed ?? 1}`));
    /* las anclas del mundo se buscan cada una desde el principio de la voz */
    const wT = spec => (typeof spec === "string" && spec.trim()[0] === "@" ? (findAnchor(words, spec, { i: 0 }) ?? (warnings.push(`ancla no encontrada: ${spec}`), 0)) : typeof spec === "string" && /^end/.test(spec) ? null : resolveT(spec, "__world"));
    for (const e of events.filter(e => e.actor == null && !e.camera && (e.do === "blast" || e.do === "barrage"))) {
      const t = wT(e.t);
      if (e.do === "blast") { S.blasts.push({ t, at: [e.at[0], e.at[1]], size: e.size ?? 1, kill: e.kill ?? 0, seed: hash(`b${t}:${e.at}`) }); continue; }
      const t1 = wT(e.until), area = e.area || { x: [-4, 4], z: [10, 14] }, ev = e.every || [0.3, 0.7], sz = e.size || [0.6, 1.1];
      for (let tt = t; tt < t1; tt += lerp(ev[0], ev[1], Rw())) {
        S.blasts.push({ t: tt, at: [lerp(area.x[0], area.x[1], Rw()), lerp(area.z[0], area.z[1], Rw())], size: lerp(sz[0], sz[1], Rw()), kill: e.kill ?? 0, seed: hash(`bb${tt.toFixed(3)}`) });
      }
    }
    S.blasts.sort((x, y) => x.t - y.t);
    for (const b of S.blasts) if (b.kill > 0) for (const a of actors.values()) {
      if (a.death && a.death.t <= b.t) continue;
      const p = posAt(a, b.t);
      if (Math.hypot(p.x - b.at[0], p.z - b.at[1]) > b.kill) continue;
      a.death = { t: b.t + 0.05, from: null, face: -(Math.sign(p.x - b.at[0]) || 1), lift: p.lift, style: "back", blast: true };
      cutAt(a, b.t);
    }
    /* luz (tinte sobre toda la imagen): [{t, color, a, blend}] — p. ej. la noche cayendo */
    for (const k of scene.tint || []) S.tint.push({ t: wT(k.t), color: k.color || "#141826", a: k.a ?? 0, blend: k.blend ?? 3 });
    S.tint.sort((x, y) => x.t - y.t);

    /* disparos en orden de tiempo: vuelo, impacto, muertes */
    const allShots = [];
    for (const a of actors.values()) for (const s of a.shots) allShots.push({ ...s, from: a.id, orig: s });
    allShots.sort((x, y) => x.t - y.t || (x.k ?? 0) - (y.k ?? 0));
    const aliveAt = (a, t) => !a.death || t < a.death.t;
    for (const sh of allShots) {
      const a = actors.get(sh.from);
      if (!aliveAt(a, sh.t)) { if (!sh.auto) warn(`${a.id} dispara en ${sh.t.toFixed(2)} s pero ya cayó`); dropShotAim(a, sh.t); continue; }
      const W = A.weapons[sh.weapon] || A.weapons.paint;
      const tgt = sh.target != null ? actors.get(sh.target) : null;
      if (sh.target != null && !tgt) { warn(`disparo a un personaje que no existe: ${sh.target}`); continue; }
      const p = posAt(a, sh.t);
      const face = tgt ? Math.sign(posAt(tgt, sh.t).x - p.x) || 1 : (sh.at ? Math.sign(sh.at[0] - p.x) || 1 : a.face0);
      const muzzle = [p.x + face * 0.42 * a.scale, p.lift + 0.68 * a.scale, p.z];
      const R = rng(hash(`${a.id}:${sh.t.toFixed(3)}`));
      let hitActor = null, impact, flight = 0.3;
      for (let it = 0; it < 3; it++) {
        const ti = sh.t + flight;
        if (tgt && sh.hit && aliveAt(tgt, ti)) { impact = A.chestW(S, tgt, ti); hitActor = tgt; }
        else if (tgt) {
          /* fallo: la bola pasa cerca y pinta el suelo detrás o al costado */
          const q = posAt(tgt, ti), side = R() < 0.5 ? -1 : 1;
          impact = [q.x + side * (0.35 + R() * 0.55) + face * (0.3 + R() * 0.6), 0, q.z + (R() - 0.5) * 1.2];
          hitActor = null;
        } else impact = sh.at ? [sh.at[0], sh.at[1] ?? 0, sh.at[2] ?? p.z] : [p.x + face * 6, 0, p.z];
        flight = Math.hypot(impact[0] - muzzle[0], impact[1] - muzzle[1], impact[2] - muzzle[2]) / W.speed;
      }
      /* impactAt: el disparo se adelanta lo que tarda la bola, así el impacto cae en ese instante */
      if (sh.impactAt != null && Math.abs(sh.t + flight - sh.impactAt) > 0.005) {
        const nt = sh.impactAt - flight;
        sh.t = nt; sh.orig.t = nt; sh.orig.aim.t0 = nt - sh.orig.aim.ready; sh.orig.aim.t1 = nt + 0.22;
        if (!aliveAt(a, nt)) { dropShotAim(a, nt); continue; }
        const q = tgt && sh.hit && aliveAt(tgt, sh.impactAt) ? A.chestW(S, tgt, sh.impactAt) : impact;
        impact = q; hitActor = tgt && sh.hit && aliveAt(tgt, sh.impactAt) ? tgt : null;
        const p2 = posAt(a, nt), m2 = [p2.x + face * 0.42 * a.scale, p2.lift + 0.68 * a.scale, p2.z];
        flight = Math.hypot(impact[0] - m2[0], impact[1] - m2[1], impact[2] - m2[2]) / W.speed;
        sh.t = sh.impactAt - flight; sh.orig.t = sh.t; sh.orig.aim.t0 = sh.t - sh.orig.aim.ready; sh.orig.aim.t1 = sh.t + 0.22;
      }
      const ti = sh.t + flight;
      const color = W.color || a.paint;
      const shot = { i: S.shots.length, from: a.id, target: sh.target, t0: sh.t, t1: ti, p1: impact, color, weapon: sh.weapon, arc: W.arc * flight, size: W.size, hit: !!hitActor };
      S.shots.push(shot);
      const imp = { t: ti, p: impact, color, actor: hitActor?.id || null, from: a.id, dirX: face, seed: hash(`imp${shot.i}`), weapon: sh.weapon };
      S.impacts.push(imp);
      if (hitActor) {
        hitActor.hits.push({ t: ti, from: a.id, color, dirX: face });
        hitActor.marks.push({ t: ti, color: W.mark || color, seed: imp.seed, small: !!W.mark });
        if (sh.lethal && hitActor.hits.length >= hitActor.hp && !hitActor.death) {
          const q = posAt(hitActor, ti);
          const fallMode = hitActor.def.fall || W.fall || "back";
          const Rf = rng(hash(`fall:${hitActor.id}`));
          const style = fallMode === "mixed" ? (Rf() < 0.4 ? "back" : Rf() < 0.55 ? "forward" : "knees") : fallMode;
          hitActor.death = { t: ti, from: a.id, face: -face, lift: q.lift, style, weapon: sh.weapon };
          cutAt(hitActor, ti);
        }
      }
    }
    /* acciones de los que ya cayeron: se descartan (los avisos solo para las manuales) */
    for (const a of actors.values()) if (a.death) {
      const tD = a.death.t;
      a.motion = a.motion.filter(s => s.t0 < tD);
      a.kneels = a.kneels.filter(k => k.t0 < tD);
      a.poses = a.poses.filter(k => k.t0 < tD);
      a.aims = a.aims.filter(k => k.t0 < tD);
      for (const k of a.aims) k.t1 = Math.min(k.t1, tD);
      for (const k of a.kneels) k.t1 = Math.min(k.t1, tD + 0.05);
    }
    function dropShotAim(a, t) { a.aims = a.aims.filter(k => !(k.shot && Math.abs(k.t0 + 0.3 - t) < 1e-6)); }

    const fxo = scene.fx || {};
    if (fxo.poppies) S.poppiesAt = wT(fxo.poppies.at ?? 0);
    /* pintura: gotas balísticas y manchas en el suelo (todo precalculado, determinista) */
    if (A.fx?.compile) A.fx.compile(S);

    /* duración */
    const lastEv = Math.max(0, ...timed.map(e => e.t), ...S.shots.map(s => s.t1), ...[...actors.values()].map(a => Math.max(0, ...a.motion.map(m => m.t1), ...a.poses.map(p => p.t1))));
    /* con voz, el video dura lo que la voz (+ cola); las poses largas ("hold") no lo estiran */
    const lastWord = words.length ? words[words.length - 1].end + (scene.tail ?? 3) : 0;
    S.total = scene.duration || opts.total || lastWord || lastEv + 2;

    /* cámara ("end-2.5" = 2,5 s antes del final) */
    for (const k of endKeys) k.t = S.total + (parseFloat(k.t.slice(3)) || 0);
    camKeys.sort((x, y) => x.t - y.t);
    S.camKeys = camKeys;
    S.camAt = t => A.camera.at(S, t);
    return S;
  }

  /* pecho de un personaje en el mundo (aproximado: no depende de la cámara) */
  A.chestW = function (S, a, t) {
    const p = S.posAt(a, t);
    if (a.death && t >= a.death.t + 0.35) return [p.x + (a.death.style && a.death.style !== "back" ? 1 : -1) * a.death.face * 0.5 * a.scale, 0.05, p.z];
    let kneel = 0;
    for (const k of a.kneels) kneel = Math.max(kneel, Math.min(smooth(k.t0, k.t0 + 0.2, t), 1 - smooth(k.t1 - 0.05, k.t1 + 0.2, t)));
    return [p.x, p.lift + lerp(0.6, 0.42, kneel) * a.scale, p.z];
  };

  /* la cámara vive en camera.js (A.camera): objetivos por key, estabilizador, efectos y proyección */

  /* ------------------------------ arranque y reloj ------------------------------ */
  async function loadJSON(...urls) {
    for (const u of urls) { if (!u) continue; try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) {} }
    return null;
  }
  const image = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

  A.boot = async function (opts = {}) {
    const doc = document;
    const raw = opts.config || (await loadJSON("config.json", "assets/config.json"));
    const C = (raw && raw.configs ? raw.configs[0] : raw) || {};
    const QS = new URLSearchParams(location.search);
    const FROZEN = QS.has("t") ? parseFloat(QS.get("t")) : null;
    const scene = opts.scene || (await loadJSON(C.sceneUrl || "scene.json", "assets/scene.json"));
    if (!scene) throw new Error("[action] sin scene.json");
    const lyrics = C.lyricsUrl ? await loadJSON(C.lyricsUrl, "lyrics.json", "assets/lyrics.json") : null;
    const words = wordsOf(lyrics);
    const audio = doc.getElementById("audio");
    if (audio && C.audio?.src) audio.src = C.audio.src;
    const audioDur = await new Promise(res => {
      if (!audio || !C.audio?.src) return res(0);
      const done = () => res(isFinite(audio.duration) ? audio.duration : 0);
      if (audio.readyState >= 1) done(); else { audio.addEventListener("loadedmetadata", done, { once: true }); setTimeout(done, 4000); }
    });

    const S = compile(scene, words, { total: audioDur || 0 });
    /* modo de personajes: "3d" = esqueleto con volumen (rig3d.js); si no, el dibujo 2D de rig.js */
    A.rig2d = A.rig2d || A.rig;
    A.rig = scene.render === "3d" && A.rig3d ? A.rig3d : A.rig2d;
    for (const w of S.warnings) console.warn("[action]", w);

    /* fondo: blanco (por defecto) · color · imagen · video */
    const BG = { type: "color", color: "#ffffff", ...(scene.background || {}), ...(C.background || {}) };
    let bgImg = null, bgVid = null;
    if (BG.type === "image" && BG.src) bgImg = await image(BG.src);
    if (BG.type === "video" && BG.src) {
      bgVid = doc.createElement("video"); bgVid.muted = true; bgVid.playsInline = true; bgVid.preload = "auto"; bgVid.src = BG.src;
      await new Promise(r => { bgVid.addEventListener("loadeddata", r, { once: true }); setTimeout(r, 6000); });
    }
    const light = BG.type === "color" ? lum(BG.color) > 0.6 : !!BG.light;

    const root = opts.root || doc.getElementById("stage");
    root.style.background = BG.color || "#fff"; doc.body.style.background = BG.color || "#fff";
    const canvas = doc.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    root.appendChild(canvas);
    const g = canvas.getContext("2d");
    const hud = doc.createElement("div"); hud.className = "na-hud"; root.appendChild(hud);
    const cap = doc.createElement("div"); cap.className = "na-cap"; root.appendChild(cap);
    const OV = { brand: "", accent: "", ...(scene.overlay || {}), ...(C.overlay || {}) };
    hud.innerHTML = OV.brand ? `<div class="na-brand">${esc(OV.brand)}<span>${esc(OV.accent || "")}</span></div><div class="na-label"></div>` : `<div class="na-label"></div>`;
    const labelEl = hud.querySelector(".na-label");
    if (OV.color) hud.style.setProperty("--na-accent", OV.color);

    const dpr = opts.dpr || Math.min(2, window.devicePixelRatio || 1);
    const view = { W: 0, H: 0, hz: 0.42, light };
    function size() {
      view.W = root.clientWidth || innerWidth; view.H = root.clientHeight || innerHeight;
      const portrait = view.H > view.W;
      const hzc = scene.camera?.horizon;
      view.hz = typeof hzc === "number" ? hzc : (portrait ? hzc?.portrait ?? 0.4 : hzc?.landscape ?? 0.42);
      view.zoomK = portrait ? scene.camera?.portraitZoom ?? 1.0 : 1;
      canvas.width = Math.round(view.W * dpr); canvas.height = Math.round(view.H * dpr);
      if (A.fx?.reset) A.fx.reset(S);
      S.camPath = null;   /* el recorrido de cámara depende de la orientación (key.portrait) */
    }
    size();
    S.view = view;

    function drawBg(t) {
      if (bgImg || bgVid) {
        const m = bgImg || bgVid, iw = m.naturalWidth || m.videoWidth, ih = m.naturalHeight || m.videoHeight;
        if (iw && ih) {
          const k = Math.max(view.W / iw, view.H / ih);
          g.drawImage(m, (view.W - iw * k) / 2, (view.H - ih * k) / 2, iw * k, ih * k);
          if (BG.dim) { g.fillStyle = `rgba(0,0,0,${BG.dim})`; g.fillRect(0, 0, view.W, view.H); }
          return;
        }
      }
      g.fillStyle = BG.color || "#fff"; g.fillRect(0, 0, view.W, view.H);
    }

    let capKey = "";
    const CAP = { enabled: words.length > 0, maxWords: 5, ...(scene.captions || {}), ...(C.captions || {}) };
    const chunks = captionChunks(words, CAP.maxWords);
    function renderCaptions(t) {
      if (!CAP.enabled) return;
      const ch = chunks.find(c => t >= c.t0 - 0.05 && t < c.t1);
      const n = ch ? ch.words.filter(w => w.start <= t + 0.02).length : 0;
      const key = ch ? ch.t0 + "|" + n : "";
      if (key === capKey) return;
      capKey = key; cap.innerHTML = "";
      if (!ch) return;
      const box = doc.createElement("div"); box.className = "na-cap-line"; cap.appendChild(box);
      ch.words.forEach((w, i) => { if (i >= n) return; const s = doc.createElement("span"); s.className = i === n - 1 ? "na-w na-w-cur" : "na-w"; s.textContent = w.text + " "; box.appendChild(s); });
    }

    function render(t) {
      t = clamp(t, 0, S.total);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBg(t);
      const cam = S.camAt(t);
      cam.zoom *= view.zoomK || 1;
      A.drawWorld(g, S, cam, t);
      const tn = tintAt(S, t);
      if (tn.a > 0.001) { g.fillStyle = tn.color; g.globalAlpha = tn.a; g.fillRect(0, 0, view.W, view.H); g.globalAlpha = 1; }
      if (labelEl.textContent !== (cam.label || "")) labelEl.textContent = cam.label || "";
      renderCaptions(t);
    }

    let forced = FROZEN, t0wall = null, controlledTime = FROZEN == null ? 0 : FROZEN;
    const LOOP = QS.has("loop"), CONTROLLED = QS.get("controls") === "1";
    const clock = now => forced != null ? forced
      : CONTROLLED ? (audio ? audio.currentTime || 0 : controlledTime)
      : audio && !audio.paused && audio.currentTime > 0 ? audio.currentTime
      : (t0wall == null ? ((t0wall = now), 0) : LOOP ? ((now - t0wall) / 1000) % S.total : (now - t0wall) / 1000);
    function frame(now) { const t = clock(now); render(t); if (forced == null && (LOOP || CONTROLLED || t < S.total)) requestAnimationFrame(frame); }
    addEventListener("resize", () => { size(); if (forced != null) render(forced); });

    const scenes = () => {
      const cuts = [0, ...S.camKeys.filter(k => k.label != null && k.t > 0).map(k => k.t)].filter((v, i, arr) => arr.indexOf(v) === i);
      return cuts.map((t0, i) => ({ t0, t1: cuts[i + 1] ?? S.total, type: "shot", seg: { text: "" } })).concat([{ t0: S.total, t1: S.total, type: "end", seg: { text: "" } }]);
    };
    window.__promo = {
      scenes, total: S.total, words,
      async seek(t) {
        forced = t;
        if (bgVid) { const vt = (BG.loop === false ? Math.min(t, bgVid.duration - 0.05) : t % Math.max(0.1, bgVid.duration || 1)); if (Math.abs(bgVid.currentTime - vt) > 0.001) { bgVid.currentTime = vt; await new Promise(r => { bgVid.addEventListener("seeked", r, { once: true }); setTimeout(r, 3000); }); } }
        render(t);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      },
      release() { forced = null; requestAnimationFrame(frame); },
    };
    window.__action = { S, render, warnings: S.warnings, compiled: () => summarize(S), audioEvents: () => audioEvents(S) };
    window.__actionPlayerControl = {
      setTime(t, freeze = true) {
        controlledTime = clamp(Number(t) || 0, 0, S.total);
        forced = freeze ? controlledTime : null;
        render(controlledTime);
      },
      release() {
        forced = null;
        if (!window.__loop) { window.__loop = 1; requestAnimationFrame(frame); }
      },
    };
    if (CONTROLLED && bridgeReady) bridgeReady.then(loaded => {
      if (!loaded || !window.NexaPlayerBridge) return;
      let playerPlaying = false, synthTime = Number.isFinite(FROZEN) ? FROZEN : 0, synthStamp = 0, endedHandler = null;
      const hasAudio = !!(audio && C.audio?.src);
      const getTime = () => hasAudio ? audio.currentTime || 0 : synthTime;
      const getDuration = () => audio && Number.isFinite(audio.duration) ? audio.duration : S.total;
      const notifyEnded = () => { playerPlaying = false; if (endedHandler) endedHandler(); };
      function syntheticFrame(now) {
        if (!playerPlaying || hasAudio) return;
        if (synthStamp) synthTime = Math.min(getDuration(), synthTime + (now - synthStamp) / 1000);
        synthStamp = now;
        window.__actionPlayerControl.setTime(synthTime, false);
        if (synthTime >= getDuration() - 0.02) { playerPlaying = false; window.__actionPlayerControl.setTime(getDuration(), true); notifyEnded(); }
        else requestAnimationFrame(syntheticFrame);
      }
      const waitSeek = () => new Promise(resolve => {
        let done = false;
        const finish = () => { if (done) return; done = true; clearTimeout(timer); resolve(); };
        const timer = setTimeout(finish, 1500);
        audio.addEventListener("seeked", finish, { once: true });
      });
      window.NexaPlayerBridge.attach({
        duration: getDuration,
        currentTime: getTime,
        play() {
          playerPlaying = true;
          if (hasAudio) { window.__actionPlayerControl.release(); return audio.play(); }
          synthStamp = 0;
          requestAnimationFrame(syntheticFrame);
        },
        pause() {
          playerPlaying = false;
          if (hasAudio) {
            audio.pause();
            return window.__promo.seek(getTime());
          }
          window.__actionPlayerControl.setTime(getTime(), true);
        },
        async seek(t) {
          const wasPlaying = playerPlaying;
          if (hasAudio) {
            const target = clamp(t, 0, Number.isFinite(audio.duration) ? Math.max(0, audio.duration - 0.02) : S.total);
            if (Math.abs(audio.currentTime - target) > 0.01) { audio.currentTime = target; await waitSeek(); }
            try { await window.__promo.seek(target); }
            catch (_) { window.__actionPlayerControl.setTime(target, !wasPlaying); }
            if (wasPlaying) window.__actionPlayerControl.release();
          } else {
            synthTime = clamp(t, 0, getDuration());
            window.__actionPlayerControl.setTime(synthTime, !wasPlaying);
            if (wasPlaying) synthStamp = performance.now();
          }
        },
        setVolume(volume, muted) {
          if (!audio) return;
          audio.volume = clamp(volume, 0, 1);
          audio.muted = Boolean(muted);
        },
        onEnded(callback) {
          endedHandler = callback;
          if (hasAudio) audio.addEventListener("ended", notifyEnded);
        },
      });
    });
    if (FROZEN == null && !QS.has("paused") && !CONTROLLED && audio && C.audio?.src) audio.play().catch(() => {});
    if (FROZEN != null) render(FROZEN); else requestAnimationFrame(frame);
    return S;
  };

  /* resumen legible de lo compilado (para revisar con herramientas) */
  function summarize(S) {
    const out = { total: S.total, warnings: S.warnings, actors: [], shots: S.shots.map(s => ({ from: s.from, target: s.target, t: +s.t0.toFixed(2), impact: +s.t1.toFixed(2), hit: s.hit })) };
    for (const a of S.actors.values()) out.actors.push({ id: a.id, team: a.team, death: a.death ? +a.death.t.toFixed(2) : null, killedBy: a.death?.from || null, moves: a.motion.length, shots: a.shots.length });
    out.survivors = out.actors.filter(a => a.death == null).map(a => a.id);
    return out;
  }

  /* eventos sonoros (tools/sfx.py los sintetiza): pan −1..1 según la pantalla, gain según distancia */
  function audioEvents(S) {
    const out = [];
    const where = (t, x, y, z) => {
      const cam = S.camAt(t); cam.zoom *= S.view.zoomK || 1;
      const P = A.project(cam, S.view, x, y, z);
      return { pan: +clamp((P.x / S.view.W) * 2 - 1, -1, 1).toFixed(3), gain: +clamp(3.2 / P.D, 0.25, 1.2).toFixed(3) };
    };
    for (const sh of S.shots) {
      const a = S.actors.get(sh.from), p = S.posAt(a, sh.t0);
      out.push({ t: +sh.t0.toFixed(4), kind: sh.weapon === "rifle" || sh.weapon === "mg" ? "crack" : "shot", weapon: sh.weapon, hero: a.hero, ...where(sh.t0, p.x, 0.6, p.z) });
    }
    for (const im of S.impacts) {
      const dust = (A.weapons[im.weapon] || {}).impact === "dust";
      out.push({ t: +im.t.toFixed(4), kind: dust ? (im.actor ? "thump" : "dust") : im.actor ? "hit" : "splat", weapon: im.weapon, ...where(im.t, im.p[0], im.p[1], im.p[2]) });
    }
    for (const b of S.blasts) out.push({ t: +b.t.toFixed(4), kind: b.size >= 2.5 ? "mine" : "blast", size: b.size, ...where(b.t, b.at[0], 0, b.at[1]) });
    for (const w of S.sounds) { const a = S.actors.get(w.actor), p = S.posAt(a, w.t); out.push({ t: +w.t.toFixed(4), kind: w.kind, ...where(w.t, p.x, 1, p.z) }); }
    for (const a of S.actors.values()) {
      if (a.death) { const p = S.posAt(a, a.death.t); out.push({ t: +(a.death.t + 0.5).toFixed(4), kind: "fall", ...where(a.death.t, p.x, 0, p.z) }); }
      for (const m of a.motion) if (m.kind === "jump" && (!a.death || m.t0 < a.death.t)) {
        const d = m.t1 - m.t0, p = S.posAt(a, m.t0);
        out.push({ t: +(m.t0 + d * 0.14).toFixed(4), kind: "whoosh", ...where(m.t0, p.x, 0.5, p.z) });
        if (!a.death || m.t0 + d * 0.84 < a.death.t) out.push({ t: +(m.t0 + d * 0.84).toFixed(4), kind: "land", ...where(m.t1, m.b[0], 0, m.b[1]) });
      }
    }
    return { total: S.total, events: out.sort((p, q) => p.t - q.t) };
  }

  /* ------------------------------ mundo (orden por profundidad) ------------------------------ */
  A.drawWorld = function (g, S, cam, t) {
    const view = S.view;
    const proj = (X, Y, Z) => A.project(cam, view, X, Y, Z);
    S.proj = proj; S.cam = cam;
    if (A.fx) A.fx.drawGround(g, S, t, proj);
    const items = [];
    for (const a of S.actors.values()) {
      const st = A.rig.state(a, t, S, cam);
      if (proj(st.x, st.y, st.z).Dr < 0.5) continue;
      items.push({ x: st.x, z: st.z, draw: () => A.rig.draw(g, st, S, proj) });
      A.rig.shadow(g, st, proj);
    }
    if (A.fx) for (const it of A.fx.items(S, t, proj, cam)) items.push(it);
    /* profundidad respecto de la cámara (gira con yaw); los decorados largos usan su punto más cercano al centro */
    const f = cam.fwd || [0, 1];
    const depth = it => {
      const x = it.long ? clamp(cam.x, Math.min(...it.long), Math.max(...it.long)) : it.x ?? cam.x;
      return (x - cam.x) * f[0] + (it.z - cam.z) * f[1];
    };
    for (const it of items) it.d = depth(it);
    items.sort((p, q) => q.d - p.d);
    for (const it of items) it.draw();
  };

  function tintAt(S, t) {
    let col = "#141826", a = 0;
    for (const k of S.tint) {
      if (t < k.t) break;
      const u = ease.sine(clamp((t - k.t) / Math.max(0.01, k.blend)));
      a = lerp(a, k.a, u); col = k.color;
    }
    return { color: col, a };
  }

  /* ------------------------------ subtítulos ------------------------------ */
  function captionChunks(words, maxWords = 5) {
    const out = []; let cur = null;
    for (const w of words) {
      if (!cur || cur.words.length >= maxWords || w.start - cur.words[cur.words.length - 1].end > 0.6) { cur = { t0: w.start, t1: w.end + 0.35, words: [] }; out.push(cur); }
      cur.words.push(w); cur.t1 = w.end + 0.35;
    }
    for (let i = 0; i + 1 < out.length; i++) out[i].t1 = Math.min(out[i].t1, out[i + 1].t0);
    return out;
  }
  function lum(hex) { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 1; const n = parseInt(m[1], 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }

  A.compile = compile;
})();
