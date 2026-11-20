import { add, sub, mul, rotate, clamp, lerp, mixPoint, smoothstep, TAU } from '../core/math.js';

export const VIEWS = Object.freeze({ front: 0, '3q-left': -.5, '3q-right': .5, 'side-left': -1, 'side-right': 1 });
export const HANDS = Object.freeze(['open', 'fist', 'point', 'thumb', 'hold', 'wave', 'flat', 'two', 'three']);
export const BODY_POSES = Object.freeze(['open-arms', 'point', 'hands-hips', 'cross-arms', 'hands-face', 'wave']);
export const viewValue = v => clamp(typeof v === 'number' ? v : (VIEWS[v] ?? 0), -1, 1);
export const blendView = (a, b, t) => lerp(viewValue(a), viewValue(b), clamp(t));

/** Lowest painted garment point, including ink, in the hip's rotated frame. */
export function pelvisBottom(character, view = 'front', lean = 0) {
  const style = character.outfit?.style, ink = character.ink?.width ?? .012;
  const width = .085 * (.56 + .44 * Math.cos(viewValue(view) * Math.PI / 2)) * (character.body?.width ?? 1);
  const hem = style === 'dress' ? .065 : .025;
  const curves = [[width * (style === 'dress' ? 1.48 : 1.08), hem - .018, hem + .025, ink]];
  if (style === 'apron') curves.push([width * .84, .035, .062, ink * .75, viewValue(view) * width * .22]);
  if (style === 'skirt') curves.push([width * 1.42, .085, .11, ink]);
  return Math.max(...curves.map(([w, end, control, stroke, cx = 0]) => {
    const a = rotate([cx-w, end], lean)[1], b = rotate([cx, control], lean)[1], c = rotate([cx+w, end], lean)[1];
    const u = clamp((a - b) / (a - 2 * b + c));
    return Math.max(a, c, (1-u)**2*a + 2*u*(1-u)*b + u*u*c) + stroke/2;
  }));
}

/** Two bones; bend is the signed cross product, or a preferred elbow/knee vector. */
export function solveIK(origin, target, upper, lower, bend = 1) {
  if (!(upper > 0 && lower > 0)) throw new RangeError('IK bone lengths must be positive');
  const dx = target[0] - origin[0], dy = target[1] - origin[1], requested = Math.hypot(dx, dy);
  const u = requested > 1e-12 ? [dx / requested, dy / requested] : [0, 1];
  const d = clamp(requested, Math.abs(upper - lower) + 1e-10, upper + lower);
  const along = (upper * upper - lower * lower + d * d) / (2 * d);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  const normal = [-u[1], u[0]];
  const sign = Array.isArray(bend) ? (normal[0] * bend[0] + normal[1] * bend[1] >= 0 ? 1 : -1) : (bend >= 0 ? 1 : -1);
  const joint = add(origin, add(mul(u, along), mul(normal, sign * height)));
  const end = add(origin, mul(u, d));
  return { origin: [...origin], joint, end, target: [...target], reachable: Math.abs(d - requested) < 1e-8, error: Math.abs(d - requested) };
}

export function createPose(p = {}) {
  return {
    x: 0, y: 0, scale: 800, rootY: -.348, sitting: 0, seatLevel: 0, lean: 0, headTurn: 0, headTilt: 0, view: 'front',
    feet: { left: [-.065, 0], right: [.065, 0], ...p.feet },
    footAngles: {left:0,right:0,...p.footAngles},
    hands: { left: [-.025, .279], right: [.025, .279], ...p.hands },
    elbows: { left: 1, right: -1, ...p.elbows },
    knees: { left: 1, right: -1, ...p.knees },
    handShapes: { left: 'open', right: 'open', ...p.handShapes },
    handAngles: { left: null, right: null, ...p.handAngles },
    armLayer: { left: 0, right: 0, ...p.armLayer },
    ...Object.fromEntries(Object.entries(p).filter(([k]) => !['feet', 'footAngles', 'hands', 'elbows', 'knees', 'handShapes', 'handAngles', 'armLayer'].includes(k))),
  };
}

