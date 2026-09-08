import { execa } from "execa";
import { RenderError } from "../errors.js";

/**
 * Mezcla un video sin audio (grabado por Playwright, .webm) con una pista de
 * audio y codifica a .mp4 final. Wrapper delgado sobre el binario `ffmpeg`
 * del sistema — mismo enfoque que `playwright_ffmpeg_adapter.py`, portado a
 * `execa` (que da timeout y captura de stderr sin código a mano).
 */
export async function muxVideoWithAudio(
  videoPath: string,
  audioPath: string | undefined,
  outputPath: string,
  durationSeconds: number,
  fps: number,
  timeoutMs: number,
): Promise<void> {
  const args = audioPath
    ? [
        "-y",
        "-i", videoPath,
        "-i", audioPath,
        "-c:v", "libx264",
        "-r", String(fps),
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-shortest",
        "-t", String(durationSeconds),
        outputPath,
      ]
    : [
        "-y",
        "-i", videoPath,
        "-c:v", "libx264",
        "-r", String(fps),
        "-pix_fmt", "yuv420p",
        "-an",
        "-t", String(durationSeconds),
        outputPath,
      ];

  try {
    await execa("ffmpeg", args, { timeout: timeoutMs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new RenderError(`FFmpeg falló mezclando el video final: ${message}`);
  }
}
