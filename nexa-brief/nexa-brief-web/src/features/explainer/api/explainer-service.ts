import { parseErrorBody } from "@/infrastructure/api/api-error";
import { httpClient, resolveApiUrl } from "@/infrastructure/api/http-client";
import type {
  AgentName,
  BriefInput,
  CategoryDesigns,
  CreateProductionInput,
  DesignGroup,
  ExplainerBrief,
  ExplainerDesign,
  ExplainerJob,
  ExplainerOptions,
  ExplainerVideo,
  Production,
  PublishIssue,
  PublishPackage,
  PublishPackageReview,
  PublishTextsResult,
  RecordExplainerInput,
  TextProvider,
  ThumbnailOptionId,
  TitleOption,
  VideoThumbnails,
} from "../types";

// Capturar las miniaturas abre el navegador del server (~10 s cada una).
const THUMBNAILS_TIMEOUT_MS = 120_000;
// Generar textos o un brief usa un LLM: puede tardar minutos.
const PUBLISH_TEXTS_TIMEOUT_MS = 240_000;
const BRIEF_TIMEOUT_MS = 300_000;
const UPLOAD_TIMEOUT_MS = 300_000;

interface ExplainerJobDto {
  job_id: string;
  video_id: string;
  state: ExplainerJob["state"];
  category_path: string;
  duration: ExplainerJob["duration"];
  publish: boolean;
  privacy: ExplainerJob["privacy"];
  account_selector: string | null;
  error: string | null;
  outputs: string[];
  output_dir: string | null;
  scheduled_job_id: string | null;
  publish_result: { post_id: string; url: string; platform: string; account_alias: string } | null;
  publish_results?: {
    account_selector: string;
    format?: "16x9" | "9x16";
    url?: string;
    error?: string;
  }[];
  formats?: ExplainerJob["formats"];
  render_seconds?: number | null;
}

interface TitleOptionDto {
  option: TitleOption["option"];
  text: string;
  strategy: number;
  emotion: string;
}

interface PublishPackageDto {
  thumbnail: {
    kicker: string;
    text_only: { lines: string[]; highlight: string; pair_title: TitleOption["option"] };
    with_image: {
      text: string;
      pair_title: TitleOption["option"];
      image_side: PublishPackage["thumbnail"]["withImage"]["imageSide"];
    };
    chosen: PublishPackage["thumbnail"]["chosen"];
  };
  titles: {
    youtube: TitleOptionDto[];
    chosen: TitleOption["option"];
  };
  pinned_comment: string;
}

interface PublishPackageReviewDto {
  package: PublishPackageDto | null;
  issues: PublishIssue[];
  thumbnail_image_url: string | null;
  hook_strategy_names: Record<string, string>;
  title_max_chars: number | null;
}

interface ExplainerVideoDto {
  video_id: string;
  design: string;
  category_id: string;
  category_name: string;
  category_path: string;
  title: string;
  topic?: string;
  status: string;
  ready: boolean;
  publish_ready: boolean;
  rendered: string[];
  duration_seconds: number | null;
  youtube_title: string;
  youtube_description?: string;
  youtube_tags?: string[];
  facebook_title?: string;
  facebook_description?: string;
  tiktok_caption?: string;
  tiktok_hashtags?: string[];
  design_name?: string;
  demo?: boolean;
  preview_url: string;
  poster_url?: string | null;
  last_job: ExplainerJobDto | null;
  publish_package?: PublishPackageReviewDto | null;
  thumbnails?: ThumbnailsDto;
}

interface ThumbnailsDto {
  chosen: ThumbnailOptionId | null;
  options: {
    option: ThumbnailOptionId;
    component: string;
    params: Record<string, unknown>;
    url: string | null;
  }[];
}

function mapThumbnails(dto: ThumbnailsDto | undefined): VideoThumbnails {
  return {
    chosen: dto?.chosen ?? null,
    options: (dto?.options ?? []).map((o) => ({
      option: o.option,
      component: o.component,
      params: o.params ?? {},
      url: o.url ? resolveApiUrl(o.url) : null,
    })),
  };
}

