/* NodeAction · cámara: dron con estabilizador (módulo independiente).
 *
 * Cómo funciona:
 *   1. Cada key de scene.camera.keys define un OBJETIVO: { x, y, z, zoom, pitch } + modos de encuadre
 *      (follow / focus / frame). Los modos son funciones registradas en A.camera.targets: para agregar
 *      uno nuevo (p. ej. "orbit" o "reveal"), se registra acá y se usa en la key con su nombre.
 *   2. Estabilizador: un filtro de 1er orden + resorte críticamente amortiguado persiguen el objetivo.
 *      Se simula UNA vez a 120 Hz desde t = 0 (A.camera.simulate) y A.camera.at(t) interpola: sin
 *      escalones ni tirones aunque el objetivo cambie de golpe, y el mismo cuadro en cualquier orden.
 *      key.smooth = segundos de respuesta (1,5–2,5 normal · 4–7 vuelo lento de dron) · key.cut = corte seco.
 *   3. Efectos sobre la cámara estabilizada (A.camera.effects): flotación de dron y ondulación de
 *      explosiones grandes. Se pueden apagar o agregar otros sin tocar el estabilizador.
 *   4. A.project: proyección perspectiva con inclinación (pitch > 0 mira hacia abajo) y giro
 *      (yaw: 0 = mira hacia el fondo +z, 180 = mira hacia la cámara de siempre, o sea "de frente").
 *   5. key.orbit: el dron gira ALREDEDOR de un punto (o de un personaje) a una distancia fija: al
 *      cambiar el yaw entre keys, recorre un arco (no atraviesa la escena en línea recta).
 *
 * Estudio de por qué es así: docs/investigaciones/nodeaction-escenas-de-accion-2026-10.md §8.
 * Verificación: tools/camcheck.py (|a| máx < 8 u/s², jerk p99 < 40).
 */
