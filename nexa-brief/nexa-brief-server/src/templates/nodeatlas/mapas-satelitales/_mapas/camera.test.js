import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("./camera.js", import.meta.url), "utf8");
const scope = { window: {} };
vm.runInNewContext(source, scope);
const create = scope.window.Mapas.camera.create;
const places = { norte: [-20, 10], este: [30, 6], oeste: [-12, -8], centro: [4, 2] };
const geo = {
  place(value) { return Array.isArray(value) ? value : places[value]; },
  merc([lon, lat]) {
    const rad = Math.PI / 180;
    return [lon * rad, -Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * rad) / 2))];
  },
  bounds(values) {
    const pts = [].concat(values).map(value => this.merc(this.place(value)));
    return [[Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1]))], [Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]];
  },
};
const timer = value => value;
const keys = [
  { t: 0, c: [0, 0], span: 40, drift: 0.14, pan: [0.025, -0.01] },
  { t: 3, c: [20, 8], span: 12, dur: 4, drift: 0.1 },
  { t: 4.5, c: [-10, 3], span: 5, dur: 3, ease: "out", drift: 0.12 },
  { t: 6, focus: ["oeste", "centro"], pad: 0.2, dur: 2.2, ease: "linear", drift: 0.08 },
  { t: 10, c: [4, 2], span: 9, dur: 2, ease: "smooth", drift: 0.16 },
];
function cameraFor(sceneKeys = keys) { return create(sceneKeys, geo, timer); }
function screenPose(camera, t, W = 960, H = 540) {
  const p = camera.at(t, W, H);
  return [p.x / p.w, (p.y / p.w) * W / H, Math.log(p.w)];
}
function difference(a, b, dt) { return a.map((value, i) => (b[i] - value) / dt); }
function norm(v) { return Math.hypot(...v); }
function keyBoundaryError(camera, t, W, H, eps = 0.001) {
  const before = screenPose(camera, t - eps, W, H);
  const at = screenPose(camera, t, W, H);
  const after = screenPose(camera, t + eps, W, H);
  const vin = difference(before, at, eps), vout = difference(at, after, eps);
  return { jump: norm(before.map((value, i) => after[i] - value)), velocity: norm(vin.map((value, i) => value - vout[i])) };
}

test("conserva velocidad en saltos, claves próximas y vuelos interrumpidos", () => {
  const camera = cameraFor();
  for (const t of [3, 4.5, 6, 10]) {
    const result = keyBoundaryError(camera, t, 960, 540);
    assert.ok(result.velocity < 0.02, `${t}s: discontinuidad de velocidad ${result.velocity}`);
    assert.ok(result.jump < 0.01, `${t}s: salto de posición ${result.jump}`);
  }
});

test("la pose depende de t y coincide al buscar adelante o atrás", () => {
  const camera = cameraFor();
  const times = [-1, 0, 1.2, 3, 4.5, 6, 8, 10, 11.2, 30];
  const forward = new Map(times.map(t => [t, camera.at(t, 1080, 1920)]));
  for (const t of [...times].reverse()) {
    const actual = camera.at(t, 1080, 1920), expected = forward.get(t);
    assert.deepEqual([actual.x, actual.y, actual.w], [expected.x, expected.y, expected.w]);
  }
});

test("admite formatos vertical y horizontal, y tiempos fuera de los bordes", () => {
  const camera = cameraFor();
  for (const [W, H] of [[1080, 1920], [1920, 1080]]) {
    for (const t of [-5, 0, 3, 4.5, 6, 10, 30]) {
      const p = camera.at(t, W, H);
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.w) && p.w > 0, `${W}x${H} @ ${t}`);
    }
  }
});

test("el drift sigue moviendo la cámara después del último vuelo", () => {
  const camera = cameraFor();
  const start = camera.at(12.1, 960, 540), later = camera.at(20, 960, 540);
  assert.ok(later.w < start.w);
});
