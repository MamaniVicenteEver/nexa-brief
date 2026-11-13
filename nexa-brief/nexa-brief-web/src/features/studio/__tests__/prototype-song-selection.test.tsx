import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LibraryAsset } from "@/features/library/api/library-assets-service";
import type { Template, TemplateRequirements } from "@/features/templates/types";
import { SongField } from "../components/SongField";
import { PrototypeList } from "../components/sandbox/PrototypeList";
import { prototypeLabel } from "../hooks/useRecordPrototype";
import { type TemplateStudioController, useTemplateStudio } from "../hooks/useTemplateStudio";
import type { Draft } from "../types";

const fixtures = vi.hoisted(() => ({
  songs: [
    {
      assetId: "bruses",
      kind: "music",
      title: "Dueles Tan Bien · Bruses",
      transcriptionStatus: "done",
      durationSeconds: 170,
    },
    {
      assetId: "other",
      kind: "music",
      title: "Otra canción",
      transcriptionStatus: "pending",
      durationSeconds: 85,
    },
  ] as LibraryAsset[],
  drafts: [] as Draft[],
  getAsset: vi.fn(),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, args?: { name?: string }) =>
    args?.name ? `${key}: ${args.name}` : key,
}));
vi.mock("@/features/library/api/library-assets-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/library/api/library-assets-service")>()),
  getLibraryAsset: fixtures.getAsset,
  getMusicGroupsPage: vi.fn(async () => ({
    items: fixtures.songs.map((song) => ({ title: song.title, artist: "", items: [song] })),
    total: fixtures.songs.length,
    page: 1,
    pageSize: 12,
  })),
}));
vi.mock("@/features/resources/hooks/useResources", () => ({
  useLibraryList: () => ({ data: fixtures.songs, isLoading: false }),
  useLibraryPage: () => ({
    data: {
      items: fixtures.songs,
      total: fixtures.songs.length,
      page: 1,
      pageSize: 12,
    },
    isLoading: false,
    isError: false,
    isFetching: false,
  }),
  useLibraryCategories: () => ({ data: [] }),
}));
vi.mock("@/features/resources", async () => ({
  ResourcePicker: (await import("@/features/resources/components/ResourcePicker")).ResourcePicker,
  LyricsViewer: ({ visible }: { visible?: boolean }) => (
    <div data-visible={String(visible)}>Synced lyrics</div>
  ),
}));
vi.mock("@/features/resources/components/UploadDropzone", () => ({
  UploadDropzone: ({ onUploaded }: { onUploaded: (asset: LibraryAsset) => void }) => (
    <button type="button" onClick={() => onUploaded(fixtures.songs[1])}>
      Upload song
    </button>
  ),
}));
vi.mock("../components/sandbox/DeletePrototypeButton", () => ({
  DeletePrototypeButton: () => null,
}));
vi.mock("@/features/create-video/hooks/useNiches", () => ({
  useNiches: () => ({ data: [] }),
}));
vi.mock("@/features/templates/hooks/useTemplateRequirements", () => ({
  useTemplateRequirements: () => ({ data: undefined }),
}));
vi.mock("../hooks/useDraft", () => ({
  useTemplateDrafts: () => ({ data: fixtures.drafts }),
}));
vi.mock("../hooks/useOriginalDraft", () => ({
  useOriginalDraft: () => ({ draft: null }),
}));
vi.mock("../hooks/usePrototypeEditor", () => ({
  usePrototypeEditor: () => ({ draft: null }),
}));
vi.mock("../hooks/useRecordPrototype", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../hooks/useRecordPrototype")>()),
  useRecordPrototype: () => ({ selected: null }),
}));
afterEach(() => {
  cleanup();
  fixtures.drafts = [];
  fixtures.getAsset.mockReset();
});
const audio = {
  required: true,
  lyrics: "auto",
} as TemplateRequirements["audio"];
function Wrapper({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function Form({ initial = "bruses" }: { initial?: string | null }) {
  const [value, onChange] = useState<string | null>(initial);
  return <SongField compact audio={audio} value={value} onChange={onChange} />;
}
const draft = (id: string, previewUrl: string | null): Draft =>
  ({
    draftId: id,
    name: id,
    status: "preview_ready",
    inputs: { musicAssetId: "bruses" },
    details: null,
    previewUrl,
  }) as Draft;

describe("prototype song selection", () => {
  it("shows only the selected song, and opens and closes the existing library without losing it", () => {
    render(<Form />, { wrapper: Wrapper });
    expect(screen.getByText(fixtures.songs[0].title)).toBeTruthy();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByText("required")).toBeNull();
    const toggle = screen.getByRole("button", { name: "chooseAnother" });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("searchbox")).toBeTruthy();
    expect(screen.getByText("Synced lyrics")).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.getByText(fixtures.songs[0].title)).toBeTruthy();
  });
  it("keeps lyrics inside the chooser, open by default, and preserves the viewer", () => {
    render(<Form />, { wrapper: Wrapper });
    const chooser = screen.getByRole("button", { name: "chooseAnother" });
    const viewer = screen.getByText("Synced lyrics");
    expect(screen.queryByRole("button", { name: "lyrics" })).toBeNull();
    expect(viewer.getAttribute("data-visible")).toBe("false");
    fireEvent.click(chooser);
    const toggle = screen.getByRole("button", { name: "lyrics" });
    const panel = document.getElementById(chooser.getAttribute("aria-controls") as string);
    expect(panel?.contains(toggle)).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(viewer.getAttribute("data-visible")).toBe("true");
    expect(fixtures.getAsset).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(viewer.getAttribute("data-visible")).toBe("false");
    expect(viewer.closest("[hidden]")).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.getByText("Synced lyrics")).toBe(viewer);
    fireEvent.click(chooser);
    expect(viewer.getAttribute("data-visible")).toBe("false");
    expect(screen.getAllByText("Synced lyrics")).toHaveLength(1);
    fireEvent.click(chooser);
    expect(screen.getByText("Synced lyrics")).toBe(viewer);
    expect(viewer.getAttribute("data-visible")).toBe("true");
  });
  it("loads the selected song by id when it is outside the scoped list", async () => {
    fixtures.getAsset.mockResolvedValue({
      ...fixtures.songs[0],
      assetId: "outside",
      title: "Otra categoría",
    });
    render(<Form initial="outside" />, { wrapper: Wrapper });
    expect(await screen.findByText("Otra categoría")).toBeTruthy();
    await waitFor(() =>
      expect(fixtures.getAsset).toHaveBeenCalledWith("music", "outside", expect.any(AbortSignal)),
    );
  });
  it("selects another library song, updates its summary and collapses the chooser", async () => {
    render(<Form />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole("button", { name: "chooseAnother" }));
    fireEvent.click(await screen.findByRole("button", { name: /Otra canción/ }));
    expect(screen.getByText("Otra canción")).toBeTruthy();
    expect(screen.queryByText(fixtures.songs[0].title)).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
  it("opens for a new prototype and accepts the existing upload callback", () => {
    render(<Form initial={null} />, { wrapper: Wrapper });
    expect(screen.getByRole("searchbox")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Upload song" }));
    expect(screen.getByText("Otra canción")).toBeTruthy();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
  it("keeps the full song form available outside the compact prototype editor", () => {
    render(<SongField audio={audio} value="bruses" onChange={vi.fn()} />, { wrapper: Wrapper });
    expect(screen.getByRole("searchbox")).toBeTruthy();
    expect(screen.getByText("required")).toBeTruthy();
    expect(screen.queryByText("hintLyrics")).toBeNull();
    expect(screen.getByRole("button", { name: "lyrics" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
  });
});

describe("preview from the prototype list", () => {
  it("shows a song before publication preparation and keeps Play separate from editing", () => {
    const previewPrototype = vi.fn();
    const openPrototype = vi.fn();
    render(
      <PrototypeList
        studio={
          {
            prototypes: [draft("One", "/preview/one"), draft("No preview", null)],
            original: { draft: null },
            template: { id: "lyrics-manifiesto" },
            previewPrototype,
            openPrototype,
            draftsLoading: false,
          } as unknown as TemplateStudioController
        }
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getAllByText(/missingPrepare/)).toHaveLength(2);
    expect(screen.getAllByText(/2:50.*missingPrepare/)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "play: One" }));
    expect(previewPrototype).toHaveBeenCalledWith("One");
    expect(openPrototype).not.toHaveBeenCalled();
    expect(
      (
        screen.getByRole("button", {
          name: "play: No preview",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    const row = screen.getByRole("button", { name: "play: One" }).closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: /One.*missingPrepare/ }));
    expect(openPrototype).toHaveBeenCalledWith("One");
  });
  it("uses the existing modal stage while leaving the list open, without generation", () => {
    fixtures.drafts = [
      draft("One", "/preview/one"),
      draft("Two", "/preview/two"),
      draft("Empty", null),
    ];
    const { result, rerender } = renderHook(
      () => useTemplateStudio({ id: "lyrics-manifiesto", canGenerate: true } as Template, true),
      { wrapper: Wrapper },
    );
    act(() => result.current.previewPrototype("One"));
    expect(result.current.editing).toBeNull();
    expect(result.current.tab).toBe("sandbox");
    expect(result.current.draftPreviewUrl).toBe("/preview/one");
    expect(result.current.view).toBe("mine");
    expect(result.current.previewPlaybackRequest).toBe(1);
    act(() => result.current.setView("default"));
    act(() => result.current.previewPrototype("One"));
    expect(result.current.view).toBe("mine");
    expect(result.current.previewPlaybackRequest).toBe(2);
    act(() => result.current.previewPrototype("Two"));
    expect(result.current.draftPreviewUrl).toBe("/preview/two");
    act(() => result.current.previewPrototype("Empty"));
    expect(result.current.draftPreviewUrl).toBe("/preview/two");
    act(() => result.current.clearPrototypePreview());
    expect(result.current.draftPreviewUrl).toBeNull();
    expect(result.current.view).toBe("default");
    act(() => result.current.previewPrototype("One"));
    expect(result.current.draftPreviewUrl).toBe("/preview/one");
    expect(result.current.view).toBe("mine");
    fixtures.drafts = [];
    rerender();
    expect(result.current.draftPreviewUrl).toBeNull();
  });
  it("keeps each prototype in its phase and excludes rendered drafts including the demo", () => {
    const original = {
      ...draft("demo", null),
      original: true,
      status: "rendered",
    } as Draft;
    const ready = { ...draft("Ready", null), status: "prepared" } as Draft;
    const failed = {
      ...draft("Retry", null),
      status: "failed",
      recoverable: true,
    } as Draft;
    const rendering = {
      ...draft("Recording", null),
      status: "rendering",
    } as Draft;
    const recordPrototype = vi.fn();
    render(
      <PrototypeList
        studio={
          {
            template: { id: "lyrics-manifiesto" },
            original: { draft: original },
            prototypes: [draft("Work", null), ready, failed, rendering],
            recordPrototype,
          } as unknown as TemplateStudioController
        }
      />,
      { wrapper: Wrapper },
    );
    expect(screen.queryByRole("button", { name: "play: Demo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "play: Recording" })).toBeNull();
    expect(screen.getByText(/missingPrepare/)).toBeTruthy();
    const row = screen.getByRole("button", { name: "play: Ready" }).closest("li") as HTMLElement;
    expect(within(row).getByText(/2:50.*readyLine/)).toBeTruthy();
    fireEvent.click(within(row).getByRole("button", { name: "record" }));
    expect(recordPrototype).toHaveBeenCalledWith("Ready");
    expect(screen.getByText(/failedRetry/)).toBeTruthy();
  });
});

it("prefers the song for generic names and retains custom names", () => {
  const generic = { ...draft("one", null), name: "Prototipo 2" };
  expect(prototypeLabel(generic, "fallback", fixtures.songs)).toBe(fixtures.songs[0].title);
  expect(prototypeLabel({ ...generic, name: "Mi versión" }, "fallback", fixtures.songs)).toBe(
    "Mi versión",
  );
});
