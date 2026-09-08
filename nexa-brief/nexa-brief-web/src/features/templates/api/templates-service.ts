import type { JobStage } from "@/features/create-video/types";
import { httpClient, resolveApiUrl } from "@/infrastructure/api/http-client";
import { appendResourceSourceFields, type ResourceSelection } from "@/shared/lib/resource-source";
import type { PreviewFile, PreviewStatus, Template, TemplatePreviewHandle } from "../types";

interface TemplateDto {
  template_id: string;
  niche_id: string;
  display_name: string;
  native_orientation: Template["nativeOrientation"];
  requires_image: boolean;
  requires_video: boolean;
  requires_lyrics: boolean;
  active: boolean;
}

function mapTemplate(dto: TemplateDto): Template {
  return {
    id: dto.template_id,
    nicheId: dto.niche_id,
    displayName: dto.display_name,
    nativeOrientation: dto.native_orientation,
    requiresImage: dto.requires_image,
    requiresVideo: dto.requires_video,
    requiresLyrics: dto.requires_lyrics,
    active: dto.active,
  };
}

export async function getTemplates(signal?: AbortSignal): Promise<Template[]> {
  const dtos = await httpClient<TemplateDto[]>("/api/v1/templates", { signal });
  return dtos.map(mapTemplate);
}

export async function getTemplate(templateId: string, signal?: AbortSignal): Promise<Template> {
  const dto = await httpClient<TemplateDto>(`/api/v1/templates/${templateId}`, { signal });
  return mapTemplate(dto);
}

interface TemplatePreviewAcceptedDto {
  preview_id: string;
  template_id: string;
  category_name: string;
  stage: JobStage;
}

export interface TemplatePreviewSelections {
  image?: ResourceSelection;
  music?: ResourceSelection;
  video?: ResourceSelection;
}

export async function createTemplatePreview(
  templateId: string,
  selections: TemplatePreviewSelections,
  signal?: AbortSignal,
): Promise<TemplatePreviewHandle> {
  const formData = new FormData();
  appendResourceSourceFields(formData, "image", selections.image);
  appendResourceSourceFields(formData, "music", selections.music);
  appendResourceSourceFields(formData, "video", selections.video);

  const dto = await httpClient<TemplatePreviewAcceptedDto>(
    `/api/v1/templates/${templateId}/preview`,
    {
      method: "POST",
      body: formData,
      signal,
    },
  );
  return {
    previewId: dto.preview_id,
    templateId: dto.template_id,
    categoryName: dto.category_name,
    stage: dto.stage,
  };
}

interface PreviewFileDto {
  filename: string;
  url: string | null;
}

interface PreviewStatusDto {
  preview_id: string;
  category: string;
  stage: JobStage;
  is_terminal: boolean;
  is_success: boolean;
  errors: string[];
  files: PreviewFileDto[];
}

function mapPreviewFile(dto: PreviewFileDto): PreviewFile {
  return { filename: dto.filename, url: dto.url ? resolveApiUrl(dto.url) : null };
}

export async function getPreviewStatus(
  previewId: string,
  signal?: AbortSignal,
): Promise<PreviewStatus> {
  const dto = await httpClient<PreviewStatusDto>(`/api/v1/templates/preview/${previewId}/status`, {
    signal,
  });
  return {
    previewId: dto.preview_id,
    category: dto.category,
    stage: dto.stage,
    isTerminal: dto.is_terminal,
    isSuccess: dto.is_success,
    errors: dto.errors,
    files: dto.files.map(mapPreviewFile),
  };
}
