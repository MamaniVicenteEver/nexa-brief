import { clamp, lerp, smoothstep } from '../core/math.js';

export const VISEMES = Object.freeze(['X', 'A', 'E', 'I', 'O', 'U', 'MBP', 'FV', 'L']);
// Shared Bézier topology: width, aperture, smile curve, asymmetry, teeth, tongue, lip.
const shape = (w, h, curve = 0, asym = 0, teeth = 0, tongue = 0, lip = 0) => ({ w, h, curve, asym, teeth, tongue, lip });
export const VISEME_SHAPES = Object.freeze({
  X: shape(.28, 0), A: shape(.34, .43, .01, 0, .18, .48), E: shape(.43, .23, .04, 0, .42, .12),
  I: shape(.45, .12, .03, 0, .7), O: shape(.23, .36, 0, 0, 0, .12), U: shape(.15, .23, 0, 0, 0, .04),
  MBP: shape(.31, 0, -.025, 0, 0, 0, 1), FV: shape(.33, .105, -.015, 0, .9, 0, .35), L: shape(.33, .25, .02, 0, .24, .95),
});
export const EXPRESSION_MOUTHS = Object.freeze({
  neutral: shape(.27, 0, .025), smile: shape(.4, 0, .20), smirk: shape(.39, 0, .115, -.105),
  grin: shape(.44, .20, .14, 0, .9), laugh: shape(.49, .48, .11, 0, .28, .55),
  sad: shape(.30, 0, -.14), worry: shape(.31, .09, -.10, -.025, .4),
  surprise: shape(.19, .26), shock: shape(.31, .52, -.04, 0, .22, .3),
  annoyed: shape(.32, 0, -.055, .03), skeptical: shape(.25, 0, -.025, .10),
  shy: shape(.22, 0, .10), love: shape(.32, .11, .16, 0, .65), think: shape(.17, 0, -.01, -.08),
});
export function mixMouth(a, b, weight) {
  return Object.fromEntries(Object.keys(a).map(k => [k, lerp(a[k], b[k], clamp(weight))]));
}
export function mouthShape(state = {}, expressionShape = EXPRESSION_MOUTHS.neutral) {
  // Compatible opt-in for episode silence: preserve the expression's closed smile.
  if (state.silent) return { ...expressionShape, h: 0, teeth: 0, tongue: 0 };
  if (!state.viseme) return expressionShape;
  const v = state.viseme;
  let target;
  if (typeof v === 'string') target = VISEME_SHAPES[v] ?? VISEME_SHAPES.X;
  else target = mixMouth(VISEME_SHAPES[v.from] ?? VISEME_SHAPES.X, VISEME_SHAPES[v.to] ?? VISEME_SHAPES.X, smoothstep(v.mix ?? 0));
  const open = clamp(state.open ?? 1);
  // At zero energy every phoneme returns to a closed line, including teeth/tongue.
  target = { ...target, h: target.h * open, teeth: target.teeth * open, tongue: target.tongue * open };
  return mixMouth(expressionShape, target, state.speechWeight ?? 1);
}

/** ctx uses head-radius units. Shape is never replaced by text glyphs. */
export function drawMouth(ctx, s, ink, width) {
  const { w, h, curve, asym } = s, l = -asym + h * .22, r = asym + h * .22;
  ctx.lineWidth = width; ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const outline = () => {
    ctx.beginPath(); ctx.moveTo(-w, l);
    ctx.bezierCurveTo(-w * .90, curve - h * .75, w * .90, curve - h * .75, w, r);
    ctx.bezierCurveTo(w * .90, curve + h * .90, -w * .90, curve + h * .90, -w, l); ctx.closePath();
  };
  if (h > .001) {
    outline(); ctx.fillStyle = '#241c24'; ctx.fill();
    ctx.save(); outline(); ctx.clip();
    if (s.teeth > 0) {
      ctx.save(); ctx.globalAlpha *= clamp(s.teeth * 4);
      ctx.fillStyle = '#fffefb';
      const depth = h * (-.25 + .55 * s.teeth);
      ctx.beginPath(); ctx.moveTo(-w * 1.1, -.20 + Math.min(l, r));
      ctx.lineTo(w * 1.1, -.20 + Math.min(l, r)); ctx.lineTo(w * 1.1, r + depth);
      ctx.quadraticCurveTo(0, curve * .65 + depth + h * .20, -w * 1.1, l + depth); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (s.tongue > 0) {
      ctx.save(); ctx.globalAlpha *= clamp(s.tongue * 3);
      ctx.fillStyle = '#e88791'; ctx.beginPath();
      ctx.ellipse(.035, curve * .75 + h * (.77 - .18 * s.tongue), w * .62, h * (.15 + .19 * s.tongue), -.08, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore(); outline(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-w, l); ctx.bezierCurveTo(-w * .5, curve, w * .5, curve, w, r); ctx.stroke();
  }
  if (s.lip > 0) {
    ctx.globalAlpha *= s.lip * .65; ctx.lineWidth = width * .7;
    ctx.beginPath(); ctx.moveTo(-w * .6, .07); ctx.quadraticCurveTo(0, .11 + curve, w * .65, .07); ctx.stroke();
  }
}

/** Spanish spelling approximation; audio alignment belongs to stage 2.
 * Silent h and u in qu/gu(e,i) are skipped. ü remains pronounced.
 * ch→E, ll/rr→L, ñ→L, y→I. Unknown nonletters are ignored.
 */
export function visemesForWord(word) {
  const text = String(word).toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300\u0301\u0302]/g, '').normalize('NFC');
  const result = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i], pair = text.slice(i, i + 2);
    if (pair === 'ch') { result.push('E'); i++; continue; }
    if (pair === 'll' || pair === 'rr') { result.push('L'); i++; continue; }
    if (pair === 'qu' || (pair === 'gu' && /[ei]/.test(text[i + 2] ?? ''))) { result.push('X'); i++; continue; }
    if ('aeiouü'.includes(c)) result.push(c === 'ü' ? 'U' : c.toUpperCase());
    else if ('mbp'.includes(c)) result.push('MBP');
    else if ('fv'.includes(c)) result.push('FV');
    else if ('lrndtñ'.includes(c)) result.push('L');
    else if (c === 'y') result.push('I');
    else if ('cgjkqsxz'.includes(c)) result.push('X');
  }
  return result;
}
