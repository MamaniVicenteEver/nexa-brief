import { httpClient } from "@/infrastructure/api/http-client";

/** Clave de cada MP4 del job ("instagram" = la copia `-ig.mp4` para Instagram). */
export type TechnicalFileKey = "16x9" | "9x16" | "tiktok" | "instagram";

interface JobTechnicalFileDto {
  key: TechnicalFileKey;
  file_name: string;
  size_mb: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  video_codec: string | null;
  video_bitrate_kbps: number | null;
  total_bitrate_kbps: number | null;
  audio_codec: string | null;
  audio_bitrate_kbps: number | null;
  audio_sample_rate_khz: number | null;
  audio_channels: number | null;
  duration_seconds: number | null;
}

interface JobTechnicalDto {
  job_id: string;
  source: "pipeline" | "explainer";
  category: string | null;
  template: string | null;
  template_label: string | null;
  engine: string | null;
  engine_target: string | null;
  render_seconds: number | null;
  render_passes: string[];
  duration_seconds: number | null;
  generation_seconds: number | null;
  formats: string[];
  files: JobTechnicalFileDto[];
  language: string | null;
  strategies: Record<string, string>;
  created_at: string | null;
  updated_at: string | null;
  output_dir: string | null;
}

export interface JobTechnicalFile {
  key: TechnicalFileKey;
  fileName: string;
  sizeMb: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  videoCodec: string | null;
  videoBitrateKbps: number | null;
  totalBitrateKbps: number | null;
  audioCodec: string | null;
  audioBitrateKbps: number | null;
  audioSampleRateKhz: number | null;
  audioChannels: number | null;
}

/** GET /videos/jobs/{id}/technical — lo desconocido llega en null (se muestra "—"). */
export interface JobTechnical {
  jobId: string;
  source: "pipeline" | "explainer";
  category: string | null;
  template: string | null;
  templateLabel: string | null;
  engine: string | null;
  engineTarget: string | null;
  renderSeconds: number | null;
  renderPasses: string[];
  durationSeconds: number | null;
  generationSeconds: number | null;
  formats: string[];
  files: JobTechnicalFile[];
  language: string | null;
  strategies: Record<string, string>;
  createdAt: string | null;
  updatedAt: string | null;
  outputDir: string | null;
}

function mapFile(dto: JobTechnicalFileDto): JobTechnicalFile {
  return {
    key: dto.key,
    fileName: dto.file_name,
    sizeMb: dto.size_mb,
    width: dto.width,
    height: dto.height,
    fps: dto.fps,
    videoCodec: dto.video_codec,
    videoBitrateKbps: dto.video_bitrate_kbps,
    totalBitrateKbps: dto.total_bitrate_kbps,
    audioCodec: dto.audio_codec,
    audioBitrateKbps: dto.audio_bitrate_kbps,
    audioSampleRateKhz: dto.audio_sample_rate_khz,
    audioChannels: dto.audio_channels,
  };
}

export async function getJobTechnical(jobId: string, signal?: AbortSignal): Promise<JobTechnical> {
  const dto = await httpClient<JobTechnicalDto>(`/api/v1/videos/jobs/${jobId}/technical`, {
    signal,
  });
  return {
    jobId: dto.job_id,
    source: dto.source,
    category: dto.category,
    template: dto.template,
    templateLabel: dto.template_label,
    engine: dto.engine,
    engineTarget: dto.engine_target,
    renderSeconds: dto.render_seconds,
    renderPasses: dto.render_passes,
    durationSeconds: dto.duration_seconds,
    generationSeconds: dto.generation_seconds,
    formats: dto.formats,
    files: dto.files.map(mapFile),
    language: dto.language,
    strategies: dto.strategies,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    outputDir: dto.output_dir,
  };
}
