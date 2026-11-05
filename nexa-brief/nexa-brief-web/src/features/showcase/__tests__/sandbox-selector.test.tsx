import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShowcaseView } from "../components/ShowcaseView";

Element.prototype.scrollIntoView = vi.fn();

const fixtures = [
  {
    id: "atlas",
    folder: "historia",
    path: "sandbox/historia/atlas",
    title: "Atlas",
    status: "listo",
    summary: "Un mapa animado",
    updated_at: new Date(Date.now() - 8 * 3600000).toISOString(),
    has_index: true,
    thumbnail_url: null,
    components: [{ name: "atlas.uno", label: "Uno", summary: "Primero", group: "cierre" }],
  },
  {
    id: "otro",
    folder: "accion",
    path: "sandbox/accion/otro",
    title: "Otro",
    status: null,
    summary: null,
    updated_at: null,
    has_index: true,
    thumbnail_url: null,
    components: [],
  },
];
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/infrastructure/api/http-client", () => ({
  httpClient: async () => fixtures,
  resolveApiUrl: (url: string) => url,
}));
vi.mock("../hooks/useShowcaseData", () => ({
  useShowcaseDesigns: () => ({
    data: [{ id: "kit", name: "Kit", tagline: "Diseño original", family: "kit", scripts: [] }],
    isPending: false,
  }),
  useShowcaseData: () => ({
    items: [],
    catalog: { isPending: false },
    library: { isPending: false },
    retryActive: vi.fn(),
  }),
}));
vi.mock("../components/ShowcaseGrid", () => ({
  ShowcaseGrid: () => <div>Cuadrícula del kit</div>,
}));
vi.mock("../components/ShowcaseModal", () => ({ ShowcaseModal: () => null }));
vi.mock("@/features/explainer/api/component-preview-service", () => ({
  requestComponentPreviews: async () => [{ previewUrl: "/preview" }],
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function choose(name: RegExp) {
  fireEvent.click(await screen.findByRole("button", { name }));
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={client}>
      <ShowcaseView />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Diseños" }));
  return result;
}

describe("selector Sandbox", () => {
  it("cuenta los componentes de la biblioteca y sus filtros en lugar de las variantes del prototipo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => ({
        ok: true,
        status: 200,
        json: async () =>
          input.endsWith("info.json")
            ? {
                catalog: {
                  components: "components.json",
                  gallery: "showcase/index.html",
                  defaultTab: "library",
                },
              }
            : {
                components: [
                  { name: "atlas.ring", family: "mapa" },
                  { name: "atlas.arrow", family: "rutas" },
                  { name: "atlas.flow", family: "rutas" },
                ],
              },
      })),
    );
    mount();
    await choose(/Atlas · historia/);
    expect(await screen.findByText("3 componentes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "mapa" }));
    expect(screen.getByText("1 componente")).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });
  it("selecciona prototipos, filtra tarjetas y desmonta las vistas al cambiar", async () => {
    mount();
    expect(screen.getByRole("button", { name: "Kit · kit" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(await screen.findByRole("group", { name: "Diseños Sandbox" })).toBeTruthy();
    await choose(/Atlas · historia/);
    expect(
      screen.getByRole("button", { name: /Atlas · historia/ }).getAttribute("aria-pressed"),
    ).toBe("true");
    await screen.findByRole("tab", { name: "Prototipo" });
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0].textContent).toContain("1 tarjeta"),
    );
    expect(screen.getAllByText(/Un mapa animado/).length).toBeGreaterThan(0);
    expect(screen.getByText(/hace 8 horas/)).toBeTruthy();
    expect(screen.queryByText(/common\.\*/)).toBeNull();
    expect(
      screen
        .getByRole("article", { name: "Prototipo completo" })
        .querySelector("[data-preview-frame]")
        ?.getAttribute("style"),
    ).toContain("9 / 16");
    fireEvent.click(screen.getByRole("button", { name: "Reproducir Prototipo completo" }));
    expect(await screen.findByTitle("Vista previa de Prototipo completo")).toBeTruthy();
    await choose(/Otro · accion/);
    expect(screen.queryByTitle(/Vista previa/)).toBeNull();
    await screen.findByRole("tab", { name: "Prototipo" });
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0].textContent).toContain("1 tarjeta"),
    );
    expect(screen.getByRole("button", { name: /Otro · accion/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    await choose(/Atlas · historia/);
    expect(screen.queryByTitle(/Vista previa/)).toBeNull();
    fireEvent.click(await screen.findByRole("tab", { name: "Biblioteca (1)" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar componentes" }), {
      target: { value: "Primero" },
    });
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0].textContent).toContain("1 componente"),
    );
    expect(screen.getByText("Uno")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar componentes" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "16:9" }));
    expect(
      screen
        .getByRole("article", { name: "Uno" })
        .querySelector("[data-preview-frame]")
        ?.getAttribute("style"),
    ).toContain("16 / 9");
    fireEvent.click(screen.getByRole("tab", { name: "Prototipo" }));
    fireEvent.click(screen.getByRole("button", { name: "Reproducir Prototipo completo" }));
    expect(await screen.findByTitle(/Vista previa/)).toBeTruthy();
    await choose(/Kit · kit/);
    expect(screen.queryByTitle(/Vista previa/)).toBeNull();
    expect(screen.getByText(/common\.\*/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kit · kit" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("funciona con localStorage bloqueado", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    mount();
    await choose(/Atlas · historia/);
    await screen.findByRole("tab", { name: "Prototipo" });
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0].textContent).toContain("1 tarjeta"),
    );
    fireEvent.click(screen.getByRole("button", { name: "16:9" }));
    expect(
      screen
        .getByRole("article", { name: "Prototipo completo" })
        .querySelector("[data-preview-frame]")
        ?.getAttribute("style"),
    ).toContain("16 / 9");
    await choose(/Kit · kit/);
    expect(screen.getByText("Cuadrícula del kit")).toBeTruthy();
  });
});
