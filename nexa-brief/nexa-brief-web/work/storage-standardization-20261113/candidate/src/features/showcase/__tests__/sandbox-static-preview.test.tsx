import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SandboxCatalog } from "../components/SandboxCatalog";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("muestra imágenes fijas sin controles y conserva los del video", async () => {
  const catalog = {
    components: "showcase/components.json",
    gallery: "showcase.html",
    thumbs: "showcase/thumbs/thumbs.json",
  };
  const components = {
    components: [
      { name: "leo.talk", family: "Personajes", preview: { bg: "white", static: true } },
      { name: "comparacion.video", family: "Medios", preview: { bg: "white" } },
    ],
  };
  const thumbs = { "leo.talk": "leo.talk.jpg", "comparacion.video": "video.jpg" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.endsWith("info.json") ? { catalog } : url.endsWith("thumbs.json") ? thumbs : components,
    })),
  );
  vi.stubGlobal("PointerEvent", MouseEvent);
  render(
    <SandboxCatalog path="sandbox/nodeaction/cara-a-cara" query="" format="9x16">
      <p>Prototipo</p>
    </SandboxCatalog>,
  );
  fireEvent.click(await screen.findByRole("tab", { name: "Biblioteca (2)" }));
  const still = screen.getByRole("article", { name: "leo.talk" });
  expect(within(still).getByRole("img", { name: "Vista previa de leo.talk" })).toBeTruthy();
  expect(within(still).queryByRole("button", { name: /reproducir|detener|pausar/i })).toBeNull();
  const video = screen.getByRole("article", { name: "comparacion.video" });
  expect(
    within(video).getByRole("button", { name: "Reproducir animación de comparacion.video" }),
  ).toBeTruthy();
  fireEvent.click(still);
  const dialog = screen.getByRole("dialog", { name: "leo.talk" });
  expect(within(dialog).getByRole("img", { name: "Vista previa de leo.talk" })).toBeTruthy();
  expect(within(dialog).getByRole("region", { name: "Vista del componente" })).toBeTruthy();
  expect(within(dialog).queryByRole("button", { name: /reproducir|detener|pausar/i })).toBeNull();
  expect(within(dialog).queryByTitle(/Vista ampliada/)).toBeNull();
});
