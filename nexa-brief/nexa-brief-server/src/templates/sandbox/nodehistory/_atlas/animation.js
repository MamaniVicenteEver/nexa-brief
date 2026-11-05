// Shared, seekable entrance/exit transforms. No previous-frame state.
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => (x = clamp(x), x * x * (3 - 2 * x));
function pose(style, k, distance) {
  return { alpha: k, scale: style === 'scale' ? .65 + .35 * k : 1,
    x: style === 'slide-left' ? -distance * (1-k) : style === 'slide-right' ? distance * (1-k) : 0,
    y: style === 'rise' ? distance * (1-k) : 0 };
}
export function animationAt(layer, t, start, out, unit = 1) {
  const result = { alpha: 1, scale: 1, x: 0, y: 0 };
  for (const [spec, k] of [[layer.enter, layer.enter ? smooth((t-start)/Math.max(.001,layer.enter.dur ?? .6)) : 1],
    [layer.exit, layer.exit && Number.isFinite(out) ? 1-smooth((t-out)/Math.max(.001,layer.exit.dur ?? .6)) : 1]]) {
    if (!spec) continue;
    const p = pose(spec.style || 'fade', k, (spec.distance ?? 65)*unit);
    result.alpha *= p.alpha; result.scale *= p.scale; result.x += p.x; result.y += p.y;
  }
  return result;
}
