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
import { draftKey } from "../hooks/useDraft";
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
let client: QueryClient;
const prepared = {
  draftId: "draft-one",
  templateId: "lyrics-manifiesto",
  name: "One",
  status: "prepared",
  details: {
    songName: "Metadata title",
    artist: "Artist",
    copies: { youtube: { title: "Post title" } },
  },
  thumbnails: {
    selected: "A",
    fingerprint: "abc",
    urls: { A: "/a.jpg", B: "/b.jpg" },
    options: {
      A: {
        text: "TÍTULO A",
        design: {
          templateId: "lyrics-manifiesto",
          styleVersion: 4,
          background: { kind: "frame", sourceKind: "video", time: 12, overlay: 0.2 },
        },
      },
      B: {
        text: "Título b",
        design: {
          templateId: "lyrics-manifiesto",
          styleVersion: 4,
          background: { kind: "frame", sourceKind: "video", time: 12, overlay: 0.2 },
        },
      },
    },
  },
} as unknown as Draft;
function Wrapper({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState<ThumbnailStagePreview | null>(null);
  return (
    <QueryClientProvider client={client}>
      <ThumbnailStageContext.Provider value={{ preview, setPreview }}>
        {children}
        {preview && (
          <output
            data-testid="stage"
            data-overlay={String(
              (
                preview.manifest.options[preview.option].design?.background as Record<
                  string,
                  unknown
                >
              )?.overlay,
            )}
            data-time={String(
              (
                preview.manifest.options[preview.option].design?.background as Record<
                  string,
                  unknown
                >
              )?.time,
            )}
          >
            {preview.option} · {preview.manifest.options[preview.option].text}
          </output>
        )}
      </ThumbnailStageContext.Provider>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(updateDraftThumbnailOption).mockImplementation(
    async (draftId, option, value) =>
      ({
        ...prepared,
        draftId,
        thumbnails: {
          ...(prepared.thumbnails ?? {}),
          selected: option,
          options: { ...(prepared.thumbnails?.options ?? {}), [option]: value },
        },
      }) as Draft,
  );
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
});

describe("prepared NodeMotion thumbnails", () => {
  it("shows both options without capture, and keeps video/iframe previews out of each card", () => {
    render(<DraftThumbnailPicker draft={prepared} />, { wrapper: Wrapper });
    expect(screen.getByRole("img", { name: "A · TÍTULO A" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "B · Título b" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "chooseOption A" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getAllByRole("button", { name: /viewOption/ })).toHaveLength(2);
    expect(prepareDraftThumbnails).not.toHaveBeenCalled();
    expect(document.querySelectorAll("iframe,video")).toHaveLength(0);
  });

  it("chooses B separately from viewing and does not trigger a capture", async () => {
    const chosen = {
      ...prepared,
      thumbnails: { ...(prepared.thumbnails ?? {}), selected: "B" },
    } as Draft;
    vi.mocked(chooseDraftThumbnail).mockResolvedValue(chosen);
    render(<DraftThumbnailPicker draft={prepared} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole("button", { name: "chooseOption B" }));
    await waitFor(() => expect(chooseDraftThumbnail).toHaveBeenCalledWith(prepared.draftId, "B"));
    await waitFor(() =>
      expect(client.getQueryData<Draft>(draftKey(prepared.draftId))?.thumbnails?.selected).toBe(
        "B",
      ),
    );
    expect(prepareDraftThumbnails).not.toHaveBeenCalled();
  });

  it("shows the selected artwork in the stage and updates it while editing", async () => {
    render(<DraftThumbnailPicker draft={prepared} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole("button", { name: "viewOption A" }));

    const input = screen.getByRole("textbox", { name: "song" });
    fireEvent.change(input, { target: { value: "Nuevo título A" } });

    expect(screen.getByTestId("stage").textContent).toBe("A · Nuevo título A");
    expect(screen.getByRole("textbox", { name: "song" })).toHaveProperty("value", "Nuevo título A");
    await waitFor(() =>
      expect(updateDraftThumbnailOption).toHaveBeenCalledWith(
        prepared.draftId,
        "A",
        expect.objectContaining({ text: "Nuevo título A" }),
      ),
    );
    expect(updateDraftThumbnailOption).toHaveBeenCalledTimes(1);
    expect(prepareDraftThumbnails).not.toHaveBeenCalled();
    expect(prepared.details?.copies.youtube?.title).toBe("Post title");
  });

  it("loads the selected option text when switching and preserves A after editing B", async () => {
    vi.mocked(chooseDraftThumbnail).mockImplementation(
      async (_draftId, option) =>
        ({
          ...prepared,
          thumbnails: { ...(prepared.thumbnails ?? {}), selected: option },
        }) as Draft,
    );
    render(<DraftThumbnailPicker draft={prepared} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole("button", { name: "chooseOption B" }));

    const input = screen.getByRole("textbox", { name: "song" });
    await waitFor(() => expect(input).toHaveProperty("value", "Título b"));
    fireEvent.change(input, { target: { value: "Título B editado" } });
    fireEvent.click(screen.getByRole("button", { name: "chooseOption A" }));

    await waitFor(() => expect(input).toHaveProperty("value", "TÍTULO A"));
    expect(screen.getByRole("img", { name: "B · Título B editado" })).toBeTruthy();
    await waitFor(() =>
      expect(updateDraftThumbnailOption).toHaveBeenCalledWith(
        prepared.draftId,
        "B",
        expect.objectContaining({ text: "Título B editado" }),
      ),
    );
    expect(prepareDraftThumbnails).not.toHaveBeenCalled();
  });

  it("only generates missing thumbnails after an explicit request", async () => {
    vi.mocked(prepareDraftThumbnails).mockResolvedValue({
      ...prepared,
      status: "preparing",
    } as Draft);
    render(<DraftThumbnailPicker draft={{ ...prepared, thumbnails: null }} />, {
      wrapper: Wrapper,
    });
    expect(prepareDraftThumbnails).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "prepare" }));
    await waitFor(() => expect(prepareDraftThumbnails).toHaveBeenCalledWith(prepared.draftId));
  });
});

