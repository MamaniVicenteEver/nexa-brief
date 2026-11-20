import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  getLibraryCategories,
  getLibraryPage,
  getMusicGroupsPage,
  uploadLibraryAsset,
} from "@/features/library/api/library-assets-service";
import { MediaSlotField } from "@/features/studio/components/MediaSlotField";
import { ResourcePicker } from "../components/ResourcePicker";
import { ResourceScopeProvider } from "../ResourceScope";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/features/realtime", () => ({ useRealtimeEvent: () => {} }));
vi.mock("@/features/studio/components/StockSearchPanel", () => ({ StockSearchPanel: () => null }));
vi.mock("@/features/library/api/library-assets-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/library/api/library-assets-service")>()),
  getLibraryPage: vi.fn(),
  getMusicGroupsPage: vi.fn(),
  getLibraryCategories: vi.fn(),
  uploadLibraryAsset: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getLibraryPage).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 12 });
  vi.mocked(getMusicGroupsPage).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 12 });
  vi.mocked(getLibraryCategories).mockResolvedValue(["node_motion", "stock"]);
  vi.mocked(uploadLibraryAsset).mockResolvedValue({
    created: true,
    asset: { assetId: "uploaded-video", kind: "videos", category: "node_motion" } as Awaited<
      ReturnType<typeof uploadLibraryAsset>
    >["asset"],
  });
});

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

it("keeps the editor category and template for uploads after changing the browsing filter", async () => {
  const change = vi.fn();
  const view = render(
    <QueryClientProvider client={client()}>
      <ResourceScopeProvider scope={{ categoryId: "node_motion", templateId: "lyrics-romantic" }}>
        <MediaSlotField
          slot={{
            slot: "background",
            kind: "image|video",
            min: 1,
            max: 1,
            target: "source",
            label: "Fondo",
            hint: "",
            orientation: null,
          }}
          value={[]}
          onChange={change}
        />
      </ResourceScopeProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "openPicker" }));
  await waitFor(() =>
    expect(getLibraryPage).toHaveBeenCalledWith(
      "videos",
      {
        q: "",
        category: "",
        page: 1,
        pageSize: 12,
      },
      expect.anything(),
    ),
  );
  await screen.findByRole("option", { name: "stock" });
  fireEvent.change(screen.getByRole("combobox", { name: "categoryLabel" }), {
    target: { value: "stock" },
  });
  await waitFor(() =>
    expect(getLibraryPage).toHaveBeenCalledWith(
      "videos",
      {
        q: "",
        category: "stock",
        page: 1,
        pageSize: 12,
      },
      expect.anything(),
    ),
  );
  const fileInput = view.container.querySelector("input[type=file]") as HTMLInputElement;
  expect(fileInput.accept).toContain("video/");
  const file = new File(["video bytes"], "fondo.mp4", { type: "video/mp4" });
  await act(async () => {
    fireEvent.change(fileInput, { target: { files: [file] } });
  });
  await waitFor(() =>
    expect(uploadLibraryAsset).toHaveBeenCalledWith(
      "videos",
      { file, category: "node_motion", templateId: "lyrics-romantic" },
      expect.any(Function),
    ),
  );
  expect(change).toHaveBeenCalledWith([{ assetId: "uploaded-video", kind: "video" }]);
  fireEvent.click(screen.getByRole("button", { name: "kindImage" }));
  expect((view.container.querySelector("input[type=file]") as HTMLInputElement).accept).toContain(
    "image/",
  );
  await waitFor(() =>
    expect(getLibraryPage).toHaveBeenCalledWith(
      "images",
      {
        q: "",
        category: "",
        page: 1,
        pageSize: 12,
      },
      expect.anything(),
    ),
  );
});

it("keeps the global music library unfiltered outside a scoped editor", async () => {
  render(
    <QueryClientProvider client={client()}>
      <ResourcePicker kind="music" value={null} onChange={() => {}} />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(getMusicGroupsPage).toHaveBeenCalledWith(
      {
        q: "",
        category: "",
        page: 1,
        pageSize: 12,
      },
      expect.anything(),
    ),
  );
});
