#!/usr/bin/env node
// Segunda salida de render: AWS Lambda, en vez de local (scripts/render-node.mjs).
// Mismo contrato de props/CLI/stdout que render-node.mjs (para que
// RemotionAdapter en Python los trate igual) más flags propios de AWS.
// Requiere haber corrido scripts/lambda-deploy.sh al menos una vez (función
// + site ya desplegados) — ver nexa-brief-docs/guia_migracion_remotion_lambda.md.
//
// audioSrc/bgSrc en --props son nombres de archivo relativos a --asset-dir
// (el output_dir del job) — Lambda no tiene acceso al filesystem local, así
// que este script los sube al bucket que ya administra Remotion y los
// reemplaza por una URL prefirmada antes de disparar el render (ver
// resolveMediaSrc() en test/neon-timeline.js, que sirve tanto un nombre de
// archivo local como una URL http(s) sin saber en qué motor está corriendo).
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {
  downloadMedia,
  getAwsClient,
  getOrCreateBucket,
  getRenderProgress,
  presignUrl,
  renderMediaOnLambda,
} from '@remotion/lambda';

// A diferencia de `npx remotion lambda ...` (que carga .env solo), invocar
// este script directo con `node` no lo hace — sin esto, REMOTION_AWS_ACCESS_KEY_ID/
// SECRET no llegarían a getAwsClient()/renderMediaOnLambda(). Resuelto contra
// la ubicación del script (no cwd) para funcionar igual sea invocado desde
// Python (con cwd=remotion_project_dir) o a mano desde cualquier directorio.
const ENV_PATH = path.join(import.meta.dirname, '..', '.env');
if (fs.existsSync(ENV_PATH)) {
  process.loadEnvFile(ENV_PATH);
}

const ASSET_PRESIGN_EXPIRY_SECONDS = 3600; // sobra para cualquier render, incluso con retries
const POLL_INTERVAL_MS = 4000;

function emit(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function usageError(message) {
  process.stderr.write(`${message}\n`);
  process.stderr.write(
    'Usage: render-lambda.mjs --props=<file.json> --composition=<id> --output=<file.mp4> ' +
      '--asset-dir=<dir> --region=<region> --function-name=<name> --serve-url=<url> ' +
      '[--job-id=<id>] [--frames-per-lambda=70] [--codec=h264] [--crf=23] [--timeout-ms=900000]\n'
  );
  process.exit(1);
}

async function uploadJobAsset({client, sdk, bucketName, region, jobId, assetDir, filename}) {
  const localPath = path.join(assetDir, filename);
  const objectKey = `nexa-brief-jobs/${jobId}/${filename}`;
  await client.send(
    new sdk.PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: fs.readFileSync(localPath),
    })
  );
  const url = await presignUrl({region, bucketName, objectKey, expiresInSeconds: ASSET_PRESIGN_EXPIRY_SECONDS});
  return {objectKey, url};
}

async function main() {
  const {values} = parseArgs({
    options: {
      props: {type: 'string'},
      composition: {type: 'string'},
      output: {type: 'string'},
      'asset-dir': {type: 'string'},
      'job-id': {type: 'string'},
      region: {type: 'string'},
      'function-name': {type: 'string'},
      'serve-url': {type: 'string'},
      'frames-per-lambda': {type: 'string', default: '70'},
      codec: {type: 'string', default: 'h264'},
      crf: {type: 'string', default: '23'},
      'timeout-ms': {type: 'string', default: '900000'},
    },
  });

  const required = ['props', 'composition', 'output', 'asset-dir', 'region', 'function-name', 'serve-url'];
  const missing = required.filter((key) => !values[key]);
  if (missing.length > 0) {
    usageError(`Faltan argumentos requeridos: ${missing.join(', ')}`);
    return;
  }

  const region = values.region;
  const functionName = values['function-name'];
  const serveUrl = values['serve-url'];
  const assetDir = path.resolve(values['asset-dir']);
  const jobId = values['job-id'] || String(Date.now());
  const outputLocation = path.resolve(values.output);
  fs.mkdirSync(path.dirname(outputLocation), {recursive: true});

  const inputProps = JSON.parse(fs.readFileSync(path.resolve(values.props), 'utf8'));

  emit({type: 'preparing-bucket'});
  const {bucketName} = await getOrCreateBucket({region});
  const {client, sdk} = getAwsClient({region, service: 's3'});

  emit({type: 'uploading-assets'});
  const uploaded = {};
  for (const key of ['audioSrc', 'bgSrc']) {
    const filename = inputProps[key];
    const {objectKey, url} = await uploadJobAsset({
      client,
      sdk,
      bucketName,
      region,
      jobId,
      assetDir,
      filename,
    });
    uploaded[key] = objectKey;
    inputProps[key] = url;
  }
  emit({type: 'assets-uploaded'});

  emit({type: 'triggering-render', composition: values.composition});
  const {renderId, bucketName: renderBucket} = await renderMediaOnLambda({
    region,
    functionName,
    serveUrl,
    composition: values.composition,
    inputProps,
    codec: values.codec,
    crf: Number(values.crf),
    framesPerLambda: Number(values['frames-per-lambda']),
    outName: path.basename(outputLocation),
  });
  emit({type: 'render-triggered', renderId});

  const deadline = Date.now() + Number(values['timeout-ms']);
  let progress;
  while (true) {
    progress = await getRenderProgress({functionName, bucketName: renderBucket, renderId, region});
    emit({
      type: 'progress',
      overallProgress: progress.overallProgress,
      framesRendered: progress.framesRendered,
      lambdasInvoked: progress.lambdasInvoked,
      costs: progress.costs,
    });

    if (progress.fatalErrorEncountered) {
      const errs = (progress.errors || []).map((e) => e.message).join('; ');
      process.stderr.write(`Render falló: ${errs || 'error fatal sin detalle'}\n`);
      process.exit(1);
    }
    if (progress.done) break;
    if (Date.now() > deadline) {
      process.stderr.write(`Timeout esperando el render de Lambda (renderId=${renderId})\n`);
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  emit({type: 'downloading'});
  await downloadMedia({region, bucketName: renderBucket, renderId, outPath: outputLocation});

  // Best-effort: no hace falta conservar los assets del job en S3 tras el render.
  for (const objectKey of Object.values(uploaded)) {
    try {
      await client.send(new sdk.DeleteObjectCommand({Bucket: bucketName, Key: objectKey}));
    } catch (err) {
      process.stderr.write(`Aviso: no se pudo borrar ${objectKey} de S3: ${err}\n`);
    }
  }

  emit({type: 'done', output: outputLocation});
}

main().catch((err) => {
  process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`);
  process.exit(1);
});
