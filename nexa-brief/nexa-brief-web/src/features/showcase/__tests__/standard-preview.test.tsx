import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShowcaseEntry } from "../api/standard-showcase-repository";
import { StandardShowcasePreview } from "../components/StandardShowcasePreview";

vi.mock("@/infrastructure/api/http-client", () => ({ resolveApiUrl: (path: string) => path }));
const entry: ShowcaseEntry = {
  id: "a",
  name: "scene",
  label: "Escena",
  kind: "component",
  summary: "",
  tags: [],
  params: {},
  example: {},
  preview_url: "/api/v1/showcase/designs/demo/preview?entry=a",
  preview_kind: "iframe",
};
const origin = window.location.origin;
function message(
  frame: HTMLIFrameElement,
  type: string,
  options: { origin?: string; source?: MessageEventSource | null } = {},
) {
  act(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: options.origin ?? origin,
        source: options.source === undefined ? frame.contentWindow : options.source,
        data: { type },
      }),
    ),
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("vista previa estándar", () => {
  it("solo acepta mensajes del iframe correcto y del origen correcto", () => {
    render(<StandardShowcasePreview entry={entry} format="9x16" modal />);
    const frame = screen.getByTitle("Vista previa de Escena") as HTMLIFrameElement;
    expect(screen.getByRole("status").textContent).toContain("Preparando");
    message(frame, "nexa-template-ready", { origin: "https://evil.example" });
    message(frame, "nexa-template-ready", { source: window });
    expect(screen.getByRole("status").textContent).toContain("Preparando");
    const post = vi.spyOn(frame.contentWindow as Window, "postMessage");
    message(frame, "nexa-template-ready");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Pausar" })).toBeDefined();
    expect(post).toHaveBeenCalledWith(
      { type: "nexa-template-volume", muted: true, volume: 0 },
      origin,
    );
    expect(post).toHaveBeenCalledWith({ type: "nexa-template-playback", playing: true }, origin);
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    expect(post).toHaveBeenLastCalledWith(
      { type: "nexa-template-playback", playing: false },
      origin,
    );
    message(frame, "nexa-template-ended");
    fireEvent.click(screen.getByRole("button", { name: "Reanudar" }));
    expect(post).toHaveBeenCalledWith({ type: "nexa-template-seek", time: 0 }, origin);
    expect(post).toHaveBeenLastCalledWith(
      { type: "nexa-template-playback", playing: true },
      origin,
    );
  });
  it("la tarjeta prepara y repite Kit sin capturar clics", () => {
    render(<StandardShowcasePreview entry={entry} format="16x9" />);
    const frame = screen.getByTitle("Vista previa de Escena") as HTMLIFrameElement;
    const post = vi.spyOn(frame.contentWindow as Window, "postMessage");
    expect(frame.className).toContain("pointer-events-none");
    expect(frame.getAttribute("src")).toContain("entry=a&format=16x9");
    message(frame, "nexa-template-ready");
    expect(post).toHaveBeenCalledWith({ type: "nexa-template-seek", time: 0.35 }, origin);
    post.mockClear();
    message(frame, "nexa-template-ended");
    expect(post).toHaveBeenCalledWith({ type: "nexa-template-seek", time: 0.35 }, origin);
    expect(post).toHaveBeenCalledWith({ type: "nexa-template-playback", playing: true }, origin);
    expect(screen.queryByRole("button", { name: "Pausar" })).toBeNull();
  });
  it("vista autónoma informa listo sin comandos de reproducción", () => {
    render(<StandardShowcasePreview entry={entry} format="9x16" modal />);
    const frame = screen.getByTitle("Vista previa de Escena") as HTMLIFrameElement;
    const post = vi.spyOn(frame.contentWindow as Window, "postMessage");
    message(frame, "nexa-animation-ready");
    expect(screen.queryByRole("status")).toBeNull();
    expect(post).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Pausar" })).toBeNull();
  });
  it("error permite reintentar con un iframe nuevo y sin confiar en el anterior", () => {
    render(<StandardShowcasePreview entry={entry} format="9x16" modal />);
    const old = screen.getByTitle("Vista previa de Escena") as HTMLIFrameElement;
    const oldWindow = old.contentWindow;
    message(old, "nexa-animation-error");
    expect(screen.getByRole("alert")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    const next = screen.getByTitle("Vista previa de Escena") as HTMLIFrameElement;
    expect(next).not.toBe(old);
    message(next, "nexa-animation-ready", { source: oldWindow });
    expect(screen.getByRole("status")).toBeDefined();
    message(next, "nexa-animation-ready");
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("el timeout permite reintentar y una imagen fallida se vuelve a montar", () => {
    vi.useFakeTimers();
    const view = render(<StandardShowcasePreview entry={entry} format="9x16" modal />);
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByRole("alert")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(screen.getByRole("status")).toBeDefined();
    view.unmount();
    const image = {
      ...entry,
      preview_kind: "image" as const,
      preview_url: "/api/v1/showcase/designs/demo/files/picture.png",
    };
    render(<StandardShowcasePreview entry={image} format="9x16" modal />);
    const old = screen.getByAltText("Escena");
    fireEvent.error(old);
    expect(screen.getByRole("alert")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(screen.getByAltText("Escena")).not.toBe(old);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("no carga URL externas", () => {
    render(
      <StandardShowcasePreview
        entry={{ ...entry, preview_url: "https://evil.example/" }}
        format="9x16"
        modal
      />,
    );
    expect(screen.getByText("Vista previa no disponible.")).toBeDefined();
    expect(screen.queryByTitle("Vista previa de Escena")).toBeNull();
  });
});
