import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/es.json";
import { fetchImageCodePreview } from "../api/image-post-preview-api";
import { ImagePostCarousel } from "../components/ImagePostCarousel";
import type { ImagePostFormat } from "../image-formats";
import type { ImageSlide } from "../types";

vi.mock("../api/image-post-preview-api", () => ({ fetchImageCodePreview: vi.fn() }));
const fetchPreview = vi.mocked(fetchImageCodePreview);
const clients: QueryClient[] = [];
const slides: ImageSlide[] = Array.from({ length: 5 }, (_, index) => ({
  slideId: `s${index + 1}`,
  order: index + 1,
  assetId: `a${index + 1}`,
  altTextInstagram: `Lámina ${index + 1}`,
  altTextFacebook: `Lámina ${index + 1}`,
  previewUrl: `/slide-${index + 1}.jpg`,
}));
function Harness() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [format, setFormat] = useState<ImagePostFormat>("9:16");
  return (
    <>
      <button type="button" onClick={() => setFormat("4:5")}>
        Cambiar formato
      </button>
      <ImagePostCarousel
        slides={slides}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
        title="Prueba de carrusel"
        platform="instagram"
        previewUrl={slides[activeIndex].previewUrl ?? ""}
        onImageError={() => {}}
        sourcePostId="img_performance"
        revision={3}
        format={format}
      />
    </>
  );
}
function required<T>(value: T | null): T {
  if (value === null) throw new Error("Expected a mounted carousel element");
  return value;
}
function setup(holdFirst = false) {
  let resolveFirst = () => {};
  fetchPreview.mockImplementation((_postId, slideId, format) => {
    const response = {
      html: `<!doctype html><html><body>${slideId} ${format}</body></html>`,
      format,
      width: 1080,
      height: format === "9:16" ? 1920 : 1350,
      revision: 3,
      plan_hash: "test",
      slide_id: slideId,
    };
    if (holdFirst && slideId === "s1") {
      return new Promise((resolve) => {
        resolveFirst = () => resolve(response);
      });
    }
    return Promise.resolve(response);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const view = render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="es" messages={messages}>
        <Harness />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { ...view, resolveFirst: () => resolveFirst() };
}
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  vi.clearAllMocks();
});

describe("navegación editable sin recargar la lámina al seleccionarla", () => {
  it("prioriza la seleccionada, conserva la portada mientras carga y prepara sólo sus vecinas", async () => {
    const { container, resolveFirst } = setup(true);
    expect(fetchPreview.mock.calls.map((call) => call[1])).toEqual(["s1"]);
    const fallback = required(
      container.querySelector<HTMLImageElement>('[data-slide-id="s1"] img'),
    );
    expect(fallback.style.visibility).toBe("visible");
    resolveFirst();
    const frame = await screen.findByTitle("Lámina 1");
    fireEvent.load(frame);
    await waitFor(() =>
      expect(container.querySelector('[data-slide-id="s2"] iframe')).toBeTruthy(),
    );
    expect(fallback.style.visibility).toBe("hidden");
    expect(fetchPreview.mock.calls.map((call) => call[1])).toEqual(["s1", "s2"]);
    expect(container.querySelectorAll("iframe").length).toBe(2);
  });

  it("mantiene el mismo iframe y el orden DOM al avanzar, sin otra petición ni pantalla negra", async () => {
    const { container } = setup();
    fireEvent.load(await screen.findByTitle("Lámina 1"));
    await waitFor(() =>
      expect(container.querySelector('[data-slide-id="s2"] iframe')).toBeTruthy(),
    );
    const nextFrame = required(container.querySelector('[data-slide-id="s2"] iframe'));
    fireEvent.load(nextFrame);
    const order = Array.from(container.querySelectorAll("figure"));
    fireEvent.click(screen.getByRole("button", { name: "Lámina siguiente" }));
    expect(container.querySelector('[data-side="selected"] iframe')).toBe(nextFrame);
    expect(Array.from(container.querySelectorAll("figure"))).toEqual(order);
    expect(screen.queryByLabelText("Cargando composición")).toBeNull();
    expect(fetchPreview.mock.calls.filter((call) => call[1] === "s2")).toHaveLength(1);
    await waitFor(() =>
      expect(container.querySelector('[data-slide-id="s3"] iframe')).toBeTruthy(),
    );
    fireEvent.load(required(container.querySelector('[data-slide-id="s3"] iframe')));
    fireEvent.click(screen.getByRole("button", { name: "Lámina siguiente" }));
    await waitFor(() =>
      expect(container.querySelector('[data-slide-id="s4"] iframe')).toBeTruthy(),
    );
    expect(container.querySelectorAll("iframe").length).toBe(3);
    expect(container.querySelector('[data-slide-id="s1"] iframe')).toBeNull();
    expect(fetchPreview.mock.calls.some((call) => call[1] === "s5")).toBe(false);
  });

  it("separa la precarga por formato y no muestra como listo el documento anterior", async () => {
    const { container } = setup();
    fireEvent.load(await screen.findByTitle("Lámina 1"));
    await waitFor(() =>
      expect(container.querySelector('[data-slide-id="s2"] iframe')).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cambiar formato" }));
    await waitFor(() =>
      expect(screen.getByTitle("Lámina 1").getAttribute("srcdoc")).toContain("4:5"),
    );
    expect(container.querySelectorAll("iframe").length).toBe(1);
    expect(
      fetchPreview.mock.calls.filter((call) => call[2] === "4:5").map((call) => call[1]),
    ).toEqual(["s1"]);
    fireEvent.load(screen.getByTitle("Lámina 1"));
    await waitFor(() =>
      expect(container.querySelector('[data-slide-id="s2"] iframe')).toBeTruthy(),
    );
    expect(
      required(container.querySelector('[data-slide-id="s2"] iframe')).getAttribute("srcdoc"),
    ).toContain("4:5");
  });
});
