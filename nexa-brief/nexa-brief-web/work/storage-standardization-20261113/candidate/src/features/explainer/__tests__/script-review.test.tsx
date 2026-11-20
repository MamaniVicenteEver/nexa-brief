import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isPreparedVideo, isRenderedVideo } from "@/features/templates/lib/preparation-items";
import { ExplainerVideoCard } from "../components/ExplainerVideoCard";
import type { ExplainerVideo } from "../types";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/features/showcase/hooks/useVisualStyles", () => ({
  useVisualStyles: () => ({ data: undefined }),
}));
vi.mock("../components/ExplainerStudioSidebar", () => ({
  ExplainerStudioSidebar: () => <aside>Publication texts</aside>,
}));
vi.mock("@/shared/components/media/MediaPlayerModal", () => ({
  MediaPlayerModal: () => {
    throw new Error("A pending draft must not mount the media player");
  },
}));
const draft = {
  videoId: "pilot",
  title: "Nuevo diálogo",
  design: "cara-a-cara",
  ready: false,
  status: "guion para revisar",
  scriptReviewRequired: true,
  scriptText: "¿Sabes qué diferencia hay entre un SSD y un M.2?",
  rendered: ["9x16"],
  lastJob: null,
  posterUrl: "/old-poster.jpg",
  qualityIssues: [],
  durationSeconds: null,
  demo: false,
  publishReady: true,
} as unknown as ExplainerVideo;

afterEach(cleanup);
describe("script review before voice", () => {
  it("returns a pending draft to Preparation while retaining its historical exports", () => {
    expect(isPreparedVideo(draft)).toBe(true);
    expect(isRenderedVideo(draft)).toBe(false);
    expect(isRenderedVideo({ ...draft, scriptReviewRequired: false })).toBe(true);
  });
  it("shows the new script without an iframe, audio, video or media player", () => {
    const client = new QueryClient();
    const view = render(
      <QueryClientProvider client={client}>
        <ExplainerVideoCard video={draft} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /card.openPreview/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(draft.scriptText!)).toBeTruthy();
    expect(document.querySelector("iframe, audio, video")).toBeNull();
    view.unmount();
    client.clear();
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });
});
