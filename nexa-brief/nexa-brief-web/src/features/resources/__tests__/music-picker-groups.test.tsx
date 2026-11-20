import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  getMusicGroupsPage,
  type LibraryAsset,
} from "@/features/library/api/library-assets-service";
import { ResourcePicker } from "../components/ResourcePicker";
import { ResourceScopeProvider } from "../ResourceScope";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, args?: Record<string, number>) =>
    args ? `${key} ${Object.values(args).join(" ")}` : key,
}));
vi.mock("@/features/library/api/library-assets-service", () => ({
  getMusicGroupsPage: vi.fn(),
  resolveAssetPreviewUrl: vi.fn(),
}));
vi.mock("@/features/library/hooks/useLibraryAssets", () => ({
  libraryAssetsKey: (kind: string) => ["library-assets", kind],
  useDebouncedValue: (value: string) => value,
}));
vi.mock("../hooks/useResources", () => ({
  useLibraryPage: () => ({ isLoading: false, isError: false, isFetching: false }),
  useLibraryCategories: () => ({ data: ["node_motion", "node_actualidad", "stock"] }),
}));
vi.mock("../components/TranscriptionBadge", () => ({ TranscriptionBadge: () => null }));
vi.mock("../components/UploadDropzone", () => ({ UploadDropzone: () => null }));

afterEach(cleanup);
const song = (assetId: string, title: string, durationSeconds: number) =>
  ({
    assetId,
    title,
    durationSeconds,
    kind: "music",
    transcriptionStatus: "done",
  }) as LibraryAsset;
const first = { ...song("mix-1", "Undaunted — Kevin MacLeod", 80), productionName: "Concierto A" };
const second = song("mix-2", "Undaunted — Kevin MacLeod", 90);
const distinct = song("other-song", "Summertime Sadness — Lana Del Rey", 265);
const stockSong = song("stock-song", "Otra canción — Otro artista", 100);
const group = (...items: LibraryAsset[]) => ({ title: items[0].title, artist: "", items });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMusicGroupsPage).mockImplementation(async ({ category, page } = {}) => {
    if (category === "stock") return { items: [group(stockSong)], total: 1, page: 1, pageSize: 12 };
    if (category === "node_actualidad")
      return { items: [group(distinct)], total: 1, page: 1, pageSize: 12 };
    if (page === 2) return { items: [group(stockSong)], total: 13, page: 2, pageSize: 12 };
    return { items: [group(first, second), group(distinct)], total: 13, page: 1, pageSize: 12 };
  });
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <ResourceScopeProvider scope={{ categoryId: "node_motion", templateId: "lyrics-impact" }}>
        {children}
      </ResourceScopeProvider>
    </QueryClientProvider>
  );
}

it("filters the grouped songs in a scoped editor and restores all categories", async () => {
  render(<ResourcePicker kind="music" value={null} onChange={vi.fn()} />, { wrapper });
  expect(await screen.findByText(first.title)).toBeTruthy();
  const filter = screen.getByRole("combobox", { name: "categoryLabel" });
  fireEvent.change(filter, { target: { value: "stock" } });
  expect(await screen.findByRole("button", { name: /Otra canción/ })).toBeTruthy();
  expect(screen.queryByText(first.title)).toBeNull();
  expect(getMusicGroupsPage).toHaveBeenLastCalledWith(
    { q: "", category: "stock", page: 1, pageSize: 12 },
    expect.anything(),
  );
  fireEvent.change(filter, { target: { value: "node_actualidad" } });
  expect(await screen.findByRole("button", { name: /Summertime Sadness/ })).toBeTruthy();
  expect(screen.queryByText(stockSong.title)).toBeNull();
  fireEvent.change(filter, { target: { value: "" } });
  expect(await screen.findByText(first.title)).toBeTruthy();
});

it("expands versions and selects their distinct IDs without merging a different song", async () => {
  const onChange = vi.fn();
  const view = render(<ResourcePicker kind="music" value={null} onChange={onChange} />, {
    wrapper,
  });
  const summary = (await screen.findByText(first.title)).closest("summary") as HTMLElement;
  expect(summary).toBeTruthy();
  expect(screen.getByRole("button", { name: /Summertime Sadness/ })).toBeTruthy();
  expect(screen.getByText("versions 2")).toBeTruthy();
  fireEvent.click(summary);
  const details = summary.closest("details") as HTMLElement;
  expect(within(details).getByText("Concierto A")).toBeTruthy();
  fireEvent.click(within(details).getByRole("button", { name: /version 1/ }));
  expect(onChange).toHaveBeenLastCalledWith("mix-1", first);
  view.rerender(<ResourcePicker kind="music" value="mix-1" onChange={onChange} />);
  expect(
    within(details)
      .getByRole("button", { name: /version 1/ })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(within(details).getByRole("button", { name: /version 2/ }));
  expect(onChange).toHaveBeenLastCalledWith("mix-2", second);
});

it("paginates by the server's grouped total and resets to page one when filtering", async () => {
  render(<ResourcePicker kind="music" value={null} onChange={vi.fn()} />, { wrapper });
  expect(await screen.findByText("range 1 12 13")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /next/ }));
  await waitFor(() => expect(screen.getByText("range 13 13 13")).toBeTruthy());
  expect(await screen.findByText(stockSong.title)).toBeTruthy();
  expect(getMusicGroupsPage).toHaveBeenLastCalledWith(
    { q: "", category: "", page: 2, pageSize: 12 },
    expect.anything(),
  );
  fireEvent.change(screen.getByRole("combobox", { name: "categoryLabel" }), {
    target: { value: "node_actualidad" },
  });
  await waitFor(() => expect(screen.getByText("range 1 1 1")).toBeTruthy());
  expect(getMusicGroupsPage).toHaveBeenLastCalledWith(
    { q: "", category: "node_actualidad", page: 1, pageSize: 12 },
    expect.anything(),
  );
});
