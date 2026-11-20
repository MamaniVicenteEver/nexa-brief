import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogPage } from "../types";

const mocks = vi.hoisted(() => ({ useCatalog: vi.fn() }));
vi.mock("../useCatalog", () => ({ useCatalog: mocks.useCatalog }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: { name?: string; count?: number }) =>
    vars?.name ? `${key}:${vars.name}` : vars?.count !== undefined ? `${key}:${vars.count}` : key,
}));
vi.mock("../components/CatalogCard", () => ({
  CatalogCard: ({ item }: { item: { title: string } }) => <p>{item.title}</p>,
}));
vi.mock("../components/CatalogControls", () => ({
  CatalogControls: ({
    onCategory,
    onPageSize,
  }: {
    onCategory: (v: string) => void;
    onPageSize: (v: number) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onCategory("history")}>
        filter history
      </button>
      <button type="button" onClick={() => onPageSize(12)}>
        page 12
      </button>
    </div>
  ),
}));

import { CatalogWindow } from "../components/CatalogWindow";

function entry(id: string, title: string, category_ids: string[]): CatalogPage["items"][number] {
  return {
    id,
    source_id: id,
    title,
    category_ids,
    kind: "demo",
    poster_url: null,
    orientation: "any",
    demo: true,
    design_id: null,
    playback: {
      engine_url: null,
      desktop_video_url: null,
      mobile_video_url: null,
      engine: "explainer",
    },
  };
}

const allData: CatalogPage = {
  categories: [
    { id: "history", name: "History", status: "active" },
    { id: "tech", name: "Tech", status: "planned" },
  ],
  category_counts: { history: 2, tech: 1 },
  items: [
    entry("shared", "Shared demo", ["history", "tech"]),
    entry("another", "History demo", ["history"]),
  ],
  total: 2,
  page: 1,
  page_size: "all",
  total_pages: 1,
};

beforeEach(() => mocks.useCatalog.mockReset());
afterEach(cleanup);

describe("internal category catalogue", () => {
  it("uses the API category counts, displaying shared items in both categories", () => {
    mocks.useCatalog.mockReturnValue({ data: allData, isLoading: false, isError: false });
    render(<CatalogWindow />);
    const history = screen.getByRole("region", { name: "History" });
    const tech = screen.getByRole("region", { name: "Tech" });
    expect(within(history).getByText("History demo")).toBeTruthy();
    expect(within(history).getByText("Shared demo")).toBeTruthy();
    expect(within(tech).getByText("Shared demo")).toBeTruthy();
    expect(within(history).getByText("designsCount:2")).toBeTruthy();
    expect(within(tech).getByText("designsCount:1")).toBeTruthy();
    expect(mocks.useCatalog).toHaveBeenCalledWith("internal", {
      category: "all",
      page: 1,
      pageSize: "all",
    });
  });

  it("collapses one category and then all categories without affecting the others", () => {
    mocks.useCatalog.mockReturnValue({ data: allData, isLoading: false, isError: false });
    render(<CatalogWindow />);
    fireEvent.click(screen.getByRole("button", { name: "collapseCategory:History" }));
    expect(
      screen.getByRole("button", { name: "expandCategory:History" }).getAttribute("aria-expanded"),
    ).toBe("false");
    expect(screen.getAllByText("Shared demo")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "expandAll" }));
    expect(screen.getAllByText("Shared demo")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "collapseAll" }));
    expect(screen.queryByText("Shared demo")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^expandCategory:/ })).toHaveLength(2);
  });

  it("keeps global category counts on a partial page and resets page when filtering", () => {
    const paged = {
      ...allData,
      category_counts: { history: 20, tech: 5 },
      items: [entry("another", "History demo", ["history"])],
      page_size: 12 as const,
      total: 25,
      total_pages: 3,
    };
    mocks.useCatalog.mockImplementation(
      (_audience: string, query?: { pageSize: number | "all" }) => ({
        data: query?.pageSize === 12 ? paged : allData,
        isLoading: false,
        isError: false,
      }),
    );
    render(<CatalogWindow />);
    fireEvent.click(screen.getByText("page 12"));
    expect(
      within(screen.getByRole("region", { name: "History" })).getByText("designsCount:20"),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Tech" })).getByText("designsCount:5"),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Tech" })).getByText("results:0"),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("filter history"));
    expect(mocks.useCatalog).toHaveBeenLastCalledWith("internal", {
      category: "history",
      page: 1,
      pageSize: 12,
    });
    expect(screen.queryByRole("region", { name: "Tech" })).toBeNull();
  });
});
