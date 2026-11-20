import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getLibraryPage } from "@/features/library/api/library-assets-service";
import { useLibraryPage } from "../hooks/useResources";
import { ResourceScopeProvider } from "../ResourceScope";

vi.mock("@/features/realtime", () => ({ useRealtimeEvent: () => {} }));
vi.mock("@/features/library/hooks/useLibraryAssets", () => ({
  libraryAssetsKey: (kind: string) => ["library-assets", kind],
  useDebouncedValue: (value: string) => value,
  useLibraryAssets: vi.fn(),
}));
vi.mock("@/features/library/api/library-assets-service", () => ({
  getLibraryPage: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getLibraryPage).mockImplementation(async (_kind, params = {}) => ({
    items: [{ assetId: params.category || "all" }] as never,
    total: 1,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 12,
  }));
});

function wrapper(categoryId?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <ResourceScopeProvider
          scope={{ categoryId, templateId: categoryId ? "lyrics-impact" : undefined }}
        >
          {children}
        </ResourceScopeProvider>
      </QueryClientProvider>
    );
  };
}

it("filters by the selected category and returns to all categories in a scoped editor", async () => {
  const { result, rerender } = renderHook(
    ({ category }: { category: string | undefined }) => useLibraryPage("music", "", category),
    { wrapper: wrapper("node_motion"), initialProps: { category: "" as string | undefined } },
  );
  await waitFor(() => expect(result.current.data?.items[0].assetId).toBe("all"));
  expect(getLibraryPage).toHaveBeenLastCalledWith(
    "music",
    { q: "", category: "", page: 1, pageSize: 12 },
    expect.anything(),
  );
  rerender({ category: "node_actualidad" });
  await waitFor(() => expect(result.current.data?.items[0].assetId).toBe("node_actualidad"));
  rerender({ category: "stock" });
  await waitFor(() => expect(result.current.data?.items[0].assetId).toBe("stock"));
  rerender({ category: "" });
  await waitFor(() => expect(result.current.data?.items[0].assetId).toBe("all"));
});

it("inherits the editor category only when the category argument is omitted", async () => {
  const { result } = renderHook(() => useLibraryPage("music"), { wrapper: wrapper("node_motion") });
  await waitFor(() => expect(result.current.data?.items[0].assetId).toBe("node_motion"));
  expect(getLibraryPage).toHaveBeenLastCalledWith(
    "music",
    { q: "", category: "node_motion", page: 1, pageSize: 12 },
    expect.anything(),
  );
});

it("uses all categories outside a scoped editor", async () => {
  const { result } = renderHook(() => useLibraryPage("music"), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.data?.items[0].assetId).toBe("all"));
});
