import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chooseDraftThumbnail,
  saveDraftDetails,
  updateDraftThumbnailOption,
} from "../api/studio-service";
import { RecordTab } from "../components/record/RecordTab";
import {
  ThumbnailStageContext,
  type ThumbnailStagePreview,
} from "../components/ThumbnailStageContext";
import type { TemplateStudioController } from "../hooks/useTemplateStudio";
import { thumbnailLocalEdits } from "../services/thumbnail-local-edits";
import { DEFAULT_RECORD_OUTPUTS } from "../types";
import type { Draft } from "../types";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, args?: { option?: string }) =>
    args?.option ? `${key} ${args.option}` : key,
}));
vi.mock("../api/studio-service", () => ({
  chooseDraftThumbnail: vi.fn(),
  updateDraftThumbnailOption: vi.fn(),
  uploadDraftThumbnailBackground: vi.fn(),
  prepareDraftThumbnails: vi.fn(),
  saveDraftDetails: vi.fn(),
}));
vi.mock("../components/record/DraftThumbnailArtwork", () => ({
  DraftThumbnailArtwork: ({ option }: { option: string }) => (
    <div role="img" aria-label={`art ${option}`} />
  ),
  retryDraftThumbnailRenderer: vi.fn(),
}));
vi.mock("../components/DraftProgress", () => ({ DraftProgress: () => null }));
vi.mock("../components/record/PrototypePicker", () => ({
  PrototypePicker: () => null,
}));
vi.mock("../components/record/DetailsAccordion", () => ({
  DetailsAccordion: () => null,
}));
vi.mock("../hooks/usePublishCategoryGroups", () => ({
  usePublishCategoryGroups: () => ({
    groups: [],
    unavailable: new Set(),
    isLoading: false,
    isError: false,
    retry: vi.fn(),
  }),
}));
vi.mock("@/shared/components/publish/BrandAccountPicker", () => ({
  BrandAccountPicker: () => null,
}));

const draft = {
  draftId: "draft-one",
  templateId: "lyrics-impact",
  name: "Song",
  status: "prepared",
  original: false,
  details: { songName: "Song", artist: "Artist", copies: {} },
  inputs: {
    musicAssetId: null,
    imageAssetId: null,
    videoAssetId: null,
    templateInputs: null,
  },
  thumbnails: {
    selected: "A",
    fingerprint: "abc",
    urls: {},
    options: {
      A: { text: "Title A", design: {} },
      B: { text: "Title B", design: {} },
    },
  },
} as unknown as Draft;
let client: QueryClient;
let startRecording: ReturnType<typeof vi.fn>;
function Wrapper({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState<ThumbnailStagePreview | null>(null);
  return (
    <QueryClientProvider client={client}>
      <ThumbnailStageContext.Provider value={{ preview, setPreview }}>
        {children}
      </ThumbnailStageContext.Provider>
    </QueryClientProvider>
  );
}
function viewRecord() {
  const studio = {
    original: { draft: null, ensure: { isPending: false } },
    recorder: {
      selected: draft,
      recordable: [draft],
      choice: draft.draftId,
      select: vi.fn(),
      isOriginal: false,
      engines: ["hyperframes"],
      engine: "hyperframes",
      hyperframesSupported: true,
      accounts: [],
      formats: ["16x9", "9x16"],
      outputs: [...DEFAULT_RECORD_OUTPUTS],
      setOutput: vi.fn(),
      hasOutputForAccount: vi.fn().mockReturnValue(true),
      desktop: true,
      vertical: false,
      canVertical: true,
      ready: true,
      render: { isPending: false, mutate: startRecording },
      setDesktop: vi.fn(),
      setVertical: vi.fn(),
      setAccounts: vi.fn(),
      setAccountFormat: vi.fn(),
    },
  } as unknown as TemplateStudioController;
  return render(<RecordTab studio={studio} />, { wrapper: Wrapper });
}
beforeEach(() => {
  thumbnailLocalEdits.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  startRecording = vi.fn();
});
afterEach(() => {
  cleanup();
  client.clear();
  thumbnailLocalEdits.clear();
  vi.clearAllMocks();
});
describe("recording thumbnail controls", () => {
  it("keeps choosing A/B separate from viewing and editing an option", () => {
    viewRecord();
    const chooseA = screen.getByRole("button", { name: "chooseOption A" });
    const chooseB = screen.getByRole("button", { name: "chooseOption B" });
    const viewB = screen.getByRole("button", { name: "viewOption B" });
    expect(chooseA.getAttribute("aria-pressed")).toBe("true");
    expect(chooseB.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "viewOption A" })).toBeTruthy();
    fireEvent.click(viewB);
    expect(chooseA.getAttribute("aria-pressed")).toBe("true");
    expect(chooseB.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("editingOption B")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "song" }) as HTMLInputElement).value).toBe(
      "Title B",
    );
    fireEvent.click(chooseB);
    expect(chooseB.getAttribute("aria-pressed")).toBe("true");
    expect(chooseA.getAttribute("aria-pressed")).toBe("false");
    expect(chooseDraftThumbnail).not.toHaveBeenCalled();
    expect(updateDraftThumbnailOption).not.toHaveBeenCalled();
  });
  it("places the artist just after the option being edited and before its title", () => {
    viewRecord();
    const editing = screen.getByText("editingOption A");
    const artist = screen.getByRole("textbox", { name: "artist" });
    const title = screen.getByRole("textbox", { name: "song" });
    expect(editing.compareDocumentPosition(artist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(artist.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("waits for the artist to be saved before allowing recording", async () => {
    let resolveSave: (result: Draft) => void = () => {};
    vi.mocked(saveDraftDetails).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    viewRecord();
    fireEvent.change(screen.getByRole("textbox", { name: "artist" }), {
      target: { value: "New artist" },
    });
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() =>
      expect(saveDraftDetails).toHaveBeenCalledWith(
        draft.draftId,
        expect.objectContaining({ artist: "New artist" }),
      ),
    );
    const record = screen.getByRole("button", {
      name: "record",
    }) as HTMLButtonElement;
    expect(record.disabled).toBe(true);
    expect(startRecording).not.toHaveBeenCalled();
    resolveSave({
      ...draft,
      details: {
        songName: "Song",
        artist: "New artist",
        language: null,
        copies: {},
        generatedAt: null,
        edited: false,
        research: "",
      },
    });
    await waitFor(() => expect(record.disabled).toBe(false));
    fireEvent.click(record);
    await waitFor(() => expect(startRecording).toHaveBeenCalledTimes(1));
  });
  it("does not start recording with an unsaved artist", () => {
    viewRecord();
    fireEvent.change(screen.getByRole("textbox", { name: "artist" }), {
      target: { value: "New artist" },
    });
    const record = screen.getByRole("button", {
      name: "record",
    }) as HTMLButtonElement;
    expect(record.disabled).toBe(true);
    fireEvent.click(record);
    expect(startRecording).not.toHaveBeenCalled();
  });
});
