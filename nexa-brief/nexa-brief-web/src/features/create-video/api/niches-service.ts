import { httpClient } from "@/infrastructure/api/http-client";
import type { Niche } from "../types";

interface NicheDto {
  id: string;
  display_name: string;
  description: string;
  category_id?: string;
  category_name?: string;
  category_order?: number;
  tags?: string[];
  sort_order?: number;
  pipeline_type: string;
  active: boolean;
  recorder_engine: string;
  supported_engines: string[];
  duration_locked_to_music?: boolean;
}

function mapNiche(dto: NicheDto): Niche {
  return {
    id: dto.id,
    displayName: dto.display_name,
    description: dto.description,
    categoryId: dto.category_id ?? "uncategorized",
    categoryName: dto.category_name ?? "Sin categoría",
    categoryOrder: dto.category_order ?? 999,
    tags: dto.tags ?? [],
    sortOrder: dto.sort_order ?? 999,
    pipelineType: dto.pipeline_type,
    active: dto.active,
    recorderEngine: dto.recorder_engine,
    supportedEngines: dto.supported_engines,
    durationLockedToMusic: dto.duration_locked_to_music ?? false,
  };
}

export async function getNiches(signal?: AbortSignal): Promise<Niche[]> {
  const dtos = await httpClient<NicheDto[]>("/api/v1/niches", { signal });
  return dtos.map(mapNiche);
}
