// Utilidades genéricas reusadas por varios timelines de composición (no hay
// nada específico de una plantilla puntual acá) — evita duplicar el mismo
// código en neon-timeline.js, lyrics-impact-timeline.js, etc.
const {staticFile} = require('remotion');

// Mismo algoritmo en las 4 plantillas que usan RNG semillado (neon, romantic,
// subject-spotlight, living-landscape) — cualquier cambio acá debe preservar
// exactamente esta secuencia, ya que todo el porting de esas plantillas
// depende de reproducir el mismo stream de números que el HTML original.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// audioSrc/bgSrc son un nombre de archivo (local: staticFile() lo resuelve
// contra el publicDir activo) o ya una URL http(s) (Lambda: URL prefirmada de
// S3, generada por render-lambda.mjs porque el bucket de assets del job no
// vive dentro del publicDir del bundle desplegado) — mismo componente sirve
// ambos casos sin saber en qué motor está corriendo.
function resolveMediaSrc(value) {
  return /^https?:\/\//i.test(value) ? value : staticFile(value);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Búsqueda binaria: último elemento de una lista ordenada por `frame` con
// frame <= el pedido — patrón compartido para "último evento ya disparado".
function findLastIdx(items, frame) {
  let lo = 0;
  let hi = items.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (items[mid].frame <= frame) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

module.exports = {mulberry32, resolveMediaSrc, lerp, findLastIdx};
