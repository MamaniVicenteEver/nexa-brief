import {readJSON} from './tools/io.js';
const DEFAULT_MANIFEST = new URL('./sprites/sprites.json', import.meta.url);
export const STATE_TINTS = Object.freeze({normal: null, detected: '#e8d179', targeted: '#ea995a', hit: '#e6ac77', burning: '#a45835', wrecked: '#42484a', destroyed: '#42484a', sunk: '#243e47'});
const familyOf = name => /carrier|deck|cubierta/i.test(name) ? 'deck' : /air|jet|bomber|heli|wing|alas/i.test(name) ? 'wings' : 'hull';
const normalized = (name, value) => {
  const r = typeof value === 'string' ? {src:value} : {...value};
  return {...r, family:familyOf(r.family || name), relativeLength:r.relativeLength ?? r.length_relative ?? r.length ?? 1};
};
function canvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  return null;
}
async function imageAt(url) {
  if (typeof Image === 'undefined') throw new Error('No hay decodificador de imágenes; se usa silueta');
  const image = new Image(); image.src = url.href; await image.decode(); return image;
}
function colored(mask, color, opacity = 1, base) {
  const c = canvas(mask.width, mask.height); if (!c) return null;
  const g = c.getContext('2d');
  if (base) g.drawImage(base, 0, 0, c.width, c.height); else g.drawImage(mask, 0, 0);
  g.globalCompositeOperation = 'source-atop'; g.globalAlpha = opacity; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return c;
}
function silhouette(g, family, length, color) {
  const w = length * (family === 'deck' ? .32 : family === 'wings' ? .78 : .23), h = length;
  g.beginPath();
  if (family === 'wings') {
    const p = [[0,-.5],[.055,-.17],[.5,.14],[.5,.21],[.06,.08],[.05,.35],[.2,.44],[.2,.49],[0,.43],[-.2,.49],[-.2,.44],[-.05,.35],[-.06,.08],[-.5,.21],[-.5,.14],[-.055,-.17]];
    p.forEach(([x,y], i) => i ? g.lineTo(x*w,y*h) : g.moveTo(x*w,y*h));
  } else {
    g.moveTo(0,-h*.5); g.bezierCurveTo(w*.55,-h*.36,w*.54,h*.1,w*.4,h*.46);
    g.lineTo(-w*.4,h*.46); g.bezierCurveTo(-w*.54,h*.1,-w*.55,-h*.36,0,-h*.5);
  }
  g.closePath(); g.fillStyle = color; g.fill();
  if (family === 'deck') {
    g.save(); g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = Math.max(.7, length*.009);
    g.beginPath(); g.moveTo(-w*.17,h*.32); g.lineTo(w*.12,-h*.34); g.stroke();
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(w*.22,-h*.05,w*.23,h*.18); g.restore();
  }
}
export function createSprites({manifest = DEFAULT_MANIFEST, loadJSON = readJSON, loadImage = imageAt, palette = {}} = {}) {
  const records = new Map(), missing = new Set(); let loading;
  function sprite(name) {
    const record = records.get(name);
    return {...record, name, family: record?.family || familyOf(name), relativeLength: record?.relativeLength ?? 1,
      available: !!record?.image, draw: (g, x, y, opts) => drawSprite(g, name, x, y, opts)};
  }
  async function load() {
    if (loading) return loading;
    loading = (async () => {
      let data;
      try { data = manifest && typeof manifest === 'object' && !(manifest instanceof URL) ? manifest : await loadJSON(manifest instanceof URL ? manifest : new URL(manifest, DEFAULT_MANIFEST)); }
      catch (error) { missing.add(`sprites.json: ${error.message}`); return api; }
      const source = data?.sprites ?? data ?? {}, entries = Array.isArray(source) ? source.map(r => [r.name || r.id, r]) : Object.entries(source);
      const base = manifest instanceof URL ? manifest : typeof manifest === 'string' ? new URL(manifest, DEFAULT_MANIFEST) : DEFAULT_MANIFEST;
      // Orden estable y una sola decodificación a la vez: el catálogo final puede ser grande.
      for (const [name,value] of entries) records.set(name, normalized(name,value));
      for (const [name,r] of records) {
        if (!r.src && !r.file) { missing.add(`sprite ${name}: falta src/file`); continue; }
        try {
          r.image = await loadImage(new URL(r.src || r.file, base));
          r.mask = r.mask ? await loadImage(new URL(r.mask, base)) : r.image;
          r.shadow = colored(r.mask, '#000'); r.variants = {};
        } catch (error) { r.image = null; missing.add(`sprite ${name}: ${error.message}`); }
      }
      for (const r of records.values()) if (r.image && (!r.state || r.state === 'normal')) {
        for (const [state,color] of Object.entries({...STATE_TINTS,...palette.states})) {
          if (color && !records.get(r.states?.[state])?.image) r.variants[state] = colored(r.mask,color,.68,r.image);
        }
      }
      return api;
    })();
    return loading;
  }
  function drawSprite(g, name, x, y, {heading = 0, length = 100, state = 'normal', shadow = true, color = palette.unit || '#b9c4cb', shadowOffset = [5, 7], shadowAlpha = .4} = {}) {
    const base = records.get(name), mapped = records.get(base?.states?.[state]);
    const record = mapped?.image ? mapped : base, family = record?.family || familyOf(name);
    const paint = (image, tint) => {
      if (image) {
        const scale = length / (record?.length_pixels || image.height), w = image.width * scale, h = image.height * scale;
        const anchor = record?.anchor || [.5,.5]; g.drawImage(image, -w*anchor[0], -h*anchor[1], w, h);
      }
      else silhouette(g, family, length, tint);
    };
    if (shadow) {
      g.save(); g.translate(x + shadowOffset[0], y + shadowOffset[1]); g.rotate(heading * Math.PI / 180); g.globalAlpha *= shadowAlpha;
      paint(record?.shadow, '#000'); g.restore();
    }
    g.save(); g.translate(x, y); g.rotate(heading * Math.PI / 180);
    paint(mapped?.image || record?.variants?.[state] || record?.image, palette.states?.[state] || STATE_TINTS[state] || color); g.restore();
  }
  const api = {load, sprite, drawSprite, missing: () => [...missing], has: name => records.has(name), names: () => [...records.keys()]};
  return api;
}
const defaults = createSprites();
export const loadSprites = () => defaults.load();
export const drawSprite = (...args) => defaults.drawSprite(...args);
