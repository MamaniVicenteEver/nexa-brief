import { resolveSkeleton } from './rig/skeleton.js';
import { drawRig } from './rig/draw.js';

/** Pure frame draw. ctx is the only mutated argument. Returns world interaction anchors. */
export function drawCharacter(ctx, character, pose = {}, faceState = {}, t = 0) {
  if (!Number.isFinite(t)) throw new RangeError('t must be finite seconds');
  const rig = resolveSkeleton(character, pose);
  drawRig(ctx, character, rig, faceState, t);
  return rig.anchors;
}
export { resolveSkeleton, solveIK, createPose, blendPose, posePreset, gaitPose, VIEWS, HANDS, BODY_POSES, viewValue, blendView } from './rig/skeleton.js';
export { EXPRESSIONS, resolveFace, blendFace, blinkAt, faceLayout } from './face/face.js';
export { VISEMES, visemesForWord, mouthShape, mixMouth } from './face/mouth.js';
export { HAIR, hairLag } from './rig/hair.js';
export { OUTFITS } from './rig/draw.js';
