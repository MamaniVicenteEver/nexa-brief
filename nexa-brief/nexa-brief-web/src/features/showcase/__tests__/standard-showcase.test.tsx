import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "@/infrastructure/api/http-client";
import { safeShowcaseUrl } from "../api/standard-showcase-repository";
import { ShowcaseView } from "../components/ShowcaseView";

vi.mock("@/features/samples/components/SamplesSection", () => ({
  SamplesSection: () => <div>Muestras disponibles</div>,
}));
vi.mock("../components/LegacyShowcaseView", () => ({
  LegacyShowcaseView: () => <div>Biblioteca antigua</div>,
}));
vi.mock("@/infrastructure/api/http-client", () => ({
  httpClient: vi.fn(),
  resolveApiUrl: (path: string) => path,
}));
const design = {
  id: "one",
  name: "Uno",
  category: "nodehistory",
  state: "prueba",
  family: "atlas",
  engine_id: "engine",
  description: "Descripción",
  revision: "1",
  catalog_url: "/api/v1/showcase/designs/one/catalog",
  preview_url: null,
  promotable: true,
  promote_blocker: null,
  episodes: [
    {
      id: "ep",
      title: "Episodio seguro",
      design_id: "one",
      preview_url: "/api/v1/explainer/files/episode",
    },
    {
      id: "unsafe",
      title: "Episodio externo",
      design_id: "one",
      preview_url: "https://evil.example/",
    },
  ],
};
const rough = { ...design, id: "rough", name: "Rough", state: "produccion" };
const catalog = {
  schema_version: 1,
  design_id: "one",
  revision: "1",
  entries: [
    {
      id: "a",
      name: "mapa",
      label: "Mapa",
      kind: "set",
      summary: "Escenario",
      tags: ["geografía"],
      params: { zoom: 2 },
      example: {},
      preview_url: "/api/v1/showcase/designs/one/preview?entry=a",
      preview_kind: "iframe",
    },
    {
      id: "b",
      name: "actor",
      label: "Actor",
      kind: "character",
      summary: "Personaje",
      tags: ["retrato"],
      params: {},
      example: {},
      preview_url: "https://evil.example/",
      preview_kind: "image",
    },
  ],
};
function setup(handler: (path: string, options?: { method?: string }) => unknown) {
  vi.mocked(httpClient).mockImplementation(
    async (path, options) => handler(path, options) as never,
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ShowcaseView />
    </QueryClientProvider>,
  );
}
const response = (path: string) =>
  path.endsWith("/catalog") ? catalog : { schema_version: 1, designs: [rough, design] };

it("abre desde Plantillas el proyecto elegido en la sección Sandbox", async () => {
  window.history.replaceState(null, "", "/showcase?section=prueba&design=one");
  try {
    setup(response);
    const button = await screen.findByRole("button", { name: /^Sandbox/ });
    await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("true"));
    expect((await screen.findByRole("button", { name: /^Uno/ })).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(await screen.findByRole("article", { name: "Mapa" })).toBeDefined();
  } finally {
    window.history.replaceState(null, "", "/showcase");
  }
});

it("indica que un proyecto seleccionado todavía no tiene componentes declarados", async () => {
  setup((path) =>
    path.endsWith("/catalog")
      ? { ...catalog, entries: [] }
      : { schema_version: 1, designs: [rough, { ...design, family: "sandbox" }] },
  );
  await sandbox();
  expect(
    await screen.findByText(/Este proyecto todavía no tiene componentes individuales/),
  ).toBeDefined();
});

