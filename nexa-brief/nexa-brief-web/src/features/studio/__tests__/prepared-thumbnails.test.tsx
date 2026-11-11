import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chooseDraftThumbnail, prepareDraftThumbnails } from "../api/studio-service";
import { DraftThumbnailPicker } from "../components/record/DraftThumbnailPicker";
import { draftKey } from "../hooks/useDraft";
import type { Draft } from "../types";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, args?: { option?: string }) =>
    args?.option ? `${key} ${args.option}` : key,
}));
vi.mock("../api/studio-service", () => ({
  chooseDraftThumbnail: vi.fn(),
  prepareDraftThumbnails: vi.fn(),
}));
let client: QueryClient;
const prepared = {
  draftId: "draft-one",
  templateId: "lyrics-manifiesto",
  name: "One",
  status: "prepared",
  details: { songName: "Dueles Tan Bien" },
  thumbnails: { selected: "A", fingerprint: "abc", urls: { A: "/a.jpg", B: "/b.jpg" } },
} as Draft;
function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
});
describe("prepared NodeMotion thumbnails", () => {
  it("shows the two prepared images without starting any generation when opening", () => {
    render(<DraftThumbnailPicker draft={prepared} />, { wrapper: Wrapper });
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "option A" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(prepareDraftThumbnails).not.toHaveBeenCalled();
    expect(document.querySelectorAll("iframe,video")).toHaveLength(0);
  });
  it("persists B as the selected thumbnail and refreshes the draft cache", async () => {
    const chosen = { ...prepared, thumbnails: { ...prepared.thumbnails, selected: "B" } } as Draft;
    vi.mocked(chooseDraftThumbnail).mockResolvedValue(chosen);
    render(<DraftThumbnailPicker draft={prepared} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole("button", { name: "option B" }));
    await waitFor(() =>
      expect(client.getQueryData<Draft>(draftKey(prepared.draftId))?.thumbnails?.selected).toBe(
        "B",
      ),
    );
    expect(chooseDraftThumbnail).toHaveBeenCalledWith(prepared.draftId, "B");
  });
  it("only generates missing thumbnails after an explicit request", async () => {
    vi.mocked(prepareDraftThumbnails).mockResolvedValue({ ...prepared, status: "preparing" });
    render(<DraftThumbnailPicker draft={{ ...prepared, thumbnails: null }} />, {
      wrapper: Wrapper,
    });
    expect(prepareDraftThumbnails).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "prepare" }));
    await waitFor(() => expect(prepareDraftThumbnails).toHaveBeenCalledWith(prepared.draftId));
  });
  it("protects selection while recording and shows retryable capture failures", () => {
    const { rerender } = render(
      <DraftThumbnailPicker draft={{ ...prepared, status: "rendering" }} />,
      { wrapper: Wrapper },
    );
    expect((screen.getByRole("button", { name: "option B" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    rerender(
      <DraftThumbnailPicker
        draft={{ ...prepared, thumbnails: null, thumbnailError: "Capture failed" }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe("Capture failed");
    expect(screen.getByRole("button", { name: "retry" })).toBeTruthy();
  });
});
