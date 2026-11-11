/* Ajuste de párrafos compartido por tarjetas y HUD. */
export function wrapText(text, maxWidth, measure, maxLines = 4) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean), lines = [];
  for (const word of words) {
    let rest = word;
    while (rest) {
      const last = lines.length - 1;
      if (last >= 0 && measure(lines[last] + ' ' + rest) <= maxWidth) { lines[last] += ' ' + rest; break; }
      if (lines.length >= maxLines) { let s = lines[maxLines - 1]; while (s && measure(s + '…') > maxWidth) s = s.slice(0, -1); lines[maxLines - 1] = s + '…'; return lines; }
      let n = rest.length; while (n > 1 && measure(rest.slice(0, n)) > maxWidth) n--;
      lines.push(rest.slice(0, n)); rest = rest.slice(n);
    }
  }
  return lines;
}
