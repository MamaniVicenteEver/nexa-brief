import { add, sub, mul, rotate, lerp, smoothstep } from '../core/math.js';
import { path, ellipse, line } from './ink.js';
import { drawHand } from './hands.js';
import { drawHairBack, drawHairFront } from './hair.js';
import { drawFace } from '../face/face.js';

export const OUTFITS = Object.freeze(['tshirt', 'hoodie', 'dress', 'skirt', 'pants', 'apron']);

function drawShoe(ctx, limb, side, rig, character) {
  const ink = character.ink?.color ?? '#151419', w = character.ink?.width ?? .012;
  const shoe = character.shoes ?? { style: 'oval', color: ink };
  const facing = lerp(side === 'left' ? -.70 : .70, rig.yaw, Math.abs(rig.yaw));
  const p = limb.leg.end, toe = .018 * facing;
  ctx.save();ctx.translate(p[0],p[1]+.022);ctx.rotate(rig.p.footAngles?.[side]??0);ctx.translate(-p[0],-p[1]-.022);
  if (shoe.style === 'sneaker') {
    ctx.save(); ctx.translate(p[0] + toe * .4, p[1] + .022); ctx.scale(1.4, 1.18); ctx.translate(0, -.022);
    const left = -.033 + Math.min(0, toe), right = .033 + Math.max(0, toe);
    const leftTop = -.020 + .012 * Math.max(0, -facing), rightTop = -.020 + .012 * Math.max(0, facing);
    path(ctx, [['M', left, .019], ['Q', left - .003, leftTop, left + .015, leftTop],
      ['Q', 0, -.032, right - .015, rightTop], ['Q', right + .003, rightTop, right, .019], ['Z']], shoe.color ?? '#3d4453', ink, w * .65);
    path(ctx, [['M', left, .013], ['Q', 0, .017, right, .013], ['L', right, .022], ['L', left, .022], ['Z']], shoe.sole ?? '#fffdf8', ink, w * .45);
    const laceX = .006 * facing;
    line(ctx, [[laceX - .008, -.010], [laceX + .008, -.007]], '#fffdf8', w * .4);
    line(ctx, [[laceX - .006, -.003], [laceX + .010, 0]], '#fffdf8', w * .4); ctx.restore();
  } else ellipse(ctx, p[0] + toe, p[1] + .008, .056, .014, shoe.color ?? ink);
  ctx.restore();
}

function drawLeg(ctx, side, rig, character) {
  const limb = rig.limbs[side], ink = character.ink?.color ?? '#151419', w = character.ink?.width ?? .012;
  const pants = character.outfit?.style === 'pants';
  line(ctx, [limb.hip, limb.leg.joint, limb.leg.end], ink, pants ? .040 : w);
  if (pants) line(ctx, [limb.hip, limb.leg.joint, limb.leg.end], character.outfit.pantsColor ?? '#465463', .040 - w * 2);
  drawShoe(ctx, limb, side, rig, character);
}

function drawArm(ctx, side, rig, character, sleeve = true) {
  const limb = rig.limbs[side], ink = character.ink?.color ?? '#151419', w = character.ink?.width ?? .012;
  // One round polyline: joints share the same stroke and cannot open seams.
  const sleeveEnd = add(limb.shoulder, mul(sub(limb.arm.joint, limb.shoulder), .055 / .146));
  line(ctx, [sleeve ? limb.shoulder : sleeveEnd, limb.arm.joint, limb.arm.end], ink, w);
  const sleeveColor = character.outfit?.color ?? '#eeeeea';
  const delta = sub(limb.arm.joint, limb.shoulder), angle = Math.atan2(delta[1], delta[0]);
  if (sleeve) {
  ctx.save(); ctx.translate(...limb.shoulder); ctx.rotate(angle);
  path(ctx, [['M', -.018, -.026], ['Q', .021, -.032, .055, -.022], ['L', .055, .022],
    ['Q', .021, .032, -.018, .026], ['Z']], sleeveColor, ink, w);
  path(ctx, [['M', .004, .012], ['L', .050, .009], ['L', .050, .017], ['Q', .02, .025, .004, .018], ['Z']], character.outfit?.shadow ?? '#c7ccd0');
  ctx.restore();
  }
  const v = sub(limb.arm.end, limb.arm.joint), explicit = rig.p.handAngles[side];
  const handAngle = explicit ?? Math.atan2(v[1], v[0]) + Math.PI / 2;
  drawHand(ctx, limb.arm.end, handAngle, rig.p.handShapes[side], ink);
}

