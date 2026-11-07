import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SandboxCatalog } from "../components/SandboxCatalog";
import { readCatalog, readWorkflows } from "../lib/sandbox-catalog";

const catalog = {
  base: "sandbox/nodeaction/_vida",
  components: "catalog.json",
  gallery: "showcase/index.html",
  workflows: "agent/guia.json",
};
const guide = {
  title: "Crear y modificar",
  summary: "Guías para agentes",
  cards: [
    {
      id: "personaje",
      title: "Crear personaje",
      summary: "Utiliza el cuerpo compartido",
      inputs: ["Nombre y voz"],
      steps: ["Leer el contrato", "Validar"],
      documents: [{ label: "Contrato", path: "schema/character.schema.json" }],
    },
    { id: "animacion", title: "Crear animación" },
  ],
};
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () =>
      url.endsWith("info.json")
        ? { catalog }
        : url.endsWith("guia.json")
          ? guide
          : { components: [] },
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Guías declarativas del catálogo", () => {
  it("muestra tarjetas, pasos y documentos relativos a la base", async () => {
    render(
      <SandboxCatalog path="sandbox/nodeaction/demo" query="" format="16x9">
        <p>Prototipo</p>
      </SandboxCatalog>,
    );
    fireEvent.click(await screen.findByRole("tab", { name: "Crear y modificar (2)" }));
    const card = screen.getByRole("heading", { name: "Crear personaje" }).closest("article");
    if (!card) throw new Error("No se encontró la tarjeta");
    fireEvent.click(within(card).getByText("Ver cómo se hace"));
    expect(within(card).getByText("Nombre y voz")).toBeTruthy();
    expect(within(card).getByText("Validar")).toBeTruthy();
    expect(within(card).getByRole("link", { name: "Contrato" }).getAttribute("href")).toBe(
      "/api/v1/explainer/files/sandbox/nodeaction/_vida/schema/character.schema.json",
    );
  });
  it("filtra las tarjetas por el texto buscado", async () => {
    const onCount = vi.fn();
    render(
      <SandboxCatalog path="sandbox/nodeaction/demo" query="voz" format="16x9" onCount={onCount}>
        <p>Prototipo</p>
      </SandboxCatalog>,
    );
    fireEvent.click(await screen.findByRole("tab", { name: "Crear y modificar (2)" }));
    expect(screen.getByRole("heading", { name: "Crear personaje" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Crear animación" })).toBeNull();
    expect(screen.getByText("1 de 2 guías")).toBeTruthy();
    expect(onCount).toHaveBeenLastCalledWith(1, "workflows");
  });
  it("permite reintentar si falla la guía", async () => {
    let fail = true;
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.endsWith("info.json")
          ? { catalog }
          : url.endsWith("guia.json")
            ? fail
              ? {}
              : guide
            : { components: [] },
    }));
    render(
      <SandboxCatalog path="sandbox/nodeaction/demo" query="" format="16x9">
        <p>Prototipo</p>
      </SandboxCatalog>,
    );
    fireEvent.click(await screen.findByRole("tab", { name: /Crear y modificar/ }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("No se pudieron cargar las guías"),
    );
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: "Crear personaje" })).toBeTruthy();
  });
  it("valida rutas y datos sin aceptar pestañas duplicadas", () => {
    expect(readWorkflows(guide)).toEqual(guide);
    expect(() => readCatalog({ catalog: { ...catalog, workflows: "../private" } })).toThrow();
    expect(() =>
      readCatalog({
        catalog: { ...catalog, tabs: [{ id: "workflows", label: "Colisión", families: [] }] },
      }),
    ).toThrow();
    expect(() =>
      readWorkflows({
        ...guide,
        cards: [{ ...guide.cards[0], documents: [{ label: "X", path: "../privado" }] }],
      }),
    ).toThrow();
    expect(() => readWorkflows({ ...guide, cards: [guide.cards[0], guide.cards[0]] })).toThrow();
  });
});
