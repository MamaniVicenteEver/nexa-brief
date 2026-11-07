import { spring, springSine } from '../core/math.js';
import { characterRng } from '../core/rng.js';
import { path, ellipse } from './ink.js';

export const HAIR = Object.freeze(['spiky', 'ponytail', 'curly', 'buzz']);
export function hairLag(character, pose, t) {
  const motion = pose.secondary;
  if (motion && t < (motion.at ?? 0)) return 0;
  if (motion) return spring(t - (motion.at ?? 0), { from: motion.amplitude ?? .15, to: 0,
    frequency: motion.frequency ?? 2.6, damping: motion.damping ?? .48 });
  const phase = characterRng(character, 'hair')() * Math.PI * 2;
  return springSine(t, { amplitude: .022, frequency: .65, naturalFrequency: 2.7, damping: .55, phase });
}
export function drawHairBack(ctx, character, rig, t) {
  const hair = character.hair ?? {}, ink = character.ink?.color ?? '#151419', width = (character.ink?.width ?? .012) / rig.r;
  const color = hair.color ?? '#493024', shade = hair.shadow ?? '#34251f';
  if (hair.style === 'ponytail') {
    const a = rig.headYaw * 1.38, x = -.66 * Math.cos(a) - .86 * Math.sin(a);
    ctx.save(); ctx.translate(x, .32); ctx.rotate(hairLag(character, rig.p, t) - rig.headAngle * .35);
    path(ctx, [['M', .22, -.40], ['Q', -.16, -.48, -.30, -.12], ['C', -.56, .03, -.59, .68, -.40, 1.11], ['Q', -.43, 1.44, -.68, 1.67],
      ['C', -.08, 1.74, .40, 1.38, .28, .87], ['C', .15, .43, .52, -.10, .22, -.40], ['Z']], color, ink, width);
    path(ctx, [['M', -.42, .30], ['C', -.53, .81, -.17, 1.23, -.39, 1.52], ['Q', .16, 1.30, .06, .86], ['Z']], shade);
    const bow = hair.tie ?? '#e98c85';
    path(ctx, [['M', -.07, .06], ['Q', -.62, -.37, -.59, .02], ['Q', -.56, .39, -.07, .13],
      ['Q', .41, .43, .38, .02], ['Q', .36, -.32, -.07, .06], ['Z']], bow, ink, width * .75);
    ellipse(ctx, -.07, .09, .095, .10, bow, ink, width * .60); ctx.restore();
  }
  const cap = character.accessories?.cap;
  if (cap === 'backward') {
    const s = Math.sin(rig.headYaw * 1.38);
    path(ctx, [['M', -.55 * s, -.70], ['Q', -1.18 * s, -.55, -1.62 * s, -.35],
      ['Q', -1.75 * s, -.15, -1.30 * s, -.25], ['L', -.58 * s, -.48], ['Z']],
      character.accessories.capColor ?? '#4d83c1', ink, width);
  }
}