/** Weights can address a whole channel or a single limb: {'hands.left': .8}. */
export function blendPose(a, b, weight = .5, channels = {}) {
  a = createPose(a); b = createPose(b);
  function mix(x, y, path) {
    const w = clamp(channels[path] ?? channels[path.split('.')[0]] ?? weight);
    if (path === 'view') return blendView(x, y, w);
    if (Array.isArray(x)) return mixPoint(x, y, w);
    if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).map(k => [k, mix(x[k], y[k], path ? `${path}.${k}` : k)]));
    if (typeof x === 'number' && typeof y === 'number') return lerp(x, y, w);
    // Shapes and explicit depth choices are categorical. Geometry stays continuous.
    return w < .5 ? x : y;
  }
  const result = mix(a, b, '');
  for (const side of ['left', 'right']) {
    const handWeight = clamp(channels[`hands.${side}`] ?? channels.hands ?? weight);
    const elbowWeight = clamp(channels[`elbows.${side}`] ?? channels.elbows ?? weight);
    // A two-bone chain can change branch continuously only through full extension.
    // Open its target smoothly before the sign changes; bone lengths remain constant.
    if (typeof a.elbows[side] === 'number' && typeof b.elbows[side] === 'number' && a.elbows[side] * b.elbows[side] < 0
      && handWeight === elbowWeight && handWeight > 0 && handWeight < 1) {
      const v = result.hands[side], length = Math.hypot(...v);
      const direction = length > 1e-8 ? mul(v, 1 / length) : [side === 'left' ? -1 : 1, 0];
      const reach = lerp(length, .146 + .143, Math.sin(Math.PI * handWeight) ** 4);
      result.hands[side] = mul(direction, reach);
    }
  }
  return result;
}

export function posePreset(name = 'idle', overrides = {}) {
  const presets = {
    idle: {},
    'open-arms': { hands: { left: [-.235, -.025], right: [.235, -.025] }, elbows: { left: -1, right: 1 }, handAngles: { left: -.8, right: .8 } },
    point: { hands: { left: [-.008, .20], right: [.275, -.025] }, elbows: { right: 1 }, handShapes: { right: 'point' }, handAngles: { right: Math.PI / 2 } },
    'hands-hips': { hands: { left: [-.006, .19], right: [.006, .19] }, handShapes: { left: 'flat', right: 'flat' }, handAngles: { left: -1.2, right: 1.2 } },
    'cross-arms': { hands: { left: [.13, .095], right: [-.135, .075] }, handShapes: { left: 'hold', right: 'hold' }, armLayer: { left: 1, right: 1 }, handAngles: { left: 1.5, right: -1.5 } },
    'hands-face': { hands: { left: [-.045, -.10], right: [.045, -.10] }, elbows: { left: -1, right: 1 }, handShapes: { left: 'wave', right: 'wave' }, armLayer: { left: 2, right: 2 }, handAngles: { left: -.25, right: .25 } },
    wave: { hands: { left: [-.008, .22], right: [.155, -.15] }, elbows: { right: 1 }, handShapes: { right: 'wave' }, handAngles: { right: .20 } },
  };
  const result = createPose(presets[name] ?? presets.idle);
  for (const [k, v] of Object.entries(overrides)) result[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...result[k], ...v } : v;
  return result;
}

