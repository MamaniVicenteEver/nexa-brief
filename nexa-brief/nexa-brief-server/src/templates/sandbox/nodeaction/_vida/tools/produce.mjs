#!/usr/bin/env node
import {mkdir, rm} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {ROOT, STEPS, json, hash, fileHash, save, exists, episodePath, episodeDirectory, parseArgs, safeError} from './production-common.mjs';
import {snapshot, provisionalEpisode, generateMissingVoice} from './production-timing.mjs';
import {run, killChildren} from './process.mjs';

export function optionsFor(input, options = {}, root = ROOT) {
  const provisional = !!options['provisional-timing'];
  const until = options.until ?? (provisional ? 'review' : 'render'), from = options.from ?? 'validate';
  if (!STEPS.includes(until) || !STEPS.includes(from) || STEPS.indexOf(from) > STEPS.indexOf(until))
    throw new Error('--from/--until deben seguir validate → review → voice → mix → render.');
  if (provisional && STEPS.indexOf(until) > 1) throw new Error('El timing provisional solo permite validate/review; nunca voice, mix ni render. No sustituye al audio real.');
  const views = (options.views ?? 'portrait').split(',');
  if (!views.length || views.some(v => !['portrait', 'landscape'].includes(v)) || new Set(views).size !== views.length)
    throw new Error('--views acepta portrait, landscape o portrait,landscape, sin repeticiones.');
  return {file: episodePath(input, root), provisional, until, from, views,
    dryRun: !!options['dry-run'], resume: !!options.resume, nice: !!options.nice};
}

export function reviewFailures(metrics) {
  const failures = [];
  for (const view of ['portrait', 'landscape']) {
    const result = metrics?.views?.find(v => v.view === view);
    if (!result || result.passed !== true || !Array.isArray(result.failed)) failures.push(`${view}: revisión ausente o incompleta`);
    else if (result.failed.length) failures.push(`${view}: ${result.failed.join(', ')}`);
  }
  return failures;
}
export function mixFailures(metrics) {
  const failed = [];
  if (metrics?.start_clicks !== 0) failed.push(`start_clicks=${metrics?.start_clicks ?? 'ausente'} (debe ser 0)`);
  if (!Number.isFinite(metrics?.lufs) || Math.abs(metrics.lufs + 16) > .5) failed.push(`LUFS=${metrics?.lufs ?? 'ausente'} (−16 ±0,5)`);
  if (!Number.isFinite(metrics?.true_peak_db) || metrics.true_peak_db > -1.5) failed.push(`TP=${metrics?.true_peak_db ?? 'ausente'} (≤ −1,5 dBTP)`);
  return failed;
}

function commandFor(step, context) {
  const {root, file, outputDir, state, view, nice} = context;
  const args = [join(root, 'tools', step + '.mjs'), file];
  if (step === 'validate') args.push('--view', 'both');
  if (step === 'review') args.push(outputDir, '--view', 'both', '--every', '2');
  if (step === 'mix') args.push(state.paths.dialogue);
  if (step === 'render') args.push(join(outputDir, state.episode.id + (view === 'landscape' ? '-16x9' : '') + '.mp4'), '--view', view);
  return step === 'render' && nice ? {command: 'nice', args: ['-n', '10', process.execPath, ...args]} : {command: process.execPath, args};
}

