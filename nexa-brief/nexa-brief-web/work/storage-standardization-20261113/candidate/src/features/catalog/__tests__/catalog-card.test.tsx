import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { CatalogEntry } from "../types";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../components/InternalCatalogPlayer", () => ({
  InternalCatalogPlayer: () => <p>internal tools</p>,
}));
vi.mock("@/shared/components/media/MediaPlayerModal", () => ({
  MediaPlayerModal: ({
    open,
    onOpenChange,
    source,
    trigger,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    source: { kind: string } | null;
    trigger: React.ReactNode;
  }) => (
    <div>
      {cloneElement(trigger as ReactElement<{ onClick: () => void }>, {
        onClick: () => onOpenChange(true),
      })}
      {open && <div data-testid="player">{source?.kind}</div>}
    </div>
  ),
}));

import { CatalogCard } from "../components/CatalogCard";

afterEach(cleanup);

const item: CatalogEntry = {
  id: "demo:test",
  source_id: "test",
  kind: "demo",
  title: "Test",
  category_ids: ["history"],
  poster_url: "/poster.jpg",
  orientation: "any",
  demo: true,
  design_id: "ink",
  playback: {
    engine_url: "/engine",
    engine: "explainer",
    desktop_video_url: null,
    mobile_video_url: null,
  },
};

it("public cards load only the thumbnail until clicked and never mount internal tools", () => {
  const { container } = render(<CatalogCard item={item} />);
  expect(container.querySelectorAll("iframe,video").length).toBe(0);
  expect(screen.queryByTestId("player")).toBeNull();
  expect(screen.queryByText("internal tools")).toBeNull();
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByTestId("player").textContent).toBe("iframe");
});

it("the same public card opens a video when the demo has an MP4", () => {
  render(
    <CatalogCard
      item={{ ...item, playback: { ...item.playback, desktop_video_url: "/demo.mp4" } }}
    />,
  );
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByTestId("player").textContent).toBe("video");
});
