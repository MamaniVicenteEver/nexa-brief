import { clamp, lerp, smoothstep, rotate, sub, TAU } from '../core/math.js';
import { characterRng } from '../core/rng.js';
import { drawMouth, mouthShape, mixMouth, EXPRESSION_MOUTHS } from './mouth.js';

const base = { eyeScale: 1, upper: [0, 0], lower: [0, 0], happy: 0, closed: 0,
  browHeight: [0, 0], browAngle: [0, 0], browCurve: [.04, .04], pupil: 1, gaze: [0, 0], blush: 0, tears: 0, sweat: 0, love: 0, surprise: 0 };
const expression = (name, changes) => ({ ...base, ...changes, mouth: EXPRESSION_MOUTHS[name] });
export const EXPRESSIONS = Object.freeze({
  neutral: expression('neutral', {}),
  smile: expression('smile', { lower: [.18, .18], browHeight: [.035, .035], browCurve: [.09, .09] }),
  smirk: expression('smirk', { upper: [.48, .30], browHeight: [.01, .11], browAngle: [-.05, -.19], gaze: [.2, 0] }),
  grin: expression('grin', { lower: [.38, .38], eyeScale: 1.07, browHeight: [.12, .12], browCurve: [.12, .12] }),
  laugh: expression('laugh', { happy: 1, closed: 1, browHeight: [.08, .08], browCurve: [.16, .16], tears: .75 }),
  sad: expression('sad', { upper: [.24, .24], browHeight: [.05, .05], browAngle: [-.42, .42], browCurve: [.025, .025], gaze: [0, .4], tears: .35 }),
  worry: expression('worry', { eyeScale: 1.08, browHeight: [.12, .12], browAngle: [-.38, .38], pupil: .85, sweat: .55 }),
  surprise: expression('surprise', { eyeScale: 1.30, browHeight: [.22, .22], browCurve: [.16, .16], pupil: .70, surprise: .7 }),
  shock: expression('shock', { eyeScale: 1.46, browHeight: [.26, .26], browAngle: [.12, -.12], pupil: .45, sweat: .75, surprise: 1 }),
  annoyed: expression('annoyed', { upper: [.48, .48], browHeight: [-.055, -.055], browAngle: [.36, -.36], browCurve: [0, 0], pupil: .85 }),
  skeptical: expression('skeptical', { upper: [.60, .12], browHeight: [-.04, .20], browAngle: [.12, -.23], browCurve: [0, .12], gaze: [.45, -.12] }),
  shy: expression('shy', { eyeScale: .87, upper: [.27, .27], browAngle: [-.19, .19], browHeight: [.05, .05], gaze: [-.35, .45], blush: .9 }),
  love: expression('love', { eyeScale: 1.08, lower: [.14, .14], browHeight: [.13, .13], browCurve: [.14, .14], blush: .75, love: 1 }),
  think: expression('think', { upper: [.27, .42], browHeight: [.16, -.02], browAngle: [-.15, .18], gaze: [.65, -.65], pupil: .8 }),
});

export function blendFace(a, b, weight) {
  const w = clamp(weight), result = {};
  for (const k of Object.keys(base)) result[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], w)) : lerp(a[k], b[k], w);
  result.mouth = mixMouth(a.mouth, b.mouth, w); return result;
}
export function resolveFace(character, state = {}) {
  const target = EXPRESSIONS[state.expression ?? character.face?.expression ?? 'neutral'] ?? EXPRESSIONS.neutral;
  let result = blendFace(EXPRESSIONS.neutral, target, state.intensity ?? 1);
  if (state.mix) {
    const { from = 'neutral', to = 'smile', weight = .5 } = state.mix;
    result = blendFace(EXPRESSIONS[from] ?? EXPRESSIONS.neutral, EXPRESSIONS[to] ?? EXPRESSIONS.neutral, weight);
    result = blendFace(EXPRESSIONS.neutral, result, state.intensity ?? 1);
  }
  result.eyeScale *= state.eyeScale ?? character.face?.eyeScale ?? 1;
  if (state.lids) {
    for (const k of ['upper', 'lower']) if (state.lids[k] !== undefined) result[k] = Array.isArray(state.lids[k]) ? state.lids[k] : [state.lids[k], state.lids[k]];
    for (const k of ['closed', 'happy']) if (state.lids[k] !== undefined) result[k] = clamp(state.lids[k]);
  }
  if (state.brows) for (const [i, side] of ['left', 'right'].entries()) {
    const b = state.brows[side] ?? {};
    for (const [input, key] of [['height', 'browHeight'], ['angle', 'browAngle'], ['curve', 'browCurve']])
      if (b[input] !== undefined) result[key] = result[key].map((v, j) => i === j ? b[input] : v);
  }
  for (const k of ['blush', 'tears', 'sweat']) if (state[k] !== undefined) result[k] = clamp(state[k]);
  return result;
}