/** Punto de sustitución para pruebas offline: recibe un paso, devuelve métricas y archivos. */
export async function runStep(step, context) {
  if (step === 'voice') {
    try {
      await generateMissingVoice(context.file, context.state, async (directory, ids) => {
        await run(process.execPath, [join(context.root, 'tools/voice.mjs'), directory, '--only', ids.join(',')]);
      });
    } catch {
      throw new Error('Voz de Gemini no disponible: faltan clips o falló clave, cuota/saldo, dependencias o QC. Revisá la configuración de voice.mjs y reintentá con --resume. Se conserva la voz y el modelo; no se inventó audio.');
    }
    return {metrics: {generated: context.state.missing.map(l => l.id)}, outputs: []};
  }
  const command = commandFor(step, context);
  let response, failure;
  // review publica métricas incluso cuando termina con código 1.
  if (step === 'review') {
    await mkdir(context.outputDir, {recursive: true});
    for (const name of [`${context.state.episode.id}-metrics.json`, ...['portrait', 'landscape'].map(v => `${context.state.episode.id}-${v}-metrics.json`)])
      await rm(join(context.outputDir, name), {force: true});
  }
  try { response = await run(command.command, command.args); } catch (error) { failure = error; }
  const {id} = context.state.episode;
  if (step === 'review') {
    const summary = join(context.outputDir, `${id}-metrics.json`);
    if (!await exists(summary)) throw failure ?? new Error('Review no produjo métricas.');
    const metrics = await json(summary);
    if (failure && !reviewFailures(metrics).length) throw failure;
    return {metrics, outputs: [summary, ...['portrait', 'landscape'].flatMap(v => [join(context.outputDir, `${id}-${v}-metrics.json`), join(context.outputDir, `${id}-${v}-sheet.jpg`)])]};
  }
  if (failure) throw failure;
  if (step === 'validate') return {metrics: JSON.parse(response.stdout), outputs: []};
  if (step === 'mix') return {metrics: await json(context.state.paths.dialogue.replace(/\.mp3$/, '.mix.json')), outputs: [context.state.paths.dialogue, context.state.paths.dialogue.replace(/\.mp3$/, '.mix.json')]};
  const video = join(context.outputDir, id + (context.view === 'landscape' ? '-16x9' : '') + '.mp4');
  return {metrics: await json(video.replace(/\.mp4$/, '.render.json')), outputs: [video, video.replace(/\.mp4$/, '.render.json')]};
}

async function artifacts(files) {
  const result = [];
  for (const file of files ?? []) {
    const digest = await fileHash(file);
    if (!digest) throw new Error('Falta un resultado del paso: ' + file);
    result.push({file, hash: digest});
  }
  return result;
}
async function reusable(record, digest) {
  if (!record || record.hash !== digest || record.status !== 'completed') return false;
  for (const item of record.outputs) if (await fileHash(item.file) !== item.hash) return false;
  return true;
}

async function lock(directory, label) {
  try { await mkdir(directory); }
  catch (error) { if (error.code === 'EEXIST') throw new Error(`${label}: hay otra producción o render activo (${directory}). Si el proceso terminó abruptamente, verificá el PID de owner.json antes de retirar el bloqueo.`); throw error; }
  try { await save(join(directory, 'owner.json'), {pid: process.pid, started_at: new Date().toISOString()}); }
  catch (error) { await rm(directory, {recursive: true, force: true}); throw error; }
  return () => rm(directory, {recursive: true, force: true});
}

