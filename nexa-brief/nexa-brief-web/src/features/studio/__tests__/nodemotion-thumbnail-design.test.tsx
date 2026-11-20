import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chooseDraftThumbnail,
  prepareDraftThumbnails,
  updateDraftThumbnailOption,
  uploadDraftThumbnailBackground,
} from "../api/studio-service";
import { DraftThumbnailPicker } from "../components/record/DraftThumbnailPicker";
import {
  ThumbnailStageContext,
  type ThumbnailStagePreview,
} from "../components/ThumbnailStageContext";
import { useDraftThumbnailEditor } from "../hooks/useDraftThumbnailEditor";
import { thumbnailLocalEdits } from "../services/thumbnail-local-edits";
import type { Draft } from "../types";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, args?: { option?: string }) =>
    args?.option ? `${key} ${args.option}` : key,
}));
vi.mock("../api/studio-service", () => ({
  chooseDraftThumbnail: vi.fn(),
  prepareDraftThumbnails: vi.fn(),
  updateDraftThumbnailOption: vi.fn(),
  uploadDraftThumbnailBackground: vi.fn(),
}));
const prepared = {
  draftId: "draft-one",
  templateId: "lyrics-impact",
  name: "One",
  status: "prepared",
  details: { songName: "Song", artist: "Artist", copies: { youtube: { title: "Post title" } } },
  thumbnails: {
    selected: "A",
    fingerprint: "abc",
    urls: {},
    options: {
      A: {
        text: "Título A",
        design: {
          styleVersion: 5,
          palette: { foreground: "#D2222A" },
          background: {
            kind: "frame",
            sourceKind: "image",
            availableSources: ["image", "video"],
            time: 12,
            overlay: 0.2,
          },
        },
      },
      B: {
        text: "Título B",
        design: {
          styleVersion: 5,
          palette: { foreground: "#D2222A" },
          background: {
            kind: "frame",
            sourceKind: "image",
            availableSources: ["image", "video"],
            time: 12,
            overlay: 0.2,
          },
        },
      },
    },
  },
} as unknown as Draft;
let client: QueryClient;
let server: Draft;
function Wrapper({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState<ThumbnailStagePreview | null>(null);
  const bg = preview?.manifest.options[preview.option].design?.background as
    | Record<string, unknown>
    | undefined;
  return (
    <QueryClientProvider client={client}>
      <ThumbnailStageContext.Provider value={{ preview, setPreview }}>
        {children}
        {preview && (
          <output
            data-testid="stage"
            data-overlay={String(bg?.overlay)}
            data-time={String(bg?.time)}
          >
            {preview.option} · {preview.manifest.options[preview.option].text}
          </output>
        )}
      </ThumbnailStageContext.Provider>
    </QueryClientProvider>
  );
}
function Picker({ draft = prepared }: { draft?: Draft }) {
  const editor = useDraftThumbnailEditor(draft);
  return (
    <>
      <DraftThumbnailPicker draft={draft} editor={editor} />
      <button type="button" onClick={() => void editor.flush().catch(() => undefined)}>
        sync
      </button>
    </>
  );
}
beforeEach(() => {
  thumbnailLocalEdits.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  server = structuredClone(prepared);
  vi.mocked(updateDraftThumbnailOption).mockImplementation(async (_id, option, value) => {
    if (!server.thumbnails?.options) throw new Error("Fixture needs options");
    server = {
      ...server,
      thumbnails: {
        ...server.thumbnails,
        options: { ...server.thumbnails.options, [option]: value },
      },
    };
    return structuredClone(server);
  });
  vi.mocked(chooseDraftThumbnail).mockImplementation(async (_id, option) => {
    if (!server.thumbnails) throw new Error("Missing thumbnails");
    server = { ...server, thumbnails: { ...server.thumbnails, selected: option } };
    return structuredClone(server);
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  thumbnailLocalEdits.clear();
  vi.clearAllMocks();
});
describe("local thumbnail editor", () => {
  it("shows both static options without preparation or API writes", () => {
    render(<Picker />, { wrapper: Wrapper });
    expect(screen.getByRole("img", { name: "A · Título A" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "B · Título B" })).toBeTruthy();
    expect(document.querySelectorAll("iframe,video")).toHaveLength(0);
    expect(prepareDraftThumbnails).not.toHaveBeenCalled();
    expect(updateDraftThumbnailOption).not.toHaveBeenCalled();
  });
  it("chooses one shared option for every destination", async () => {
    function SharedPicker() {
      const editor = useDraftThumbnailEditor(prepared);
      return (
        <>
          <DraftThumbnailPicker draft={prepared} editor={editor} />
          <button type="button" onClick={() => void editor.flush()}>sync destination</button>
        </>
      );
    }
    render(<SharedPicker />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole("button", { name: "chooseOption B" }));
    fireEvent.click(screen.getByRole("button", { name: "sync destination" }));
    await waitFor(() =>
      expect(chooseDraftThumbnail).toHaveBeenCalledWith(prepared.draftId, "B"),
    );
    expect(server.thumbnails?.selected).toBe("B");
  });

  it("edits B immediately without choosing it and restores unsynced JSON on reopen", async () => {
    const view = render(<Picker />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole("button", { name: "viewOption B" }));
    fireEvent.change(screen.getByRole("textbox", { name: "song" }), {
      target: { value: "Frase local B" },
    });
    fireEvent.click(screen.getByText("background"));
    fireEvent.change(screen.getByRole("slider", { name: "darken" }), { target: { value: ".65" } });
    expect(screen.getByTestId("stage").textContent).toBe("B · Frase local B");
    expect(screen.getByTestId("stage").getAttribute("data-overlay")).toBe("0.65");
    expect(
      screen.getByRole("button", { name: "chooseOption A" }).getAttribute("aria-pressed"),
    ).toBe("true");
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(updateDraftThumbnailOption).not.toHaveBeenCalled();
    expect(chooseDraftThumbnail).not.toHaveBeenCalled();
    view.unmount();
    render(<Picker />, { wrapper: Wrapper });
    expect(screen.getByRole("textbox", { name: "song" })).toHaveProperty("value", "Frase local B");
    expect(screen.getByText("savedLocally")).toBeTruthy();
  });
  it("keeps selection local and synchronizes the latest edits before recording", async () => {
    render(<Picker />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole("button", { name: "chooseOption B" }));
    fireEvent.change(screen.getByRole("textbox", { name: "song" }), {
      target: { value: "Última frase B" },
    });
    expect(chooseDraftThumbnail).not.toHaveBeenCalled();
    expect(updateDraftThumbnailOption).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("sync"));
    await waitFor(() => expect(chooseDraftThumbnail).toHaveBeenCalledWith(prepared.draftId, "B"));
    expect(updateDraftThumbnailOption).toHaveBeenCalledWith(
      prepared.draftId,
      "B",
      expect.objectContaining({ text: "Última frase B" }),
    );
    expect(updateDraftThumbnailOption).toHaveBeenCalledTimes(1);
    expect(thumbnailLocalEdits.get(prepared.draftId)).toBeNull();
  });
  it("retains local edits on synchronization failure and supports retry", async () => {
    vi.mocked(updateDraftThumbnailOption).mockRejectedValueOnce(new Error("offline"));
    render(<Picker />, { wrapper: Wrapper });
    fireEvent.change(screen.getByRole("textbox", { name: "song" }), {
      target: { value: "Guardar después" },
    });
    fireEvent.click(screen.getByText("sync"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("offline"));
    expect(thumbnailLocalEdits.get(prepared.draftId)?.options.A?.text).toBe("Guardar después");
    fireEvent.click(screen.getByRole("button", { name: "retrySave" }));
    await waitFor(() => expect(thumbnailLocalEdits.get(prepared.draftId)).toBeNull());
  });
  it("offers image and video independently, with seconds only for video", async () => {
    const { container } = render(<Picker />, { wrapper: Wrapper });
    expect(container.querySelector("details")?.open).toBe(false);
    fireEvent.click(screen.getByText("background"));
    expect(screen.queryByRole("spinbutton")).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "background" }), {
      target: { value: "source-video" },
    });
    fireEvent.click(screen.getByRole("button", { name: "viewOption A" }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "32.5" } });
    await waitFor(
      () => expect(screen.getByTestId("stage").getAttribute("data-time")).toBe("32.5"),
      { timeout: 2000 },
    );
    expect(updateDraftThumbnailOption).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("combobox", { name: "background" }), {
      target: { value: "source-image" },
    });
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(thumbnailLocalEdits.get(prepared.draftId)?.options.A?.background.mediaSource).toBe(
      "image",
    );
  });
  it("uploads an image through the media endpoint and keeps its configuration local", async () => {
    vi.mocked(uploadDraftThumbnailBackground).mockResolvedValue({ asset: "a".repeat(24) });
    render(<Picker />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText("background"));
    const file = new File(["image"], "custom.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("uploadImage"), { target: { files: [file] } });
    await waitFor(() =>
      expect(thumbnailLocalEdits.get(prepared.draftId)?.options.A?.background.asset).toBe(
        "a".repeat(24),
      ),
    );
    expect(uploadDraftThumbnailBackground).toHaveBeenCalledWith(prepared.draftId, file);
    expect(updateDraftThumbnailOption).not.toHaveBeenCalled();
    expect(screen.getByRole("option", { name: "videoFrame" })).toBeTruthy();
  });
});
