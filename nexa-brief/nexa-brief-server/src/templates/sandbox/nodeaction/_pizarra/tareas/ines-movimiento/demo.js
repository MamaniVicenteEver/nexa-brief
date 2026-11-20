import { createInesRig } from "./ines-rig.js";

const params = new URLSearchParams(location.search);
const rig = createInesRig(document.querySelector("#character"), {
  glasses: params.get("lentes") === "si",
});
const fixedTime = params.has("t") && Number.isFinite(Number(params.get("t")))
  ? Number(params.get("t")) : null;

// A reusable pose is just joint angles. No image is loaded for any movement.
const KEYFRAMES = [
  { at: 0,    pose: {} },
  { at: 1.55, pose: {} },
  { at: 2.4,  pose: { armRightUpper: -58, armRightFore: -85, head: 4, wave: 1 } },
  { at: 4.1,  pose: { armRightUpper: -58, armRightFore: -85, head: 4, wave: 1 } },
  { at: 4.85, pose: {} },
  { at: 5.55, pose: { armRightUpper: -34, armRightFore: -64, handRight: -16, head: -3 } },
  { at: 7.85, pose: { armRightUpper: -34, armRightFore: -64, handRight: -16, head: -3 } },
  { at: 8.55, pose: {} },
  { at: 9.25, pose: { armLeftUpper: 9, armLeftFore: 8, armRightUpper: -14, armRightFore: -8, talk: 1 } },
  { at: 11.35,pose: { armLeftUpper: 9, armLeftFore: 8, armRightUpper: -14, armRightFore: -8, talk: 1 } },
  { at: 12.05,pose: {} },
  { at: 12.7, pose: { armLeftUpper: 22, armLeftFore: 16, armRightUpper: -22, armRightFore: -16, head: 3 } },
  { at: 14.15,pose: { armLeftUpper: 22, armLeftFore: 16, armRightUpper: -22, armRightFore: -16, head: 3 } },
  { at: 14.8, pose: {} },
  { at: 16,   pose: {} },
];
const DURATION = 16;
const JOINTS = ["armRightUpper", "armRightFore", "handRight", "armLeftUpper", "armLeftFore", "handLeft", "legLeft", "legRight", "footLeft", "footRight", "head", "lean", "yaw", "x", "y", "wave", "talk"];
const smooth = u => u * u * (3 - 2 * u);
const lerp = (a, b, u) => a + (b - a) * u;

function poseAt(seconds) {
  const t = ((seconds % DURATION) + DURATION) % DURATION;
  let i = 0;
  while (i < KEYFRAMES.length - 2 && t >= KEYFRAMES[i + 1].at) i++;
  const a = KEYFRAMES[i], b = KEYFRAMES[i + 1];
  const u = smooth((t - a.at) / (b.at - a.at));
  const pose = Object.fromEntries(JOINTS.map(key => [key, lerp(a.pose[key] || 0, b.pose[key] || 0, u)]));

  pose.handRight += Math.sin(t * 10) * 13 * pose.wave;
  pose.head += Math.sin(t * 1.5) * 1.5;
  pose.lean += Math.sin(t * 1.2) * 0.7;
  pose.yaw += Math.sin(t * 1.1) * 2.2;
  pose.y += Math.sin(t * 2.5) * 2.8;
  pose.footLeft = -pose.legLeft * 0.7;
  pose.footRight = -pose.legRight * 0.7;
  pose.talk = pose.talk * (0.55 + 0.45 * Math.sin(t * 13));
  const blinkPhase = (t + 0.3) % 3.8;
  pose.blink = blinkPhase < 0.16 ? Math.sin((blinkPhase / 0.16) * Math.PI) : 0;
  return pose;
}

let started = 0;
let heldTime = fixedTime;
function render(t) { rig.setPose(poseAt(t)); }
function frame(now) {
  if (!started) started = now;
  render(heldTime ?? (now - started) / 1000);
  if (heldTime === null) requestAnimationFrame(frame);
}

window.InesRig = rig;
window.InesDemo = {
  seek(t) { heldTime = t; render(t); },
  play() { heldTime = null; started = performance.now(); requestAnimationFrame(frame); },
  poseAt,
};
requestAnimationFrame(frame);
