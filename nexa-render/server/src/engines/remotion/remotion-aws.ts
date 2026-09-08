import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  deploySiteFromBundle,
  downloadMedia,
  getAwsClient,
  getOrCreateBucket,
  getRenderProgress,
  presignUrl,
  renderMediaOnLambda,
} from "@remotion/lambda";
import type { EngineOptions, EngineOutput, VideoFormat } from "../port.js";
import { FORMAT_VIEWPORT } from "../format-viewport.js";
import { env } from "../../config/env.js";
import { RenderError } from "../errors.js";
import { logger } from "../../observability/logger.js";

const ASSET_URL_TTL_SECONDS = 3_600;
const POLL_INTERVAL_MS = 4_000;

/** Render remoto de Remotion. Los recursos externos ya fueron descargados y
 * validados por remote-assets; aquí se suben con prefijo de job y se eliminan
 * al terminar. El bundle también se publica por job, para que código generado
 * por usuarios nunca pise el site de otro render. */
export async function renderRemotionOnAws(args: {
  input: Extract<import("../port.js").RenderInput, { kind: "react" }>;
  options: EngineOptions;
  durationInFrames: number;
  buildBundle(format: VideoFormat, props: Record<string, unknown>, audioUrl?: string): Promise<string>;
}): Promise<EngineOutput[]> {
  const { input, options, durationInFrames, buildBundle } = args;
  const region = env.REMOTION_AWS_REGION as never;
  const { bucketName } = await getOrCreateBucket({ region });
  const { client, sdk } = getAwsClient({ region, service: "s3" });
  const uploadedKeys: string[] = [];

  const stageUrl = async (filePath: string, fileName: string): Promise<string> => {
    const objectKey = `nexa-render/jobs/${options.jobId}/${fileName}`;
    await client.send(new sdk.PutObjectCommand({ Bucket: bucketName, Key: objectKey, Body: await readFile(filePath) }));
    uploadedKeys.push(objectKey);
    return presignUrl({ region, bucketName, objectKey, expiresInSeconds: ASSET_URL_TTL_SECONDS });
  };

  try {
    const replacements = new Map<string, string>();
    const assetDir = options.assetDir;
    if (assetDir) {
      for (const asset of await import("node:fs/promises").then(({ readdir }) => readdir(assetDir, { withFileTypes: true }))) {
        if (!asset.isFile()) continue;
        const name = asset.name;
        const url = await stageUrl(path.join(assetDir, name), name);
        if (options.assetOrigin) replacements.set(`${options.assetOrigin}/${name}`, url);
      }
    }
    const rewrite = (value: unknown): unknown => {
      if (typeof value === "string") {
        let next = value;
        for (const [from, to] of replacements) next = next.replaceAll(from, to);
        return next;
      }
      if (Array.isArray(value)) return value.map(rewrite);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewrite(item)]));
      return value;
    };
    const props = rewrite(input.props ?? {}) as Record<string, unknown>;
    const audioUrl = rewrite(options.audioUrl) as string | undefined;
    const outputs: EngineOutput[] = [];

    for (const format of options.formats) {
      const bundleDir = await buildBundle(format, props, audioUrl);
      const site = await deploySiteFromBundle({
        bucketName,
        region,
        bundleDir,
        siteName: `${env.REMOTION_AWS_SITE_PREFIX}-${options.jobId}-${format}`.slice(0, 63),
        privacy: "no-acl",
      });
      const { width, height } = FORMAT_VIEWPORT[format];
      const render = await renderMediaOnLambda({
        region,
        functionName: env.REMOTION_AWS_FUNCTION_NAME,
        serveUrl: site.serveUrl,
        composition: "Main",
        inputProps: props,
        codec: "h264",
        framesPerLambda: env.REMOTION_AWS_FRAMES_PER_LAMBDA,
        outName: `nexa-${options.jobId}-${format}.mp4`,
        imageFormat: "jpeg",
        // Valores defensivos: la Composition incluida en el site define el tamaño.
        frameRange: [0, durationInFrames - 1],
        chromiumOptions: { ignoreCertificateErrors: false },
        webhook: undefined,
      } as never);
      const deadline = Date.now() + options.timeoutMs;
      while (true) {
        const progress = await getRenderProgress({
          functionName: env.REMOTION_AWS_FUNCTION_NAME,
          bucketName: render.bucketName,
          renderId: render.renderId,
          region,
        });
        logger.info({ event: "remotion_aws_progress", jobId: options.jobId, format, percent: Math.round(progress.overallProgress * 100) });
        if (progress.fatalErrorEncountered) throw new RenderError(`Remotion Lambda falló: ${(progress.errors ?? []).map((error) => error.message).join("; ") || "sin detalle"}`);
        if (progress.done) break;
        if (Date.now() > deadline) throw new RenderError(`Remotion Lambda excedió el tiempo máximo (${options.timeoutMs} ms).`);
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
      const outputPath = path.join(options.workDir, `output-${format}.mp4`);
      await downloadMedia({ region, bucketName: render.bucketName, renderId: render.renderId, outPath: outputPath });
      outputs.push({ format, path: outputPath });
      logger.info({ event: "remotion_aws_completed", jobId: options.jobId, format, width, height });
    }
    return outputs;
  } finally {
    await Promise.all(uploadedKeys.map(async (Key) => {
      try { await client.send(new sdk.DeleteObjectCommand({ Bucket: bucketName, Key })); }
      catch (error) { logger.warn({ event: "remotion_aws_asset_cleanup_failed", jobId: options.jobId, Key, err: error }); }
    }));
  }
}
