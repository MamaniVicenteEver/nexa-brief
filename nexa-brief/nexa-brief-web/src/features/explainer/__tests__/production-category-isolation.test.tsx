import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { CategoryNode } from "@/features/categories";
import type { ExplainerVideo } from "../types";
import { ExplainerCategoryWindow } from "../components/ExplainerCategoryWindow";

const { productionVideos, readSandbox } = vi.hoisted(() => ({
  productionVideos: vi.fn(),
  readSandbox: vi.fn(() => { throw new Error("Production categories must not fetch Sandbox projects"); }),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../hooks/useExplainer", () => ({ useExplainerVideos: productionVideos }));
vi.mock("@/features/sandbox/hooks/useSandbox", () => ({ useSandbox: readSandbox }));
vi.mock("@/features/showcase/hooks/useStandardShowcase", () => ({
  useStandardShowcase: () => ({ designs: { data: { designs: [{ id: "atlas", name: "Atlas", state: "produccion", category_path: "node_atlas", shared_categories: [] }] } } }),
}));
vi.mock("@/features/image-posts/hooks/useImagePosts", () => ({ useImagePosts: () => ({ data: [] }) }));
vi.mock("../components/CreateExplainerVideoModal", () => ({ CreateExplainerVideoModal: () => null }));
vi.mock("../components/DesignUsagePanel", () => ({ DesignUsagePanel: () => null }));
vi.mock("../components/ProductionsList", () => ({ ProductionsList: () => null }));
vi.mock("../components/ExplainerVideoCard", () => ({ ExplainerVideoCard: ({ video }: { video: ExplainerVideo }) => <article>{video.title}</article> }));

const category = { id: "node_atlas", path: "node_atlas", displayName: "NodeAtlas", engine: "explainer_kit" } as CategoryNode;
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("counts and displays only production API videos without fetching Sandbox demos", () => {
  productionVideos.mockReturnValue({
    data: [
      { videoId: "main", title: "Registered production demo", demo: true, design: "atlas", status: "en preparación", rendered: [] },
      { videoId: "episode", title: "Production episode", demo: false, design: "atlas", status: "en preparación", rendered: [] },
    ],
    isLoading: false,
  });
  render(<ExplainerCategoryWindow category={category} />);
  expect(screen.getByText("Registered production demo")).toBeDefined();
  expect(screen.getByText("Production episode")).toBeDefined();
  expect(screen.getByRole("button", { name: "heading (2)" })).toBeDefined();
  expect(readSandbox).not.toHaveBeenCalled();
});

it("keeps a production category empty when its design has no registered production demo", () => {
  productionVideos.mockReturnValue({ data: [], isLoading: false });
  render(<ExplainerCategoryWindow category={category} />);
  expect(screen.getByText("prep.emptyPreparation")).toBeDefined();
  expect(screen.getByRole("button", { name: "heading (0)" })).toBeDefined();
  expect(screen.queryByText("prep.designDemos")).toBeNull();
  expect(readSandbox).not.toHaveBeenCalled();
});