export async function produce(input, options = {}, dependencies = {}) {
  const root = dependencies.root ?? ROOT, execute = dependencies.runStep ?? runStep;
  const settings = optionsFor(input, options, root), file = settings.file;
  let state = await snapshot(file, root);
  const outputDir = join(episodeDirectory(file), 'render'), reportFile = join(outputDir, 'produce.json');
  const preflight = settings.provisional || state.missing.length > 0;
  const plan = {
    episode: state.episode.id, episode_file: file, report: reportFile, provisional: preflight,
    from: settings.from, until: settings.until, views: settings.views,
    missing: state.missing,
    steps: STEPS.slice(STEPS.indexOf(settings.from), STEPS.indexOf(settings.until) + 1).flatMap(step => {
      if (step === 'voice') return [{step, action: state.missing.length ? 'generar solo faltantes con voice.mjs; requiere clave/cuota Gemini' : 'reutilizar clips existentes', missing: state.missing.map(l => l.id)}];
      const views = step === 'render' ? settings.views : [undefined];
      return views.map(view => ({step, ...(view ? {view} : {}), ...commandFor(step, {root, state, view, nice: settings.nice,
        file: preflight && ['validate', 'review'].includes(step) ? '<copia provisional en /tmp/episode.json>' : file,
        outputDir: step === 'review' ? join(outputDir, preflight ? 'review-provisional' : 'review') : outputDir})}));
    }),
    notes: [preflight ? 'Revisión estimada a 150 palabras/minuto. provisional:true; no es audio. Tras generar voz se repiten validate y review con timing real.' : 'Revisión con timing y clips reales.',
      'Antes del render: review.failed vacío en ambas vistas; start_clicks=0; LUFS −16 ±0,5; TP ≤ −1,5. Un render a la vez.',
      'render.mjs vuelve a mezclar internamente con el mismo motor; produce verifica antes la mezcla publicada.']
  };
  if (settings.dryRun) return {dry_run: true, ...plan};
  await mkdir(outputDir, {recursive: true});
  const release = await lock(join(outputDir, '.produce.lock'), 'Producción ocupada');
  let design, interrupted;
  const onSignal = signal => { interrupted = signal; killChildren(signal); };
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  const started = performance.now(), previous = await exists(reportFile) ? await json(reportFile).catch(() => ({})) : {};
  const report = {version: 1, episode: state.episode.id, episode_file: file, report: reportFile,
    started_at: new Date().toISOString(), status: 'running', provisional: preflight,
    episode_hash: state.episode_hash, hash: state.hash, views: settings.views,
    steps: [], cache: previous.cache ?? {}, metrics: {review: {}, mix: null}, missing: state.missing, plan};
  let review, mix;
  const persist = () => save(reportFile, report);
  async function step(name, {provisional = false, view, prerequisite = false} = {}) {
    const key = name + (['validate', 'review'].includes(name) ? (provisional ? ':provisional' : ':real') : view ? ':' + view : '');
    const digest = hash(JSON.stringify({version: 1, inputs: state.hash, step: key,
      // El render también depende del resultado auditado de mix/review.
      ...(name === 'render' ? {mix, review, mix_outputs: report.cache.mix?.outputs,
        review_outputs: report.cache['review:real']?.outputs} : {})}));
    const cached = report.cache[key], t0 = performance.now();
    if ((settings.resume || prerequisite) && await reusable(cached, digest)) {
      const record = {...cached, key, status: 'cached', seconds: 0}; report.steps.push(record);
      if (name === 'review') {
        review = cached.metrics;
        report.metrics.review = Object.fromEntries((review.views ?? []).map(v => [v.view, {failed: v.failed, passed: v.passed, provisional}]));
      }
      if (name === 'mix') {
        mix = cached.metrics;
        report.metrics.mix = {lufs: mix?.lufs, true_peak_db: mix?.true_peak_db, start_clicks: mix?.start_clicks};
      }
      await persist(); return;
    }
    if (prerequisite) throw new Error(`--from ${settings.from}: falta un resultado vigente de ${key}. Ejecutá desde validate con --resume.`);
    // Un intento fallido nunca debe resucitar una aprobación de una ejecución anterior.
    delete report.cache[key];
    const record = {step: name, key, ...(view ? {view} : {}), provisional, status: 'running', hash: digest, seconds: 0};
    report.steps.push(record); await persist();
    let renderRelease;
    try {
      if (['mix', 'render'].includes(name) && !state.paths.dialogue.endsWith('.mp3'))
        throw new Error('resources.dialogue debe terminar en .mp3 para conservar la mezcla y su informe.');
      if (name !== 'voice' && (await snapshot(file, root)).hash !== state.hash)
        throw new Error('Las entradas cambiaron durante la producción. Volvé a ejecutar con --resume.');
      if (name === 'render') {
        const failures = [...reviewFailures(review), ...mixFailures(mix)];
        if (state.missing.length || report.provisional || failures.length) throw new Error('Render bloqueado: ' + [...state.missing.map(l => `${l.id}: ${l.reason}`), ...failures, ...(report.provisional ? ['timing provisional'] : [])].join('; '));
        renderRelease = await lock(dependencies.renderLockDirectory ?? join(tmpdir(), 'vida-produce-render.lock'), 'Render ocupado');
      }
      const result = await execute(name, {root, state, view, nice: settings.nice, file: provisional ? design.episodeFile : file,
        outputDir: name === 'review' ? join(outputDir, provisional ? 'review-provisional' : 'review') : outputDir, provisional});
      if (interrupted) throw new Error('Producción interrumpida: ' + interrupted + '. Reanudá con --resume.');
      if (name !== 'voice' && (await snapshot(file, root)).hash !== state.hash)
        throw new Error('Las entradas cambiaron durante la producción. Volvé a ejecutar con --resume.');
      record.metrics = result.metrics;
      record.outputs = await artifacts(result.outputs);
      if (name === 'validate' && result.metrics?.passed !== true) throw new Error('Validación no aprobada en ambas vistas.');
      if (name === 'review') {
        review = result.metrics;
        report.metrics.review = Object.fromEntries((review.views ?? []).map(v => [v.view, {failed: v.failed, passed: v.passed, provisional}]));
        const failed = reviewFailures(review);
        if (failed.length) throw new Error('Revisión no aprobada; render bloqueado: ' + failed.join('; '));
      }
      if (name === 'mix') {
        mix = result.metrics;
        report.metrics.mix = {lufs: mix?.lufs, true_peak_db: mix?.true_peak_db, start_clicks: mix?.start_clicks};
        const failed = mixFailures(mix);
        if (failed.length) throw new Error('Mezcla no aprobada; render bloqueado: ' + failed.join('; '));
      }
      record.status = 'completed';
      report.cache[key] = {...record};
    } catch (error) { record.status = 'failed'; record.error = safeError(error); throw error; }
    finally { record.seconds = (performance.now() - t0) / 1000; if (report.cache[key]?.hash === digest && record.status === 'completed') report.cache[key].seconds = record.seconds; await renderRelease?.(); await persist(); }
  }
  try {
    if (preflight) design = await provisionalEpisode(file, state);
    for (const name of STEPS.slice(0, STEPS.indexOf(settings.until) + 1)) {
      if (interrupted) throw new Error('Producción interrumpida: ' + interrupted + '. Reanudá con --resume.');
      const prerequisite = STEPS.indexOf(name) < STEPS.indexOf(settings.from);
      if (name === 'voice') {
        if (state.missing.length) {
          if (prerequisite) throw new Error('--from no puede omitir la voz faltante. Ejecutá con --resume desde validate.');
          try { await step('voice'); }
          catch (error) { throw new Error('Producción detenida por falta de voz (clave/cuota/saldo, dependencias o QC). ' + safeError(error)); }
          state = await snapshot(file, root);
          report.hash = state.hash; report.missing = state.missing;
          if (state.missing.length) throw new Error('Voz incompleta: ' + state.missing.map(l => `${l.id} (${l.reason})`).join(', ') + '. No se permite mezclar/renderizar ni inventar audio.');
        } else report.steps.push({step: 'voice', key: 'voice', status: 'reused', seconds: 0, reason: 'Todos los clips y timing están disponibles y corresponden al guion.'});
        if (preflight) {
          report.provisional = false;
          await step('validate'); await step('review');
        }
      } else if (name === 'render') {
        // Incluso los renders reanudados pasan las puertas con métricas vigentes.
        const failed = [...reviewFailures(review), ...mixFailures(mix)];
        if (state.missing.length || report.provisional || failed.length) throw new Error('Render bloqueado: ' + failed.join('; '));
        for (const view of settings.views) await step('render', {view, prerequisite});
      } else await step(name, {provisional: ['validate', 'review'].includes(name) && preflight, prerequisite});
    }
    report.status = 'completed';
    return report;
  } catch (error) {
    report.status = 'blocked'; report.error = safeError(error);
    report.missing = (await snapshot(file, root).catch(() => state)).missing;
    error.report = report;
    throw error;
  } finally {
    process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
    report.seconds = (performance.now() - started) / 1000;
    report.finished_at = new Date().toISOString();
    try { await persist(); } finally { try { await design?.cleanup(); } finally { await release(); } }
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const {input, ...options} = parseArgs(process.argv.slice(2), {values: ['until', 'from', 'views'], flags: ['dry-run', 'resume', 'nice', 'provisional-timing']});
    const report = await produce(input, options);
    console.log(JSON.stringify(report.dry_run ? report : {episode: report.episode, status: report.status, provisional: report.provisional,
      report: report.report, seconds: report.seconds, steps: report.steps.map(s => ({key: s.key, status: s.status, seconds: s.seconds})), metrics: report.metrics, missing: report.missing}, null, 2));
  } catch (error) {
    if (error.report) console.log(JSON.stringify({status: error.report.status, report: error.report.report, metrics: error.report.metrics, missing: error.report.missing, error: error.report.error}, null, 2));
    console.error(safeError(error)); process.exitCode = 1;
  }
}
