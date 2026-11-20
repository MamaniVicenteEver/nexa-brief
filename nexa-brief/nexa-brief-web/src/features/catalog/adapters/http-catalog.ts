import { z } from "zod";
import { type ExplainerVideoDto, mapVideo } from "@/features/explainer/api/explainer-service";
import { mapTemplate, type TemplateDto } from "@/features/templates/api/templates-service";
import { httpClient } from "@/infrastructure/api/http-client";
import type { CatalogClient } from "../ports";

const pageSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      source_id: z.string(),
      kind: z.enum(["template", "demo"]),
      title: z.string(),
      category_ids: z.array(z.string()),
      poster_url: z.string().nullable(),
      orientation: z.enum(["9:16", "16:9", "any"]),
      demo: z.boolean(),
      design_id: z.string().nullable(),
      playback: z.object({
        engine_url: z.string().nullable(),
        desktop_video_url: z.string().nullable(),
        mobile_video_url: z.string().nullable(),
        engine: z.enum(["template", "explainer"]),
      }),
    }),
  ),
  categories: z.array(z.object({ id: z.string(), name: z.string(), status: z.string() })),
  total: z.number(),
  page: z.number(),
  page_size: z.union([z.literal("all"), z.number()]),
  total_pages: z.number(),
  category_counts: z.record(z.string(), z.number()),
});

export const httpCatalogClient: CatalogClient = {
  async studio(id, signal) {
    const dto = await httpClient<
      { kind: "template"; template: TemplateDto } | { kind: "demo"; video: ExplainerVideoDto }
    >(`/api/v1/catalog/internal/items/${encodeURIComponent(id)}/studio`, { signal });
    return dto.kind === "template"
      ? { kind: "template", template: mapTemplate(dto.template) }
      : { kind: "demo", video: mapVideo(dto.video) };
  },
  async list(audience, query, signal) {
    const params = new URLSearchParams({
      category: query.category ?? "all",
      page: String(query.page ?? 1),
      page_size: String(query.pageSize ?? "all"),
    });
    const path = audience === "internal" ? "/api/v1/catalog/internal" : "/api/v1/catalog";
    return pageSchema.parse(await httpClient<unknown>(`${path}?${params}`, { signal }));
  },
};
