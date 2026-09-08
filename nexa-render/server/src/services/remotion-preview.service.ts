import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { env } from "../config/env.js";
import { generateRemotionEntrySource } from "../engines/remotion/remotion-engine.js";
import { RenderError } from "../engines/errors.js";
import { FORMAT_VIEWPORT } from "../engines/format-viewport.js";
import type { Fps, VideoFormat } from "../engines/port.js";
import { resolveRemoteAssets } from "../sandbox/remote-assets.js";

const COMPOSITION_ID = "Main";

export interface RemotionPreviewRequest {
  componentSource: string;
  props: Record<string, unknown>;
  fps: Fps;
  durationSeconds: number;
  format: VideoFormat;
  frame?: number;
}

/** Renderiza un cuadro PNG real del mismo JSX que se usará en el MP4 final. */
export async function renderRemotionPreview(request: RemotionPreviewRequest): Promise<Buffer> {
  const workDir = await mkdtemp(path.join(os.tmpdir(), "nexa-remotion-preview-"));
  let stopAssets: (() => Promise<void>) | undefined;
  try {
    const resolved = await resolveRemoteAssets(
      { kind: "react", componentSource: request.componentSource, props: request.props },
      undefined,
      {
        workDir,
        allowlist: env.NETWORK_ALLOWLIST,
        timeoutMs: env.REMOTE_ASSET_TIMEOUT_MS,
        maxBytes: env.REMOTE_ASSET_MAX_BYTES,
        maxRedirects: env.REMOTE_ASSET_MAX_REDIRECTS,
      },
    );
    stopAssets = resolved.stop;
    if (resolved.input.kind !== "react") throw new RenderError("El preview de Remotion requiere un componente React.");

    const durationInFrames = Math.max(1, Math.round(request.durationSeconds * request.fps));
    const { width, height } = FORMAT_VIEWPORT[request.format];
    const componentPath = path.join(workDir, "Component.jsx");
    const entryPath = path.join(workDir, "entry.jsx");
    await writeFile(componentPath, resolved.input.componentSource, "utf-8");
    await writeFile(
      entryPath,
      generateRemotionEntrySource({
        width,
        height,
        fps: request.fps,
        durationInFrames,
        props: resolved.input.props ?? {},
      }),
      "utf-8",
    );

    const serveUrl = await bundle({ entryPoint: entryPath });
    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps: resolved.input.props ?? {},
      timeoutInMilliseconds: env.JOB_TIMEOUT_MS,
    });
    const frame = Math.min(
      Math.max(0, request.frame ?? Math.round(request.fps * 0.5)),
      durationInFrames - 1,
    );
    const outputPath = path.join(workDir, "preview.png");
    await renderStill({
      composition,
      serveUrl,
      output: outputPath,
      frame,
      imageFormat: "png",
      inputProps: resolved.input.props ?? {},
      scale: 0.5,
      timeoutInMilliseconds: env.JOB_TIMEOUT_MS,
    });
    return await readFile(outputPath);
  } catch (error) {
    if (error instanceof RenderError) throw error;
    throw new RenderError(error instanceof Error ? error.message : "No se pudo generar el preview de Remotion.");
  } finally {
    await stopAssets?.();
    await rm(workDir, { recursive: true, force: true });
  }
}
