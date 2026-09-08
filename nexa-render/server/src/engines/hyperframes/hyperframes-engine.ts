import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import type { EngineOptions, EngineOutput, EngineResult, RenderEngine, RenderInput, VideoFormat } from "../port.js";
import { RenderError } from "../errors.js";
import { logger } from "../../observability/logger.js";
import { env } from "../../config/env.js";
import { downloadS3Object } from "../aws/s3.js";

const GSAP_CDN_TAG =
  '<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>';

/**
 * Motor real, subproceso sobre el binario local `node_modules/.bin/hyperframes`
 * (nunca `npx hyperframes` — overhead medido de ~170s en el POC de referencia).
 * A diferencia de PlaywrightEngine, no arranca un servidor HTTP: HyperFrames
 * lee el HTML directo del disco, así que css/js SIEMPRE se inlinean en un
 * único `index.html` autocontenido (simplificación deliberada frente a la
 * estructura multi-archivo real de un proyecto HyperFrames — ver plan).
 */
export class HyperframesEngine implements RenderEngine {
  readonly name = "hyperframes" as const;

  canHandle(input: RenderInput): boolean {
    return input.kind === "html" && validateComposition(input) === undefined;
  }

  async render(input: RenderInput, options: EngineOptions): Promise<EngineResult> {
    if (input.kind !== "html") {
      throw new RenderError("HyperframesEngine solo acepta input de tipo 'html'.");
    }
    const validationError = validateComposition(input);
    if (validationError) throw new RenderError(validationError);

    // El formato lo declara la propia composición (data-width/data-height
    // del elemento raíz) — a diferencia de Playwright/Remotion, acá no hay
    // una segunda composición "mobile" gratis: pedir un formato que la
    // composición no declara falla explícito, no en silencio.
    const declaredFormat = detectDeclaredFormat(input.html);
    for (const format of options.formats) {
      if (format !== declaredFormat) {
        throw new RenderError(
          `Esta composición HyperFrames está declarada en formato '${declaredFormat}' (según data-width/data-height); no puede renderizar '${format}' sin una composición dedicada para ese formato.`,
        );
      }
    }

    const siteDir = path.join(options.workDir, "site");
    await mkdir(siteDir, { recursive: true });
    const document = assembleInlineDocument(input.html, input.css, input.js, options.audioUrl, options.durationSeconds);
    // El compilador de HyperFrames no acepta http://, ni siquiera loopback.
    // Los recursos ya han pasado la validación y descarga de remote-assets;
    // copiarlos junto al index permite que HyperFrames los lea como archivos
    // locales relativos sin volver a abrir la red durante su pipeline.
    const materialized = await materializeLoopbackAssets(document, siteDir, options.assetOrigin);
    // El runtime Lambda exige duración en la raíz de la composición. Las
    // plantillas pueden declararla por clips; para un job de la aplicación el
    // contrato ya provee durationSeconds, así que lo normalizamos al site.
    const renderDocument = ensureCompositionDuration(materialized.document, options.durationSeconds);
    await writeFile(path.join(siteDir, "index.html"), renderDocument, "utf-8");

    // Resolver desde este módulo, no desde cwd: el worker puede arrancar con
    // `pnpm --dir server`, desde la raíz del monorepo o desde Docker.
    const bin = env.HYPERFRAMES_BIN || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../node_modules/.bin/hyperframes");
    const outputName = "out.mp4";
    if (options.worker === "aws") {
      const format = options.formats[0]!;
      const { width, height } = format === "desktop" ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
      const outputKey = `renders/nexa-render/${options.jobId}/${format}.mp4`;
      // hyperframes lambda usa este archivo como contrato del stack ya
      // desplegado. Es metadata pública de infraestructura, no una credencial.
      const lambdaStateDir = path.join(siteDir, ".hyperframes");
      await mkdir(lambdaStateDir, { recursive: true });
      await writeFile(path.join(lambdaStateDir, `lambda-stack-${env.HYPERFRAMES_AWS_STACK_NAME}.json`), JSON.stringify({
        stackName: env.HYPERFRAMES_AWS_STACK_NAME,
        region: env.AWS_REGION,
        bucketName: env.HYPERFRAMES_AWS_BUCKET,
        stateMachineArn: env.HYPERFRAMES_AWS_STATE_MACHINE_ARN,
        functionName: "hyperframes-render",
      }), "utf-8");
      try {
        logger.info({ event: "hyperframes_aws_render_started", jobId: options.jobId, format, stack: env.HYPERFRAMES_AWS_STACK_NAME });
        const result = await execa(bin, [
          "lambda", "render", ".",
          "--stack-name", env.HYPERFRAMES_AWS_STACK_NAME,
          "--region", env.AWS_REGION,
          "--width", String(width), "--height", String(height), "--fps", String(options.fps),
          "--format", "mp4", "--codec", "h264",
          "--chunk-size", String(env.HYPERFRAMES_AWS_CHUNK_SIZE),
          "--max-parallel-chunks", String(env.HYPERFRAMES_AWS_MAX_PARALLEL_CHUNKS),
          "--execution-name", `nexa-${options.jobId}-${format}`.slice(0, 80),
          "--output-key", outputKey, "--wait", "--json",
        ], { cwd: siteDir, timeout: options.timeoutMs });
        logger.info({ event: "hyperframes_aws_render_completed", jobId: options.jobId, format, output: result.stdout });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new RenderError(`'hyperframes lambda render' falló: ${message}`);
      }
      const outputPath = path.join(siteDir, outputName);
      await downloadS3Object(env.HYPERFRAMES_AWS_BUCKET, outputKey, env.AWS_REGION, outputPath);
      return { outputs: [{ format, path: outputPath }], stats: { engine: "hyperframes", worker: "aws", declaredFormat, localAssets: materialized.count, outputKey } };
    }
    try {
      logger.info({ event: "hyperframes_render_started", jobId: options.jobId, declaredFormat, bin });
      const processResult = await execa(bin, ["render", "--workers", "2", "-o", outputName], {
        cwd: siteDir,
        timeout: options.timeoutMs,
      });
      logger.debug({ event: "hyperframes_render_output", jobId: options.jobId, stdout: processResult.stdout });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new RenderError(`'hyperframes render' falló: ${message}`);
    }

    const outputPath = path.join(siteDir, outputName);
    const outputs: EngineOutput[] = options.formats.map((format) => ({ format, path: outputPath }));
    return { outputs, stats: { engine: "hyperframes", declaredFormat, localAssets: materialized.count } };
  }
}