function mapPublishPackage(dto: PublishPackageReviewDto): PublishPackageReview {
  const p = dto.package;
  return {
    issues: dto.issues,
    titleMaxChars: dto.title_max_chars ?? 0,
    package: p && {
      thumbnail: {
        kicker: p.thumbnail.kicker,
        textOnly: {
          lines: p.thumbnail.text_only.lines,
          highlight: p.thumbnail.text_only.highlight,
          pairTitle: p.thumbnail.text_only.pair_title,
        },
        withImage: {
          text: p.thumbnail.with_image.text,
          imageUrl: dto.thumbnail_image_url ? resolveApiUrl(dto.thumbnail_image_url) : null,
          pairTitle: p.thumbnail.with_image.pair_title,
          imageSide: p.thumbnail.with_image.image_side,
        },
        chosen: p.thumbnail.chosen,
      },
      titles: {
        youtube: p.titles.youtube.map((t) => ({
          ...t,
          strategyName: dto.hook_strategy_names[String(t.strategy)] ?? "",
        })),
        chosen: p.titles.chosen,
      },
      pinnedComment: p.pinned_comment,
    },
  };
}

function mapJob(dto: ExplainerJobDto): ExplainerJob {
  return {
    jobId: dto.job_id,
    videoId: dto.video_id,
    state: dto.state,
    categoryPath: dto.category_path,
    duration: dto.duration,
    publish: dto.publish,
    privacy: dto.privacy,
    accountSelector: dto.account_selector,
    error: dto.error,
    outputs: dto.outputs,
    outputDir: dto.output_dir,
    scheduledJobId: dto.scheduled_job_id,
    formats: dto.formats ?? [],
    renderSeconds: dto.render_seconds ?? null,
    publishResults: (dto.publish_results ?? []).map((r) => ({
      accountSelector: r.account_selector,
      format: r.format,
      url: r.url ?? null,
      error: r.error ?? null,
    })),
    publishResult: dto.publish_result
      ? {
          postId: dto.publish_result.post_id,
          url: dto.publish_result.url,
          platform: dto.publish_result.platform,
          accountAlias: dto.publish_result.account_alias,
        }
      : null,
  };
}

function mapVideo(dto: ExplainerVideoDto): ExplainerVideo {
  return {
    videoId: dto.video_id,
    design: dto.design,
    categoryId: dto.category_id,
    categoryName: dto.category_name,
    categoryPath: dto.category_path,
    title: dto.title,
    topic: dto.topic ?? "",
    status: dto.status,
    ready: dto.ready,
    publishReady: dto.publish_ready,
    rendered: dto.rendered,
    durationSeconds: dto.duration_seconds,
    youtubeTitle: dto.youtube_title,
    youtubeDescription: dto.youtube_description ?? "",
    youtubeTags: dto.youtube_tags ?? [],
    facebookTitle: dto.facebook_title ?? "",
    facebookDescription: dto.facebook_description ?? "",
    tiktokCaption: dto.tiktok_caption ?? "",
    tiktokHashtags: dto.tiktok_hashtags ?? [],
    designName: dto.design_name ?? dto.design,
    demo: dto.demo ?? false,
    previewUrl: resolveApiUrl(dto.preview_url),
    posterUrl: dto.poster_url ? resolveApiUrl(dto.poster_url) : null,
    lastJob: dto.last_job ? mapJob(dto.last_job) : null,
    publishPackage: dto.publish_package ? mapPublishPackage(dto.publish_package) : null,
    thumbnails: mapThumbnails(dto.thumbnails),
  };
}

function categoryQuery(category?: string): string {
  return category ? `?category=${encodeURIComponent(category)}` : "";
}

export async function getExplainerVideos(
  category?: string,
  signal?: AbortSignal,
): Promise<ExplainerVideo[]> {
  const dtos = await httpClient<ExplainerVideoDto[]>(
    `/api/v1/explainer/videos${categoryQuery(category)}`,
    { signal },
  );
  return dtos.map(mapVideo);
}

export async function recordExplainerVideo(input: RecordExplainerInput): Promise<ExplainerJob> {
  const dto = await httpClient<ExplainerJobDto>(
    `/api/v1/explainer/videos/${input.videoId}/record`,
    {
      method: "POST",
      body: {
        duration: input.duration,
        publish: input.publish,
        privacy: input.privacy,
        account_selector: input.accountSelector ?? null,
        account_selectors: input.accountSelectors ?? [],
        formats: input.formats ?? ["16x9"],
        account_formats: input.accountFormats ?? null,
        thumbnail: input.thumbnail ?? null,
      },
    },
  );
  return mapJob(dto);
}

