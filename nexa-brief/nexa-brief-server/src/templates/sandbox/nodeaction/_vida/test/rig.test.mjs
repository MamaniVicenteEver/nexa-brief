import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { readFile } from 'node:fs/promises';
import { drawCharacter, solveIK, resolveSkeleton, createPose, posePreset, blendPose, gaitPose, VIEWS, BODY_POSES,
  EXPRESSIONS, VISEMES, visemesForWord, resolveFace, blinkAt, faceLayout, mouthShape, hairLag } from '../engine/index.js';
import { mulberry32 } from '../engine/core/rng.js';
import { distance, spring, springSine } from '../engine/core/math.js';
import { readCharacters, validateCharacter } from '../tools/validate.mjs';

const characters = await readCharacters();
const tomas = characters.find(c => c.id === 'tomas');
function pixels(character, pose, face, t) {
  const canvas = createCanvas(1080, 1920), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#faf8f2'; ctx.fillRect(0, 0, 1080, 1920);
  drawCharacter(ctx, character, { ...pose, x: 540, y: 1650, scale: 1300 }, face, t);
  return createHash('sha256').update(ctx.getImageData(0, 0, 1080, 1920).data).digest('hex');
}

test('IK: 1,000 reachable targets, <0.5 px error and exact lengths', () => {
  const rng = mulberry32(981);
  for (let i = 0; i < 1000; i++) {
    const a = [rng() * 300, rng() * 200], upper = 40 + rng() * 150, lower = 40 + rng() * 150;
    const angle = rng() * Math.PI * 2, d = Math.abs(upper - lower) + .01 + rng() * (2 * Math.min(upper, lower) - .02);
    const target = [a[0] + Math.cos(angle) * d, a[1] + Math.sin(angle) * d];
    for (const sign of [-1, 1]) {
      const ik = solveIK(a, target, upper, lower, sign);
      assert.ok(distance(ik.end, target) < .5);
      assert.ok(Math.abs(distance(a, ik.joint) - upper) < 1e-7);
      assert.ok(Math.abs(distance(ik.joint, ik.end) - lower) < 1e-7);
      const cross = (target[0] - a[0]) * (ik.joint[1] - a[1]) - (target[1] - a[1]) * (ik.joint[0] - a[0]);
      assert.equal(Math.sign(cross), sign);
    }
  }
});
test('IK: preferred elbow direction, zero distance and unreachable targets stay finite', () => {
  const up = solveIK([0, 0], [100, 0], 80, 80, [0, -1]); assert.ok(up.joint[1] < 0);
  const down = solveIK([0, 0], [100, 0], 80, 80, [0, 1]); assert.ok(down.joint[1] > 0);
  for (const target of [[0, 0], [10000, 0], [.0000001, .000001]]) {
    for (const lengths of [[80, 80], [80, 60]]) {
      const ik = solveIK([0, 0], target, ...lengths, 1);
      assert.ok([...ik.joint, ...ik.end].every(Number.isFinite));
      assert.ok(Math.abs(distance([0, 0], ik.joint) - lengths[0]) < 1e-6);
      assert.ok(Math.abs(distance(ik.joint, ik.end) - lengths[1]) < 1e-6);
    }
  }
});
test('all six body poses reach their targets across all five views', () => {
  for (const c of characters) for (const name of ['idle', ...BODY_POSES]) for (const view of Object.keys(VIEWS)) {
    const rig = resolveSkeleton(c, posePreset(name, { view, scale: 1920 }));
    for (const limb of Object.values(rig.limbs)) for (const bone of [limb.arm, limb.leg])
      assert.ok(bone.error * rig.scale < .5, `${c.id}/${name}/${view}: ${bone.error * rig.scale}px`);
  }
});
test('pose blend is independent per channel and view interpolation has continuous geometry', () => {
  const a = posePreset('hands-hips', { view: 'front' }), b = posePreset('open-arms', { view: 'side-right' });
  const mixed = blendPose(a, b, .5, { 'hands.left': 0, 'hands.right': 1, feet: 0 });
  assert.deepEqual(mixed.hands.left, a.hands.left); assert.deepEqual(mixed.hands.right, b.hands.right);
  assert.deepEqual(mixed.feet, a.feet); assert.equal(mixed.view, .5);
  let previous = null;
  for (let i = -100; i <= 100; i++) {
    const pose = { view: i / 100 }, rig = resolveSkeleton(tomas, pose), face = faceLayout(rig.headYaw);
    if (previous) {
      assert.ok(Math.abs(rig.width - previous.rig.width) < .008);
      for (let j = 0; j < 2; j++) {
        assert.ok(Math.abs(face[j].x - previous.face[j].x) < .013);
        assert.ok(Math.abs(face[j].visibility - previous.face[j].visibility) < .06);
      }
    }
    previous = { rig, face };
  }
});
test('stance foot does not slide: world distance + local target stays fixed', () => {
  let previous = null;
  for (let d = .01; d < .20; d += .003) {
    const pose = gaitPose(d, { x: d * 1200, y: 0, scale: 1200, view: 'side-right' });
    const rig = resolveSkeleton({ ...tomas, height: 1 }, pose);
    const foot = rig.anchors.leftFoot;
    assert.ok(rig.limbs.left.leg.error * 1200 < .5);
    if (previous) assert.ok(distance(foot, previous) < .001, `slide ${distance(foot, previous)}`);
    previous = foot;
  }
});
test('pose blends change elbow branch through extension without a joint jump', () => {
  for (const name of ['wave', 'hands-face', 'open-arms']) {
    const a = posePreset('hands-hips'), b = posePreset(name);
    const before = resolveSkeleton(tomas, blendPose(a, b, .49999));
    const after = resolveSkeleton(tomas, blendPose(a, b, .50001));
    for (const side of ['left', 'right']) {
      assert.ok(distance(before.limbs[side].arm.joint, after.limbs[side].arm.joint) * 1920 < .5, name);
      assert.ok(before.limbs[side].arm.error * 1920 < .5);
    }
  }
});
test('turning preserves explicit ground-frame foot targets', () => {
  for (const view of Object.keys(VIEWS)) {
    const rig = resolveSkeleton(tomas, { scale: 1200, x: 300, y: 1500, view, feet: { left: [-.065, 0], right: [.065, 0] } });
    assert.ok(distance(rig.anchors.leftFoot, [222, 1500]) < .5);
    assert.ok(distance(rig.anchors.rightFoot, [378, 1500]) < .5);
  }
});
test('same character/pose/t = same pixel hash; arbitrary seek order matches sequential', () => {
  for (const character of characters) {
    const pose = posePreset('wave', { view: '3q-right', secondary: { at: .2, amplitude: .25 } });
    const face = { expression: 'worry', lookAt: [80, 400] };
    const times = [0, .3, 2.72, 3.87, 8.1];
    const sequential = new Map(times.map(t => [t, pixels(character, pose, face, t)]));
    for (const t of [8.1, .3, 3.87, 0, 2.72, .3]) assert.equal(pixels(character, pose, face, t), sequential.get(t), `${character.id}@${t}`);
  }
});
test('draw does not mutate data or leak Canvas state; world anchors and gaze work', () => {
  const pose = posePreset('point', { x: 700, y: 1100, scale: 900, lean: .1, headTilt: -.12 });
  const face = { expression: 'smirk', lookAt: [10, 10] }, before = JSON.stringify([tomas, pose, face]);
  const ctx = createCanvas(1080, 1920).getContext('2d'); ctx.translate(12, 13); ctx.lineWidth = 3; ctx.globalAlpha = .7;
  const transform = ctx.getTransform(), anchors = drawCharacter(ctx, tomas, pose, face, 4);
  assert.equal(JSON.stringify([tomas, pose, face]), before); assert.deepEqual(ctx.getTransform(), transform);
  assert.equal(ctx.lineWidth, 3); assert.ok(Math.abs(ctx.globalAlpha - .7) < .005);
  assert.deepEqual(anchors, resolveSkeleton(tomas, pose).anchors);
  assert.notEqual(pixels(tomas, pose, { ...face, lookAt: [10, 10] }, 0), pixels(tomas, pose, { ...face, lookAt: [2000, 1800] }, 0));
});
test('14 expressions alter eyes and brows as well as mouth and have unique raster hashes', () => {
  const hashes = new Set();
  for (const name of Object.keys(EXPRESSIONS)) {
    const face = resolveFace(tomas, { expression: name });
    if (name !== 'neutral') {
      const { mouth: a, ...rest } = face, { mouth: b, ...neutral } = resolveFace(tomas, { expression: 'neutral' });
      assert.notDeepEqual(rest, neutral, name);
    }
    hashes.add(pixels(tomas, posePreset('idle'), { expression: name, blink: false }, 0));
    assert.deepEqual(resolveFace(tomas, { expression: name, intensity: 0 }), resolveFace(tomas, { expression: 'neutral' }));
  }
  assert.equal(hashes.size, 14);
});
test('seeded blink starts are 2.5–5s apart and suppressed during surprise closeups', () => {
  const starts = []; let previous = 0;
  for (let t = 0; t < 40; t += .005) {
    const value = blinkAt(tomas, t);
    if (value > 0 && previous === 0) starts.push(t);
    previous = value;
    assert.equal(blinkAt(tomas, t, { expression: 'shock', closeUp: true, blink: 1 }), 0);
    assert.equal(blinkAt(tomas, t, { mix: { from: 'neutral', to: 'surprise', weight: .5 }, closeUp: true }), 0);
  }
  assert.ok(starts.length >= 8);
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 2.495 && starts[i] - starts[i - 1] <= 5.005);
  assert.notEqual(blinkAt(tomas, starts[0] + .07), blinkAt({ ...tomas, seed: 884 }, starts[0] + .07));
});
test('Spanish graphemes: vowels, accents, consonants and digraphs', () => {
  const cases = {
    'ÁÉÍÓÚ': ['A', 'E', 'I', 'O', 'U'], 'mamá': ['MBP', 'A', 'MBP', 'A'], 'bebé': ['MBP', 'E', 'MBP', 'E'],
    'papá': ['MBP', 'A', 'MBP', 'A'], 'fávola': ['FV', 'A', 'FV', 'O', 'L', 'A'],
    'lrdnt': ['L', 'L', 'L', 'L', 'L'], 'chilla': ['E', 'I', 'L', 'A'], 'perro': ['MBP', 'E', 'L', 'O'],
    'queso': ['X', 'E', 'X', 'O'], 'guitarra': ['X', 'I', 'L', 'A', 'L', 'A'],
    'guerra': ['X', 'E', 'L', 'A'], 'guapo': ['X', 'U', 'A', 'MBP', 'O'], 'pingüino': ['MBP', 'I', 'L', 'X', 'U', 'I', 'L', 'O'],
    'hola': ['O', 'L', 'A'], 'NIÑO': ['L', 'I', 'L', 'O'], '¡hoy!': ['O', 'I'], '': [], '123…': [],
  };
  for (const [word, expected] of Object.entries(cases)) assert.deepEqual(visemesForWord(word), expected, word);
  assert.deepEqual(visemesForWord('a\u0301rbol'), visemesForWord('árbol'));
});
test('viseme blend has continuous geometry and zero energy closes every mouth', () => {
  for (const from of VISEMES) for (const to of VISEMES) {
    const a = mouthShape({ viseme: { from, to, mix: .49999 } }), b = mouthShape({ viseme: { from, to, mix: .50001 } });
    for (const key of Object.keys(a)) assert.ok(Math.abs(a[key] - b[key]) < .0001);
    const closed = mouthShape({ viseme: from, open: 0 });
    assert.equal(closed.h, 0); assert.equal(closed.teeth, 0); assert.equal(closed.tongue, 0);
  }
});
test('springs and secondary hair response are analytic and seekable', () => {
  for (const damping of [.2, 1, 2]) {
    assert.equal(spring(0, { from: 2, to: 4, damping }), 2);
    assert.ok(Math.abs(spring(20, { from: 2, to: 4, damping }) - 4) < 1e-6);
  }
  assert.notEqual(springSine(.1), Math.sin(.1 * Math.PI * 2));
  const pose = { secondary: { at: 1, amplitude: .4 } };
  assert.equal(hairLag(tomas, pose, .5), 0);
  const first = hairLag(tomas, pose, 1.3); hairLag(tomas, pose, 20);
  assert.equal(hairLag(tomas, pose, 1.3), first);
});
test('character schema validates all cards and rejects missing/unknown/out-of-range data', () => {
  for (const c of characters) assert.ok(validateCharacter(c));
  for (const bad of [{ ...tomas, height: 4 }, { ...tomas, typo: true }, { ...tomas, voice: '' },
    { ...tomas, hair: { ...tomas.hair, style: 'invalid' } }, { ...tomas, ink: { width: -.01 } }]) assert.equal(validateCharacter(bad), false);
  const missing = { ...tomas }; delete missing.seed; assert.equal(validateCharacter(missing), false);
});
test('catalog covers every implemented character/expression/viseme/hand/hair/outfit', async () => {
  const catalog = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url), 'utf8'));
  const expected = { characters: characters.map(c => c.id), expressions: Object.keys(EXPRESSIONS), visemes: VISEMES,
    hands: ['open', 'fist', 'point', 'thumb', 'hold', 'wave', 'flat', 'two', 'three'], hair: ['spiky', 'ponytail', 'curly', 'buzz'],
    outfits: ['tshirt', 'hoodie', 'dress', 'skirt', 'pants', 'apron'] };
  for (const [category, names] of Object.entries(expected)) {
    assert.deepEqual(catalog[category].map(e => e.name).sort(), [...names].sort());
    for (const entry of catalog[category]) {
      for (const key of ['name', 'summary', 'params', 'file', 'demo', 'used_by']) assert.ok(key in entry, `${category}/${entry.name}/${key}`);
      await readFile(new URL(`../${entry.file}`, import.meta.url));
    }
  }
});
