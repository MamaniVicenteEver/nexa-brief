import type { VideoFormat } from "./port.js";

/** Compartido entre PlaywrightEngine y RemotionEngine — mismas dimensiones
 * para que un mismo `format` ("mobile"/"desktop") signifique lo mismo sin
 * importar qué motor terminó procesando el job. */
export const FORMAT_VIEWPORT: Record<VideoFormat, { width: number; height: number }> = {
  desktop: { width: 1920, height: 1080 },
  mobile: { width: 1080, height: 1920 },
};
