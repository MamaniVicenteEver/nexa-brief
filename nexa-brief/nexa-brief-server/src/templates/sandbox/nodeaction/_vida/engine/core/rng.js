export function hashSeed(value) {
  if (typeof value === 'number') return value >>> 0;
  let h = 2166136261;
  for (const c of String(value)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return h >>> 0;
}
export function mulberry32(seed) {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
/** Independent stream for each character + purpose; reconstructed on every evaluation. */
export const characterRng = (character, purpose = '') => mulberry32(hashSeed(`${character.seed}:${character.id}:${purpose}`));
