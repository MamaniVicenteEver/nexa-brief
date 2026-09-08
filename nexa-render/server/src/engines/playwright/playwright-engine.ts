import { mkdir, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import type { EngineOptions, EngineOutput, EngineResult, RenderEngine, RenderInput, VideoFormat } from "../port.js";
import { RenderError } from "../errors.js";
import { EphemeralStaticServer } from "./static-server.js";
import { installNetworkGuard } from "../../sandbox/network-guard.js";
import { muxVideoWithAudio } from "./ffmpeg-mux.js";
import { FORMAT_VIEWPORT } from "../format-viewport.js";
import { logger } from "../../observability/logger.js";

/**
 * Motor genérico: abre CUALQUIER HTML/CSS/JS autocontenido en Chromium
 * headless y graba el viewport en tiempo real. Puerto de la lógica de
 * `playwright_ffmpeg_adapter.py` (nexa-brief-server), con dos cambios
 * deliberados:
 *   1. Espera `networkidle` antes del primer frame (ausente en el original) —
 *      evita capturar fuentes/imágenes a medio cargar.
 *   2. NO usa `--disable-web-security` — en cambio, un allowlist de red
 *      explícito (ver sandbox/network-guard.ts), porque acá el HTML puede
 *      venir de un tercero, a diferencia del HTML siempre-propio de Nexa Brief.
 */
export class PlaywrightEngine implements RenderEngine {
  readonly name = "playwright" as const;

  canHandle(input: RenderInput): boolean {
    // Único motor verdaderamente genérico — respaldo universal para
    // cualquier HTML/CSS/JS. No puede compilar un componente React crudo
    // (eso requiere un bundler, que es el trabajo de Remotion).
    return input.kind === "html";
  }

  async render(input: RenderInput, options: EngineOptions): Promise<EngineResult> {
    if (input.kind !== "html") {
      throw new RenderError("PlaywrightEngine solo acepta input de tipo 'html'.");
    }

    const siteDir = path.join(options.workDir, "site");
    await mkdir(siteDir, { recursive: true });
    await this.writeSite(siteDir, input.html, input.css, input.js);

    const server = new EphemeralStaticServer(siteDir);
    const { origin } = await server.start();

    try {
    const outputs: EngineOutput[] = [];
    for (const format of options.formats) {
        logger.info({ event: "playwright_format_started", jobId: options.jobId, format });
        const output = await this.renderFormat(format, origin, options);
        outputs.push(output);
        logger.info({ event: "playwright_format_completed", jobId: options.jobId, format, outputPath: output.path });
      }
      return { outputs, stats: { engine: "playwright", formats: options.formats } };
    } finally {
      await server.stop();
    }
  }

  private async writeSite(siteDir: string, html: string, css?: string, js?: string): Promise<void> {
    const document = this.assembleDocument(html, Boolean(css), Boolean(js));
    await writeFile(path.join(siteDir, "index.html"), document, "utf-8");
    if (css) await writeFile(path.join(siteDir, "styles.css"), css, "utf-8");
    if (js) await writeFile(path.join(siteDir, "script.js"), js, "utf-8");
  }

  private assembleDocument(html: string, hasCss: boolean, hasJs: boolean): string {
    // Si `html` ya es un documento completo (<html>/<head> presentes), se usa
    // tal cual y css/js se inyectan igual antes de </head> y </body> por si
    // el usuario los mandó por separado además de un documento completo.
    const looksLikeFullDocument = /<html[\s>]/i.test(html);
    const cssTag = hasCss ? '<link rel="stylesheet" href="/styles.css" />' : "";
    const jsTag = hasJs ? '<script src="/script.js"></script>' : "";

    if (looksLikeFullDocument) {
      return html
        .replace(/<\/head>/i, `${cssTag}</head>`)
        .replace(/<\/body>/i, `${jsTag}</body>`);
    }

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
${cssTag}
</head>
<body>
${html}
${jsTag}
</body>
</html>`;
  }

  private async renderFormat(format: VideoFormat, origin: string, options: EngineOptions): Promise<EngineOutput> {
    const viewport = FORMAT_VIEWPORT[format];
    const videoDir = path.join(options.workDir, `video-${format}`);
    await mkdir(videoDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport,
        recordVideo: { dir: videoDir, size: viewport },
      });
      const page = await context.newPage();
      installNetworkGuard(page, [origin, ...(options.assetOrigin ? [options.assetOrigin] : [])], options.networkAllowlist);

      await page.goto(origin, { waitUntil: "networkidle", timeout: options.timeoutMs });
      await page.waitForTimeout(options.durationSeconds * 1000);

      await context.close(); // flushes the recorded .webm to videoDir
      const webmPath = await this.findRecordedVideo(videoDir);

      const outputPath = path.join(options.workDir, `output-${format}.mp4`);
      await muxVideoWithAudio(
        webmPath,
        options.audioPath,
        outputPath,
        options.durationSeconds,
        options.fps,
        options.timeoutMs,
      );

      return { format, path: outputPath };
    } finally {
      await browser.close();
    }
  }

  private async findRecordedVideo(videoDir: string): Promise<string> {
    const files = await readdir(videoDir);
    const webm = files.find((f) => f.endsWith(".webm"));
    if (!webm) {
      throw new RenderError(`Playwright no generó ningún .webm en ${videoDir}.`);
    }
    const finalPath = path.join(videoDir, "recording.webm");
    await rename(path.join(videoDir, webm), finalPath);
    return finalPath;
  }
}
