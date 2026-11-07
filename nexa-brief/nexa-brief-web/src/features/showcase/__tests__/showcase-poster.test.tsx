import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ShowcaseDesign, ShowcaseEntry } from "../api/standard-showcase-repository";
import { ShowcasePoster } from "../components/ShowcasePoster";

vi.mock("@/infrastructure/api/http-client", () => ({ resolveApiUrl: (path: string) => path }));
const design = { id: "demo", revision: "v1" } as ShowcaseDesign;
const entry = { id: "item", label: "Prueba", preview_kind: "iframe", preview_url: "/api/v1/showcase/designs/demo/preview?entry=item" } as ShowcaseEntry;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("muestra la imagen generada y solo monta la animación al pulsar reproducir", async () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["imagen"]), { status: 200 })));
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:poster"), revokeObjectURL: vi.fn() }));
  render(<ShowcasePoster design={design} entry={entry} format="16x9" suspended={false} />);
  await waitFor(() => expect(screen.getByAltText("Vista previa de Prueba").getAttribute("src")).toBe("blob:poster"));
  expect(screen.queryByTitle("Vista previa de Prueba")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reproducir Prueba" }));
  expect(screen.getByTitle("Vista previa de Prueba")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Detener Prueba" }));
  expect(screen.queryByTitle("Vista previa de Prueba")).toBeNull();
  expect(screen.getByAltText("Vista previa de Prueba")).toBeDefined();
});

it("conserva el fotograma cuando la tarjeta sale y vuelve a entrar en pantalla", async () => {
  let callback: IntersectionObserverCallback = () => {};
  class Observer {
    constructor(cb: IntersectionObserverCallback) { callback = cb; }
    observe() {} disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", Observer);
  const fetcher = vi.fn(async () => new Response(new Blob(["imagen"]), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:poster"), revokeObjectURL: vi.fn() }));
  render(<ShowcasePoster design={design} entry={entry} format="16x9" suspended={false} />);
  const intersect = (value: boolean) => act(() => callback([{ isIntersecting: value } as IntersectionObserverEntry], {} as IntersectionObserver));
  intersect(true);
  await screen.findByAltText("Vista previa de Prueba");
  intersect(false); intersect(true);
  expect(screen.getByAltText("Vista previa de Prueba").getAttribute("src")).toBe("blob:poster");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