(function () {
  "use strict";
  const A = window.Action;
  const { clamp, lerp } = A;
  const RAD = Math.PI / 180;
  const CAM = (A.camera = {});

  /* ------------------------------ modos de encuadre ------------------------------
     Cada modo recibe (S, key, t, c) con c = [x, y, z, zoom, pitch] ya armado desde la key y lo modifica. */
  CAM.targets = {
    /* órbita: key.orbit = id de personaje o [x, z]; radius (u); yaw de la key = ángulo alrededor.
       Usa el yaw YA suavizado (cur[5]) para ubicar la cámara sobre el círculo → el giro es un arco. */
    orbit(S, key, t, c, cur) {
      let cx, cz;
      if (Array.isArray(key.orbit)) [cx, cz] = key.orbit;
      else { const a = S.actors.get(key.orbit); if (!a) return; const p = S.posAt(a, t); cx = p.x + (key.dx ?? 0); cz = p.z + (key.dz ?? 0); }
      const yaw = cur ? cur[5] : c[5], R = key.radius ?? 5;
      c[0] = cx - R * Math.sin(yaw); c[2] = cz - R * Math.cos(yaw);
    },
    /* seguir a un personaje: key.follow = id, followX / followZ (0..1), dx, dz, focus (0..1) */
    follow(S, key, t, c) {
      const a = S.actors.get(key.follow); if (!a) return;
      const f = key.focus ? focusPoint(S, a, t, key.focus) : (p => [p.x, p.z])(S.posAt(a, t));
      c[0] = lerp(c[0], f[0] + (key.dx ?? 0), key.followX ?? 0.65);
      if (key.followZ) c[2] = lerp(c[2], f[1] - (key.dz ?? 6), key.followZ);
    },
    /* encuadrar un grupo: key.frame = "all" | "alive" | "team:<id>" | [ids], frameX / frameZ */
    frame(S, key, t, c) {
      const g = groupCenter(S, key.frame, t); if (!g) return;
      c[0] = lerp(c[0], g[0] + (key.dx ?? 0), key.frameX ?? 1);
      if (key.frameZ) c[2] = lerp(c[2], g[1] - (key.dz ?? 8), key.frameZ);
    },
  };
  /* punto de acción: entre el personaje y su próximo blanco (el resorte suaviza el cambio de blanco) */
  function focusPoint(S, a, t, w) {
    const p = S.posAt(a, t);
    const sh = S.shots.find(s => s.from === a.id && s.t0 + 0.45 >= t && s.t0 - t < 1.6 && s.target != null);
    if (!sh) return [p.x, p.z];
    const q = S.posAt(S.actors.get(sh.target), Math.min(t, sh.t1 + 0.4));
    return [lerp(p.x, q.x, w), lerp(p.z, q.z, w)];
  }
  /* centro de un grupo (los caídos pesan menos, el héroe el doble) */
  function groupCenter(S, sel, t) {
    let list = [...S.actors.values()];
    if (Array.isArray(sel)) list = list.filter(a => sel.includes(a.id));
    else if (typeof sel === "string" && sel.startsWith("team:")) list = list.filter(a => a.team === sel.slice(5));
    let x = 0, z = 0, wsum = 0;
    for (const a of list) {
      const dead = a.death && t > a.death.t;
      if (sel === "alive" && dead) continue;
      const w = (dead ? 0.35 : 1) * (a.hero ? 2 : 1);
      const p = S.posAt(a, t); x += p.x * w; z += p.z * w; wsum += w;
    }
    return wsum ? [x / wsum, z / wsum] : null;
  }
  CAM.focusPoint = focusPoint; CAM.groupCenter = groupCenter;

  /* objetivo de una key en t */
  CAM.target = function (S, key, t, cur) {
    /* key.portrait = { … } pisa campos de la key solo en vertical (9:16): más alto, más abierto… */
    if (key.portrait && S.view && S.view.H > S.view.W) key = { ...key, ...key.portrait };
    const c = [key.x ?? 0, key.y ?? 1.35, key.z ?? 1, key.zoom ?? 1, (key.pitch ?? 0) * RAD, (key.yaw ?? 0) * RAD];
    for (const [name, fn] of Object.entries(CAM.targets)) if (key[name] != null) fn(S, key, t, c, cur);
    return c;
  };

  /* ------------------------------ estabilizador ------------------------------ */
  CAM.simulate = function (S) {
    const K = S.camKeys, G = S.scene.camera || {}, dt = 1 / 120;
    const D = 6, n = Math.ceil((S.total + 1) / dt) + 2, out = new Float32Array(n * D);
    let c = null, f = null, v = new Array(D).fill(0), ki = 0;
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      while (ki + 1 < K.length && K[ki + 1].t <= t) { ki++; if (K[ki].cut) c = null; }
      const key = K.length ? K[t < K[0].t ? 0 : ki] : {};
      const T = CAM.target(S, key, t, c);
      if (!c) { c = T.slice(); f = T.slice(); v = new Array(D).fill(0); }
      const sm = Math.max(0.15, key.smooth ?? key.blend ?? G.smooth ?? 1.4);
      /* el yaw se suaviza primero: la órbita usa el yaw suavizado para ubicar x/z; en órbita, x/z
         siguen el círculo de cerca (respuesta 4× más rápida) para que la cámara mire siempre al centro */
      for (const k of [5, 0, 1, 2, 3, 4]) {
        /* rampa (sin escalón): con el mismo centro entra en 1 s; con centro nuevo, cuando el vuelo llegó */
        const prev = K[(t < K[0]?.t ? 0 : ki) - 1];
        const sameCenter = prev && JSON.stringify(prev.orbit) === JSON.stringify(key.orbit);
        const fast = key.orbit != null && (k === 0 || k === 2) ? A.smooth(key.t ?? 0, (key.t ?? 0) + (sameCenter ? 1 : sm), t) : 0;
        const smk = sm * lerp(1, 0.25, fast);
        const w = 4.7 / smk, a = Math.min(1, dt / (smk * 0.3));
        f[k] += (T[k] - f[k]) * a;
        v[k] += (w * w * (f[k] - c[k]) - 2 * w * v[k]) * dt;
        c[k] += v[k] * dt;
        out[i * D + k] = c[k];
        if (k === 5 && key.orbit != null) { const T2 = CAM.target(S, key, t, c); T[0] = T2[0]; T[2] = T2[2]; }
      }
    }
    S.camPath = out; S.camDt = dt; S.camN = n; S.camD = D;
  };

  /* ------------------------------ efectos (sobre la cámara ya estabilizada) ------------------------------ */
  CAM.effects = {
    /* flotación de dron, muy lenta (camera.drift, 1) */
    drift(S, c, t) {
      const d = S.scene.camera?.drift ?? 1; if (!d) return;
      c.x += d * (0.03 * Math.sin(t * 0.31) + 0.012 * Math.sin(t * 0.83 + 2));
      c.y += d * 0.02 * Math.sin(t * 0.27 + 1);
      c.pitch += d * 0.004 * Math.sin(t * 0.4);
    },
    /* solo explosiones grandes (size ≥ 2): ondulación lenta que crece y se apaga suave (camera.rumble, 1) */
    rumble(S, c, t) {
      const r = S.scene.camera?.rumble ?? 1; if (!r) return;
      for (const b of S.blasts || []) {
        const dt = t - b.t;
        if (b.size < 2 || dt < 0 || dt > 2.4) continue;
        const env = Math.sin((Math.PI * Math.min(1, dt / 0.35)) / 2) ** 2 * Math.exp(-dt / 0.8);
        const k = (r * 0.035 * b.size * env) / Math.max(1, Math.hypot(b.at[0] - c.x, b.at[1] - c.z) / 8);
        c.y += k * Math.sin(2 * Math.PI * 1.6 * dt); c.x += k * 0.5 * Math.sin(2 * Math.PI * 1.1 * dt + 1);
      }
    },
  };

  /* cámara en t: { x, y, z, zoom, pitch, label } */
  CAM.at = function (S, t) {
    if (!S.camPath) CAM.simulate(S);
    const u = clamp(t / S.camDt, 0, S.camN - 1.001), i = Math.floor(u), fr = u - i, P = S.camPath, D = S.camD;
    const g = k => lerp(P[i * D + k], P[(i + 1) * D + k], fr);
    const c = { x: g(0), y: g(1), z: g(2), zoom: g(3), pitch: g(4), yaw: g(5) };
    c.label = [...S.camKeys].reverse().find(k => k.t <= t && k.label != null)?.label ?? "";
    for (const fx of Object.values(CAM.effects)) fx(S, c, t);
    /* ejes de la cámara en el suelo: adelante (fx, fz) y derecha (rx, rz) */
    c.fwd = [Math.sin(c.yaw), Math.cos(c.yaw)]; c.right = [Math.cos(c.yaw), -Math.sin(c.yaw)];
    return c;
  };

  /* proyección perspectiva con inclinación: pitch > 0 mira hacia abajo. Punto principal en H·hz */
  A.project = function (cam, view, X, Y, Z) {
    const p = cam.pitch || 0, cp = Math.cos(p), sp = Math.sin(p), yw = cam.yaw || 0, cy = Math.cos(yw), sy = Math.sin(yw);
    const ox = X - cam.x, oz = Z - cam.z, dy = Y - cam.y;
    const dx = ox * cy - oz * sy, dz = ox * sy + oz * cy;   /* al marco de la cámara (giro yaw) */
    const Dr = dz * cp - dy * sp, D = Math.max(0.25, Dr), V = dy * cp + dz * sp;
    const F = cam.zoom * Math.min(view.W, view.H * 1.3);
    /* Dr = profundidad real (≤ 0 = detrás de la cámara: no se dibuja) */
    return { x: view.W / 2 + (F * dx) / D, y: view.H * view.hz - (F * V) / D, s: F / D, D, Dr };
  };
})();