async function sandbox() {
  fireEvent.click(await screen.findByRole("button", { name: /^Sandbox/ }));
  await screen.findByRole("group", { name: "Diseños Sandbox" });
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("Showcase estándar", () => {
  it("prioriza texto y medios y conserva una categoría activa al contraer la lista", async () => {
    setup((path) =>
      path.endsWith("/catalog")
        ? {
            ...catalog,
            entries: [
              {
                ...catalog.entries[0],
                tags: [
                  ...Array.from({ length: 12 }, (_, i) => `a${i.toString().padStart(2, "0")}`),
                  "texto",
                  "foto",
                ],
              },
            ],
          }
        : response(path),
    );
    await screen.findByRole("article", { name: "Mapa" });
    expect(screen.getByRole("button", { name: "texto" })).toBeDefined();
    expect(screen.getByRole("button", { name: "foto" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "a11" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Más categorías (14)" }));
    fireEvent.click(screen.getByRole("button", { name: "a11" }));
    fireEvent.click(screen.getByRole("button", { name: "Menos categorías" }));
    expect(screen.getByRole("button", { name: "a11" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("article", { name: "Mapa" })).toBeDefined();
  });
  it("recupera tipos, categorías nativas y familias de sprites sin etiquetas", async () => {
    const native = {
      ...catalog,
      groups: [
        { id: "textos", label: "Textos", families: ["label"], components: [] },
        { id: "cards", label: "Tarjetas", families: [], components: ["card.hero"] },
      ],
      entries: [
        {
          ...catalog.entries[0],
          id: "text",
          name: "label.chip",
          label: "Rótulo",
          kind: "component",
          family: "label",
          tags: [],
        },
        {
          ...catalog.entries[0],
          id: "card",
          name: "card.hero",
          label: "Tarjeta",
          kind: "component",
          family: "card",
          tags: [],
        },
        {
          ...catalog.entries[1],
          id: "sprite-carrier",
          name: "carrier",
          label: "Portaavión",
          kind: "component",
          family: "carrier",
          section: "sprites",
          tags: [],
        },
        {
          ...catalog.entries[1],
          id: "sprite-air",
          name: "air",
          label: "Avión",
          kind: "component",
          family: "air",
          section: "sprites",
          tags: [],
        },
      ],
    };
    setup((path) => (path.endsWith("/catalog") ? native : response(path)));
    await screen.findByRole("article", { name: "Rótulo" });
    const types = screen.getByRole("group", { name: "Mostrar" });
    expect(within(types).getByRole("button", { name: "Componentes" }).textContent).toContain("2");
    fireEvent.click(screen.getByRole("button", { name: "Textos" }));
    expect(screen.getByRole("article", { name: "Rótulo" })).toBeDefined();
    expect(screen.queryByRole("article", { name: "Tarjeta" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sprites" }));
    expect(screen.queryByRole("button", { name: "Textos" })).toBeNull();
    expect(screen.queryByRole("article", { name: "Rótulo" })).toBeNull();
    expect(screen.getByText("2 de 4 entradas")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Portaaviones" }));
    expect(screen.getByRole("article", { name: "Portaavión" })).toBeDefined();
    expect(screen.queryByRole("article", { name: "Avión" })).toBeNull();
    fireEvent.click(within(types).getByRole("button", { name: "Componentes" }));
    fireEvent.click(screen.getByRole("button", { name: "Tarjetas" }));
    expect(screen.getByRole("article", { name: "Tarjeta" })).toBeDefined();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar componentes" }), {
      target: { value: "inexistente" },
    });
    expect(screen.getByText("No hay entradas para estos filtros.")).toBeDefined();
    await sandbox();
    expect(await screen.findByRole("article", { name: "Rótulo" })).toBeDefined();
    expect(screen.getByRole("article", { name: "Avión" })).toBeDefined();
    expect(
      (screen.getByRole("searchbox", { name: "Buscar componentes" }) as HTMLInputElement).value,
    ).toBe("");
  });
  it("elige sección y diseño directamente sin selectores en cascada", async () => {
    setup(response);
    expect(await screen.findByRole("group", { name: "Diseños de producción" })).toBeDefined();
    expect(screen.getByRole("button", { name: /Rough/ }).getAttribute("aria-pressed")).toBe("true");
    await sandbox();
    expect(screen.getByRole("button", { name: /Uno/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /Producción/ }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });
  it("filtra por búsqueda y etiquetas y cambia formato de tarjeta", async () => {
    setup(response);
    await sandbox();
    const mapa = await screen.findByRole("article", { name: "Mapa" });
    expect(mapa.querySelector("[data-preview-frame]")?.getAttribute("style")).toContain("16 / 9");
    fireEvent.click(screen.getByRole("button", { name: "9:16" }));
    expect(
      screen
        .getByRole("article", { name: "Mapa" })
        .querySelector("[data-preview-frame]")
        ?.getAttribute("style"),
    ).toContain("9 / 16");
    fireEvent.click(screen.getByRole("button", { name: "retrato" }));
    expect(screen.queryByRole("article", { name: "Mapa" })).toBeNull();
    expect(screen.getByRole("article", { name: "Actor" })).toBeDefined();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar componentes" }), {
      target: { value: "inexistente" },
    });
    expect(screen.getByText("No hay entradas para estos filtros.")).toBeDefined();
  });
  it("abre y cierra el detalle sin dejar activa la tarjeta anterior", async () => {
    setup(response);
    await sandbox();
    const card = await screen.findByRole("article", { name: "Mapa" });
    fireEvent.click(card);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTitle("Vista previa de Mapa")).toBeDefined();
    expect(within(dialog).getByText("Parámetros")).toBeDefined();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("muestra enlaces locales de episodios y no enlaza URL externas", async () => {
    setup(response);
    await sandbox();
    expect((await screen.findByText("Episodio seguro")).closest("a")?.getAttribute("href")).toBe(
      "/api/v1/explainer/files/episode",
    );
    expect(screen.getByText("Episodio externo").closest("a")).toBeNull();
  });
  it("promueve el diseño seleccionado, actualiza lista y conserva selección", async () => {
    let published = false;
    setup((path, options) => {
      if (options?.method === "POST") {
        published = true;
        return { ...design, state: "produccion" };
      }
      if (path.endsWith("/catalog")) return catalog;
      return {
        schema_version: 1,
        designs: [rough, { ...design, state: published ? "produccion" : "prueba" }],
      };
    });
    await sandbox();
    fireEvent.click(await screen.findByRole("button", { name: "Pasar a producción" }));
    expect(await screen.findByText("Diseño Uno pasado a producción.")).toBeDefined();
    expect(screen.getByRole("button", { name: /Uno/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /^Producción/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(
      vi.mocked(httpClient).mock.calls.filter(([path]) => path === "/api/v1/showcase/designs")
        .length,
    ).toBeGreaterThan(1);
  });
  it("muestra el bloqueo y el error de promoción", async () => {
    setup((path) =>
      path.endsWith("/catalog")
        ? catalog
        : {
            schema_version: 1,
            designs: [rough, { ...design, promotable: false, promote_blocker: "Falta catálogo" }],
          },
    );
    await sandbox();
    expect(await screen.findByText("Falta catálogo")).toBeDefined();
    expect(
      (screen.getByRole("button", { name: "Pasar a producción" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    cleanup();
    vi.resetAllMocks();
    setup((path, options) => {
      if (options?.method === "POST") throw new Error("Revisión fallida");
      return response(path);
    });
    await sandbox();
    fireEvent.click(await screen.findByRole("button", { name: "Pasar a producción" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Revisión fallida");
  });
  it("permite reintentar un catálogo con error", async () => {
    let attempts = 0;
    setup((path) => {
      if (path.endsWith("/catalog")) {
        attempts++;
        if (attempts === 1) throw new Error("Catálogo falló");
        return catalog;
      }
      return { schema_version: 1, designs: [rough, design] };
    });
    expect((await screen.findByRole("alert")).textContent).toContain("Catálogo falló");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getByRole("article", { name: "Mapa" })).toBeDefined();
  });
  it("rechaza URL externas o inseguras", () => {
    expect(safeShowcaseUrl("/api/v1/showcase/designs/x/preview")).toBeTruthy();
    for (const url of [
      "//evil.example",
      "https://evil.example",
      "/api/v1/../../private",
      "/api/v1/\\evil",
      "data:text/html,x",
    ])
      expect(safeShowcaseUrl(url)).toBeNull();
  });
});