function drawTorso(ctx, rig, character) {
  const ink = character.ink?.color ?? '#151419', w = character.ink?.width ?? .012;
  const outfit = character.outfit ?? {}, style = outfit.style ?? 'tshirt';
  const color = outfit.color ?? '#eeece6', shade = outfit.shadow ?? '#c7ced1';
  const width = .085 * rig.width * rig.torsoWidth, hipWidth = width * 1.08;
  ctx.save(); ctx.translate(...rig.hip); ctx.rotate(rig.p.lean);
  // Neck is tucked under both the head and the garment.
  path(ctx, [['M', -.018, -.327], ['L', -.018, -.248], ['Q', 0, -.227, .018, -.248], ['L', .018, -.327]], character.skin ?? '#fffdf8', ink, w);
  const dress = style === 'dress', skirt = style === 'skirt', hoodie = style === 'hoodie';
  const hem = dress ? .065 : .025, bottom = dress ? width * 1.48 : hipWidth;
  path(ctx, [['M', -width * .63, -.282], ['Q', -width * 1.02, -.274, -width, -.218],
    ['L', -bottom, hem - .018], ['Q', 0, hem + .025, bottom, hem - .018],
    ['L', width, -.218], ['Q', width * 1.02, -.274, width * .63, -.282],
    ['Q', 0, -.255, -width * .63, -.282], ['Z']], color, ink, w);
  // Soft flat shadow, without a second contour along the inside.
  path(ctx, [['M', -width + w * .6, -.235], ['Q', -width * .65, -.165, -width * .62, -.05],
    ['Q', -width * .30, hem - .002, bottom - w * .6, hem - .028], ['L', bottom - w * .6, hem - .012],
    ['Q', 0, hem + .013, -bottom + w * .6, hem - .022], ['Z']], shade);
  if (hoodie) {
    // Hood and V opening, distinct from the torso mass.
    path(ctx, [['M', -width * .82, -.280], ['C', -width * 1.72, -.316, -width * 1.42, -.359, -.015, -.331],
      ['Q', .048, -.336, width * 1.15, -.302], ['Q', width * 1.50, -.268, width * .78, -.230],
      ['L', .008, -.216], ['L', -width * .68, -.246], ['Q', -width * 1.40, -.226, -width * .82, -.280], ['Z']], color, ink, w);
    path(ctx, [['M', -width * 1.05, -.301], ['Q', 0, -.334, width * .85, -.298], ['L', .008, -.229],
      ['Q', -.025, -.275, -width * 1.05, -.301], ['Z']], shade, ink, w * .65);
    // Draw cords as narrow filled shapes. Their outline is finer to preserve the outer ink.
    for (const s of [-1, 1]) {
      const cx = s * width * .37 + rig.yaw * .008;
      path(ctx, [['M', cx, -.235], ['Q', cx + .005, -.195, cx + .003, -.15]], null, ink, w * .85);
      path(ctx, [['M', cx, -.235], ['Q', cx + .005, -.195, cx + .003, -.15]], null, '#faf9f3', w * .42);
      ellipse(ctx, cx + .003, -.145, .003, .006, ink);
    }
    const px = rig.yaw * width * .18, pw = width * .69;
    path(ctx, [['M', px - pw * .69, -.076], ['Q', px, -.065, px + pw * .69, -.076],
      ['L', px + pw, -.021], ['Q', px, -.004, px - pw, -.021], ['Z']], color, '#8697a0', w * .58);
    path(ctx, [['M', -hipWidth * .92, .002], ['Q', 0, .025, hipWidth * .92, .002]], null, '#8697a0', w * .6);
  } else {
    path(ctx, [['M', -width * .45, -.277], ['Q', 0, -.237, width * .45, -.277]], null, ink, w * .65);
  }
  if (dress) {
    path(ctx, [['M', -width * .84, -.125], ['Q', 0, -.113, width * .84, -.125]], null, outfit.trim ?? '#b49aca', w * .7);
    path(ctx, [['M', -width * .45, -.045], ['Q', -width * .5, .017, -width * .72, .041]], null, shade, w * .65);
  }
  if (skirt) {
    path(ctx, [['M', -width, -.025], ['L', -width * 1.42, .085], ['Q', 0, .11, width * 1.42, .085], ['L', width, -.025], ['Z']], outfit.skirtColor ?? '#b8a1c9', ink, w);
    path(ctx, [['M', -width * .3, -.012], ['L', -width * .48, .075]], null, shade, w * .65);
  }
  if (style === 'apron') {
    const apron = outfit.apronColor ?? '#a6b59b', ax = rig.yaw * width * .22;
    path(ctx, [['M', ax - width * .43, -.244], ['L', ax - width * .46, -.151], ['L', ax - width * .84, .035],
      ['Q', ax, .062, ax + width * .84, .035], ['L', ax + width * .46, -.151], ['L', ax + width * .43, -.244], ['Z']], apron, ink, w * .75);
    path(ctx, [['M', ax - width * .39, -.075], ['L', ax - width * .36, -.025], ['Q', ax, -.007, ax + width * .36, -.025],
      ['L', ax + width * .39, -.075], ['Z']], null, '#627866', w * .6);
  }
  ctx.restore();
}

