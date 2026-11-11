import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LibraryAsset } from "@/features/library/api/library-assets-service";
import type { Template, TemplateRequirements } from "@/features/templates/types";
import { SongField } from "../components/SongField";
import { PrototypeList } from "../components/sandbox/PrototypeList";
import { type TemplateStudioController, useTemplateStudio } from "../hooks/useTemplateStudio";
import type { Draft } from "../types";

const fixtures = vi.hoisted(() => ({
  songs: [
    {
      assetId: "bruses",
      kind: "music",
      title: "Dueles Tan Bien · Bruses",
      transcriptionStatus: "done",
    },
    { assetId: "other", kind: "music", title: "Otra canción", transcriptionStatus: "pending" },
  ] as LibraryAsset[],
  drafts: [] as Draft[],
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, args?: { name?: string }) =>
    args?.name ? `${key}: ${args.name}` : key,
}));
vi.mock("@/features/resources/hooks/useResources", () => ({
  useLibraryList: () => ({ data: fixtures.songs }),
}));
vi.mock("@/features/resources", async () => ({
  ResourcePicker: (await import("@/features/resources/components/ResourcePicker")).ResourcePicker,
  LyricsViewer: () => <div>Synced lyrics</div>,
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
vi.mock("@/features/create-video/hooks/useNiches", () => ({ useNiches: () => ({ data: [] }) }));
vi.mock("@/features/templates/hooks/useTemplateRequirements", () => ({
  useTemplateRequirements: () => ({ data: undefined }),
}));
vi.mock("../hooks/useDraft", () => ({ useTemplateDrafts: () => ({ data: fixtures.drafts }) }));
vi.mock("../hooks/useOriginalDraft", () => ({ useOriginalDraft: () => ({ draft: null }) }));
vi.mock("../hooks/usePrototypeEditor", () => ({ usePrototypeEditor: () => ({ draft: null }) }));
vi.mock("../hooks/useRecordPrototype", () => ({ useRecordPrototype: () => ({ selected: null }) }));
afterEach(() => {
  cleanup();
  fixtures.drafts = [];
});
const audio = { required: true, lyrics: "auto" } as TemplateRequirements["audio"];
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
    render(<Form />);
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
  it("selects another library song, updates its summary and collapses the chooser", () => {
    render(<Form />);
    fireEvent.click(screen.getByRole("button", { name: "chooseAnother" }));
    fireEvent.click(screen.getByRole("button", { name: /Otra canción/ }));
    expect(screen.getByText("Otra canción")).toBeTruthy();
    expect(screen.queryByText(fixtures.songs[0].title)).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
  it("opens for a new prototype and accepts the existing upload callback", () => {
    render(<Form initial={null} />);
    expect(screen.getByRole("searchbox")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Upload song" }));
    expect(screen.getByText("Otra canción")).toBeTruthy();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
  it("keeps the full song form available outside the compact prototype editor", () => {
    render(<SongField audio={audio} value="bruses" onChange={vi.fn()} />);
    expect(screen.getByRole("searchbox")).toBeTruthy();
    expect(screen.getByText("required")).toBeTruthy();
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
            previewPrototype,
            openPrototype,
            draftsLoading: false,
          } as unknown as TemplateStudioController
        }
      />,
    );
    expect(screen.getAllByText(fixtures.songs[0].title)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "play: One" }));
    expect(previewPrototype).toHaveBeenCalledWith("One");
    expect(openPrototype).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("button", { name: "play: No preview" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /One.*Dueles/ }));
    expect(openPrototype).toHaveBeenCalledWith("One");
  });
  it("uses the existing modal stage while leaving the list open, without generation", () => {
    fixtures.drafts = [
      draft("One", "/preview/one"),
      draft("Two", "/preview/two"),
      draft("Empty", null),
    ];
    const { result, rerender } = renderHook(() =>
      useTemplateStudio({ id: "lyrics-manifiesto", canGenerate: true } as Template, true),
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
    fixtures.drafts = [];
    rerender();
    expect(result.current.draftPreviewUrl).toBeNull();
  });
});
