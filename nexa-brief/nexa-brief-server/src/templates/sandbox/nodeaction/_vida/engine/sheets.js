import { drawCharacter, posePreset, VIEWS, EXPRESSIONS, VISEMES, HANDS, BODY_POSES } from './index.js';
import { drawHand } from './rig/hands.js';

export const SHEET_WIDTH = 7560, ROW_HEIGHT = 1080, SHEET_HEIGHT = ROW_HEIGHT * 7;
export const SHEET_ROWS = [
  { title: '01 / VISTAS', items: Object.keys(VIEWS), type: 'views' },
  { title: '02 / EXPRESIONES · 1–7', items: Object.keys(EXPRESSIONS).slice(0, 7), type: 'expressions' },
  { title: '03 / EXPRESIONES · 8–14', items: Object.keys(EXPRESSIONS).slice(7), type: 'expressions' },
  { title: '04 / BOCA · 9 VISEMAS + TRANSICIÓN', items: [...VISEMES, 'A → O · 50 %'], type: 'visemes' },
  { title: '05 / MANOS · SILUETAS', items: HANDS, type: 'hands' },
  { title: '06 / CUERPO · OBJETIVOS + IK', items: BODY_POSES, type: 'body' },
  { title: '07 / GIRO CONTINUO · FRONT → SIDE-RIGHT', items: Array.from({ length: 8 }, (_, i) => i / 7), type: 'turn' },
];
const bg = '#faf8f2', dark = '#23232c', muted = '#77766f';
function text(ctx, content, x, y, size = 30, color = dark, weight = 400) {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px sans-serif`; ctx.fillText(content, x, y);
}

export function drawSheetRow(ctx, character, rowIndex, y = 0) {
  const row = SHEET_ROWS[rowIndex], cw = SHEET_WIDTH / row.items.length;
  ctx.save(); ctx.translate(0, y); ctx.fillStyle = bg; ctx.fillRect(0, 0, SHEET_WIDTH, ROW_HEIGHT);
  text(ctx, row.title, 60, 68, 32, dark, 700);
  ctx.textAlign = 'right'; text(ctx, `${character.name}  /  VIDA EN ESCENA`, SHEET_WIDTH - 60, 68, 30, muted); ctx.textAlign = 'left';
  for (const [i, item] of row.items.entries()) {
    ctx.save(); ctx.beginPath(); ctx.rect(i * cw, 100, cw, 915); ctx.clip();
    const x = (i + .5) * cw;
    let pose = posePreset('idle', { x, y: 945, scale: 735 }), face = { blink: false };
    if (row.type === 'views') pose.view = item;
    if (row.type === 'turn') pose.view = item;
    if (row.type === 'expressions' || row.type === 'visemes') {
      const scale = Math.min(1740, (cw - 100) / .40 / character.height);
      pose = posePreset('idle', { x, y: 530 + .796 * scale * character.height, scale });
      if (row.type === 'expressions') face.expression = item;
      else { face.expression = 'neutral'; face.viseme = i < VISEMES.length ? item : { from: 'A', to: 'O', mix: .5 }; face.open = 1; }
    }
    if (row.type === 'body') pose = posePreset(item, { x, y: 945, scale: 735 });
    if (row.type === 'hands') {
      pose = posePreset('wave', { x: x - 85, y: 945, scale: 710, handShapes: { right: item } });
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      drawHand(ctx, [x + 290, 650], .10, item, character.ink?.color ?? dark, 95); ctx.restore();
    }
    if (!['expressions', 'visemes'].includes(row.type)) {
      ctx.strokeStyle = '#dedbd2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 210, 950); ctx.lineTo(x + 210, 950); ctx.stroke();
    }
    drawCharacter(ctx, character, pose, face, .8); ctx.restore();
    ctx.textAlign = 'center';
    text(ctx, typeof item === 'number' ? `${(item * 90).toFixed(1)}°` : item, x, 1032, 31, muted);
    ctx.textAlign = 'left';
    if (i > 0) { ctx.fillStyle = '#e6e2d8'; ctx.fillRect(i * cw, 145, 1, 805); }
  }
  ctx.fillStyle = '#d6d1c5'; ctx.fillRect(0, ROW_HEIGHT - 2, SHEET_WIDTH, 2); ctx.restore();
}
export function drawCharacterSheet(ctx, character) {
  for (let i = 0; i < SHEET_ROWS.length; i++) drawSheetRow(ctx, character, i, i * ROW_HEIGHT);
}
export function drawGroupSheet(ctx, characters, width = 3840, height = 2160) {
  ctx.save(); ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  text(ctx, 'VIDA EN ESCENA', 150, 160, 70, dark, 700);
  text(ctx, 'Personajes / tinta, silueta y alturas relativas', 150, 232, 32, muted);
  const ordered = ['tomas', 'nico', 'valeria', 'mama'].map(id => characters.find(c => c.id === id)).filter(Boolean);
  const floor = height - 265, scale = 1200;
  ctx.strokeStyle = '#dcd7cb'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(145, floor + 4); ctx.lineTo(width - 145, floor + 4); ctx.stroke();
  for (let i = 0; i < ordered.length; i++) {
    const c = ordered[i], x = (i + .5) * width / ordered.length;
    const pose = posePreset(['hands-hips', 'wave', 'idle', 'open-arms'][i], { x, y: floor, scale, view: ['front', '3q-left', '3q-right', 'front'][i] });
    drawCharacter(ctx, c, pose, { blink: false }, .8);
    ctx.textAlign = 'center'; text(ctx, c.name, x, floor + 100, 51, dark, 700);
    text(ctx, `${c.id}  ·  altura ${c.height.toFixed(2)}`, x, floor + 151, 29, muted); ctx.textAlign = 'left';
  }
  ctx.restore();
}
