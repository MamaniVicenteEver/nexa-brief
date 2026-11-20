import test from 'node:test';
import assert from 'node:assert/strict';
import { createHud } from '../hud.js';

function fonts(width, height) {
  const values = [];
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key === 'measureText') return () => ({ width: 100 });
      if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (key === 'fillText') return text => values.push({ text, font: target.font });
      if (key in target) return target[key];
      return () => {};
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  const scene = { hud: [{ type:'lower-title', t:0, scalePortrait:1.3, scaleLandscape:1.5,
    lines:[{text:'Resumen', size:50}], meta:'FECHA', metaSize:25 }] };
  createHud(scene, { loadImg: () => null }).draw(ctx, 2, { W:width, H:height });
  return values;
}

test('la apertura escala 30 % en vertical y 50 % en horizontal', () => {
  assert.match(fonts(1080, 1920)[0].font, /65px/);
  assert.match(fonts(1920, 1080)[0].font, /75px/);
});
