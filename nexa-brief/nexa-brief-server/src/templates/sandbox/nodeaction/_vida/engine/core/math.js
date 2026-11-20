/** Canvas coordinates: x right, y down. Distances in character heights. */
export const TAU = Math.PI * 2;
export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const lerp = (a, b, t) => t === 0 ? a : t === 1 ? b : a + (b - a) * t;
export const smoothstep = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export const ease = Object.freeze({
  linear: clamp,
  smooth: smoothstep,
  sine: t => (1 - Math.cos(Math.PI * clamp(t))) / 2,
  inOutCubic: t => { t = clamp(t); return t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2; },
  outCubic: t => 1 - (1 - clamp(t)) ** 3,
});
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul = (a, k) => [a[0] * k, a[1] * k];
export const mixPoint = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const rotate = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];

/** Analytic damped spring. No accumulated state: safe to seek backwards. */
export function spring(t, { from = 0, to = 1, velocity = 0, frequency = 3, damping = .65 } = {}) {
  if (t <= 0) return from;
  const w = TAU * Math.max(.001, frequency), z = Math.max(0, damping), x = from - to;
  if (Math.abs(z - 1) < 1e-5) return to + (x + (velocity + w * x) * t) * Math.exp(-w * t);
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return to + Math.exp(-z * w * t) * (x * Math.cos(wd * t) + (velocity + z * w * x) / wd * Math.sin(wd * t));
  }
  const s = Math.sqrt(z * z - 1), r1 = -w * (z - s), r2 = -w * (z + s);
  const a = (velocity - r2 * x) / (r1 - r2);
  return to + a * Math.exp(r1 * t) + (x - a) * Math.exp(r2 * t);
}

/** Steady-state response to a sine driver, including physical phase lag. */
export function springSine(t, { amplitude = 1, frequency = 1, naturalFrequency = 3, damping = .65, phase = 0 } = {}) {
  const q = frequency / Math.max(.001, naturalFrequency);
  const gain = 1 / Math.hypot(1 - q * q, 2 * damping * q);
  const lag = Math.atan2(2 * damping * q, 1 - q * q);
  return amplitude * gain * Math.sin(TAU * frequency * t + phase - lag);
}
