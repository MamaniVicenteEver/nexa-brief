import { useQuery } from "@tanstack/react-query";
import { httpClient } from "@/infrastructure/api/http-client";

/** Qué le falta a una categoría para publicar sola (códigos del backend). */
export type ReadinessGap =
  | "no_content"
  | "no_schedule"
  | "no_ready_video"
  | "empty_category"
  | "autopublish_off";

export interface CategoryOverview {
  id: string;
  displayName: string;
  topic: string;
  status: "active" | "planned" | "empty";
  engine: "pipeline" | "explainer_kit";
  content: { designs: number; templates: number };
  pipeline: {
    producing: number;
    readyToRecord: number;
    recordedPending: number;
    published: number;
  };
  schedule: { channels: string[]; days: number[]; times: string[]; nextAt: string | null };
  automation: { prerecord: boolean; autoproduce: boolean; plannedItems: number };
  missing: ReadinessGap[];
}

interface CategoryOverviewDto {
  id: string;
  display_name: string;
  topic: string;
  status: CategoryOverview["status"];
  engine: CategoryOverview["engine"];
  content: { designs: number; templates: number };
  pipeline: {
    producing: number;
    ready_to_record: number;
    recorded_pending: number;
    published: number;
  };
  schedule: { channels: string[]; days: number[]; times: string[]; next_at: string | null };
  automation: { prerecord: boolean; autoproduce: boolean; planned_items: number };
  missing: ReadinessGap[];
}

function mapOverview(dto: CategoryOverviewDto): CategoryOverview {
  return {
    id: dto.id,
    displayName: dto.display_name,
    topic: dto.topic,
    status: dto.status,
    engine: dto.engine,
    content: dto.content,
    pipeline: {
      producing: dto.pipeline.producing,
      readyToRecord: dto.pipeline.ready_to_record,
      recordedPending: dto.pipeline.recorded_pending,
      published: dto.pipeline.published,
    },
    schedule: {
      channels: dto.schedule.channels,
      days: dto.schedule.days,
      times: dto.schedule.times,
      nextAt: dto.schedule.next_at,
    },
    automation: {
      prerecord: dto.automation.prerecord,
      autoproduce: dto.automation.autoproduce,
      plannedItems: dto.automation.planned_items,
    },
    missing: dto.missing,
  };
}

export function useCategoriesOverview() {
  return useQuery({
    queryKey: ["categories-overview"],
    queryFn: async ({ signal }) => {
      const dtos = await httpClient<CategoryOverviewDto[]>("/api/v1/categories/overview", {
        signal,
      });
      return dtos.map(mapOverview);
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
}
