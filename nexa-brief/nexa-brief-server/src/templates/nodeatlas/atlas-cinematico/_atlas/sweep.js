/** Evalúa toda la cuadrícula; prepara solo estados consecutivos distintos. */
export async function sweepFrames({end, step = .25, evaluate, prepare, progress = () => {}, isCurrent = () => true, stats = {}, now = () => performance.now()}) {
  if (!Number.isFinite(step) || !(step > 0)) throw Error('step debe ser positivo y finito');
  if (!Number.isFinite(end) || end < 0) throw Error('end debe ser no negativo y finito');
  const total = Math.ceil(end / step) + 1;
  if (!Number.isSafeInteger(total)) throw Error('Cuadrícula de barrido demasiado grande');
  Object.assign(stats, {total, sampled:0, prepared:0, skipped:0, step, end, lastTime:null, startedAtMs:now(), elapsedMs:0, running:true, cancelled:false, error:null});
  let previous;
  try {
    for (let i = 0; i < total && isCurrent(); i++) {
      const t = Math.min(end, i * step), state = evaluate(t), signature = JSON.stringify(state);
      stats.sampled++;
      if (i === 0 || signature !== previous) {
        stats.prepared++;
        await prepare(t, state);
      } else stats.skipped++;
      previous = signature;
      stats.lastTime = t;
      stats.elapsedMs = Math.max(0, now() - stats.startedAtMs);
      progress((i + 1) / total);
    }
    return stats;
  } catch (error) {
    stats.error = String(error?.message || error);
    throw error;
  } finally {
    stats.running = false;
    stats.cancelled = !isCurrent();
    stats.elapsedMs = Math.max(0, now() - stats.startedAtMs);
  }
}
