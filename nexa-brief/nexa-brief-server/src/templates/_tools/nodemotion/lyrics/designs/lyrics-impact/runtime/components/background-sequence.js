/* Tiempo de cada fondo: compartido por el navegador, HyperFrames y Remotion. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaBackgroundSequence = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const IMAGE_SECONDS = 5;
  function at(items, seconds, firstLyricSeconds) {
    if (!Array.isArray(items) || !items.length) return null;
    const t = Math.max(0, Number(seconds) || 0);
    const cover = items.length > 1 && items[0].type === "image";
    const intro = cover ? Math.max(0, Number(firstLyricSeconds) || 0) : 0;
    if (cover && t < intro) return { item: items[0], index: 0, offset: t, start: 0, duration: intro };
    const begin = cover ? 1 : 0;
    const cycle = items.slice(begin);
    const durations = cycle.map(item => item.type === "video" && Number.isFinite(Number(item.duration)) && Number(item.duration) > 0 ? Number(item.duration) : IMAGE_SECONDS);
    const length = durations.reduce((a, b) => a + b, 0);
    const elapsed = Math.max(0, t - intro);
    const cycleStart = intro + Math.floor(elapsed / length) * length;
    let offset = elapsed % length;
    for (let i = 0; i < cycle.length; i++) {
      if (offset < durations[i] || i === cycle.length - 1) {
        return { item: cycle[i], index: begin + i, offset, start: cycleStart + durations.slice(0, i).reduce((a, b) => a + b, 0), duration: durations[i] };
      }
      offset -= durations[i];
    }
    return null;
  }
  return { at, IMAGE_SECONDS };
});
