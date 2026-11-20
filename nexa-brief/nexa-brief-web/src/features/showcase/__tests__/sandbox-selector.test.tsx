import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShowcaseView } from "../components/ShowcaseView";

const design = (id: string, name: string, category: string, state: "prueba" | "produccion") => ({
  id,
  name,
  category,
  state,
  family: id,
  engine_id: "engine",
  description: `${name} descripción`,
  revision: "1",
  catalog_url: `/api/v1/showcase/designs/${id}/catalog`,
  preview_url: null,
  promotable: false,
  promote_blocker: "No preparado",
  episodes: [],
});
const entry = (id: string, label: string, kind: string) => ({
  id,
  name: id,
  label,
  kind,
  summary: label,
  tags: [kind],
  params: {},
  example: {},
  preview_url: `/api/v1/showcase/designs/atlas/preview?entry=${id}`,
  preview_kind: "iframe",
});
const catalogs: Record<string, ReturnType<typeof entry>[]> = {
  atlas: [
    entry("ring", "Anillo", "component"),
    entry("arrow", "Flecha", "action"),
    entry("flow", "Flujo", "action"),
  ],
  otro: [],
  kit: [entry("kit.one", "Componente Kit", "component")],
};
const requests: string[] = [];
vi.mock("@/features/samples/components/SamplesSection", () => ({ SamplesSection: () => null }));
vi.mock("../components/LegacyShowcaseView", () => ({
  LegacyShowcaseView: () => <div>Biblioteca</div>,
}));
vi.mock("@/infrastructure/api/http-client", () => ({
  httpClient: async (path: string) => {
    requests.push(path);
    if (path === "/api/v1/showcase/designs")
      return {
        schema_version: 1,
        designs: [
          design("kit", "Kit", "historia", "produccion"),
          design("atlas", "Atlas", "historia", "prueba"),
          design("otro", "Otro", "accion", "prueba"),
        ],
      };
    const match = path.match(/^\/api\/v1\/showcase\/designs\/([^/]+)\/catalog$/);
    if (match)
      return { schema_version: 1, design_id: match[1], revision: "1", entries: catalogs[match[1]] };
    throw new Error(`Solicitud inesperada: ${path}`);
  },
  resolveApiUrl: (url: string) => url,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  requests.length = 0;
});
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ShowcaseView />
    </QueryClientProvider>,
  );
}
async function choose(id: string) {
  fireEvent.click(
    await screen.findByRole("button", { name: id === "kit" ? /^Producción/ : /^Sandbox/ }),
  );
  const name = { kit: /Kit.*kit/, atlas: /Atlas.*atlas/, otro: /Otro.*otro/ }[id];
  if (!name) throw new Error("Diseño de prueba desconocido");
  fireEvent.click(await screen.findByRole("button", { name }));
}

describe("selector de diseños estándar", () => {
  it("filtra componentes del catálogo por tipo y búsqueda", async () => {
    mount();
    await choose("atlas");
    await screen.findByTitle("Vista previa de Anillo");
    fireEvent.click(screen.getByRole("button", { name: "action" }));
    expect(screen.queryByTitle("Vista previa de Anillo")).toBeNull();
    expect(screen.getByTitle("Vista previa de Flecha")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar componentes" }), {
      target: { value: "flujo" },
    });
    expect(screen.queryByText("Flecha")).toBeNull();
    expect(screen.getByTitle("Vista previa de Flujo")).toBeTruthy();
  });
  it("cambia de diseño, desmonta la vista previa y consulta el catálogo estándar", async () => {
    mount();
    await choose("atlas");
    await screen.findByTitle("Vista previa de Anillo");
    await choose("otro");
    expect(screen.queryByTitle("Vista previa de Anillo")).toBeNull();
    await screen.findByText("No hay entradas para estos filtros.");
    await choose("kit");
    await screen.findByTitle("Vista previa de Componente Kit");
    expect(requests).toContain("/api/v1/showcase/designs/kit/catalog");
    expect(requests.some((path) => path.includes("/sandbox/components"))).toBe(false);
  });
  it("funciona con localStorage bloqueado", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    mount();
    await choose("atlas");
    await screen.findByTitle("Vista previa de Anillo");
    fireEvent.click(screen.getByRole("button", { name: "16:9" }));
    await waitFor(() =>
      expect(screen.getByTitle("Vista previa de Anillo").getAttribute("src")).toContain(
        "format=16x9",
      ),
    );
    await choose("kit");
    expect(await screen.findByTitle("Vista previa de Componente Kit")).toBeTruthy();
  });
});
