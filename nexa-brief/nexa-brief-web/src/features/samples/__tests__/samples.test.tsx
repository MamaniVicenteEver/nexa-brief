import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSamples, safeSamplePreview } from "../api/samples-repository";
import { SamplesSection } from "../components/SamplesSection";

const stage =
  "/api/v1/explainer/files/_tools/explainer-kit/showcase/stage.html?d=rough&c=rough.introv2&solo=1";
const long =
  "/api/v1/explainer/files/bundled/nodetech/muestras/rough/video-largo/index.html?controls=1";
const samples = [
  {
    id: "rough-componentes",
    category: "nodetech",
    design: "rough",
    kind: "componentes",
    title: "Componente Rough",
    available: true,
    preview_url: stage,
  },
  {
    id: "rough-largo",
    category: "nodetech",
    design: "rough",
    kind: "video-largo",
    title: "Plantilla larga",
    available: true,
    rendered: false,
    preview_url: long,
  },
  {
    id: "binary-componentes",
    category: "nodetech",
    design: "binary",
    shared_categories: ["node_history"],
    kind: "componentes",
    title: "Componente Binary",
    available: true,
    preview_url: stage.replaceAll("rough", "binary"),
  },
];

function renderSection(category?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SamplesSection category={category} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("muestras", () => {
  it("lista, filtra por categoría y diseño, y abre la vista elegida", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ samples }), { status: 200 }),
    );
    renderSection();
    expect(await screen.findByText("Plantilla larga")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Diseño"), { target: { value: "rough" } });
    expect(screen.queryByText("Componente Binary")).toBeNull();
    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "nodetech" } });
    const card = screen.getByText("Plantilla larga").closest("article");
    if (!card) throw new Error("No se encontró la tarjeta");
    expect(within(card).getByText("Plantilla editable · sin narración")).toBeTruthy();
    expect(within(card).getByText("DEMO · Repositorio")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Ver muestra" }));
    expect((await screen.findByTitle("Vista previa: Plantilla larga")).getAttribute("src")).toBe(
      long,
    );
    expect(screen.getByRole("button", { name: "Cerrar" })).toBe(document.activeElement);
  });

  it("vincula NodeTech con su categoría y permite filtrar diseños", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ samples }), { status: 200 }),
    );
    renderSection("node_tech");
    expect(await screen.findByText("Plantilla larga")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Diseño"), { target: { value: "binary" } });
    expect(screen.queryByText("Plantilla larga")).toBeNull();
    expect(screen.getByText("Componente Binary")).toBeTruthy();
  });

  it("muestra una sola ficha Binary compartida en NodeHistory, sin crear otra muestra", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ samples }), { status: 200 }),
    );
    renderSection("node_history");
    expect(await screen.findByText("Componente Binary")).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("DEMO · Repositorio")).toBeTruthy();
    expect(screen.queryByText("Componente Rough")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver muestra" }));
    expect((await screen.findByTitle("Vista previa: Componente Binary")).getAttribute("src")).toBe(
      stage.replaceAll("rough", "binary"),
    );
  });

  it("acepta 404 antiguo sin mostrar error ni sección", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 404 }));
    expect(await getSamples()).toEqual([]);
    const view = renderSection();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    expect(view.container.querySelector("section")).toBeNull();
  });

  it("rechaza enlaces externos, escapes y parámetros de script", () => {
    const sample = { category: "nodetech", design: "rough", kind: "componentes" as const };
    expect(safeSamplePreview(stage, sample)).toBe(stage);
    for (const url of [
      `https://example.com${stage}`,
      `${stage}&js=evil.js`,
      stage.replace("stage.html", "%2e%2e/stage.html"),
      stage.replace("rough.introv2", "binary.icon"),
    ]) {
      expect(safeSamplePreview(url, sample)).toBeNull();
    }
  });
});