/** Blink starts are 2.5–5 s apart. The stream is replayed, never retained. */
export function blinkAt(character, t, state = {}, face = resolveFace(character, state)) {
  if (state.closeUp && face.surprise > .05) return 0;
  if (typeof state.blink === 'number') return clamp(state.blink);
  if (state.blink === false || state.blink === 'off') return 0;
  const rng = characterRng(character, 'blink');
  let start = 2.5 + rng() * 2.5;
  while (start <= t) {
    const dur = .15 + rng() * .07;
    if (t < start + dur) {
      const u = (t - start) / dur;
      return u < .42 ? smoothstep(u / .42) : 1 - smoothstep((u - .42) / .58);
    }
    start += 2.5 + rng() * 2.5;
  }
  return 0;
}

export function faceLayout(yaw, radius = 1) {
  const angle = clamp(yaw, -1, 1) * 1.38;
  return [-1, 1].map(side => {
    const a = angle + side * .43, depth = Math.cos(a);
    return { side, x: Math.sin(a) * radius * .86, y: -.09 * radius,
      width: (.45 + .55 * Math.max(0, depth)) * radius,
      visibility: smoothstep((depth + .08) / .42) };
  });
}
function heart(ctx, x, y, size) {
  ctx.beginPath(); ctx.moveTo(x, y + size * .7);
  ctx.bezierCurveTo(x - size * 1.4, y - size * .15, x - size * .65, y - size, x, y - size * .38);
  ctx.bezierCurveTo(x + size * .65, y - size, x + size * 1.4, y - size * .15, x, y + size * .7); ctx.fill();
}
function drop(ctx, x, y, size) {
  ctx.beginPath(); ctx.moveTo(x, y - size); ctx.bezierCurveTo(x + size, y, x + size * .6, y + size, x, y + size);
  ctx.bezierCurveTo(x - size * .6, y + size, x - size, y, x, y - size); ctx.closePath(); ctx.fill(); ctx.stroke();
}

