import { httpClient } from "@/infrastructure/api/http-client";
import type { CategoryNode } from "@/features/categories";
import { mapVideo, type ExplainerVideoDto } from "@/features/explainer/api/explainer-service";
import { mapTemplate, type TemplateDto } from "./templates-service";
import type { Template } from "../types";
import type { ExplainerVideo } from "@/features/explainer/types";

export interface TemplateCatalogSummary {
  categoryCount: number;
  activeCategoryCount: number;
  plannedCategoryCount: number;
  emptyCategoryCount: number;
  categoriesWithItems: number;
  pipelineTemplateCount: number;
  demoCount: number;
  totalCardCount: number;
}

export interface TemplateCatalogSection {
  category: Pick<CategoryNode, "id" | "path" | "displayName" | "topic" | "status" | "engine">;
  templateCount: number;
  demoVideoCount: number;
  totalItemCount: number;
  templates: Template[];
  demoVideos: ExplainerVideo[];
}

interface TemplateCatalogResponseDto {
  summary: {
    category_count: number;
    active_category_count: number;
    planned_category_count: number;
    empty_category_count: number;
    categories_with_items: number;
    pipeline_template_count: number;
    demo_count: number;
    total_card_count: number;
  };
  categories: {
    id: string;
    path: string;
    display_name: string;
    topic: string;
    status: CategoryNode["status"];
    engine: CategoryNode["engine"];
    template_count: number;
    demo_video_count: number;
    total_item_count: number;
    templates: TemplateDto[];
    demo_videos: ExplainerVideoDto[];
  }[];
}

export interface TemplateCatalog {
  summary: TemplateCatalogSummary;
  categories: TemplateCatalogSection[];
}

export async function getTemplateCatalog(signal?: AbortSignal): Promise<TemplateCatalog> {
  const dto = await httpClient<TemplateCatalogResponseDto>("/api/v1/templates/catalog", { signal });
  return {
    summary: {
      categoryCount: dto.summary.category_count,
      activeCategoryCount: dto.summary.active_category_count,
      plannedCategoryCount: dto.summary.planned_category_count,
      emptyCategoryCount: dto.summary.empty_category_count,
      categoriesWithItems: dto.summary.categories_with_items,
      pipelineTemplateCount: dto.summary.pipeline_template_count,
      demoCount: dto.summary.demo_count,
      totalCardCount: dto.summary.total_card_count,
    },
    categories: dto.categories.map((section) => ({
      category: {
        id: section.id,
        path: section.path,
        displayName: section.display_name,
        topic: section.topic,
        status: section.status,
        engine: section.engine,
      },
      templateCount: section.template_count,
      demoVideoCount: section.demo_video_count,
      totalItemCount: section.total_item_count,
      templates: section.templates.map(mapTemplate),
      demoVideos: section.demo_videos.map(mapVideo),
    })),
  };
}
