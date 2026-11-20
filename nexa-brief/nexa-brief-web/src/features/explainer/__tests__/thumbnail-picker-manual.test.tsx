import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "../../../../messages/es.json";
import type { ExplainerVideo } from "../types";
import { ThumbnailPicker } from "../components/ThumbnailPicker";

const actions = vi.hoisted(() => ({ choose: vi.fn(), capture: vi.fn() }));
vi.mock("../hooks/useExplainer", () => ({
  useCaptureThumbnails: () => ({ mutate: actions.capture, isPending: false, error: null }),
  useChooseThumbnail: () => ({ mutate: actions.choose, isPending: false, error: null }),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("muestra y selecciona imágenes existentes sin generar otras al abrir", () => {
  const video = {
    videoId: "demo", publishPackage: null,
    thumbnails: { chosen: "A", options: [
      { option: "A", url: "/a.jpg", component: "a", params: {} },
      { option: "B", url: "/b.jpg", component: "b", params: {} },
      { option: "C", url: "/c.jpg", component: "c", params: {} },
    ] },
  } as unknown as ExplainerVideo;
  render(<NextIntlClientProvider locale="es" messages={messages}><ThumbnailPicker video={video} /></NextIntlClientProvider>);
  expect(screen.getAllByRole("presentation")).toHaveLength(3);
  expect(actions.capture).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button")[1]);
  expect(actions.choose).toHaveBeenCalledWith({ videoId: "demo", option: "B" });
  expect(actions.capture).not.toHaveBeenCalled();
});
