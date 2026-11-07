const canonical = value => JSON.stringify(value, (_, v) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]])) : v);

// The saved union crop comes from the same full-sequence audit as the posters.
// A changed demo or missing cache falls back to the original measurement.
export function cachedPreviewLayout(cache, name, demo) {
  const item = cache?.layouts?.[name];
  if (cache?.version !== 1 || cache.width !== 1080 || cache.height !== 1080 || !item ||
      canonical(item.demo) !== canonical(demo)) return null;
  const b = item.crop;
  if (!Array.isArray(b) || b.length !== 4 || !b.every(Number.isFinite) ||
      b[0] < 0 || b[1] < 0 || b[2] > 1080 || b[3] > 1080 ||
      b[2] <= b[0] || b[3] <= b[1] || !Number.isFinite(item.peakTime) || item.peakTime < 0 ||
      !Number.isFinite(item.peak) || item.peak <= 0) return null;
  return item;
}
