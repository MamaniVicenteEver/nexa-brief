/** Small Canvas 2D vocabulary; no Path2D, DOM, assets or renderer globals. */
export function path(ctx, commands, fill, stroke, width) {
  ctx.beginPath();
  for (const [command, ...p] of commands) {
    if (command === 'M') ctx.moveTo(...p);
    else if (command === 'L') ctx.lineTo(...p);
    else if (command === 'C') ctx.bezierCurveTo(...p);
    else if (command === 'Q') ctx.quadraticCurveTo(...p);
    else if (command === 'Z') ctx.closePath();
  }
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; if (width !== undefined) ctx.lineWidth = width; ctx.stroke(); }
}
export function ellipse(ctx, x, y, rx, ry, fill, stroke, width, angle = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(1e-7, rx), Math.max(1e-7, ry), angle, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; if (width !== undefined) ctx.lineWidth = width; ctx.stroke(); }
}
export function line(ctx, points, color, width) {
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (const p of points.slice(1)) ctx.lineTo(...p);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
