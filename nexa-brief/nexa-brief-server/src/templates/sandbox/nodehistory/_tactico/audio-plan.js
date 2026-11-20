// Plan compartido por WebAudio y ffmpeg. No requiere DOM ni prepara gráficos.
import {Tactico, loadComponents, resolveScene} from './core.js';
import {timerFromWords} from './tools/anchors.js';
export const dbGain = db => 10 ** (db / 20);
const finite = (v, name) => { if (!Number.isFinite(v)) throw Error(`Audio: ${name} no es finito`); return v; };
export function speechRanges(lyrics = {}, duration = Infinity) {
  const ranges = (lyrics.segments || []).flatMap(s => s.words?.length ? s.words : [s])
    .filter(w => Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start)
    .map(w => [Math.max(0, w.start), Math.min(duration, w.end)])
    .filter(([s,e]) => e > s).sort((a,b) => a[0]-b[0]);
  const merged = [];
  for (const r of ranges) { const last = merged.at(-1); if (last && r[0] <= last[1] + .18) last[1] = Math.max(last[1],r[1]); else merged.push([...r]); }
  return merged;
}
export function duckGain(t, ranges, db = -9) {
  const low = dbGain(db);
  for (const [s,e] of ranges) {
    if (t >= s && t <= e) return low;
    if (t >= s-.02 && t < s) return 1 + (low-1)*(t-s+.02)/.02;
    if (t > e && t < e+.08) return low + (1-low)*(t-e)/.08;
  }
  return 1;
}
export function cueGain(cue, t) {
  const elapsed = t-cue.at, remaining = cue.at+cue.dur-t;
  if (elapsed < 0 || remaining <= 0) return 0;
  return dbGain(cue.gain_db) * Math.min(1, cue.fade_in ? elapsed/cue.fade_in : 1, cue.fade_out ? remaining/cue.fade_out : 1);
}
export async function collectCues(scene, {T, lyrics = {}, derived} = {}) {
  if (derived) return structuredClone(derived); // c.tactico.sfx() ya incluye sound.cues: no duplicar.
  if ((scene.items || []).some(i => i.sfx !== false)) await loadComponents();
  T ||= timerFromWords((lyrics.segments || []).flatMap(s => s.words || []));
  const errors = [], resolved = resolveScene(scene, {T, errors});
  if (errors.length) throw Error(errors.map(e => `${e.path}: ${e.message}`).join('\n'));
  const ctx = {scene:resolved, T, place:ref => Array.isArray(ref) ? ref : resolved.places?.[ref]};
  const cues = [];
  for (const raw of resolved.items || []) {
    if (raw.sfx === false) continue;
    const def = Tactico.get(raw.type);
    if (!def) throw Error(`Audio: componente desconocido ${raw.type}`);
    const defaults = Object.fromEntries(Object.entries(def.params).filter(([,v]) => v.default !== undefined).map(([k,v]) => [k,structuredClone(v.default)]));
    const item = {...defaults,...raw};
    const own = item.sfx == null ? def.sfx?.(item,ctx) || [] : Array.isArray(item.sfx) ? item.sfx : [item.sfx];
    for (const v of own) { const c = typeof v === 'string' ? {sfx:v} : v; cues.push({...c, at:T(c.at,item.t ?? 0), dur:T(c.dur,item.dur ?? 0),item:item.id}); }
  }
  cues.push(...(resolved.sound?.cues || []));
  return cues.sort((a,b) => a.at-b.at);
}
export function normalizeCues(cues, catalog, duration) {
  finite(duration,'duration');
  const sounds = new Map(catalog.sounds.map(s => [s.id,s]));
  return cues.map((raw,index) => {
    const requested = raw.sfx, id = catalog.aliases?.[requested] || requested, sound = sounds.get(id);
    if (!sound) throw Error(`Audio: SFX desconocido ${requested}`);
    const cue = {...sound,...raw,sfx:id,requested_sfx:requested,cue_id:`cue-${index}`,at:finite(raw.at ?? 0,'at')};
    cue.source_in = finite(cue.source_in ?? 0,'source_in');
    if (cue.at < 0 || cue.source_in < 0 || cue.source_in >= sound.duration) throw Error(`Audio: tiempo fuera de rango ${requested}`);
    cue.loop = Boolean(cue.loop);
    cue.dur = finite(raw.dur ?? sound.duration-cue.source_in,'dur');
    if (cue.dur < 0) throw Error(`Audio: duración negativa ${requested}`);
    cue.dur = Math.max(0, Math.min(cue.dur,duration-cue.at,cue.loop ? Infinity : sound.duration-cue.source_in));
    for (const k of ['gain_db','fade_in','fade_out']) finite(cue[k] ?? 0,k);
    if (cue.fade_in < 0 || cue.fade_out < 0) throw Error('Audio: fade negativo');
    cue.fade_in = Math.min(cue.fade_in,cue.dur/2); cue.fade_out = Math.min(cue.fade_out,cue.dur/2);
    return cue;
  }).filter(c => c.dur > 0).sort((a,b) => a.at-b.at);
}
export async function makePlan(scene, catalog, options = {}) {
  const duration = options.duration ?? scene.duration ?? scene.end;
  return {version:1,duration,duck_db:-9,speech_ranges:speechRanges(options.lyrics,duration),
    cues:normalizeCues(await collectCues(scene,options),catalog,duration)};
}