function drawHead(ctx, rig, character, state, t) {
  const ink = character.ink?.color ?? '#151419', w = (character.ink?.width ?? .012) / rig.r;
  ctx.save(); ctx.translate(...rig.head); ctx.rotate(rig.headAngle); ctx.scale(rig.r, rig.r);
  const roundness = character.head?.roundness ?? 1;
  // The head stays round through turns; the features travel on its surface.
  ellipse(ctx, 0, 0, roundness, 1, character.skin ?? '#fffdf8', ink, w);
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, roundness - w * .48, 1 - w * .48, 0, 0, Math.PI * 2); ctx.clip();
  path(ctx, [['M', -.97, -.36], ['C', -.95, .75, .17, 1.04, .79, .63],
    ['C', .44, 1.14, -.91, 1.25, -1.07, .03], ['Z']], character.skinShadow ?? '#dce4e6'); ctx.restore();
  drawFace(ctx, character, rig, state, t);
  drawHairFront(ctx, character, rig, t); ctx.restore();
}

export function drawRig(ctx, character, rig, faceState = {}, t = 0) {
  ctx.save(); ctx.translate(rig.p.x, rig.p.y); ctx.scale(rig.scale, rig.scale);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Hair is rooted at the nape and falls BEHIND the shoulder/torso.
  ctx.save(); ctx.translate(...rig.head); ctx.rotate(rig.headAngle); ctx.scale(rig.r, rig.r);
  drawHairBack(ctx, character, rig, t); ctx.restore();
  const order = rig.yaw >= 0 ? ['right', 'left'] : ['left', 'right'];
  for (const side of order) drawLeg(ctx, side, rig, character);
  // Both arms have a back pass. The far arm's front pass fades continuously with yaw,
  // so changing the sign of the turn never pops a limb over the clothing.
  for (const side of order) drawArm(ctx, side, rig, character);
  drawTorso(ctx, rig, character);
  for (const side of order) {
    if (rig.p.armLayer[side] >= 2) continue;
    const isFar = (side === 'right' ? 1 : -1) * rig.yaw;
    const frontAlpha = rig.p.armLayer[side] >= 1 ? 1 : 1 - smoothstep(isFar / .5);
    ctx.save(); ctx.globalAlpha *= frontAlpha; drawArm(ctx, side, rig, character, false); ctx.restore();
  }
  drawHead(ctx, rig, character, faceState, t);
  for (const side of order) if (rig.p.armLayer[side] >= 2) drawArm(ctx, side, rig, character, false);
  ctx.restore();
}
