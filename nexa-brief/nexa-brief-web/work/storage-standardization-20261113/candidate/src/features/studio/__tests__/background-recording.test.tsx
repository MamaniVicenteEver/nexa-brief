import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Template } from "@/features/templates/types";
import type { Niche } from "@/features/create-video/types";
import { renderDraft } from "../api/studio-service";
import { useRecordPrototype } from "../hooks/useRecordPrototype";
import { backgroundVisibility } from "../services/background-visibility";
import type { Draft } from "../types";

vi.mock("../api/studio-service", () => ({ renderDraft: vi.fn() }));
beforeEach(() => { window.localStorage.clear(); vi.clearAllMocks(); });
it("sends the local background opacity for the selected prototype when recording", async () => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const template = { id: "lyrics-impact", nicheId: "lyrics_video_impact", displayName: "Impacto" } as Template;
  const niche = { supportedEngines: ["hyperframes", "remotion"], recorderEngine: "remotion" } as Niche;
  const draft = { draftId: "draft-one", status: "prepared", name: "uno", original: false,
    inputs: { templateInputs: { media: { background: ["video"] } }, videoAssetId: "video" } } as unknown as Draft;
  backgroundVisibility.set("draft-one", 0.43);
  vi.mocked(renderDraft).mockResolvedValue({ draft_id: "draft-one", job_id: "job-one", status: "rendering" });
  const { result } = renderHook(() => useRecordPrototype(template, niche, [draft], null), { wrapper });
  act(() => result.current.render.mutate(draft));
  await waitFor(() => expect(renderDraft).toHaveBeenCalledWith("draft-one", expect.objectContaining({ backgroundOpacity: 0.43, recorderEngine: "hyperframes" })));
});

it("blocks recording when HyperFrames is unsupported", () => {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const draft = { draftId: "one", status: "prepared", original: false } as Draft;
  const { result } = renderHook(() => useRecordPrototype({} as Template, { supportedEngines: ["remotion"] } as Niche, [draft], null), { wrapper });
  expect(result.current.engine).toBe("hyperframes");
  expect(result.current.hyperframesSupported).toBe(false);
  expect(result.current.ready).toBe(false);
});
