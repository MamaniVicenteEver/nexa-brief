import type { JobTechnical, JobTechnicalFile } from "../../api/job-technical-service";
import { formatDuration, formatElapsed } from "../../library-status";
import { formatLabel } from "./publication-rows";

/** Fila de la tabla: `label` es una clave de `library.playerSidebar.technical.rows`.
 * `value` null se muestra como "—"; `valueKey` es un valor que también se traduce. */
export interface TechnicalRow {
  label: string;
  value: string | null;
  valueKey?: string;
  mono?: boolean;
}

export interface TechnicalSection {
  /** null = la sección general; si no, la clave del archivo ("16x9", "instagram"…). */
  fileKey: JobTechnicalFile["key"] | null;
  fileName?: string;
  rows: TechnicalRow[];
}

const ENGINE_LABEL: Record<string, string> = {
  hyperframes: "HyperFrames",
  remotion: "Remotion",
  playwright: "Playwright",
  "explainer-kit": "Explainer kit",
};

const TARGET_LABEL: Record<string, string> = { local: "Local", aws: "AWS" };

function seconds(value: number | null, format: (s: number) => string): string | null {
  return value === null ? null : format(value);
}

function joinParts(parts: (string | null | undefined | false)[]): string | null {
  const present = parts.filter(Boolean);
  return present.length ? present.join(" · ") : null;
}

function engineValue(data: JobTechnical): string | null {
  if (!data.engine) return null;
  const engine = ENGINE_LABEL[data.engine] ?? data.engine;
  const target = data.engineTarget ? (TARGET_LABEL[data.engineTarget] ?? data.engineTarget) : null;
  return joinParts([engine, target]);
}

function strategiesValue(strategies: Record<string, string>): string | null {
  const entries = Object.entries(strategies);
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join("\n") : null;
}

function fileRows(file: JobTechnicalFile): TechnicalRow[] {
  const audio = joinParts([
    file.audioCodec?.toUpperCase(),
    file.audioBitrateKbps !== null && `${file.audioBitrateKbps} kbps`,
    file.audioSampleRateKhz !== null && `${file.audioSampleRateKhz} kHz`,
    file.audioChannels !== null && `${file.audioChannels} ch`,
  ]);
  return [
    {
      label: "resolution",
      value: file.width && file.height ? `${file.width} × ${file.height}` : null,
    },
    { label: "fps", value: file.fps === null ? null : String(file.fps) },
    { label: "videoCodec", value: file.videoCodec?.toUpperCase() ?? null },
    {
      label: "videoBitrate",
      value:
        file.videoBitrateKbps !== null
          ? `${(file.videoBitrateKbps / 1000).toFixed(2)} Mbps`
          : file.totalBitrateKbps !== null
            ? `${(file.totalBitrateKbps / 1000).toFixed(2)} Mbps`
            : null,
    },
    { label: "audio", value: audio },
    { label: "size", value: file.sizeMb === null ? null : `${file.sizeMb.toFixed(1)} MB` },
  ];
}

/** Arma la tabla de "Info técnica" (sección general + una por archivo). */
export function buildTechnicalSections(
  data: JobTechnical,
  categoryLabel: string,
  formatDate: (iso: string) => string,
): TechnicalSection[] {
  const general: TechnicalRow[] = [
    { label: "jobId", value: data.jobId, mono: true },
    { label: "source", value: null, valueKey: `source.${data.source}` },
    { label: "category", value: categoryLabel || data.category },
    {
      label: "template",
      value:
        data.templateLabel && data.template && data.templateLabel !== data.template
          ? `${data.templateLabel} (${data.template})`
          : (data.templateLabel ?? data.template),
    },
    { label: "engine", value: engineValue(data) },
    { label: "duration", value: seconds(data.durationSeconds, formatDuration) },
    { label: "generation", value: seconds(data.generationSeconds, formatElapsed) },
    { label: "render", value: seconds(data.renderSeconds, formatElapsed) },
    {
      label: "formats",
      value: data.formats.length ? data.formats.map(formatLabel).join(", ") : null,
    },
    { label: "language", value: data.language },
    { label: "strategies", value: strategiesValue(data.strategies), mono: true },
    { label: "createdAt", value: data.createdAt ? formatDate(data.createdAt) : null },
    { label: "updatedAt", value: data.updatedAt ? formatDate(data.updatedAt) : null },
    { label: "outputDir", value: data.outputDir, mono: true },
  ];
  if (data.renderPasses.length > 0) {
    general.splice(8, 0, { label: "passes", value: data.renderPasses.join(", "), mono: true });
  }
  return [
    { fileKey: null, rows: general },
    ...data.files.map((file) => ({
      fileKey: file.key,
      fileName: file.fileName,
      rows: fileRows(file),
    })),
  ];
}
