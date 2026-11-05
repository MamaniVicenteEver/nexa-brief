import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SandboxCatalog } from "../components/SandboxCatalog";
import { copyText } from "../lib/clipboard";

vi.mock("../lib/clipboard", () => ({ copyText: vi.fn(async () => true) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("muestra y copia el JSON en la pestaña sin reproductor ni diálogo", async () => {
  const data = { titulo: "Crear personaje", poses: ["talk", "question"] };
  const info = {
    catalog: {
      components: "showcase/components.json",
      gallery: "showcase.html",
      tabs: [
        {
          id: "new-componentes",
          label: "New componentes",
          families: [],
          components: ["personajes.crear-personaje"],
        },
      ],
    },
  };
  const components = {
    components: [
      { name: "personajes.crear-personaje", family: "Personajes", kind: "json", demo: data },
    ],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => (url.endsWith("info.json") ? info : components),
    })),
  );
  render(
    <SandboxCatalog path="sandbox/nodeaction/cara-a-cara" query="" format="9x16">
      <p>Prototipo</p>
    </SandboxCatalog>,
  );
  fireEvent.click(await screen.findByRole("tab", { name: "New componentes (1)" }));
  const card = screen.getByRole("article", { name: "personajes.crear-personaje" });
  const json = within(card).getByRole("region", { name: "JSON de personajes.crear-personaje" });
  expect(json.textContent).toBe(JSON.stringify(data, null, 2));
  expect(json.className).toContain("overflow-auto");
  expect(json.getAttribute("tabindex")).toBe("0");
  expect(within(card).queryByRole("button", { name: /reproducir|pausar|detener/i })).toBeNull();
  expect(within(card).queryByTitle(/Vista previa/)).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(within(card).getByRole("button", { name: "Copiar JSON" }));
  await waitFor(() => expect(copyText).toHaveBeenCalledWith(JSON.stringify(data, null, 2), card));
  expect(await within(card).findByText("JSON copiado.")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Biblioteca (1)" }));
  expect(screen.getByRole("region", { name: "JSON de personajes.crear-personaje" })).toBeTruthy();
});