export function drawHairFront(ctx, character, rig, t) {
  const hair = character.hair ?? {}, ink = character.ink?.color ?? '#151419', width = (character.ink?.width ?? .012) / rig.r;
  const color = hair.color ?? '#493024', shade = hair.shadow ?? '#34251f', light = hair.highlight ?? '#6d4b32';
  ctx.save(); ctx.rotate(hairLag(character, rig.p, t) * (hair.style === 'spiky' ? .5 : .12));
  const s = Math.sin(rig.headYaw * 1.2);
  if (hair.style === 'spiky') {
    path(ctx, [['M', -.97, -.10], ['Q', -1.17, -.42, -.97, -.72], ['L', -.99, -1.00], ['L', -.79, -.82],
      ['Q', -.69, -1.18, -.35, -1.38], ['L', -.41, -1.12], ['Q', -.02, -1.40, .48, -1.27],
      ['L', .26, -1.12], ['Q', .76, -.98, 1.11, -1.16], ['Q', 1.06, -.88, .84, -.78],
      ['L', 1.12, -.60], ['L', .87, -.63], ['Q', 1.02, -.44, .94, -.21],
      ['L', .73 + s * .06, -.67], ['L', .43 + s * .08, -.82], ['L', .56, -.68], ['Q', .06, -.85, -.30, -.77],
      ['L', -.18, -.63], ['L', -.53, -.69], ['L', -.64, -.16], ['L', -.79, -.34], ['L', -.87, .02], ['Z']], color, ink, width);
    path(ctx, [['M', -.66, -.83], ['Q', -.27, -1.13, .44, -1.08], ['Q', .08, -.91, -.16, -.88],
      ['Q', .48, -.93, .85, -.99], ['Q', .46, -.66, -.35, -.76], ['Z']], light);
    path(ctx, [['M', -.84, -.29], ['Q', -.87, -.57, -.58, -.76], ['Q', .26, -.95, .73, -.67],
      ['Q', .11, -.85, -.30, -.77], ['L', -.18, -.63], ['L', -.53, -.69], ['L', -.64, -.16], ['L', -.79, -.34], ['Z']], shade);
  } else if (hair.style === 'ponytail') {
    path(ctx, [['M', -.99, -.16], ['C', -1.13, -.91, -.50, -1.16, .06, -1.09], ['C', .70, -1.13, 1.08, -.69, 1.00, -.08],
      ['Q', .81, -.21, .65, -.75], ['Q', .28 + .15 * s, -.62, -.30, -.70],
      ['L', -.20, -.80], ['Q', -.63, -.54, -.85, -.42], ['L', -.88, .08], ['Z']], color, ink, width);
    path(ctx, [['M', -.78, -.69], ['Q', -.34, -1.06, .25, -.94], ['Q', -.06, -.79, -.54, -.59], ['Z']], light);
  } else if (hair.style === 'curly') {
    // One scalloped contour avoids visible circle seams between curls.
    path(ctx, [['M', -.99, .02], ['Q', -1.25, -.18, -1.02, -.39], ['Q', -1.30, -.63, -.99, -.78],
      ['Q', -1.07, -1.10, -.73, -1.08], ['Q', -.67, -1.39, -.37, -1.19],
      ['Q', -.14, -1.45, .10, -1.20], ['Q', .39, -1.40, .55, -1.11],
      ['Q', .93, -1.18, .94, -.85], ['Q', 1.24, -.71, 1.04, -.47], ['Q', 1.23, -.19, 1.00, .03],
      ['L', .86, -.32], ['Q', .65, -.31, .64, -.59], ['Q', .39, -.42, .24, -.65],
      ['Q', -.04, -.43, -.23, -.65], ['Q', -.48, -.44, -.65, -.55], ['Q', -.68, -.22, -.89, -.29], ['Z']], color, ink, width);
    for (const [x, y] of [[-.77, -.83], [-.35, -1.02], [.16, -1.03], [.65, -.88]])
      path(ctx, [['M', x - .09, y + .12], ['C', x - .20, y - .12, x + .18, y - .17, x + .14, y + .04]], null, light, width * .65);
  } else if (hair.style === 'buzz') {
    path(ctx, [['M', -.91, -.42], ['C', -.72, -1.23, .78, -1.23, .93, -.42], ['Q', .35, -.72, -.04, -.60], ['Q', -.54, -.70, -.91, -.42], ['Z']], color, ink, width);
  }
  ctx.restore();
  if (character.accessories?.cap) {
    const acc = character.accessories, color = acc.capColor ?? '#4d83c1';
    path(ctx, [['M', -.99, -.45], ['C', -1.04, -1.30, .66, -1.43, .96, -.63],
      ['Q', .02, -.82, -.99, -.45], ['Z']], color, ink, width);
    path(ctx, [['M', -.72, -.83], ['Q', -.31, -1.25, .19, -1.11]], null, '#91b2d5', width * .75);
    ellipse(ctx, .02, -1.18, .09, .045, color, ink, width * .7);
    if (acc.cap === 'backward') {
      path(ctx, [['M', -.26 + .2 * s, -.66], ['Q', -.27 + .2 * s, -.95, .09 + .2 * s, -.88],
        ['Q', .32 + .2 * s, -.86, .29 + .2 * s, -.71]], '#e5d9c5', ink, width * .7);
      path(ctx, [['M', -.29 + .2 * s, -.65], ['L', .31 + .2 * s, -.70]], null, ink, width * .8);
    } else {
      const sn = Math.sin(rig.headYaw * 1.38), cs = Math.cos(rig.headYaw * 1.38);
      const left = -.8 * cs + .45 * sn, right = .8 * cs + .45 * sn;
      const outerLeft = -.95 * cs + 1.35 * sn, outerRight = .95 * cs + 1.35 * sn;
      path(ctx, [['M', left, -.64], ['Q', .45 * sn, -.76, right, -.64],
        ['Q', outerRight + .12 * cs, -.50, outerRight, -.44], ['Q', 1.35 * sn, -.38, outerLeft, -.44],
        ['Q', outerLeft - .12 * cs, -.50, left, -.64], ['Z']], color, ink, width);
    }
  }
}
