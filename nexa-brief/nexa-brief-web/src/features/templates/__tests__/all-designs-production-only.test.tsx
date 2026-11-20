import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AllDesignsWindow } from "../components/AllDesignsWindow";

const { loadCatalog, renderSandbox } = vi.hoisted(() => ({
  loadCatalog: vi.fn(),
  renderSandbox: vi.fn(() => { throw new Error("Sandbox cards do not belong in production categories"); }),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../hooks/useTemplateCatalog", () => ({ useTemplateCatalog: loadCatalog }));
vi.mock("@/features/explainer/components/ExplainerVideoCard", () => ({ ExplainerVideoCard: ({ video }: { video: { title: string } }) => <article>{video.title}</article> }));
vi.mock("@/features/explainer/components/SandboxDesignDemoCard", () => ({ SandboxDesignDemoCard: renderSandbox }));
vi.mock("../components/TemplateCard", () => ({ TemplateCard: ({ template }: { template: { name: string } }) => <article>{template.name}</article> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("renders registered production demos and templates, ignoring stale sandbox fallback data", () => {
  loadCatalog.mockReturnValue({ data: {
    summary: { categoryCount: 1, activeCategoryCount: 1, plannedCategoryCount: 0, emptyCategoryCount: 0, categoriesWithItems: 1, pipelineTemplateCount: 1, demoCount: 1, totalCardCount: 2 },
    categories: [{
      category: { id: "node_atlas", displayName: "NodeAtlas", status: "active" },
      totalItemCount: 2,
      templates: [{ id: "reusable", name: "Reusable production template" }],
      demoVideos: [{ videoId: "main", title: "Main production demo" }],
      sandboxDemos: [{ item: { folder: "nodeatlas", id: "draft", title: "Sandbox draft" }, productionDesign: true }],
    }],
  }, isLoading: false, isError: false });
  render(<AllDesignsWindow />);
  expect(screen.getByText("Main production demo")).toBeDefined();
  expect(screen.getByText("Reusable production template")).toBeDefined();
  expect(screen.queryByText("Sandbox draft")).toBeNull();
  expect(renderSandbox).not.toHaveBeenCalled();
});

it("leaves a category without a registered production demo empty", () => {
  loadCatalog.mockReturnValue({ data: {
    summary: { categoryCount: 1, activeCategoryCount: 1, plannedCategoryCount: 0, emptyCategoryCount: 0, categoriesWithItems: 0, pipelineTemplateCount: 0, demoCount: 0, totalCardCount: 0 },
    categories: [{ category: { id: "node_atlas", displayName: "NodeAtlas", status: "active" }, totalItemCount: 0, templates: [], demoVideos: [] }],
  }, isLoading: false, isError: false });
  render(<AllDesignsWindow />);
  expect(screen.getByText("catalogReport.emptyCategory")).toBeDefined();
  expect(renderSandbox).not.toHaveBeenCalled();
});