export function drawFace(ctx, character, rig, state, t) {
  const f = resolveFace(character, state), ink = character.ink?.color ?? '#151419';
  const line = (character.ink?.width ?? .012) / rig.r, skin = character.skin ?? '#fffdf8';
  const blink = Math.max(f.closed, blinkAt(character, t, state, f));
  const layout = faceLayout(rig.headYaw), theta = rig.headYaw * 1.38;
  const centerX = Math.sin(theta) * .64, compression = .56 + .44 * Math.cos(theta);
  // World target → head-local vector. Caller transforms context, never input data.
  const target = state.lookAt ? rotate(sub(state.lookAt, rig.world(rig.head)), -rig.headAngle).map(v => v / rig.scale / rig.r) : null;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = ink;
  for (let i = 0; i < 2; i++) {
    const e = layout[i]; if (e.visibility <= 0) continue;
    const rx = .215 * e.width * f.eyeScale, ry = .265 * f.eyeScale;
    ctx.save(); ctx.globalAlpha *= e.visibility;
    if (f.blush > 0) {
      ctx.save(); ctx.globalAlpha *= f.blush * .45; ctx.fillStyle = '#ed8b90';
      ctx.beginPath(); ctx.ellipse(e.x, .29, .18 * e.width, .09, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    const closing = clamp(blink), upper = lerp(clamp(f.upper[i]), 1, closing), lower = clamp(f.lower[i]);
    const topY = lerp(-ry + 2 * ry * clamp(f.upper[i]), .035, closing);
    const bottomY = lerp(ry - ry * lower, .035, closing);
    const closedCurve = -.19 * f.happy + .08 * (1 - f.happy);
    const upperCurve = lerp(.015, closedCurve, closing), lowerCurve = lerp(-ry * .22, closedCurve, closing);
    ctx.save(); ctx.translate(e.x, e.y);
    if (closing < .985) {
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.lineWidth = line * .68; ctx.stroke(); ctx.save(); ctx.clip();
      const vector = target ? [target[0] - e.x, target[1] - e.y] : f.gaze;
      const length = Math.hypot(...vector), divisor = target ? Math.max(1.8, length) : 1;
      const px = clamp(vector[0] / divisor, -1, 1) * rx * .48;
      const py = clamp(vector[1] / divisor, -1, 1) * ry * .38;
      ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(px, py, rx * .35 * f.pupil, ry * .45 * f.pupil, 0, 0, TAU); ctx.fill();
      if (f.love > 0) { ctx.globalAlpha *= f.love; ctx.fillStyle = '#d96c78'; heart(ctx, px, py, rx * .62); }
      ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, rx + line, ry + line, 0, 0, TAU); ctx.clip();
      ctx.fillStyle = skin;
      if (upper > .001) {
        ctx.beginPath(); ctx.moveTo(-rx - line, -ry - line); ctx.lineTo(-rx - line, topY);
        ctx.quadraticCurveTo(0, topY + upperCurve, rx + line, topY); ctx.lineTo(rx + line, -ry - line); ctx.closePath(); ctx.fill();
      }
      if (lower > .001 || closing > .001) {
        ctx.beginPath(); ctx.moveTo(-rx - line, ry + line); ctx.lineTo(-rx - line, bottomY);
        ctx.quadraticCurveTo(0, bottomY + lowerCurve, rx + line, bottomY); ctx.lineTo(rx + line, ry + line); ctx.closePath(); ctx.fill();
      }
      ctx.restore(); ctx.lineWidth = line * .78;
      if (upper > .001) {
        const edge = rx * Math.sqrt(Math.max(0, 1 - (topY / ry) ** 2));
        ctx.beginPath(); ctx.moveTo(-edge, topY); ctx.quadraticCurveTo(0, topY + upperCurve, edge, topY); ctx.stroke();
      }
      if (lower > .001 || closing > .001) { ctx.beginPath(); ctx.moveTo(-rx * .91, bottomY); ctx.quadraticCurveTo(0, bottomY + lowerCurve, rx * .91, bottomY); ctx.stroke(); }
    } else {
      ctx.lineWidth = line * .85; ctx.beginPath(); ctx.moveTo(-rx, .035);
      ctx.quadraticCurveTo(0, .035 - .19 * f.happy + .08 * (1 - f.happy), rx, .035); ctx.stroke();
    }
    ctx.restore();
    // Each brow has independent height, slope and curvature.
    const by = -.40 - f.browHeight[i] * .50, bw = .22 * e.width;
    ctx.save(); ctx.translate(e.x, by); ctx.rotate(f.browAngle[i]); ctx.lineWidth = line * 1.02;
    ctx.beginPath(); ctx.moveTo(-bw, 0); ctx.quadraticCurveTo(0, -f.browCurve[i] * .60, bw, 0); ctx.stroke(); ctx.restore();
    if (f.tears > 0) {
      ctx.save(); ctx.globalAlpha *= f.tears; ctx.fillStyle = '#a6d8e4'; ctx.strokeStyle = '#548eab'; ctx.lineWidth = line * .32;
      const bounce = .035 * Math.sin(t * 5 + i);
      drop(ctx, e.x + e.side * .15, .36 + bounce, .075); ctx.restore();
    }
    ctx.restore();
  }
  // A tiny nose travels around the circular head with the face.
  ctx.lineWidth = line * .6; ctx.strokeStyle = ink;
  ctx.beginPath(); ctx.moveTo(centerX + .035 * compression, .08);
  ctx.quadraticCurveTo(centerX + .09 + .07 * Math.abs(rig.headYaw), .19, centerX + .01, .19); ctx.stroke();
  ctx.save(); ctx.translate(centerX, .43); ctx.scale(compression, 1);
  drawMouth(ctx, mouthShape(state, f.mouth), ink, line * .75); ctx.restore();
  if (f.sweat > 0) {
    ctx.save(); ctx.globalAlpha *= f.sweat; ctx.fillStyle = '#b9e0eb'; ctx.strokeStyle = '#578ba1'; ctx.lineWidth = line * .36;
    drop(ctx, -.81, -.27, .09); ctx.restore();
  }
  if (character.accessories?.glasses) {
    ctx.strokeStyle = character.accessories.glassesColor ?? '#3c3033'; ctx.lineWidth = line * .63;
    for (const e of layout) {
      ctx.save(); ctx.globalAlpha *= e.visibility; ctx.beginPath(); ctx.ellipse(e.x, e.y + .005, .29 * e.width, .32, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
    ctx.beginPath(); ctx.moveTo(layout[0].x + .29 * layout[0].width, -.10);
    ctx.quadraticCurveTo(centerX, -.19, layout[1].x - .29 * layout[1].width, -.10); ctx.stroke();
  }
  return f;
}