function validateComposition(input: Extract<RenderInput, { kind: "html" }>): string | undefined {
  if (!/data-start=|data-track-index=/.test(input.html)) {
    return "La composición HyperFrames necesita clips con data-start y data-track-index.";
  }
  const compositionId = input.html.match(/data-composition-id=["']([^"']+)["']/i)?.[1];
  if (!compositionId) return "La composición HyperFrames necesita data-composition-id en el elemento raíz.";

  const scripts = `${inlineScripts(input.html)}\n${input.js ?? ""}`;
  const escapedId = compositionId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const registration = new RegExp(`window\\.__timelines\\s*\\[\\s*["']${escapedId}["']\\s*\\]\\s*=`);
  if (!registration.test(scripts)) {
    return `La línea de tiempo debe registrarse con window.__timelines["${compositionId}"] = tl; (el nombre debe coincidir con data-composition-id).`;
  }
  return undefined;
}

function inlineScripts(html: string): string {
  return [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .join("\n");
}

function detectDeclaredFormat(html: string): VideoFormat {
  const width = Number(html.match(/data-width="(\d+)"/)?.[1] ?? 1920);
  const height = Number(html.match(/data-height="(\d+)"/)?.[1] ?? 1080);
  return width >= height ? "desktop" : "mobile";
}

function assembleInlineDocument(html: string, css?: string, js?: string, audioUrl?: string, durationSeconds?: number): string {
  const looksLikeFullDocument = /<html[\s>]/i.test(html);
  const styleTag = css ? `<style>${css}</style>` : "";
  const scriptTag = js ? `<script>${js}</script>` : "";
  const audioTag = audioUrl ? `<audio src="${audioUrl}" data-start="0" data-duration="${durationSeconds ?? 0}" preload="auto"></audio>` : "";

  if (looksLikeFullDocument) {
    return html
      .replace(/<\/head>/i, `${styleTag}</head>`)
      .replace(/<\/body>/i, `${audioTag}${GSAP_CDN_TAG}${scriptTag}</body>`);
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
${styleTag}
</head>
<body>
${html}
${audioTag}
${GSAP_CDN_TAG}
${scriptTag}
</body>
</html>`;
}

function ensureCompositionDuration(document: string, durationSeconds: number): string {
  return document.replace(/(<[^>]*\bdata-composition-id=["'][^"']+["'][^>]*)(>)/i, (tag, start: string, end: string) => {
    if (/\bdata-duration=["']/i.test(tag)) return tag;
    return `${start} data-duration="${durationSeconds}"${end}`;
  });
}

async function materializeLoopbackAssets(
  document: string,
  siteDir: string,
  origin: string | undefined,
): Promise<{ document: string; count: number }> {
  if (!origin) return { document, count: 0 };
  const escapedOrigin = origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escapedOrigin}/([a-f0-9]{64}\\.[a-z0-9]{1,10})`, "gi");
  const urls = [...new Set([...document.matchAll(pattern)].map((match) => match[0]))];
  if (urls.length === 0) return { document, count: 0 };

  const assetDir = path.join(siteDir, "assets");
  await mkdir(assetDir, { recursive: true });
  await Promise.all(urls.map(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new RenderError(`No se pudo copiar el recurso local de HyperFrames '${url}' (HTTP ${response.status}).`);
    const filename = new URL(url).pathname.split("/").at(-1);
    if (!filename) throw new RenderError(`Nombre inválido para recurso local de HyperFrames '${url}'.`);
    await writeFile(path.join(assetDir, filename), new Uint8Array(await response.arrayBuffer()));
  }));

  return { document: document.replaceAll(`${origin}/`, "assets/"), count: urls.length };
}