/** Estado de una grabación, también cuando se cierra el modal de Plantillas. */
export async function getExplainerJob(jobId: string, signal?: AbortSignal): Promise<ExplainerJob> {
  const dto = await httpClient<ExplainerJobDto>(`/api/v1/explainer/jobs/${jobId}`, { signal });
  return mapJob(dto);
}

/** Captura de nuevo las miniaturas A (introv1) y B (introv2) con los textos actuales. */
export async function captureThumbnails(videoId: string): Promise<VideoThumbnails> {
  const dto = await httpClient<ThumbnailsDto>(`/api/v1/explainer/videos/${videoId}/thumbnails`, {
    method: "POST",
    timeoutMs: THUMBNAILS_TIMEOUT_MS,
  });
  return mapThumbnails(dto);
}

/** Elige la miniatura que se sube a YouTube (queda guardada en el video). */
export async function chooseThumbnail(
  videoId: string,
  option: ThumbnailOptionId,
): Promise<VideoThumbnails> {
  const dto = await httpClient<ThumbnailsDto>(`/api/v1/explainer/videos/${videoId}/thumbnail`, {
    method: "PUT",
    body: { option },
    timeoutMs: THUMBNAILS_TIMEOUT_MS,
  });
  return mapThumbnails(dto);
}

export async function generatePublishTexts(input: {
  videoId: string;
  provider?: TextProvider;
  overwrite?: boolean;
}): Promise<PublishTextsResult> {
  const dto = await httpClient<{ video_id: string; written: boolean; brief: ExplainerBrief }>(
    `/api/v1/explainer/videos/${input.videoId}/publish-texts`,
    {
      method: "POST",
      body: { provider: input.provider ?? null, overwrite: input.overwrite ?? false },
      timeoutMs: PUBLISH_TEXTS_TIMEOUT_MS,
    },
  );
  return { videoId: dto.video_id, written: dto.written, brief: dto.brief };
}

// ── Crear: opciones, diseños, textos y producción ──────────────────────────

interface OptionsDto {
  agents: { name: AgentName; available: boolean }[];
  text_providers: { name: TextProvider; available: boolean }[];
  default_agent: AgentName;
  default_text_provider: TextProvider;
  lengths: {
    presets: { minutes: number; id: string; label: string }[];
    default_minutes: number;
    min_minutes: number;
    max_minutes: number;
  };
}

export async function getExplainerOptions(signal?: AbortSignal): Promise<ExplainerOptions> {
  const dto = await httpClient<OptionsDto>("/api/v1/explainer/options", { signal });
  return {
    agents: dto.agents,
    textProviders: dto.text_providers,
    defaultAgent: dto.default_agent,
    defaultTextProvider: dto.default_text_provider,
    lengths: {
      presets: dto.lengths.presets,
      defaultMinutes: dto.lengths.default_minutes,
      minMinutes: dto.lengths.min_minutes,
      maxMinutes: dto.lengths.max_minutes,
    },
  };
}

interface DesignDto {
  design_id: string;
  name: string;
  tagline: string;
  topics: string[];
  voice: string;
  category_path: string | null;
  preview_url: string | null;
  poster_url?: string | null;
  video_url?: string | null;
  video_portrait_url?: string | null;
}

interface DesignsDto {
  category_path: string;
  shared: boolean;
  designs: DesignDto[];
}

function mapDesign(d: DesignDto): ExplainerDesign {
  return {
    designId: d.design_id,
    name: d.name,
    tagline: d.tagline,
    topics: d.topics,
    voice: d.voice,
    categoryPath: d.category_path,
    previewUrl: d.preview_url ? resolveApiUrl(d.preview_url) : null,
    posterUrl: d.poster_url ? resolveApiUrl(d.poster_url) : null,
    videoUrl: d.video_url ? resolveApiUrl(d.video_url) : null,
    videoPortraitUrl: d.video_portrait_url ? resolveApiUrl(d.video_portrait_url) : null,
  };
}

/** Todos los diseños del kit, agrupados por categoría; `first` va primero. */
export async function getDesignGroups(first: string, signal?: AbortSignal): Promise<DesignGroup[]> {
  const dtos = await httpClient<
    { category_path: string; category_name: string; designs: DesignDto[] }[]
  >(`/api/v1/explainer/design-groups?first=${encodeURIComponent(first)}`, { signal });
  return dtos.map((g) => ({
    categoryPath: g.category_path,
    categoryName: g.category_name,
    designs: g.designs.map(mapDesign),
  }));
}

