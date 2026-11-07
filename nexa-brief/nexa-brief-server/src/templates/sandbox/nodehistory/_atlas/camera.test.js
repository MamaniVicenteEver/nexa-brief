import test from "node:test"; import assert from "node:assert/strict";
import { createCamera, mercY, invMercY, spanToZoom, zoomToSpan } from "./camera.js";

const K = [
  { t: 0, center: [2, 48], zoom: 3.5, pitch: 60, bearing: 0 },
  { t: 1, center: [-98, 31], zoom: 4.2, pitch: 55, bearing: 10, dur: 2.0, drift: { z: 0.02 } },
  { t: 6, center: [-52, -3], zoom: 4, pitch: 68, bearing: -20, dur: 3.5 },
  { t: 9.5, center: [40, 52], zoom: 4, pitch: 60, bearing: 350, dur: 2.5 },
];
const cam = createCamera(K);
const D = (t, e = 1e-4) => ["x", "y", "z", "p", "b"].map(c => (cam.raw(t + e)[c] - cam.raw(t - e)[c]) / (2 * e));

test("mercator ida y vuelta", () => { assert.ok(Math.abs(invMercY(mercY(40)) - 40) < 1e-9); assert.ok(Math.abs(zoomToSpan(spanToZoom(30)) - 30) < 1e-9); });
test("posición exacta en las keys de llegada (t+dur)", () => {
  const p = cam.at(3.0); assert.ok(Math.abs(p.lon - -98) < 1e-6 && Math.abs(p.lat - 31) < 1e-6);
});
test("determinista fuera de orden", () => {
  const ts = [7.1, 0.2, 3.3, 11, 2.2, 7.1, 0]; const a = ts.map(t => JSON.stringify(cam.at(t)));
  const b = [...ts].reverse().map(t => JSON.stringify(cam.at(t))).reverse(); assert.deepEqual(a, b);
  assert.deepEqual(createCamera(K).at(5.5), cam.at(5.5));
});
test("continuidad C0 y C1 en cada salida/llegada de vuelo", () => {
  for (const t of [1, 3, 6, 9.5, 9.5 + 2.5, 6 + 3.5]) {
    const a = cam.raw(t - 1e-6), b = cam.raw(t + 1e-6);
    for (const c of ["x", "y", "z", "p", "b"]) assert.ok(Math.abs(a[c] - b[c]) < 1e-3, `C0 ${c}@${t}`);
    const da = D(t - 1e-3), db = D(t + 1e-3);
    da.forEach((v, i) => assert.ok(Math.abs(v - db[i]) < 0.35 + 0.05 * Math.abs(v), `C1 canal ${i}@${t}: ${v} vs ${db[i]}`));
  }
});
test("sin saltos: paso máximo por fotograma acotado", () => {
  let prev = cam.raw(0);
  for (let t = 1 / 30; t < 14; t += 1 / 30) { const c = cam.raw(t); assert.ok(Math.abs(c.x - prev.x) < 8 && Math.abs(c.z - prev.z) < 0.25 && Math.abs(c.b - prev.b) < 3, `salto @${t.toFixed(2)}`); prev = c; }
});
test("interrumpir un vuelo conserva velocidad", () => {
  const c2 = createCamera([{ t: 0, center: [0, 0], zoom: 4 }, { t: 1, center: [80, 0], zoom: 4, dur: 3 }, { t: 2, center: [-60, 20], zoom: 5, dur: 3 }]);
  const v = e => c2.raw(2 + e).x - c2.raw(2 - e).x; assert.ok(Math.abs(c2.velocity(2 - 1e-6).x - c2.velocity(2 + 1e-6).x) < 0.5);
  assert.ok(Math.abs(v(1e-3)) < 20);
});
test("rumbo y longitud toman el camino corto", () => {
  const c3 = createCamera([{ t: 0, center: [170, 0], zoom: 3, bearing: 350 }, { t: 0, center: [170, 0], zoom: 3, bearing: 350 }, { t: 1, center: [-170, 0], zoom: 3, bearing: 10, dur: 2 }]);
  const m = c3.at(3); assert.ok(Math.abs(m.lon - -170) < 1e-6 || Math.abs(m.lon - 190) < 1e-6);
  let maxLon = 0, maxB = 0; for (let t = 1; t <= 3; t += 0.05) { const r = c3.raw(t); maxLon = Math.max(maxLon, Math.abs(r.x - 170)); maxB = Math.max(maxB, Math.abs(r.b - 350)); }
  assert.ok(maxLon < 30 && maxB < 40, `rodeo largo: ${maxLon} ${maxB}`);
});
test("sin rebote en vuelo simple desde reposo", () => {
  const c4 = createCamera([{ t: 0, center: [0, 0], zoom: 4 }, { t: 1, center: [50, 0], zoom: 4, dur: 2 }]);
  let prev = -1; for (let t = 1; t <= 3; t += 0.01) { const x = c4.raw(t).x; assert.ok(x >= prev - 1e-9 && x <= 50 + 1e-6); prev = x; }
});
test("la deriva se acota y nunca congela del todo", () => {
  const x = [4, 8, 12, 40].map(t => cam.raw(t).z); assert.ok(x[0] !== x[1]); assert.ok(Math.abs(x[3] - x[2]) < 0.4);
});

test('lift constante, límites y compatibilidad sin lift', () => {
  const key = {t:0, center:[0,0], zoom:1};
  assert.equal(createCamera([key]).at(100).lift, 0);
  assert.equal(createCamera([{...key, lift:0.3}]).at(100).lift, 0.3);
  assert.equal(createCamera([{...key, lift:-1}]).at(0).lift, 0);
  assert.equal(createCamera([{...key, lift:2}]).at(0).lift, 0.9);
  const explicit = createCamera(K.map(k => ({...k, lift:0})));
  for (const t of [0, 1.5, 3, 7, 12]) assert.deepEqual(cam.at(t), explicit.at(t));
});
test('lift interpola suavemente sin overshoot y mantiene velocidad al encadenar', () => {
  const c = createCamera([{t:0,center:[0,0],zoom:1}, {t:1,center:[0,0],zoom:1,lift:0.3,dur:2,through:true}, {t:3,center:[0,0],zoom:1,lift:0.6,dur:2}]);
  let prev = 0;
  for (let t=1; t<=5; t+=0.005) { const v=c.at(t).lift; assert.ok(v>=prev-1e-10 && v<=0.6+1e-10); if(t<=3) assert.ok(v<=0.3+1e-10); prev=v; }
  assert.ok(Math.abs(c.at(2).lift-0.15)<0.05);
  for(const t of [1,3,5]) assert.ok(Math.abs(c.velocity(t-1e-6).lift-c.velocity(t+1e-6).lift)<1e-5);
});
