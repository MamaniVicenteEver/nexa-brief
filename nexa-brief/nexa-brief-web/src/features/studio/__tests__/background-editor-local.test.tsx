import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Template, TemplateRequirements } from "@/features/templates/types";
import { backgroundVisibility } from "../services/background-visibility";
import { usePrototypeEditor } from "../hooks/usePrototypeEditor";
import type { Draft } from "../types";

const current = vi.hoisted(() => ({ draft: null as unknown }));
vi.mock("../hooks/useDraft", () => ({
  useDraft: () => ({ data: current.draft }), draftKey: (id: string) => ["draft", id],
  draftsKey: (id: string) => ["drafts", id], isDraftRunning: () => false,
}));
vi.mock("../api/studio-service", () => ({ createDraft: vi.fn(), deleteDraft: vi.fn(), prepareDraft: vi.fn(), renameDraft: vi.fn(), saveDraftDetails: vi.fn() }));
const template = { id: "lyrics-impact" } as Template;
const requirements = { audio: { required: false, lyrics: "none" },
  media: [{ slot: "background", kind: "image|video", min: 1, max: 1, target: "source" }], texts: [], brief: false } as unknown as TemplateRequirements;
const draft = { draftId: "draft-one", name: "uno", songNotes: "", status: "preview_ready", inputs: {
  musicAssetId: null, videoAssetId: "video", imageAssetId: null,
  templateInputs: { media: { background: ["video"] }, texts: {} },
} } as unknown as Draft;
beforeEach(() => { localStorage.clear(); current.draft = draft; });
it("restores browser opacity and changing it does not require regenerating the draft", async () => {
  backgroundVisibility.set("draft-one", 0.45);
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, unmount } = renderHook(() => usePrototypeEditor({ template, requirements, draftId: "draft-one", defaultName: "uno", onCreated: vi.fn() }), { wrapper });
  await waitFor(() => expect(result.current.value.mediaOpacity?.background).toBe(0.45));
  expect(result.current.dirty).toBe(false);
  act(() => result.current.setValue({ ...result.current.value, mediaOpacity: { background: 0.3 } }));
  expect(backgroundVisibility.get("draft-one")).toBe(0.3);
  expect(result.current.dirty).toBe(false);
  unmount(); client.clear();
});