export async function getCategoryDesigns(
  category: string,
  signal?: AbortSignal,
): Promise<CategoryDesigns> {
  const dto = await httpClient<DesignsDto>(`/api/v1/explainer/designs${categoryQuery(category)}`, {
    signal,
  });
  return {
    categoryPath: dto.category_path,
    shared: dto.shared,
    designs: dto.designs.map(mapDesign),
  };
}

export async function generateBrief(input: BriefInput): Promise<ExplainerBrief> {
  return httpClient<ExplainerBrief>("/api/v1/explainer/briefs", {
    method: "POST",
    body: {
      category_path: input.categoryPath,
      topic: input.topic,
      description: input.description ?? "",
      design: input.design ?? null,
      provider: input.provider ?? null,
      media_names: input.mediaNames ?? [],
      minutes: input.minutes ?? null,
    },
    timeoutMs: BRIEF_TIMEOUT_MS,
  });
}

interface ProductionDto {
  production_id: string;
  video_id: string;
  category_path: string;
  design: string;
  topic: string;
  description?: string;
  agent: string;
  auto_record?: boolean;
  state: Production["state"];
  error?: string | null;
  video_status?: string | null;
  record_job_id?: string | null;
  media?: string[];
  brief?: ExplainerBrief | null;
  agent_report?: string | null;
  plan_item_id?: string | null;
  created_at: string;
  updated_at: string;
  log_tail?: string | null;
}

function mapProduction(dto: ProductionDto): Production {
  return {
    productionId: dto.production_id,
    videoId: dto.video_id,
    categoryPath: dto.category_path,
    design: dto.design,
    topic: dto.topic,
    description: dto.description ?? "",
    agent: dto.agent,
    autoRecord: dto.auto_record ?? false,
    state: dto.state,
    error: dto.error ?? null,
    videoStatus: dto.video_status ?? null,
    recordJobId: dto.record_job_id ?? null,
    media: dto.media ?? [],
    brief: dto.brief ?? null,
    agentReport: dto.agent_report ?? null,
    planItemId: dto.plan_item_id ?? null,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    logTail: dto.log_tail ?? null,
  };
}

/** Multipart: `payload` (JSON) + `files` (imágenes/videos opcionales). */
export async function createProduction(input: CreateProductionInput): Promise<Production> {
  const form = new FormData();
  form.append(
    "payload",
    JSON.stringify({
      category_path: input.categoryPath,
      design: input.design,
      topic: input.topic,
      description: input.description ?? "",
      agent: input.agent ?? null,
      brief: input.brief ?? null,
      auto_record: input.autoRecord ?? false,
      plan_item_id: input.planItemId ?? null,
      minutes: input.minutes ?? null,
    }),
  );
  for (const file of input.files ?? []) form.append("files", file);
  const dto = await httpClient<ProductionDto>("/api/v1/explainer/productions", {
    method: "POST",
    body: form,
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
  return mapProduction(dto);
}

export async function getProductions(
  category?: string,
  signal?: AbortSignal,
): Promise<Production[]> {
  const dtos = await httpClient<ProductionDto[]>(
    `/api/v1/explainer/productions${categoryQuery(category)}`,
    { signal },
  );
  return dtos.map(mapProduction);
}

export async function getProduction(id: string, signal?: AbortSignal): Promise<Production> {
  const dto = await httpClient<ProductionDto>(`/api/v1/explainer/productions/${id}`, { signal });
  return mapProduction(dto);
}

export async function resumeProduction(id: string): Promise<Production> {
  const dto = await httpClient<ProductionDto>(`/api/v1/explainer/productions/${id}/resume`, {
    method: "POST",
  });
  return mapProduction(dto);
}

/** Escuchar la voz del narrador (WAV). No pasa por httpClient porque devuelve un blob. */
export async function previewVoice(input: { text: string; voice?: string }): Promise<Blob> {
  const res = await fetch(resolveApiUrl("/api/v1/voice/preview"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: input.text, voice: input.voice || null }),
  });
  if (!res.ok) throw parseErrorBody(res.status, await res.json().catch(() => null));
  return res.blob();
}
