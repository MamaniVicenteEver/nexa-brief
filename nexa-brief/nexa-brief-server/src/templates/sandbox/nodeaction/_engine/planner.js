/* NodeAction · director: convierte un "plan" de alto nivel en acciones concretas.
 *
 * scene.plan = { mode: "skirmish", hero: "<id>", seed, start, heroMoves, gap, foeFire, allyFire, victory }
 *   skirmish  dos (o más) bandos se disparan; el héroe elimina a todos los rivales con movimientos
 *             encadenados (correr, saltar disparando, rodilla en tierra con doble disparo, de pie);
 *             los rivales disparan y fallan, se reacomodan; los aliados del héroe caen durante la
 *             pelea; al final queda UNO (el héroe) y hace su pose de victoria.
 *
 * Determinista: misma semilla → misma coreografía. Las acciones generadas son del mismo formato
 * que las manuales (se pueden copiar a "timeline" y retocar a mano). Las manuales se suman.
 */
(function () {
  "use strict";
  const A = window.Action;
  const { clamp, lerp, rng } = A;

  const MODES = {};
  A.plan = function (scene, actors, ctx) {
    const P = scene.plan || {};
    const f = MODES[P.mode || "skirmish"];
    if (!f) throw new Error(`plan.mode desconocido: ${P.mode}`);
    return f(scene, P, actors, ctx);
  };
  A.planModes = MODES;

  MODES.skirmish = function (scene, P, actors, ctx) {
    const R = rng(P.seed ?? scene.seed ?? 1);
    const hero = actors.get(P.hero);
    if (!hero) throw new Error(`plan.hero "${P.hero}" no está en cast`);
    const arena = { x: scene.arena?.x || [-4, 6], z: scene.arena?.z || [6, 14] };
    const all = [...actors.values()].filter(a => a.weapon);
    const foes = all.filter(a => a.team !== hero.team);
    const allies = all.filter(a => a.team === hero.team && a !== hero);
    const ev = [];
    const T = spec => (ctx?.anchor ? ctx.anchor(spec) : typeof spec === "number" ? spec : null);
    const t0 = (P.start != null ? T(P.start) : null) ?? 1.0, FL = 0.32;
    /* kills: momentos (segundos o "@palabra") en que debe caer cada rival del héroe, en orden */
    const killAt = (P.kills || []).map(k => T(k));
    const gapR = () => lerp((P.gap || [0.5, 1.0])[0], (P.gap || [0.5, 1.0])[1], R());
    const pos = new Map(all.map(a => [a.id, [...a.pos0]]));
    const dead = new Map();
    const d2 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    const inArena = p => [clamp(p[0], arena.x[0], arena.x[1]), clamp(p[1], arena.z[0], arena.z[1])];
    const aliveFoes = () => foes.filter(e => !dead.has(e.id));
    const shoot = (a, b, ts, hit = true, impactAt = null) => { ev.push({ t: ts, actor: a.id, do: "shoot", target: b.id, hit, ...(impactAt != null ? { impactAt } : {}) }); if (hit) dead.set(b.id, impactAt ?? ts + FL); };

    /* un lugar nuevo para el héroe: avanza hacia los rivales, a distancia de combate (~2,4 u)
       del más cercano, sin encimarse con nadie y dentro de la arena */
    const spot = (from, dmin, dmax) => {
      const live = aliveFoes();
      const cx = live.reduce((s, e) => s + pos.get(e.id)[0], 0) / Math.max(1, live.length);
      const cz = live.reduce((s, e) => s + pos.get(e.id)[1], 0) / Math.max(1, live.length);
      const toward = [cx - from[0], cz - from[1]], tl = Math.hypot(...toward) || 1;
      let best = null, bs = -1e9;
      for (let i = 0; i < 16; i++) {
        const an = R() * Math.PI * 2, d = lerp(dmin, dmax, R());
        const p = inArena([from[0] + Math.cos(an) * d, from[1] + Math.sin(an) * d * 0.75]);
        const near = Math.min(9, ...live.map(e => d2(p, pos.get(e.id))));
        const crowd = Math.min(9, ...all.filter(b => b !== hero && !dead.has(b.id)).map(b => d2(p, pos.get(b.id))));
        const adv = ((p[0] - from[0]) * toward[0] + (p[1] - from[1]) * toward[1]) / tl;
        const s = -Math.abs(near - (P.range ?? 2.4)) + adv * 0.45 - (crowd < 1.0 ? 3 : 0) - Math.abs(p[1] - from[1]) * 0.15 + R() * 0.3;
        if (s > bs) { bs = s; best = p; }
      }
      return best;
    };

    /* apertura: todos se apuntan (enfrentamiento) */
    for (const a of all) {
      const tg = (a === hero || a.team === hero.team ? foes : [hero, ...allies]).slice().sort((p, q) => d2(pos.get(a.id), pos.get(p.id)) - d2(pos.get(a.id), pos.get(q.id)))[0];
      if (tg) ev.push({ t: 0.15 + R() * 0.25, actor: a.id, do: "aim", target: tg.id, dur: t0 + 0.1 });
    }

    /* el héroe elimina a los rivales uno por uno */
    const moves = P.heroMoves || ["run", "jump", "kneel", "run", "stand", "jump", "kneel"];
    let t = t0, k = 0;
    while (aliveFoes().length) {
      const hp = pos.get(hero.id);
      const left = aliveFoes().sort((p, q) => d2(hp, pos.get(p.id)) - d2(hp, pos.get(q.id)));
      /* plan.order fija a quién elimina en cada turno (p. ej. el orden en que los nombra la voz) */
      const forced = (P.order || []).map(id => left.find(e => e.id === id)).find(Boolean);
      const tgt = forced || left[R() < 0.7 || left.length === 1 ? 0 : 1];
      let mv = moves[k % moves.length];
      /* sincronía con la narración: el impacto tiene que caer en killAt[k] */
      const want = killAt[k] != null ? killAt[k] - FL : null;
      k++;
      if (want != null) {
        const lead = { run: 1.0, jump: 0.5, kneel: 0.42, stand: 0.25 };
        if (want - (lead[mv] ?? 0.25) < t) mv = want - 0.42 >= t ? "kneel" : "stand";
        if (mv === "run") {
          const dest = spot(hp, 1.4, 2.6), dur = d2(hp, dest) / A.GAITS.run.speed + 0.12;
          if (want - dur >= t) { t = want - dur; ev.push({ t, actor: hero.id, do: "run", to: dest }); pos.set(hero.id, dest); shoot(hero, tgt, want, true, want + FL); t = want + 0.35; continue; }
          mv = "kneel";
        }
        if (mv === "jump") { const dest = spot(hp, 1.0, 2.0); ev.push({ t: want - 0.5, actor: hero.id, do: "jump", to: dest, height: 0.75, dur: 0.92 }); shoot(hero, tgt, want, true, want + FL); pos.set(hero.id, dest); t = want + 0.45; continue; }
        if (mv === "kneel") { ev.push({ t: want - 0.42, actor: hero.id, do: "kneel", dur: 1.2 }); shoot(hero, tgt, want, true, want + FL); t = want + 0.8; continue; }
        shoot(hero, tgt, Math.max(t, want), true, Math.max(t, want) + FL); t = Math.max(t, want) + 0.35; continue;
      }
      if (mv === "run") {
        const dest = spot(hp, 1.6, 3.0);
        ev.push({ t, actor: hero.id, do: "run", to: dest });
        t += d2(hp, dest) / A.GAITS.run.speed + 0.12; pos.set(hero.id, dest);
        shoot(hero, tgt, t); t += gapR();
      } else if (mv === "jump") {
        const dest = spot(hp, 1.0, 2.0);
        ev.push({ t, actor: hero.id, do: "jump", to: dest, height: 0.65 + R() * 0.25, dur: 0.92, style: P.flips && R() < 0.35 ? "flip" : "tuck" });
        shoot(hero, tgt, t + 0.5); pos.set(hero.id, dest); t += 0.92 + gapR() * 0.7;
      } else if (mv === "kneel") {
        ev.push({ t, actor: hero.id, do: "kneel", dur: 1.6 });
        shoot(hero, tgt, t + 0.42);
        const second = left.find(e => e !== tgt);
        if (second && R() < 0.65) shoot(hero, second, t + 1.02);
        t += 1.6 + gapR() * 0.5;
      } else {
        shoot(hero, tgt, t + 0.25); t += 0.25 + gapR();
      }
    }
    const lastFoe = Math.max(...[...dead.values()]);

    /* los aliados caen durante la pelea (al final queda solo el héroe) */
    const allyAt = (P.allyKills || []).map(k => T(k));
    allies.forEach((al, i) => {
      const td = allyAt[i] ?? lerp(t0 + 1.4, lastFoe - 0.6, (i + 1) / (allies.length + 1)) + (R() - 0.5) * 0.4;
      const killer = foes.filter(e => (dead.get(e.id) ?? 1e9) > td - FL + 0.1).sort((p, q) => d2(pos.get(al.id), pos.get(p.id)) - d2(pos.get(al.id), pos.get(q.id)))[0];
      if (killer) shoot(killer, al, td - FL, true, allyAt[i] != null ? td : null);
    });

    /* fuego cruzado: rivales y aliados disparan y fallan; los rivales se reacomodan */
    const fire = (a, targets, every, tStop) => {
      let tt = t0 + R() * 0.7;
      const last = Math.min(tStop, lastFoe);
      for (;;) {
        tt += lerp(every[0], every[1], R());
        if (tt > last - 0.15) break;
        const live = targets.filter(b => (dead.get(b.id) ?? 1e9) > tt + FL);
        if (!live.length) break;
        const b = live[Math.floor(R() * live.length)];
        ev.push({ t: tt, actor: a.id, do: "shoot", target: b.id, hit: false });
        if (a.team !== hero.team && R() < (P.foeMove ?? 0.35)) {
          const p = pos.get(a.id), q = inArena([p[0] + (R() - 0.5) * 2.0, p[1] + (R() - 0.5) * 1.4]);
          ev.push({ t: tt + 0.35, actor: a.id, do: R() < 0.5 ? "strafe" : "run", to: q });
          pos.set(a.id, q);
          tt += 0.35 + d2(p, q) / 2.5;
        }
      }
    };
    for (const e of foes) fire(e, [hero, ...allies], P.foeFire || [1.0, 2.2], dead.get(e.id) ?? 1e9);
    for (const al of allies) fire(al, foes, P.allyFire || [1.1, 2.0], dead.get(al.id) ?? 1e9);

    /* victoria */
    const vAt = P.victoryAt != null ? T(P.victoryAt) : null;
    ev.push({ t: Math.max(lastFoe + 0.45, vAt ?? lastFoe + 0.55), actor: hero.id, do: "pose", name: P.victoryPose || "victory", dur: P.victory ?? 3 });
    return ev;
  };

  /* advance — una línea ataca caminando hacia otra que espera oculta (asalto de trincheras, carga).
     P = { attackers, defenders, seed, goalZ?, defendersUp ("@palabra"), fireAt?, fireUntil?,
           waves: [{ wave, at, stagger }],            ← cast[].wave = número de oleada (1 por defecto)
           casualties: [{ at, over, n, wave? }],      ← n caídos repartidos en `over` segundos desde `at`
           survivors: [ids], cover: [{ actor, at, to: [x,z], pose: "prone" }],
           burst (ráfaga de la ametralladora, 4), every ([0.7, 1.5]) }
     Los atacantes esperan agachados en su trinchera, salen (pequeño salto) y marchan; los oficiales
     (cast[].officer = true) tocan el silbato al empezar su oleada. */
  MODES.advance = function (scene, P, actors, ctx) {
    const R = rng(P.seed ?? scene.seed ?? 3);
    const T = spec => (ctx?.anchor ? ctx.anchor(spec) : typeof spec === "number" ? spec : null);
    const all = [...actors.values()];
    const att = all.filter(a => a.team === P.attackers), def = all.filter(a => a.team === P.defenders);
    if (!att.length || !def.length) throw new Error("advance: faltan atacantes o defensores (attackers/defenders = id de equipo)");
    const keep = new Set(P.survivors || []);
    const goalZ = P.goalZ ?? Math.min(...def.map(d => d.pos0[1])) - 1.4;
    const ev = [], dead = new Map(), start = new Map();
    const waveOf = a => a.def.wave ?? 1;

    /* defensores: ocultos (en sus refugios) hasta que suben */
    const up = P.defendersUp != null ? T(P.defendersUp) : 0;
    for (const d of def) if (up > 0) { ev.push({ t: 0, actor: d.id, do: "hide" }); ev.push({ t: up + R() * 1.4, actor: d.id, do: "show" }); }

    /* oleadas: agachados → silbato → salen → marchan */
    for (const w of P.waves || [{ wave: 1, at: 1 }]) {
      const tw = T(w.at);
      if (tw == null) continue;
      const members = att.filter(a => waveOf(a) === w.wave);
      for (const a of members) {
        if (a.def.officer) ev.push({ t: tw - 0.35, actor: a.id, do: "whistle", dur: 0.9 });
        const t0 = tw + (a.def.officer ? 0.6 : 0.25) + (w.stagger ?? 1.8) * R();
        ev.push({ t: -1, actor: a.id, do: "pose", name: "crouch", dur: Math.max(0.1, t0 + 0.85) });
        ev.push({ t: t0, actor: a.id, do: "jump", by: [0, 0.55], height: 0.3, dur: 0.6, style: "hop" });
        /* avance con desorden: 3–4 tramos con desvío lateral y ritmo propio; en las pausas se
           detienen (a veces rodilla en tierra) y disparan a un defensor (izquierda o derecha) */
        const goal = [a.pos0[0] + (R() - 0.5) * 0.8, goalZ - R() * 1.2];
        let cur = [a.pos0[0], a.pos0[1] + 0.55], tt = t0 + 0.62;
        const nLegs = (P.legs ?? 4) + Math.floor(R() * 2), wander = P.wander ?? 0.9;
        start.set(a.id, tt);
        for (let i = 1; i <= nLegs && tt < (P.marchUntil ?? 1e9); i++) {
          const u = i / nLegs;
          const to = [lerp(a.pos0[0], goal[0], u) + (i < nLegs ? (R() - 0.5) * wander : 0), lerp(cur[1], goal[1], 1 / (nLegs - i + 1))];
          const sp = lerp((P.speed || [0.42, 0.68])[0], (P.speed || [0.42, 0.68])[1], R()), d = Math.hypot(to[0] - cur[0], to[1] - cur[1]);
          ev.push({ t: tt, actor: a.id, do: "march", to, speed: sp });
          tt += d / sp; cur = to;
          if (i < nLegs && R() < (P.fireChance ?? 0.6)) {
            /* blanco hacia un costado (el disparo de perfil se lee; uno justo delante apuntaría al cielo) */
            const side = def.filter(d => Math.abs(d.pos0[0] - cur[0]) > 2.2);
            const pool = side.length ? side : def, tgt = pool[Math.floor(R() * pool.length)];
            const shots = (P.shotsPerStop || [2, 3])[0] + Math.floor(R() * ((P.shotsPerStop || [2, 3])[1] - (P.shotsPerStop || [2, 3])[0] + 1));
            const pause = 0.5 + shots * lerp(0.42, 0.6, R());
            if (R() < (P.kneelChance ?? 0.3)) ev.push({ t: tt, actor: a.id, do: "kneel", dur: pause });
            for (let k = 0; k < shots; k++) ev.push({ t: tt + 0.45 + k * (pause - 0.6) / Math.max(1, shots - 1), actor: a.id, do: "shoot", target: tgt.id, hit: false, ready: k ? 0.15 : 0.4 });
            tt += pause;
          }
        }
      }
    }

    /* bajas por tandas (el impacto cae en el instante pedido) */
    const nearestDef = (a, t) => def.filter(d => t > up + 1.4).sort((p, q) => Math.abs(p.pos0[0] - a.pos0[0]) - Math.abs(q.pos0[0] - a.pos0[0]))[0] || def[0];
    for (const c of P.casualties || []) {
      const tc = T(c.at); if (tc == null) continue;
      const over = c.over ?? 6;
      const pool = att.filter(a => !dead.has(a.id) && !keep.has(a.id) && (c.wave == null || waveOf(a) === c.wave) && (start.get(a.id) ?? 1e9) < tc + over)
        .map(a => ({ a, k: R() })).sort((p, q) => p.k - q.k).map(o => o.a);
      const picked = pool.slice(0, c.n ?? pool.length);
      picked.forEach((a, i) => {
        const ti = Math.max(tc + (over * (i + R() * 0.8)) / Math.max(1, picked.length), (start.get(a.id) ?? 0) + 0.8);
        const sh = nearestDef(a, ti);
        ev.push({ t: ti - 0.3, actor: sh.id, do: "shoot", target: a.id, hit: true, impactAt: ti, ready: 0.18 });
        dead.set(a.id, ti);
      });
    }

    /* los que sobreviven: corren a un cráter y se quedan cuerpo a tierra */
    for (const cv of P.cover || []) {
      const t = T(cv.at); if (t == null) continue;
      const a = actors.get(cv.actor); if (!a) continue;
      ev.push({ t, actor: a.id, do: "run", to: cv.to, speed: cv.speed ?? 2.6 });
      ev.push({ t: t + (cv.dur ?? 1.6), actor: a.id, do: "pose", name: cv.pose || "prone", dur: cv.hold ?? 600 });
    }

    /* fuego de contención: ráfagas que fallan (polvo alrededor de los que avanzan) */
    const fs = P.fireAt != null ? T(P.fireAt) : up + 1.2, fe = P.fireUntil != null ? T(P.fireUntil) : Math.max(...[...dead.values(), fs + 10]) + 2;
    for (const d of def) {
      let tt = fs + R() * 1.2;
      while (tt < fe) {
        const live = att.filter(a => (dead.get(a.id) ?? 1e9) > tt + 0.4 && (start.get(a.id) ?? 1e9) < tt);
        if (!live.length) { tt += 1; continue; }
        const b = live[Math.floor(R() * live.length)], n = d.weapon === "mg" ? P.burst ?? 4 : 1;
        for (let k = 0; k < n; k++) ev.push({ t: tt + k * 0.11, actor: d.id, do: "shoot", target: b.id, hit: false, ready: 0.25 });
        const every = P.every || [0.7, 1.5];
        tt += n * 0.11 + lerp(every[0], every[1], R()) * (d.weapon === "mg" ? 1 : 1.8);
      }
    }
    return ev;
  };
})();
