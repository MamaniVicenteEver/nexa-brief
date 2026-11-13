import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SandboxCatalog } from "../components/SandboxCatalog";
import { copyText } from "../lib/clipboard";
import { inCatalogTab, readCatalog, readProduction } from "../lib/sandbox-catalog";

vi.mock("../lib/clipboard", () => ({ copyText: vi.fn(async () => true) }));

const declaration = {
  base: "sandbox/nodehistory/_atlas",
  components: "components.json",
  gallery: "showcase/index.html",
  production: "production.json",
};
const components = [
  {
    name: "atlas.route.arc",
    family: "rutas",
    summary: "Conexión entre dos lugares",
    target: "scene.overlays[]",
    insert: "Añade un objeto por cada conexión.",
    params: {
      from: { type: "string", required: true, description: "Lugar de origen" },
    },
    demo: { type: "arc", from: "brussels", to: "beijing", start: 0, end: 5 },
  },
];
const guide = {
  title: "Producción con mapas",
  summary: "Componer escenas reutilizables desde JSON.",
  status: "Lista para validación",
  entrypoint: "SKILL.md",
  catalog: "components.json",
  capabilities: [{ title: "Cámara", description: "Vuelos entre lugares" }],
  inputs: [
    {
      name: "Guion",
      description: "Texto revisado y sus fuentes",
      required: true,
    },
  ],
  steps: [
    {
      title: "Validar la escena",
      description: "Revisa las entradas antes de renderizar.",
      command: "python validar.py escena.json",
    },
  ],
  limitations: ["La voz necesita un archivo de audio."],
  agent_prompt: "Lee SKILL.md y components.json. Crea un episodio nuevo.",
  documents: [{ label: "Contrato de escena", path: "ESCENA.md" }],
};
const fetchMock = vi.fn();
function renderCatalog() {
  return render(
    <SandboxCatalog path="sandbox/nodehistory/demo" query="" format="16x9">
      <p>Prototipo visible</p>
    </SandboxCatalog>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("PointerEvent", MouseEvent);
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () =>
      url.endsWith("info.json")
        ? { catalog: declaration }
        : url.endsWith("production.json")
          ? guide
          : { components },
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Catálogos de producción sin sprites", () => {
  it("conserva el prototipo inicial y ofrece biblioteca y guía sin pedir sprites inexistentes", async () => {
    renderCatalog();
    expect(await screen.findByRole("tab", { name: "Prototipo" })).toBeTruthy();
    await screen.findByRole("tab", { name: "Biblioteca (1)" });
    expect(screen.getByText("Prototipo visible")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Guía de producción" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Sprites/ })).toBeNull();
    expect(fetchMock.mock.calls.map(([url]) => url)).toHaveLength(3);
    expect(fetchMock.mock.calls.every(([url]) => !url.includes("sprites"))).toBe(true);
  });
  it("presenta contratos, entradas, pasos, límites y copia la instrucción de la guía", async () => {
    renderCatalog();
    fireEvent.click(await screen.findByRole("tab", { name: "Guía de producción" }));
    expect(await screen.findByRole("heading", { name: guide.title })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Punto de entrada para agentes" }).getAttribute("href"),
    ).toBe("/api/v1/explainer/files/sandbox/nodehistory/_atlas/SKILL.md");
    expect(screen.getByRole("link", { name: "Contrato de escena" }).getAttribute("href")).toBe(
      "/api/v1/explainer/files/sandbox/nodehistory/_atlas/ESCENA.md",
    );
    expect(
      screen.getByRole("link", { name: "Guía de producción (JSON)" }).getAttribute("href"),
    ).toBe("/api/v1/explainer/files/sandbox/nodehistory/_atlas/production.json");
    expect(screen.getByRole("row", { name: /Guion Sí Texto revisado/ })).toBeTruthy();
    expect(screen.getByText(guide.steps[0].command)).toBeTruthy();
    expect(screen.getByText(guide.limitations[0])).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copiar instrucción para el agente" }));
    await screen.findByText("Instrucción copiada.");
    expect(copyText).toHaveBeenCalledWith(guide.agent_prompt, expect.any(HTMLElement));
  });
  it("muestra la ruta de inserción, parámetros requeridos y el JSON copiable sin transformarlo", async () => {
    renderCatalog();
    fireEvent.click(await screen.findByRole("tab", { name: "Biblioteca (1)" }));
    expect(screen.getByRole("button", { name: "rutas" })).toBeTruthy();
    fireEvent.click(screen.getByRole("article", { name: "atlas.route.arc" }));
    const dialog = screen.getByRole("dialog", { name: "atlas.route.arc" });
    expect(within(dialog).getByText("scene.overlays[]")).toBeTruthy();
    expect(within(dialog).getByText(components[0].insert)).toBeTruthy();
    expect(within(dialog).getByRole("row", { name: /from string Sí/ })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Copiar JSON" }));
    await waitFor(() =>
      expect(copyText).toHaveBeenCalledWith(
        JSON.stringify(components[0].demo, null, 2),
        expect.any(HTMLElement),
      ),
    );
    expect(within(dialog).queryByTitle("Vista ampliada de atlas.route.arc")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reproducir" }));
    expect(
      (await within(dialog).findByTitle("Vista ampliada de atlas.route.arc")).getAttribute("src"),
    ).toContain("/files/sandbox/nodehistory/_atlas/showcase/index.html?only=atlas.route.arc");
    fireEvent.click(within(dialog).getByRole("button", { name: "Detener" }));
    expect(within(dialog).queryByTitle("Vista ampliada de atlas.route.arc")).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Reproducir" })).toBeTruthy();
  });
  it("conserva miniaturas y pestañas compactas junto con la guía de producción", async () => {
    const extended = {
      ...declaration,
      thumbs: "showcase/thumbs.json",
      tabs: [{ id: "rutas", label: "Rutas", families: ["rutas"] }],
    };
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.endsWith("info.json")
          ? { catalog: extended }
          : url.endsWith("production.json")
            ? guide
            : url.endsWith("thumbs.json")
              ? { "atlas.route.arc": "arc.jpg" }
              : { components },
    }));
    renderCatalog();
    fireEvent.click(await screen.findByRole("tab", { name: "Rutas (1)" }));
    const thumbnail = await screen.findByRole("img", { name: "Miniatura de atlas.route.arc" });
    expect(thumbnail.getAttribute("alt")).toBe("Miniatura de atlas.route.arc");
    expect(thumbnail.getAttribute("src")).toBe(
      "/api/v1/explainer/files/sandbox/nodehistory/_atlas/showcase/arc.jpg",
    );
    expect(screen.queryByText("Entrada JSON: scene.overlays[]")).toBeNull();
    expect(screen.queryByText("Parámetros (1)")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Guía de producción" }));
    expect(await screen.findByRole("heading", { name: guide.title })).toBeTruthy();
    expect(inCatalogTab(components[0], { id: "legacy", label: "Atlas", families: ["atlas"] })).toBe(
      true,
    );
  });
  it("permite reintentar una guía inválida sin romper la biblioteca", async () => {
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.endsWith("info.json")
          ? { catalog: declaration }
          : url.endsWith("production.json")
            ? { ...guide, documents: [{ label: "Escape", path: "../privado" }] }
            : { components },
    }));
    renderCatalog();
    fireEvent.click(await screen.findByRole("tab", { name: "Guía de producción" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("No se pudo cargar la guía de producción."),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Biblioteca (1)" }));
    expect(screen.getByRole("heading", { name: "atlas.route.arc" })).toBeTruthy();
  });
});

describe("Contratos de catálogo y guía", () => {
  it("admite el catálogo sin sprites y exige el directorio cuando hay un manifiesto", () => {
    expect(readCatalog({ catalog: declaration })).toEqual(declaration);
    expect(() => readCatalog({ catalog: { ...declaration, sprites: "sprites.json" } })).toThrow();
    expect(() =>
      readCatalog({ catalog: { ...declaration, production: "../guia.json" } }),
    ).toThrow();
    expect(() =>
      readCatalog({
        catalog: { ...declaration, tabs: [{ id: "production", label: "Colisión", families: [] }] },
      }),
    ).toThrow();
  });
  it("rechaza enlaces inseguros y formas que impedirían representar la guía", () => {
    expect(readProduction(guide)).toEqual(guide);
    for (const path of ["../fuera", "/etc/passwd", "https://host", "a?b", "%2e%2e/a"]) {
      expect(() => readProduction({ ...guide, entrypoint: path })).toThrow();
      expect(() =>
        readProduction({ ...guide, documents: [{ label: "Documento", path }] }),
      ).toThrow();
    }
    for (const invalid of [
      {},
      { ...guide, steps: {} },
      { ...guide, inputs: [{ name: "Guion", required: "yes" }] },
      { ...guide, limitations: [false] },
    ])
      expect(() => readProduction(invalid)).toThrow();
  });
});
