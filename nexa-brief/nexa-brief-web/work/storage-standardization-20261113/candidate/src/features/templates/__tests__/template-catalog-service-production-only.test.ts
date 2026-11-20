import { afterEach, expect, it, vi } from "vitest";
import { httpClient } from "@/infrastructure/api/http-client";
import { getTemplateCatalog } from "../api/template-catalog-service";

vi.mock("@/infrastructure/api/http-client", () => ({ httpClient: vi.fn() }));
vi.mock("../api/templates-service", () => ({ mapTemplate: vi.fn() }));
vi.mock("@/features/explainer/api/explainer-service", () => ({ mapVideo: vi.fn() }));
afterEach(() => vi.clearAllMocks());

it("maps production categories without exposing sandbox fallback fields", async () => {
  vi.mocked(httpClient).mockResolvedValue({
    summary: { category_count: 1, active_category_count: 1, planned_category_count: 0, empty_category_count: 0, categories_with_items: 0, pipeline_template_count: 0, demo_count: 0, total_card_count: 0 },
    categories: [{ id: "node_atlas", path: "node_atlas", display_name: "NodeAtlas", topic: "", status: "active", engine: "explainer_kit", template_count: 0, demo_video_count: 0, total_item_count: 0, templates: [], demo_videos: [], sandbox_demo_count: 1, sandbox_demos: [{ item: { id: "draft" }, production_design: true }] }],
  });
  const catalog = await getTemplateCatalog();
  expect(catalog.categories[0].demoVideos).toEqual([]);
  expect(catalog.categories[0]).not.toHaveProperty("sandboxDemos");
  expect(catalog.categories[0]).not.toHaveProperty("sandboxDemoCount");
  expect(httpClient).toHaveBeenCalledWith("/api/v1/templates/catalog", { signal: undefined });
});
