import {mkdtemp, rm, readFile, copyFile, mkdir, stat} from 'node:fs/promises';
import {join, dirname, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {ROOT, ID, json, hash, fileHash, resourcePaths, clipPath, save, exists} from './production-common.mjs';

function spokenIds(episode) {
  const ids = new Set();
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.say === 'string') ids.add(value.say);
    if (value.action === 'talk' && typeof value.line === 'string') ids.add(value.line);
    for (const child of Object.values(value)) walk(child);
  }
  walk(episode.scenes);
  return ids;
}
export async function snapshot(file, root = ROOT) {
  const bytes = await readFile(file), episode = JSON.parse(bytes);
  if (!ID.test(episode.id)) throw new Error('episode.id debe ser kebab-case para nombrar los resultados.');
  const paths = resourcePaths(file, episode);
  const timingHash = await fileHash(paths.timing);
  const timing = timingHash ? await json(paths.timing) : {version: 1, fps: 30, lines: {}};
  const scripts = new Map();
  for (const line of episode.script ?? []) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(line.id) || scripts.has(line.id)) throw new Error('IDs de guion inválidos o duplicados.');
    scripts.set(line.id, line);
  }
  const ids = new Set([...scripts.keys(), ...spokenIds(episode)]), clips = {}, profiles = {}, missing = [];
  for (const id of ids) {
    const line = timing.lines?.[id], script = scripts.get(id);
    const clip = clipPath(paths.audioBase, line?.clip);
    clips[id] = clip ? await fileHash(clip) : null;
    let reason;
    if (timing.provisional || line?.provisional) reason = 'timing provisional';
    else if (!line) reason = 'falta timing';
    else if (!clips[id] || !(await stat(clip)).size) reason = 'falta clip';
    else if (!(line.dur > 0) || !line.words?.length || line.qc?.ok === false) reason = 'timing o QC incompleto';
    else if (script && (line.speaker !== script.who || line.text !== script.text)) reason = 'guion distinto del audio';
    const who = script?.who ?? line?.speaker;
    if (who && ID.test(who)) {
      const profileFile = join(root, 'voices', who + '.json');
      profiles[who] = await fileHash(profileFile);
      // Sidecars de voice.mjs: si existen, conservan la identidad y el hash del WAV.
      if (clip?.endsWith('.wav') && await exists(clip.replace(/\.wav$/, '.json'))) {
        const sidecar = await json(clip.replace(/\.wav$/, '.json'));
        if (sidecar.wav_sha256 && sidecar.wav_sha256 !== clips[id]) reason = 'clip cambiado desde su QC';
        if (script && sidecar.emotion != null && sidecar.emotion !== script.emotion) reason = 'emoción distinta del audio';
        if (sidecar.profile && profiles[who] && hash(JSON.stringify(sidecar.profile)) !== hash(JSON.stringify(await json(profileFile)))) reason = 'perfil de voz cambiado';
      }
    }
    if (reason) missing.push({id, reason, generatable: !!script});
  }
  const ambient = paths.ambient ? await fileHash(paths.ambient) : null;
  return {episode, paths, timing, missing, clips, episode_hash: hash(bytes),
    hash: hash(JSON.stringify({version: 1, episode: hash(bytes), timing: timingHash, clips, profiles, ambient}))};
}

/** Solo datos de diseño. Ningún WAV, clip ni timing se escribe en assets/. */
export async function provisionalEpisode(file, state) {
  const temporary = await mkdtemp(join(tmpdir(), 'vida-produce-design-'));
  try {
    const lines = {};
    for (const line of state.episode.script ?? []) {
      const words = line.text.trim().split(/\s+/u).filter(Boolean);
      if (!words.length) throw new Error(`${line.id}: texto vacío.`);
      const wordSeconds = 60 / 150, lead = .15, tail = .2;
      lines[line.id] = {speaker: line.who, text: line.text, emotion: line.emotion, provisional: true,
        dur: lead + words.length * wordSeconds + tail,
        words: words.map((w, i) => ({w, s: lead + i * wordSeconds, e: lead + (i + 1) * wordSeconds - .03})),
        rms: [], rmsHz: 100,
        // loadEpisode solo comprueba existencia en revisión; este JSON NO es audio.
        clip: file};
    }
    for (const id of spokenIds(state.episode)) if (!lines[id]) throw new Error(`${id}: falta texto en script para estimar timing provisional.`);
    const timingFile = join(temporary, 'timing.provisional.json');
    await save(timingFile, {version: 1, fps: 30, provisional: true, method: 'texto a 150 palabras/minuto; SIN AUDIO', lines});
    const episode = structuredClone(state.episode);
    episode.resources = {...episode.resources, timing: timingFile, audioBase: state.paths.audioBase,
      dialogue: state.paths.dialogue, ...(state.paths.ambient ? {ambient: state.paths.ambient} : {})};
    const episodeFile = join(temporary, 'episode.json');
    await save(episodeFile, episode);
    return {episodeFile, timingFile, cleanup: () => rm(temporary, {recursive: true, force: true})};
  } catch (error) { await rm(temporary, {recursive: true, force: true}); throw error; }
}

/** voice.mjs siempre lee assets/episode.json; staging permite también rutas alternativas. */
export async function generateMissingVoice(file, state, invoke) {
  const missing = state.missing;
  if (missing.some(l => !l.generatable)) throw new Error('Falta guion para generar las líneas: ' + missing.filter(l => !l.generatable).map(l => l.id).join(', '));
  const temporary = await mkdtemp(join(tmpdir(), 'vida-produce-voice-'));
  const assets = join(temporary, 'assets'), ids = new Set(missing.map(l => l.id));
  let failure;
  try {
    await save(join(assets, 'episode.json'), {...state.episode, script: state.episode.script.filter(l => ids.has(l.id))});
    try { await invoke(temporary, [...ids]); } catch (error) { failure = error; }
    const generatedTiming = await exists(join(assets, 'timing.json')) ? await json(join(assets, 'timing.json')) : null;
    if (generatedTiming && !generatedTiming.provisional) {
      const timing = structuredClone(state.timing);
      delete timing.provisional;
      timing.lines ??= {};
      for (const id of ids) {
        const line = generatedTiming.lines?.[id];
        if (!line || line.qc?.ok !== true || line.provisional) continue;
        const relative = `audio/lines/${id}.wav`, clip = resolve(state.paths.audioBase, relative);
        const source = join(assets, relative);
        if (!await exists(source)) continue;
        await mkdir(dirname(clip), {recursive: true});
        await copyFile(source, clip);
        if (await exists(source.replace(/\.wav$/, '.json'))) await copyFile(source.replace(/\.wav$/, '.json'), clip.replace(/\.wav$/, '.json'));
        timing.lines[id] = {...line, clip: relative};
      }
      await save(state.paths.timing, timing);
    }
    if (failure) throw failure;
  } finally { await rm(temporary, {recursive: true, force: true}); }
}
