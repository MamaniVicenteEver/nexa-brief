import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { EngineOptions, EngineOutput, EngineResult, RenderEngine, RenderInput, VideoFormat } from "../port.js";
import { RenderError } from "../errors.js";
import { FORMAT_VIEWPORT } from "../format-viewport.js";
import { logger } from "../../observability/logger.js";
import { renderRemotionOnAws } from "./remotion-aws.js";

const COMPOSITION_ID = "Main";

/**
 * Motor real (in-process, no subproceso — simplificación deliberada frente
 * al diseño original documentado acá: @remotion/bundler y @remotion/renderer
 * son funciones async normales, no hace falta aislarlas en otro proceso
 * para una prueba end-to-end). `input.componentSource` es JSX moderno:
 * `export default function Component(props) {...}` + constantes opcionales
 * `FPS`/`DURATION_IN_FRAMES` (width/height los define SIEMPRE el formato
 * pedido, no el componente — ver generateEntrySource). El bundler de
 * Remotion ya sabe transpilar JSX, no hace falta imitar el `module.exports`
 * CommonJS de nexa-brief-remotion.
 */
export class RemotionEngine implements RenderEngine {
  readonly name = "remotion" as const;

  canHandle(input: RenderInput): boolean {
    return input.kind === "react";
  }

  async render(input: RenderInput, options: EngineOptions): Promise<EngineResult> {
    if (input.kind !== "react") {
      throw new RenderError("RemotionEngine solo acepta input de tipo 'react'.");
    }

    const componentPath = path.join(options.workDir, "Component.jsx");
    await writeFile(componentPath, input.componentSource, "utf-8");

    const durationInFrames = Math.max(1, Math.round(options.durationSeconds * options.fps));
    const props = input.props ?? {};

    if (options.worker === "aws") {
      const outputs = await renderRemotionOnAws({
        input,
        options,
        durationInFrames,
        buildBundle: async (format, bundleProps, audioUrl) => this.bundleFormat(format, options, durationInFrames, bundleProps, audioUrl),
      });
      return { outputs, stats: { engine: "remotion", worker: "aws", formats: options.formats } };
    }

    const outputs: EngineOutput[] = [];
    for (const format of options.formats) {
      logger.info({ event: "remotion_format_started", jobId: options.jobId, format });
      const output = await this.renderFormat(format, options, durationInFrames, props);
      outputs.push(output);
      logger.info({ event: "remotion_format_completed", jobId: options.jobId, format, outputPath: output.path });
    }
    return { outputs, stats: { engine: "remotion", formats: options.formats } };
  }

  private async renderFormat(
    format: VideoFormat,
    options: EngineOptions,
    durationInFrames: number,
    props: Record<string, unknown>,
  ): Promise<EngineOutput> {
    const serveUrl = await this.bundleFormat(format, options, durationInFrames, props, options.audioUrl);

    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps: props,
      timeoutInMilliseconds: options.timeoutMs,
    });

    const outputLocation = path.join(options.workDir, `output-${format}.mp4`);
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation,
      inputProps: props,
      timeoutInMilliseconds: options.timeoutMs,
      onProgress: ({ progress }) => {
        const percent = Math.round(progress * 100);
        if (percent % 25 === 0) logger.debug({ event: "remotion_render_progress", jobId: options.jobId, format, percent });
      },
    });

    return { format, path: outputLocation };
  }

  private async bundleFormat(format: VideoFormat, options: EngineOptions, durationInFrames: number, props: Record<string, unknown>, audioUrl?: string): Promise<string> {
    const { width, height } = FORMAT_VIEWPORT[format];
    const entryPath = path.join(options.workDir, `entry-${format}.jsx`);
    await mkdir(options.workDir, { recursive: true });
    await writeFile(entryPath, generateRemotionEntrySource({ width, height, fps: options.fps, durationInFrames, props, audioUrl }), "utf-8");
    logger.info({ event: "remotion_bundle_started", jobId: options.jobId, format });
    const bundleDir = await bundle({ entryPoint: entryPath });
    logger.info({ event: "remotion_bundle_completed", jobId: options.jobId, format });
    return bundleDir;
  }
}

export function generateRemotionEntrySource(opts: {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  props: Record<string, unknown>;
  audioUrl?: string;
}): string {
  // React.createElement en vez de JSX en ESTE archivo (a propósito) — el
  // bundler transpila JSX igual, pero así el entry point no depende de que
  // el loader configurado trate .jsx exactamente como esperamos; es la
  // parte generada por nosotros, conviene que sea lo más "plana" posible.
  return `import React from "react";
import { registerRoot, Composition, Audio } from "remotion";
import Component from "./Component.jsx";

const WithOptionalAudio = (props) =>
  React.createElement(React.Fragment, null,
    React.createElement(Component, props),
    ${opts.audioUrl ? `React.createElement(Audio, {src: ${JSON.stringify(opts.audioUrl)}})` : "null"},
  );

const RootComponent = () =>
  React.createElement(Composition, {
    id: ${JSON.stringify(COMPOSITION_ID)},
    component: WithOptionalAudio,
    fps: ${opts.fps},
    width: ${opts.width},
    height: ${opts.height},
    durationInFrames: ${opts.durationInFrames},
    defaultProps: ${JSON.stringify(opts.props)},
  });

registerRoot(RootComponent);
`;
}
