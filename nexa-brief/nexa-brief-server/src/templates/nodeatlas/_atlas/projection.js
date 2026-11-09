import { spanToZoom } from './camera.js';

/** Normaliza la proyección del look al objeto aceptado por MapLibre. */
export function normalizeProjection(value = 'mercator', {width} = {}) {
  let type = value && !Array.isArray(value) && typeof value === 'object' ? value.type : value;
  if (!(typeof type === 'string' && type.length > 0) &&
      !(Array.isArray(type) && type.length > 0 && typeof type[0] === 'string')) {
    throw new TypeError('Atlas: proyección inválida');
  }
  if (Array.isArray(type) && type[0] === 'interpolate' && Array.isArray(type[2]) && type[2].length === 1 && type[2][0] === 'zoom') {
    type = [...type];
    let previous = -Infinity;
    for (let i = 3; i < type.length; i += 2) {
      const stop = type[i];
      if (stop && typeof stop === 'object' && !Array.isArray(stop) && Object.keys(stop).length === 1 && 'span' in stop) {
        if (!Number.isFinite(stop.span) || stop.span <= 0) throw new TypeError('Atlas: span de proyección debe ser un número positivo y finito');
        if (!Number.isFinite(width) || width <= 0) throw new TypeError('Atlas: se requiere un ancho positivo y finito para convertir span de proyección');
        type[i] = spanToZoom(stop.span, width);
      }
      if (!Number.isFinite(type[i])) throw new TypeError('Atlas: etapa de proyección debe ser un zoom numérico o {span: N}');
      if (type[i] <= previous) throw new RangeError('Atlas: las etapas de proyección deben estar en orden estrictamente ascendente de zoom');
      previous = type[i];
    }
  }
  return {type};
}

/** El fondo estrellado corresponde al primer tramo de una expresión de globo. */
export function isGlobeProjection(value) {
  const type = value && !Array.isArray(value) && typeof value === 'object' ? value.type : value;
  if (typeof type === 'string') return type === 'globe';
  const first = type[0] === 'interpolate' ? type[4] : type[0] === 'step' ? type[2] : undefined;
  return first === 'vertical-perspective' || first === 'globe';
}
