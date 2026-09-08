#!/usr/bin/env node
// Wrapper programático de render, pensado para ser invocado como subproceso
// desde el backend Python (RemotionAdapter) en vez de volver a envolver
// `npx remotion render` (otra capa de CLI sobre CLI). Usa las APIs de Node
// de Remotion directamente: un solo bundle + selectComposition (resuelve
// calculateMetadata con las props reales) + renderMedia.
//
// Progreso/resultado se emiten como líneas JSON en stdout para que el
// llamador pueda parsear sin ambigüedad; los errores van a stderr con
// exit code != 0.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';

const PROJECT_ROOT = path.join(import.meta.dirname, '..');
const ENTRY_POINT = path.join(PROJECT_ROOT, 'index.js');

function emit(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function usageError(message) {
  process.stderr.write(`${message}\n`);
  process.stderr.write(
    'Usage: render-node.mjs --props=<file.json> --composition=<id> --output=<file.mp4> ' +
      '[--public-dir=<dir>] [--codec=h264] [--crf=23] [--concurrency=2] [--timeout-ms=120000]\n'
  );
  process.exit(1);
}

async function main() {
  const {values} = parseArgs({
    options: {
      props: {type: 'string'},
      composition: {type: 'string'},
      output: {type: 'string'},
      'public-dir': {type: 'string'},
      codec: {type: 'string', default: 'h264'},
      crf: {type: 'string', default: '23'},
      concurrency: {type: 'string', default: '2'},
      'timeout-ms': {type: 'string', default: '120000'},
    },
  });

  if (!values.props || !values.composition || !values.output) {
    usageError('Faltan argumentos requeridos.');
    return;
  }

  const inputProps = JSON.parse(fs.readFileSync(path.resolve(values.props), 'utf8'));
  const outputLocation = path.resolve(values.output);
  fs.mkdirSync(path.dirname(outputLocation), {recursive: true});

  // publicDir aloja los assets del job (audioSrc/bgSrc en inputProps son
  // solo nombres de archivo, resueltos vía staticFile() dentro del
  // componente) — típicamente el output_dir del job de Python, que ya
  // contiene song.mp3/bg.jpg/bg-video.mp4 puestos ahí por etapas previas
  // del pipeline. Sin --public-dir cae al publicDir fijo del proyecto
  // (test/, para uso local/Studio).
  emit({type: 'bundling'});
  const serveUrl = await bundle({
    entryPoint: ENTRY_POINT,
    publicDir: values['public-dir'] ? path.resolve(values['public-dir']) : undefined,
  });

  emit({type: 'selecting-composition', id: values.composition});
  const composition = await selectComposition({
    serveUrl,
    id: values.composition,
    inputProps,
  });

  emit({type: 'rendering', totalFrames: composition.durationInFrames});
  await renderMedia({
    composition,
    serveUrl,
    codec: values.codec,
    outputLocation,
    inputProps,
    crf: Number(values.crf),
    concurrency: Number(values.concurrency),
    timeoutInMilliseconds: Number(values['timeout-ms']),
    onProgress: ({renderedFrames, encodedFrames}) => {
      emit({type: 'progress', renderedFrames, encodedFrames, totalFrames: composition.durationInFrames});
    },
  });

  emit({type: 'done', output: outputLocation});
}

main().catch((err) => {
  process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`);
  process.exit(1);
});