describe("NodeMotion backgrounds", () => {
  it("saves a frame time only after applying it and keeps A independent from B", async () => {
    render(<DraftThumbnailPicker draft={prepared} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText("background"));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "24.5" } });
    expect(updateDraftThumbnailOption).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "applyFrame" }));
    await waitFor(() =>
      expect(updateDraftThumbnailOption).toHaveBeenCalledWith(
        prepared.draftId,
        "A",
        expect.objectContaining({
          design: expect.objectContaining({
            background: expect.objectContaining({ kind: "frame", time: 24.5 }),
          }),
        }),
      ),
    );
    expect(updateDraftThumbnailOption).not.toHaveBeenCalledWith(
      prepared.draftId,
      "B",
      expect.anything(),
    );
  });
  it("uploads a custom image and persists its asset ID without capturing artwork", async () => {
    vi.mocked(uploadDraftThumbnailBackground).mockResolvedValue({ asset: "a".repeat(24) });
    render(<DraftThumbnailPicker draft={prepared} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText("background"));
    const file = new File(["image"], "custom.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("uploadImage"), { target: { files: [file] } });
    await waitFor(() =>
      expect(uploadDraftThumbnailBackground).toHaveBeenCalledWith(prepared.draftId, file),
    );
    await waitFor(() =>
      expect(updateDraftThumbnailOption).toHaveBeenCalledWith(
        prepared.draftId,
        "A",
        expect.objectContaining({
          design: expect.objectContaining({
            background: expect.objectContaining({ kind: "image", asset: "a".repeat(24) }),
          }),
        }),
      ),
    );
    expect(prepareDraftThumbnails).not.toHaveBeenCalled();
    expect(document.querySelectorAll("iframe,video")).toHaveLength(0);
  });
});

describe("thumbnail background corrections", () => {
  it("starts collapsed and an image background never offers video seconds", () => {
    const imageDraft = structuredClone(prepared);
    if (!imageDraft.thumbnails?.options) throw new Error("Fixture needs thumbnail options");
    for (const option of ["A", "B"] as const) {
      const value = imageDraft.thumbnails.options[option];
      if (!value?.design) throw new Error("Fixture needs a design");
      value.design.background = {
        kind: "frame",
        sourceKind: "image",
        overlay: 0.2,
      };
    }
    const { container } = render(<DraftThumbnailPicker draft={imageDraft} />, { wrapper: Wrapper });
    expect(container.querySelector("details")?.open).toBe(false);
    fireEvent.click(screen.getByText("background"));
    expect(container.querySelector("details")?.open).toBe(true);
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.getByRole("option", { name: "templateImage" })).toBeTruthy();
    expect(screen.getByText("changeThumbnail")).toBeTruthy();
  });
  it("edits the viewed B background immediately while keeping the chosen A", async () => {
    render(<DraftThumbnailPicker draft={prepared} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole("button", { name: "viewOption B" }));
    fireEvent.click(screen.getByText("background"));
    fireEvent.change(screen.getByRole("slider", { name: "darken" }), { target: { value: ".65" } });
    await waitFor(() =>
      expect(screen.getByTestId("stage").getAttribute("data-overlay")).toBe("0.65"),
    );
    await waitFor(() =>
      expect(updateDraftThumbnailOption).toHaveBeenCalledWith(
        prepared.draftId,
        "B",
        expect.objectContaining({
          design: expect.objectContaining({
            background: expect.objectContaining({ overlay: 0.65, overlayMode: "manual" }),
          }),
        }),
      ),
    );
    expect(chooseDraftThumbnail).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "chooseOption A" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("applies video seconds automatically after typing without a separate click", async () => {
    render(<DraftThumbnailPicker draft={prepared} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole("button", { name: "viewOption A" }));
    fireEvent.click(screen.getByText("background"));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "32.5" } });
    await waitFor(
      () => expect(screen.getByTestId("stage").getAttribute("data-time")).toBe("32.5"),
      { timeout: 2000 },
    );
    await waitFor(
      () =>
        expect(updateDraftThumbnailOption).toHaveBeenCalledWith(
          prepared.draftId,
          "A",
          expect.objectContaining({
            design: expect.objectContaining({
              background: expect.objectContaining({ time: 32.5 }),
            }),
          }),
        ),
      { timeout: 2000 },
    );
  });
});
