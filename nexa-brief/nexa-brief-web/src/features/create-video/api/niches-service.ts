import { httpClient } from "@/infrastructure/api/http-client";
import type { Niche } from "../types";

interface NicheDto {
  id: string;
  display_name: string;
  description: string;
  pipeline_type: string;
  active: boolean;
  recorder_engine: string;
  supported_engines: string[];
}

function mapNiche(dto: NicheDto): Niche {
  return {
    id: dto.id,
    displayName: dto.display_name,
    description: dto.description,
    pipelineType: dto.pipeline_type,
    active: dto.active,
    recorderEngine: dto.recorder_engine,
    supportedEngines: dto.supported_engines,
  };
}

export async function getNiches(signal?: AbortSignal): Promise<Niche[]> {
  const dtos = await httpClient<NicheDto[]>("/api/v1/niches", { signal });
  return dtos.map(mapNiche);
}
