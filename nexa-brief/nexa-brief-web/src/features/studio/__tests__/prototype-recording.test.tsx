import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Niche } from "@/features/create-video/types";
import type { Template } from "@/features/templates/types";
import { deleteDraft, renderDraft } from "../api/studio-service";
import { PrototypePicker } from "../components/record/PrototypePicker";
import { useRecordPrototype } from "../hooks/useRecordPrototype";
import { DEFAULT_RECORD_OUTPUTS } from "../types";
import type { Draft } from "../types";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../api/studio-service", () => ({ deleteDraft: vi.fn(), renderDraft: vi.fn() }));
const draft = (id: string, status = "prepared") =>
  ({ draftId: id, templateId: "lyrics-caution", name: id, status, details: null }) as Draft;
let client: QueryClient;
function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(deleteDraft).mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("NodeMotion recording choices", () => {
  it("deletes the chosen prototype without selecting its radio or deleting the original", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const select = vi.fn();
    render(
      <PrototypePicker
        original={draft("original")}
        prototypes={[draft("one"), draft("two")]}
        choice="one"
        onSelect={select}
      />,
      { wrapper: Wrapper },
    );
    fireEvent.click(screen.getByRole("button", { name: "delete: two" }));
    await waitFor(() => expect(deleteDraft).toHaveBeenCalledWith("two", expect.anything()));
    expect(select).not.toHaveBeenCalled();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });
  it("keeps active work protected and respects cancelling deletion", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <PrototypePicker
        original={null}
        prototypes={[draft("one"), draft("busy", "rendering")]}
        choice="one"
        onSelect={vi.fn()}
      />,
      { wrapper: Wrapper },
    );
    expect(
      (screen.getByRole("button", { name: "delete: busy" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "delete: one" }));
    expect(deleteDraft).not.toHaveBeenCalled();
  });
  it("defaults all five outputs and resets the choices when reopening", () => {
    const template = {
      id: "lyrics-caution",
      nicheId: "lyrics_video_caution",
      displayName: "Caution",
    } as Template;
    const niche = { supportedEngines: ["hyperframes"], recorderEngine: "hyperframes" } as Niche;
    const { result, rerender } = renderHook(
      ({ open }) => useRecordPrototype(template, niche, [], null, open),
      { initialProps: { open: true }, wrapper: Wrapper },
    );
    expect(result.current.outputs).toEqual([...DEFAULT_RECORD_OUTPUTS]);
    expect(result.current.formats).toEqual(["16x9", "9x16"]);
    act(() => {
      for (const output of DEFAULT_RECORD_OUTPUTS) {
        if (output !== "youtube_shorts") result.current.setOutput(output, false);
      }
    });
    expect(result.current.outputs).toEqual(["youtube_shorts"]);
    expect(result.current.formats).toEqual(["9x16"]);
    rerender({ open: false });
    rerender({ open: true });
    expect(result.current.outputs).toEqual([...DEFAULT_RECORD_OUTPUTS]);
    expect(result.current.formats).toEqual(["16x9", "9x16"]);
  });

  it("sends output destinations separately from publish accounts", async () => {
    vi.mocked(renderDraft).mockResolvedValue({ draft_id: "one", job_id: "job", status: "rendering" });
    const template = {
      id: "lyrics-caution",
      nicheId: "lyrics_video_caution",
      displayName: "Caution",
    } as Template;
    const niche = { supportedEngines: ["hyperframes"], recorderEngine: "hyperframes" } as Niche;
    const { result } = renderHook(
      () => useRecordPrototype(template, niche, [], null),
      { wrapper: Wrapper },
    );
    await act(async () => {
      await result.current.render.mutateAsync(draft("one"));
    });
    expect(renderDraft).toHaveBeenCalledWith("one", expect.objectContaining({
      outputs: [...DEFAULT_RECORD_OUTPUTS],
      publishAccounts: [],
    }));
  });
});
