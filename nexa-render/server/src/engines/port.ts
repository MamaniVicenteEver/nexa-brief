/**
 * RenderEngine — el contrato central que implementan los 3 motores.
 *
 * Forma portada de `nexa-brief-server/src/core/ports/recorder_port.py`
 * (RecorderPort.record(html_path, audio_path, output_dir, duration_seconds,
 * niche_cfg) -> RecordingResult), generalizada para aceptar también
 * composiciones React (Remotion) y para devolver un output por formato
 * en vez de campos fijos youtube/reels/tiktok — acá "formato" es genérico
 * (mobile/desktop), no atado a plataformas de publicación como en Nexa Brief.
 */

export type VideoFormat = "mobile" | "desktop";
export type Fps = 30 | 60;
export type EngineName = "playwright" | "remotion" | "hyperframes";
export type WorkerTarget = "local" | "aws";

export type RenderInput =
  | { kind: "html"; html: string; css?: string; js?: string }
  | { kind: "react"; componentSource: string; props?: Record<string, unknown> };

export interface EngineOptions {
  jobId: string;
  worker: WorkerTarget;
  /** Directorio efímero exclusivo de este job — se borra al terminar salvo
   * KEEP_WORKDIRS=true. Cada motor escribe sus artefactos intermedios acá. */
  workDir: string;
  fps: Fps;
  formats: VideoFormat[];
  /** Si viene, la duración se deriva de este archivo de audio. Si no, se usa
   * DEFAULT_STATIC_DURATION_SECONDS (ver server/.env.example). */
  audioPath?: string;
  /** URL local de una pista de audio remota materializada para motores de navegador. */
  audioUrl?: string;
  /** Origen loopback que sirve imágenes, video, fuentes y JSON materializados. */
  assetOrigin?: string;
  /** Directorio de recursos remotos ya validados, útil para subirlos al worker AWS. */
  assetDir?: string;
  durationSeconds: number;
  timeoutMs: number;
  /** Dominios externos permitidos durante la captura (además del servidor
   * estático efímero del propio job) — ver sandbox/network-guard más abajo. */
  networkAllowlist: string[];
}

export interface EngineOutput {
  format: VideoFormat;
  path: string;
}

export interface EngineResult {
  outputs: EngineOutput[];
  stats: Record<string, unknown>;
}

export interface RenderEngine {
  readonly name: EngineName;
  /** True si este motor puede razonablemente procesar `input` — usado por
   * selectEngine() en factory.ts para la regla de auto-selección. */
  canHandle(input: RenderInput): boolean;
  /** Lanza EngineError (o una subclase) en caso de fallo — nunca resuelve
   * con un resultado parcial/silencioso. */
  render(input: RenderInput, options: EngineOptions): Promise<EngineResult>;
}
