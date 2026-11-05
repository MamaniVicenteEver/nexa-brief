import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, readFile, writeFile, readdir, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {newEpisode} from '../tools/new-episode.mjs';
import {produce, mixFailures, optionsFor} from '../tools/produce.mjs';
import {ROOT, json, save, exists, fileHash} from '../tools/production-common.mjs';
import {snapshot, generateMissingVoice, provisionalEpisode} from '../tools/production-timing.mjs';

const approvedReview = () => ({views: ['portrait', 'landscape'].map(view => ({view, passed: true, failed: []})), passed: true});
const approvedMix = () => ({lufs: -16, true_peak_db: -1.8, start_clicks: 0});
// Fixture WAV PCM 16 bits real, solo silencio; nunca se presenta como voz aprobada real.
function wav() {
  const length = 24000, b = Buffer.alloc(44 + length * 2);
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(24000, 24); b.writeUInt32LE(48000, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(length * 2, 40);
  return b;
}
async function fixture(t, {audio = true} = {}) {
  const parent = await mkdtemp(join(tmpdir(), 'vida-produce-test-pipeline-'));
  t.after(() => rm(parent, {recursive: true, force: true}));
  const scaffold = await newEpisode('agua-001', {title: 'Agua'}, {destinationRoot: parent});
  const file = join(scaffold.directory, 'assets/episode.json');
  const ep = await json(file);
  ep.scenes[0].steps = [{say: 'L01'}, {say: 'L02'}];
  await save(file, ep);
  if (audio) await audioFixture(file);
  return {file, directory: scaffold.directory, parent};
}
async function audioFixture(file) {
  const ep = await json(file), dir = join(file, '..'), lines = {};
  await mkdir(join(dir, 'audio/lines'), {recursive: true});
  for (const line of ep.script) {
    const words = line.text.split(/\s+/);
    lines[line.id] = {speaker: line.who, clip: `audio/lines/${line.id}.wav`, dur: 1, text: line.text,
      words: words.map((w, i) => ({w, s: i / words.length, e: (i + .8) / words.length})), rms: [], rmsHz: 100, qc: {ok: true}};
    await writeFile(join(dir, lines[line.id].clip), wav());
  }
  await save(join(dir, 'timing.json'), {version: 1, fps: 30, lines});
}
function double({calls = [], review = approvedReview(), mix = approvedMix(), voiceError, voiceNoOutput = false, delayRender = false} = {}) {
  return async (step, ctx) => {
    calls.push({step, view: ctx.view, provisional: ctx.provisional, nice: ctx.nice});
    if (step === 'voice') {
      if (voiceError) throw new Error(voiceError);
      if (!voiceNoOutput) await audioFixture(ctx.file);
      return {metrics: {fixture: true}, outputs: []};
    }
    if (step === 'render' && delayRender) await new Promise(r => setTimeout(r, 20));
    const name = `${step}${ctx.view ? '-' + ctx.view : ''}.fixture.json`;
    const artifact = join(ctx.outputDir, name);
    await save(artifact, {step, view: ctx.view, fixture: true});
    return {metrics: step === 'review' ? review : step === 'mix' ? mix : {passed: true}, outputs: [artifact]};
  };
}
test('encadena validate, review both, voz reutilizada, mix y renders secuenciales con nice', async t => {
  const {file} = await fixture(t), calls = [];
  const r = await produce(file, {views: 'portrait,landscape', nice: true}, {runStep: double({calls})});
  assert.equal(r.status, 'completed'); assert.equal(r.missing.length, 0);
  assert.deepEqual(calls.map(c => c.step), ['validate', 'review', 'mix', 'render', 'render']);
  assert.deepEqual(calls.filter(c => c.step === 'render').map(c => c.view), ['portrait', 'landscape']);
  assert.ok(calls.every(c => c.nice));
  assert.equal(r.steps.find(s => s.step === 'voice').status, 'reused');
  assert.equal(r.metrics.mix.start_clicks, 0); assert.deepEqual(r.metrics.review.landscape.failed, []);
  assert.equal((await json(r.report)).status, 'completed');
});
test('resume omite resultados idénticos, mantiene métricas y from exige antecedentes vigentes', async t => {
  const {file} = await fixture(t), calls = [], runStep = double({calls});
  await produce(file, {}, {runStep}); calls.length = 0;
  const resumed = await produce(file, {resume: true}, {runStep});
  assert.deepEqual(calls, []); assert.ok(resumed.steps.filter(s => s.step !== 'voice').every(s => s.status === 'cached'));
  assert.deepEqual(resumed.metrics.mix, approvedMix()); assert.deepEqual(resumed.metrics.review.portrait.failed, []);
  await produce(file, {from: 'mix', until: 'mix'}, {runStep});
  assert.deepEqual(calls.map(c => c.step), ['mix']);
  const ep = await json(file); ep.title += ' cambiado'; await save(file, ep);
  await assert.rejects(produce(file, {from: 'mix'}, {runStep}), /falta un resultado vigente/);
});
test('resume invalida por cambios de episodio, bytes de clip, timing y pérdida de artefactos', async t => {
  const {file} = await fixture(t), calls = [], runStep = double({calls});
  const first = await produce(file, {}, {runStep});
  for (const mutation of [
    async () => { const ep = await json(file); ep.title += '!'; await save(file, ep); },
    async () => { const clip = join(file, '../audio/lines/L01.wav'); const b = await readFile(clip); b[b.length - 1] = 1; await writeFile(clip, b); },
    async () => { const timing = await json(join(file, '../timing.json')); timing.lines.L01.dur += .01; await save(join(file, '../timing.json'), timing); }
  ]) {
    await mutation(); calls.length = 0;
    await produce(file, {resume: true}, {runStep});
    assert.deepEqual(calls.map(c => c.step), ['validate', 'review', 'mix', 'render']);
  }
  calls.length = 0;
  await rm(first.cache['render:portrait'].outputs[0].file);
  await produce(file, {resume: true}, {runStep}); assert.deepEqual(calls.map(c => c.step), ['render']);
});
test('dry-run no ejecuta, no crea render ni cambia assets y presenta las dos vistas', async t => {
  const {file, directory} = await fixture(t, {audio: false}), before = await readFile(file);
  const r = await produce(file, {'dry-run': true, views: 'portrait,landscape', nice: true}, {runStep: () => assert.fail('No debe ejecutarse')});
  assert.equal(r.dry_run, true); assert.equal(r.provisional, true);
  assert.equal(r.missing.length, 2); assert.equal(await exists(join(directory, 'render')), false);
  assert.deepEqual(await readFile(file), before);
  assert.deepEqual(r.steps.filter(s => s.step === 'render').map(s => s.view), ['portrait', 'landscape']);
  assert.ok(r.steps.find(s => s.view === 'landscape').args.some(a => a.endsWith('agua-001-16x9.mp4')));
  assert.equal(r.steps.find(s => s.view === 'portrait').command, 'nice');
});
test('provisional genera timing marcado en /tmp, no toca assets y elimina sus temporales', async t => {
  const {file, directory} = await fixture(t, {audio: false});
  const before = await fileHash(join(directory, 'assets/timing.json')), original = await fileHash(file);
  const actual = double(), calls = []; let temporaryFile;
  const runStep = async (step, ctx) => {
    calls.push(step); temporaryFile = ctx.file;
    assert.ok(ctx.file.startsWith(tmpdir())); assert.notEqual(ctx.file, file);
    const ep = await json(ctx.file), timing = await json(ep.resources.timing);
    assert.equal(timing.provisional, true); assert.match(timing.method, /SIN AUDIO/);
    assert.ok(Object.values(timing.lines).every(l => l.provisional && l.dur > 0 && l.words.length));
    return actual(step, ctx);
  };
  const r = await produce(file, {'provisional-timing': true}, {runStep});
  assert.equal(r.provisional, true); assert.deepEqual(calls, ['validate', 'review']);
  assert.equal(await exists(temporaryFile), false); assert.equal(await fileHash(file), original);
  assert.equal(await fileHash(join(directory, 'assets/timing.json')), before);
  assert.equal(await exists(join(directory, 'assets/audio')), false);
  for (const until of ['voice', 'mix', 'render']) await assert.rejects(produce(file, {'provisional-timing': true, until}), /solo permite validate\/review/);
});
test('faltante de voz: preflight, doble TTS, validación/review reales y reanudación sin TTS', async t => {
  const {file} = await fixture(t, {audio: false}), calls = [], runStep = double({calls});
  const r = await produce(file, {until: 'mix'}, {runStep});
  assert.equal(r.provisional, false); assert.equal(r.missing.length, 0);
  assert.deepEqual(calls.map(c => c.step), ['validate', 'review', 'voice', 'validate', 'review', 'mix']);
  assert.deepEqual(calls.slice(0, 2).map(c => c.provisional), [true, true]);
  assert.ok(calls.slice(3).every(c => !c.provisional));
  calls.length = 0; await produce(file, {until: 'mix', resume: true}, {runStep}); assert.deepEqual(calls, []);
});
test('cuota, clave ausente y voz incompleta detienen sin mix/render, informe y bloqueo liberado', async t => {
  for (const error of ['HTTP 402: saldo agotado', 'HTTP 429: cuota diaria', 'Sin clave Gemini']) {
    const {file} = await fixture(t, {audio: false}), calls = [];
    await assert.rejects(produce(file, {}, {runStep: double({calls, voiceError: error})}), /detenida por falta de voz/);
    const report = await json(join(file, '../../render/produce.json'));
    assert.equal(report.status, 'blocked'); assert.equal(report.missing.length, 2);
    assert.deepEqual(calls.map(c => c.step), ['validate', 'review', 'voice']);
    assert.equal(await exists(join(file, '../../render/.produce.lock')), false);
  }
  const {file} = await fixture(t, {audio: false});
  await assert.rejects(produce(file, {}, {runStep: double({voiceNoOutput: true})}), /Voz incompleta/);
});
test('una revisión fallida o incompleta en cualquier vista bloquea la mezcla y render', async t => {
  for (const view of ['portrait', 'landscape']) {
    const {file} = await fixture(t), calls = [], review = approvedReview();
    review.views.find(v => v.view === view).failed.push('actores_completos');
    await assert.rejects(produce(file, {}, {runStep: double({calls, review})}), /render bloqueado.*actores_completos/);
    assert.deepEqual(calls.map(c => c.step), ['validate', 'review']);
  }
  const {file} = await fixture(t);
  await assert.rejects(produce(file, {}, {runStep: double({review: {views: [{view: 'portrait', passed: true, failed: []}]}})}), /landscape.*incompleta/);
});
test('cada puerta de mezcla bloquea render; valores ausentes y no finitos también', async t => {
  for (const bad of [{start_clicks: 1}, {lufs: -15.49}, {lufs: -16.51}, {true_peak_db: -1.49}, {lufs: null}, {true_peak_db: NaN}]) {
    const {file} = await fixture(t), calls = [], mix = {...approvedMix(), ...bad};
    await assert.rejects(produce(file, {}, {runStep: double({calls, mix})}), /Mezcla no aprobada; render bloqueado/);
    assert.equal(calls.some(c => c.step === 'render'), false);
    assert.equal((await json(join(file, '../../render/produce.json'))).status, 'blocked');
  }
  assert.deepEqual(mixFailures({start_clicks: 0, lufs: -15.5, true_peak_db: -1.5}), []);
});
test('resume reevalúa una puerta fallida y no usa la mezcla aprobada de una ejecución anterior', async t => {
  const {file} = await fixture(t), calls = [];
  await produce(file, {}, {runStep: double()});
  const ep = await json(file); ep.title += '!'; await save(file, ep);
  await assert.rejects(produce(file, {resume: true}, {runStep: double({calls, mix: {...approvedMix(), start_clicks: 1}})}), /render bloqueado/);
  assert.equal(calls.some(c => c.step === 'render'), false);
});
test('una nueva falla con las MISMAS entradas elimina la aprobación anterior de la caché', async t => {
  const {file} = await fixture(t), calls = [];
  await produce(file, {}, {runStep: double()});
  await assert.rejects(produce(file, {}, {runStep: double({mix: {...approvedMix(), start_clicks: 1}})}), /render bloqueado/);
  const report = await json(join(file, '../../render/produce.json'));
  assert.equal(report.cache.mix, undefined);
  await assert.rejects(produce(file, {resume: true}, {runStep: double({calls, mix: {...approvedMix(), start_clicks: 1}})}), /render bloqueado/);
  assert.deepEqual(calls.map(c => c.step), ['mix']);
});
test('cambio de entradas durante revisión invalida el resultado antes de mix/render', async t => {
  const {file} = await fixture(t), calls = [], actual = double({calls});
  await assert.rejects(produce(file, {}, {runStep: async (step, context) => {
    const result = await actual(step, context);
    if (step === 'review') { const ep = await json(file); ep.title += '!'; await save(file, ep); }
    return result;
  }}), /entradas cambiaron/);
  assert.deepEqual(calls.map(c => c.step), ['validate', 'review']);
});
test('dialogue con extensión incompatible se rechaza antes de invocar mix', async t => {
  const {file} = await fixture(t), ep = await json(file), calls = [];
  ep.resources.dialogue = 'mezcla.wav'; await save(file, ep);
  await assert.rejects(produce(file, {}, {runStep: double({calls})}), /debe terminar en .mp3/);
  assert.deepEqual(calls.map(c => c.step), ['validate', 'review']);
});
test('bloqueo global impide renders de dos episodios al mismo tiempo y se libera al terminar', async t => {
  const first = await fixture(t), second = await fixture(t), renderLockDirectory = join(first.parent, 'render-global.lock');
  let enter, finish;
  const entered = new Promise(r => { enter = r; }), wait = new Promise(r => { finish = r; });
  const actual = double(), firstRun = produce(first.file, {}, {renderLockDirectory, runStep: async (step, ctx) => {
    if (step === 'render') { enter(); await wait; }
    return actual(step, ctx);
  }});
  try {
    await entered;
    await assert.rejects(produce(second.file, {}, {renderLockDirectory, runStep: double()}), /Render ocupado/);
    assert.equal(await exists(renderLockDirectory), true);
  } finally { finish(); await firstRun; }
  assert.equal(await exists(renderLockDirectory), false);
  assert.equal((await produce(second.file, {resume: true}, {renderLockDirectory, runStep: double()})).status, 'completed');
});
test('--from no permite omitir revisión o voz; opciones inválidas fallan antes de ejecutar', async t => {
  const {file} = await fixture(t);
  await assert.rejects(produce(file, {from: 'render'}, {runStep: () => assert.fail()}), /falta un resultado vigente/);
  for (const options of [{until: 'otro'}, {from: 'mix', until: 'review'}, {views: 'both'}, {views: 'portrait,portrait'}, {views: ''}]) assert.throws(() => optionsFor(file, options));
});
test('rechaza producción simultánea del mismo episodio y no borra el bloqueo ajeno', async t => {
  const {file, directory} = await fixture(t), block = join(directory, 'render/.produce.lock');
  await mkdir(block, {recursive: true}); await save(join(block, 'owner.json'), {pid: process.pid});
  await assert.rejects(produce(file, {}, {runStep: () => assert.fail()}), /otra producción o render activo/);
  assert.equal(await exists(block), true);
});
test('voz por ruta alternativa usa staging y solo incorpora los faltantes, sin cambiar guion ni modelo', async t => {
  const {file} = await fixture(t, {audio: false}), state = await snapshot(file), before = await readFile(file);
  let staging;
  await generateMissingVoice(file, state, async (directory, ids) => {
    staging = directory; assert.deepEqual(ids, ['L01', 'L02']);
    const staged = join(directory, 'assets/episode.json');
    assert.deepEqual((await json(staged)).script, state.episode.script);
    await audioFixture(staged);
  });
  assert.equal((await snapshot(file)).missing.length, 0);
  assert.deepEqual(await readFile(file), before); assert.equal(await exists(staging), false);
});
test('voz parcial conserva clips aprobados al fallar cuota y la próxima ejecución solo pide faltantes', async t => {
  const {file} = await fixture(t, {audio: false});
  await assert.rejects(generateMissingVoice(file, await snapshot(file), async directory => {
    const staged = join(directory, 'assets/episode.json'); await audioFixture(staged);
    const timing = await json(join(staged, '../timing.json')); delete timing.lines.L02;
    await save(join(staged, '../timing.json'), timing); throw new Error('HTTP 402');
  }), /402/);
  const state = await snapshot(file); assert.deepEqual(state.missing.map(l => l.id), ['L02']);
  await generateMissingVoice(file, state, async (directory, ids) => {
    assert.deepEqual(ids, ['L02']); await audioFixture(join(directory, 'assets/episode.json'));
  });
  assert.equal((await snapshot(file)).missing.length, 0);
});
test('cambios de guion, QC o clip faltante invalidan disponibilidad de voz', async t => {
  const {file} = await fixture(t);
  const ep = await json(file); ep.script[0].text = 'Una frase distinta.'; await save(file, ep);
  assert.match((await snapshot(file)).missing.find(l => l.id === 'L01').reason, /guion distinto/);
  const timing = await json(join(file, '../timing.json')); timing.lines.L02.qc.ok = false;
  await save(join(file, '../timing.json'), timing);
  assert.equal((await snapshot(file)).missing.length, 2);
  await rm(join(file, '../audio/lines/L02.wav'));
  assert.match((await snapshot(file)).missing.find(l => l.id === 'L02').reason, /falta clip/);
});
test('provisional no reutiliza un say sin texto y limpia el directorio ante error', async t => {
  const {file} = await fixture(t, {audio: false});
  const ep = await json(file); ep.script = []; await save(file, ep);
  const before = (await readdir(tmpdir())).filter(f => f.startsWith('vida-produce-design-')).sort();
  await assert.rejects(provisionalEpisode(file, await snapshot(file)), /falta texto en script/);
  const after = (await readdir(tmpdir())).filter(f => f.startsWith('vida-produce-design-')).sort();
  assert.deepEqual(after, before);
});
