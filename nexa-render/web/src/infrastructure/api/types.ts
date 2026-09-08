export type EngineName = "playwright" | "remotion" | "hyperframes";
export type WorkerTarget = "local" | "aws";
export type Fps = 30 | 60;
export type VideoFormat = "mobile" | "desktop";

export type RenderInput =
  | { kind: "html"; html: string; css?: string; js?: string }
  | { kind: "react"; componentSource: string; props?: Record<string, unknown> };

export interface EngineStatus {
  name: EngineName;
  implemented: boolean;
  supportsReact: boolean;
  workerTargets: WorkerTarget[];
}

export interface TemplateSummary {
  slug: string;
  engine: EngineName;
  engineImplemented: boolean;
  title: string;
  description: string;
}

export interface TemplateDetail extends TemplateSummary {
  input: RenderInput;
}

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface EngineOutput {
  format: VideoFormat;
  path: string;
}

export interface EngineResult {
  outputs: EngineOutput[];
  stats: Record<string, unknown>;
}

export interface RenderJob {
  id: string;
  input: RenderInput;
  engineRequested: string;
  engineUsed?: EngineName;
  worker: WorkerTarget;
  fps: Fps;
  formats: VideoFormat[];
  audioUrl?: string;
  status: JobStatus;
  result?: EngineResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitJobPayload {
  input: RenderInput;
  engine?: EngineName | "auto";
  worker?: WorkerTarget;
  fps?: Fps;
  formats?: VideoFormat[];
  audioUrl?: string;
  durationSeconds?: number;
}

export interface GalleryItem {
  id: string;
  jobId: string;
  engine: EngineName;
  format: VideoFormat;
  filename: string;
  fps: number;
  bytes: number;
  durationSeconds?: number;
  codec?: string;
  width?: number;
  height?: number;
  completedAt: string;
  videoUrl: string;
}

export interface GalleryResponse {
  items: GalleryItem[];
  categories: Array<{ engine: EngineName; count: number }>;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}

export interface RenderStudioDetail {
  jobId: string;
  engine: EngineName;
  input: RenderInput;
  settings: { worker: WorkerTarget; fps: Fps; formats: VideoFormat[]; durationSeconds?: number };
}