/** Phase uses traveled distance, never wall time. Stance x + distance is constant. */
export function gaitPose(distance, { stride = .43, stance = .58, lift = .045, direction = 1, ...overrides } = {}) {
  const phase = distance / stride;
  const foot = offset => {
    const p = ((phase + offset) % 1 + 1) % 1, half = stance * stride / 2;
    if (p < stance) return [direction * (half - p * stride), 0];
    const u = (p - stance) / (1 - stance);
    return [direction * lerp(-half, half, smoothstep(u)), -lift * Math.sin(Math.PI * u)];
  };
  const swing = Math.cos(TAU * phase) * .09 * direction;
  return createPose({ rootY: -.305 + .004 * Math.cos(TAU * phase * 2), lean: .035 * direction,
    knees: {left:-direction,right:-direction}, feet: { left: foot(0), right: foot(.5) }, hands: { left: [swing, .23], right: [-swing, .23] }, ...overrides });
}

export function resolveSkeleton(character, pose = {}) {
  const p = createPose(pose), yaw = viewValue(p.view), theta = yaw * Math.PI / 2;
  const width = .56 + .44 * Math.cos(theta), torsoWidth = character.body?.width ?? 1;
  const sitting = clamp(p.sitting), depth = pelvisBottom(character, p.view);
  const hip = [0, lerp(p.rootY, p.seatLevel - pelvisBottom(character, p.view, p.lean), sitting)], turn = point => add(hip, rotate(point, p.lean));
  const shoulderCenter = turn([0, -.262]), neck = turn([0, -.31]);
  const headAngle = p.headTilt + p.lean * .45;
  const head = add(neck, rotate([0, -.151], headAngle));
  const r = character.head?.radius ?? .166;
  const limbs = {};
  for (const [side, s] of [['left', -1], ['right', 1]]) {
    const shoulder = turn([s * .076 * width * torsoWidth, -.262]);
    let hipJoint = turn([s * .038 * width * torsoWidth, 0]);
    const handTarget = add(shoulder, p.hands[side]);
    // Ground-frame targets are never projected with the torso: a planted foot stays put during a turn.
    const footTarget = [p.feet[side][0], p.feet[side][1] - .022];
    let leg = solveIK(hipJoint, footTarget, .166, .163, p.knees[side]);
    if (sitting > 0) {
      // Project a bent thigh in depth. Frontal knees stay together; the tibia is vertical.
      // Torso gestures do not move the planted feet or the pelvis/seat contact.
      const seat = lerp(p.rootY + depth, p.seatLevel, sitting), origin = [s * .038 * width * torsoWidth, seat - .012];
      const kneeY = Math.max(origin[1] + .018, footTarget[1] - .163);
      const thighX = Math.sqrt(Math.max(0, .166**2 - (kneeY-origin[1])**2)) * Math.sin(theta);
      const knee = [origin[0] + thighX, kneeY], end = [knee[0], footTarget[1]];
      hipJoint = mixPoint(hipJoint, origin, sitting);
      leg = {...leg, origin:hipJoint, joint:mixPoint(leg.joint,knee,sitting), end:mixPoint(leg.end,end,sitting), projected:true};
    }
    limbs[side] = { shoulder, hip: hipJoint,
      arm: solveIK(shoulder, handTarget, .146, .143, p.elbows[side]),
      leg };
  }
  const scale = p.scale * (character.height ?? 1);
  const world = point => [p.x + point[0] * scale, p.y + point[1] * scale];
  const headYaw = clamp(yaw + p.headTurn, -1, 1);
  return { p, hip, shoulderCenter, neck, head, headAngle, headYaw,
    r, yaw, theta, width, torsoWidth, scale, limbs, world,
    anchors: { hip: world(hip), pelvisBottom:world([0,hip[1]+pelvisBottom(character,p.view,p.lean)]), head: world(head), neck: world(neck),
      mouth:world(add(head,rotate([Math.sin(headYaw*1.38)*.64*r,.43*r],headAngle))),
      leftHand: world(limbs.left.arm.end), rightHand: world(limbs.right.arm.end),
      leftFoot: world(add(limbs.left.leg.end, [0, .022])), rightFoot: world(add(limbs.right.leg.end, [0, .022])) } };
}
