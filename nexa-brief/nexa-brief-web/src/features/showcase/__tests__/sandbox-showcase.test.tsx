import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestComponentPreviews } from "@/features/explainer/api/component-preview-service";
import { type SandboxPrototype, SandboxShowcase } from "../components/SandboxShowcase";
import { copyText } from "../lib/clipboard";
import {
  catalogFileUrl,
  componentPosterUrl,
  galleryUrl,
  readCatalog,
  readSprites,
  readThumbs,
  thumbnailUrl,
} from "../lib/sandbox-catalog";

vi.mock("@/features/explainer/api/component-preview-service", () => ({
  requestComponentPreviews: vi.fn(async () => [{ previewUrl: "/preview?controls=1" }]),
}));
vi.mock("../lib/clipboard", () => ({ copyText: vi.fn(async () => true) }));
const prototype: SandboxPrototype = {
  id: "atlas",
  folder: "historia",
  subcategory: null,
  path: "sandbox/historia/atlas",
  title: "Atlas",
  status: "en progreso",
  has_index: true,
  thumbnail_url: null,
  updated_at: null,
  components: [
    {
      name: "atlas.uno",
      label: "Uno",
      summary: "Primero",
      group: "outro",
      default: true,
    },
    { name: "atlas.dos", label: "Dos", summary: "Segundo", group: "outro" },
    { name: "atlas.fichas", label: "Fichas", summary: "Fotos", default: true },
  ],
};
const catalog = {
  components: "engine/tactico/components.json",
  sprites: "engine/tactico/sprites/sprites.json",
  spritesDir: "engine/tactico/sprites/",
  sheet: "engine/tactico/sprites/hoja.png",
  gallery: "work/tactico/demo.html",
};
const components = [
  {
    name: "naval.carrier",
    summary: "Portaaviones",
    layer: 40,
    states: ["normal", "hit"],
    params: {
      scale: {
        type: "number",
        default: 1,
        doc: "Escala de pantalla",
        min: 0,
        max: 4,
        step: 0.5,
      },
      config: { type: "object", default: { count: 2 } },
    },
    used_by: ["petroleros"],
    demo: { id: "carrier", type: "naval.carrier", scale: 1 },
  },
  { name: "naval.cargo", summary: "Mercante", layer: 40 },
  { name: "air.jet", summary: "Caza", layer: 50 },
];
const observed = new Map<Element, IntersectionObserverCallback>();
function intersect(element: Element, visible: boolean) {
  act(() => {
    observed.get(element)?.(
      [
        {
          target: element,
          isIntersecting: visible,
          intersectionRatio: visible ? 1 : 0,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );
  });
}
function intersectAll(visible = true) {
  for (const element of [...observed.keys()]) intersect(element, visible);
}
const MockIntersectionObserver = class {
  constructor(private callback: IntersectionObserverCallback) {}
  observe(element: Element) {
    observed.set(element, this.callback);
  }
  unobserve(element: Element) {
    observed.delete(element);
  }
  disconnect() {
    for (const [element, callback] of observed)
      if (callback === this.callback) observed.delete(element);
  }
};
const fetchMock = vi.fn();
function mockCatalog({
  sprites = null,
  library = components,
  failure = "",
}: {
  sprites?: unknown;
  library?: unknown;
  failure?: string;
} = {}) {
  fetchMock.mockImplementation(async (url: string) => {
    if (failure && url.endsWith(failure)) throw new Error("Network error");
    const data = url.endsWith("info.json")
      ? { catalog }
      : url.endsWith(catalog.components)
        ? { components: library }
        : sprites;
    return {
      ok: data !== null,
      status: data === null ? 404 : 200,
      json: async () => data,
    };
  });
}
async function openLibrary() {
  fireEvent.click(await screen.findByRole("tab", { name: /Biblioteca \(3\)/ }));
}
beforeEach(() => {
  observed.clear();
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("PointerEvent", MouseEvent);
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Biblioteca Sandbox", () => {
  it("monta como máximo dos vistas y busca componentes sin catálogo", async () => {
    const { rerender } = render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    expect(
      await screen.findByRole("button", { name: "Reproducir Prototipo completo" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Reproducir/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "Biblioteca (4)" }));
    expect(screen.getAllByRole("button", { name: /Reproducir/ })).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Reproducir Uno" }));
    fireEvent.click(screen.getByRole("button", { name: "Reproducir Dos" }));
    await waitFor(() => expect(screen.getAllByTitle(/Vista previa/)).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "Detener Uno" }));
    expect(screen.queryByTitle("Vista previa de Uno")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(requestComponentPreviews).toHaveBeenCalledWith([
      expect.objectContaining({
        component: "atlas.dos",
        components: ["atlas.fichas", "atlas.dos"],
      }),
    ]);
    rerender(<SandboxShowcase prototype={prototype} query="Fotos" format="16x9" />);
    expect(screen.getByText("Fichas · con")).toBeTruthy();
    expect(screen.queryByText("Uno")).toBeNull();
  });
  it("mantiene el interruptor apagado sin selección por defecto", async () => {
    render(
      <SandboxShowcase
        prototype={{
          ...prototype,
          components: [{ name: "solo", label: "Solo", summary: "Prueba" }],
        }}
        query=""
        format="9x16"
      />,
    );
    fireEvent.click(await screen.findByRole("tab", { name: "Biblioteca (2)" }));
    fireEvent.click(screen.getByRole("button", { name: "Reproducir Solo · sin" }));
    const iframe = await screen.findByTitle("Vista previa de Solo · sin");
    expect(iframe.getAttribute("src")).toContain("/preview?controls=1");
    expect(requestComponentPreviews).toHaveBeenCalledWith([
      expect.objectContaining({ component: "solo", components: [] }),
    ]);
  });
  it("muestra la nota cuando no hay componentes", async () => {
    render(<SandboxShowcase prototype={{ ...prototype, components: [] }} query="" format="9x16" />);
    expect(await screen.findByText(/no declara interruptores individuales/)).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
  it("carga info por archivos y mantiene Prototipo como pestaña inicial", async () => {
    mockCatalog();
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    const tab = await screen.findByRole("tab", { name: "Prototipo" });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/explainer/files/sandbox/historia/atlas/info.json",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByRole("button", { name: "Reproducir Prototipo completo" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "naval.carrier" })).toBeNull();
  });
  it("muestra documentación, familias, búsqueda y contadores", async () => {
    mockCatalog();
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    await openLibrary();
    expect(screen.getByText("3 de 3 componentes")).toBeTruthy();
    fireEvent.click(screen.getByRole("article", { name: "naval.carrier" }));
    const details = screen.getByRole("dialog", { name: "naval.carrier" });
    expect(within(details).getByText("Familia: naval · Capa: 40")).toBeTruthy();
    expect(within(details).getByText("Estados: normal, hit")).toBeTruthy();
    expect(within(details).getByText("Escala de pantalla")).toBeTruthy();
    expect(within(details).getByText("Usado por: petroleros")).toBeTruthy();
    fireEvent.click(within(details).getByRole("button", { name: "Cerrar" }));
    fireEvent.click(screen.getByRole("button", { name: "naval" }));
    expect(screen.getByText("2 de 3 componentes")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "air.jet" })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar en la biblioteca" }), {
      target: { value: "mercante" },
    });
    expect(screen.getByText("1 de 3 componentes")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "naval.cargo" })).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "inexistente" },
    });
    expect(screen.getByText("No se encontraron componentes.")).toBeTruthy();
    expect(screen.getByText("0 de 3 componentes")).toBeTruthy();
  });
  it("respeta la búsqueda de la barra y muestra la biblioteca completa sin límite de 16", async () => {
    mockCatalog({
      library: Array.from({ length: 68 }, (_, i) => ({
        name: `unit.item${i}`,
        summary: `Elemento ${i}`,
      })),
    });
    const { rerender } = render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Biblioteca (68)" }));
    expect(screen.getAllByRole("article")).toHaveLength(68);
    rerender(<SandboxShowcase prototype={prototype} query="item67" format="9x16" />);
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });
  it("espera el botón aunque esté visible, detiene al salir y respeta el formato", async () => {
    mockCatalog();
    const { rerender } = render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    await openLibrary();
    expect(screen.queryAllByTitle(/Vista previa/)).toHaveLength(0);
    intersectAll();
    expect(screen.queryAllByTitle(/Vista previa/)).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Reproducir animación de naval.cargo" }));
    expect(screen.getAllByTitle(/Vista previa/)).toHaveLength(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    const frame = screen.getByTitle("Vista previa de naval.cargo");
    expect(frame.getAttribute("src")).toContain(
      "only=naval.cargo&bg=white&autoplay=1&loop=1&bare=1&aspect=9x16",
    );
    expect(requestComponentPreviews).not.toHaveBeenCalled();
    intersect(frame.parentElement as HTMLElement, false);
    expect(screen.queryByTitle("Vista previa de naval.cargo")).toBeNull();
    intersectAll();
    rerender(<SandboxShowcase prototype={prototype} query="" format="16x9" />);
    expect(screen.queryByTitle("Vista previa de naval.cargo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reproducir animación de naval.cargo" }));
    expect(screen.getByTitle("Vista previa de naval.cargo").getAttribute("src")).toContain(
      "aspect=16x9",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Prototipo" }));
    expect(screen.queryAllByTitle(/Vista previa/)).toHaveLength(0);
  });
  it("limita a tres y da prioridad al último botón pulsado", async () => {
    mockCatalog({
      library: Array.from({ length: 9 }, (_, i) => ({ name: `fx.effect${i}` })),
    });
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Biblioteca (9)" }));
    intersectAll();
    for (const n of [0, 1, 2, 3])
      fireEvent.click(
        screen.getByRole("button", { name: `Reproducir animación de fx.effect${n}` }),
      );
    expect(screen.getAllByTitle(/Vista previa/)).toHaveLength(3);
    expect(screen.queryByTitle("Vista previa de fx.effect0")).toBeNull();
    expect(screen.getByTitle("Vista previa de fx.effect3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Detener animación de fx.effect3" }));
    expect(screen.queryByTitle("Vista previa de fx.effect3")).toBeNull();
    expect(screen.getAllByTitle(/Vista previa/)).toHaveLength(2);
  });
  it("muestra sprites en construcción ante un 404", async () => {
    mockCatalog();
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Sprites (0)" }));
    expect(await screen.findByText("Sprites en construcción")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("muestra una biblioteca vacía sin romper el prototipo", async () => {
    mockCatalog({ library: [] });
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Biblioteca (0)" }));
    expect(screen.getByText("0 de 0 componentes")).toBeTruthy();
    expect(screen.getByText("No se encontraron componentes.")).toBeTruthy();
  });
  it("carga sprites tardíos, imágenes perezosas y hoja ampliable", async () => {
    mockCatalog();
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Sprites (0)" }));
    mockCatalog({
      sprites: {
        sprites: {
          carrier: {
            src: "carrier.png",
            variant: "hero",
            length_relative: 1.5,
            states: { burning: "carrier-burning" },
          },
        },
      },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Volver a cargar sprites" }));
    const image = await screen.findByRole("img", { name: "Sprite carrier" });
    expect(image.getAttribute("src")).toBe(
      "/api/v1/explainer/files/sandbox/historia/atlas/engine/tactico/sprites/carrier.png",
    );
    expect(image.getAttribute("loading")).toBe("lazy");
    fireEvent.click(screen.getByRole("article", { name: "carrier" }));
    const spriteDialog = screen.getByRole("dialog", { name: "carrier" });
    expect(within(spriteDialog).getByText("hero")).toBeTruthy();
    expect(within(spriteDialog).getByText("1.5")).toBeTruthy();
    expect(within(spriteDialog).getByRole("option", { name: "En llamas" })).toBeTruthy();
    fireEvent.click(within(spriteDialog).getByRole("button", { name: "Cerrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Ampliar hoja" }));
    expect(screen.getByRole("button", { name: "Reducir hoja" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
    fireEvent.error(image);
    expect(screen.getByText("Imagen no disponible: Sprite carrier")).toBeTruthy();
  });
  it("admite manifiestos de sprites como array", () => {
    expect(
      readSprites({
        sprites: [
          {
            id: "jet",
            file: "jet.png",
            relativeLength: 0.5,
            states: ["normal"],
          },
        ],
      }),
    ).toEqual([
      {
        name: "jet",
        file: "jet.png",
        relativeLength: 0.5,
        variant: undefined,
        states: ["normal"],
      },
    ]);
  });
  it("presenta errores de red en español y permite reintentar", async () => {
    mockCatalog({ failure: catalog.components });
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Biblioteca (0)" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "No se pudo cargar la biblioteca de componentes.",
    );
    mockCatalog();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: "naval.carrier" })).toBeTruthy();
  });
  it("informa errores de sprites sin tratar un error de red como construcción", async () => {
    mockCatalog({ failure: catalog.sprites });
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Sprites (0)" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "No se pudieron cargar los sprites.",
    );
    expect(screen.queryByText("Sprites en construcción")).toBeNull();
  });
  it("permite navegar entre pestañas con el teclado", async () => {
    mockCatalog();
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    const first = await screen.findByRole("tab", { name: "Prototipo" });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Biblioteca/ }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: /Biblioteca/ }));
  });
  it("restablece las vistas al cambiar de prototipo", async () => {
    mockCatalog();
    const { rerender } = render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    await openLibrary();
    intersectAll();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    rerender(
      <SandboxShowcase
        prototype={{ ...prototype, path: "sandbox/otro/video" }}
        query=""
        format="9x16"
      />,
    );
    await waitFor(() => expect(screen.queryByRole("tablist")).toBeNull());
    expect(screen.queryAllByTitle(/Vista previa/)).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Reproducir Prototipo completo" })).toBeTruthy();
  });
});

describe("Modales Sandbox", () => {
  it("abre con clic, atrapa el foco, bloquea el fondo y cierra con Esc devolviendo el foco", async () => {
    mockCatalog();
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    await openLibrary();
    const card = screen.getByRole("article", { name: "naval.carrier" });
    fireEvent.click(within(card).getByRole("heading"));
    const dialog = screen.getByRole("dialog", { name: "naval.carrier" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const close = within(dialog).getByRole("button", { name: "Cerrar" });
    expect(document.activeElement).toBe(close);
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(true);
    card.focus();
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(card));
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
  });
  it("abre con Enter y cierra con clic fuera", async () => {
    mockCatalog();
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    await openLibrary();
    const card = screen.getByRole("article", { name: "naval.cargo" });
    fireEvent.keyDown(card, { key: "Enter" });
    expect(screen.getByRole("dialog", { name: "naval.cargo" })).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    if (!overlay) throw new Error("Falta el fondo del diálogo");
    fireEvent.pointerDown(overlay, { button: 0, pointerType: "mouse" });
    fireEvent.click(overlay);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(card));
  });
  it("navega por la lista filtrada mediante botones y flechas", async () => {
    mockCatalog();
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    await openLibrary();
    fireEvent.click(screen.getByRole("button", { name: "naval" }));
    fireEvent.click(screen.getByRole("article", { name: "naval.carrier" }));
    let dialog = screen.getByRole("dialog", { name: "naval.carrier" });
    expect(within(dialog).getByText("1 de 2")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Anterior" }).hasAttribute("disabled")).toBe(
      true,
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Siguiente" }));
    dialog = screen.getByRole("dialog", { name: "naval.cargo" });
    expect(within(dialog).getByText("2 de 2")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Siguiente" }).hasAttribute("disabled")).toBe(
      true,
    );
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    dialog = screen.getByRole("dialog", { name: "naval.carrier" });
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(screen.getByRole("dialog", { name: "naval.cargo" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(screen.getByRole("dialog", { name: "naval.carrier" })).toBeTruthy();
    expect(await screen.findByTitle("Vista ampliada de naval.carrier")).toBeTruthy();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Detener" }),
    ).toBeTruthy();
  });
  it("presenta parámetros completos y copia exactamente el demo JSON", async () => {
    mockCatalog();
    render(<SandboxShowcase prototype={prototype} query="" format="16x9" />);
    await openLibrary();
    fireEvent.click(screen.getByRole("article", { name: "naval.carrier" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("columnheader", { name: "Rango" })).toBeTruthy();
    expect(within(dialog).getByText("0 a 4 · paso 0.5")).toBeTruthy();
    expect(within(dialog).getByText("Usado por: petroleros")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Copiar JSON" }));
    await within(dialog).findByText("JSON copiado.");
    expect(copyText).toHaveBeenCalledWith(
      JSON.stringify(components[0].demo, null, 2),
      expect.any(HTMLElement),
    );
    vi.mocked(copyText).mockResolvedValueOnce(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "Copiar JSON" }));
    await within(dialog).findByText("No se pudo copiar; selecciona el JSON de ejemplo.");
  });
  it("desmonta vistas de tarjetas, reinicia el único iframe y respeta ambos formatos", async () => {
    mockCatalog();
    const { rerender } = render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    await openLibrary();
    intersectAll();
    fireEvent.click(screen.getByRole("button", { name: "Reproducir animación de naval.cargo" }));
    fireEvent.click(screen.getByRole("article", { name: "naval.cargo" }));
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
    const dialog = screen.getByRole("dialog");
    const frame = await within(dialog).findByTitle("Vista ampliada de naval.cargo");
    expect(frame.getAttribute("src")).toContain(
      "only=naval.cargo&bg=white&autoplay=1&loop=1&bare=1&aspect=9x16",
    );
    fireEvent.load(frame);
    fireEvent.click(within(dialog).getByRole("button", { name: "Detener" }));
    expect(within(dialog).queryByTitle("Vista ampliada de naval.cargo")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reproducir" }));
    expect(within(dialog).getByTitle("Vista ampliada de naval.cargo")).not.toBe(frame);
    rerender(<SandboxShowcase prototype={prototype} query="" format="16x9" />);
    fireEvent.click(within(dialog).getByRole("button", { name: "Desktop (16:9)" }));
    expect(
      (await within(dialog).findByTitle("Vista ampliada de naval.cargo")).getAttribute("src"),
    ).toContain("aspect=16x9");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(document.querySelectorAll("iframe")).toHaveLength(0));
    intersectAll();
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
  });
  it("permite cambiar estados de sprites y ver sus variantes sin selector de fondo", async () => {
    const states = {
      normal: "carrier",
      detected: "carrier-detected",
      burning: "carrier-burning",
      wrecked: "carrier-wrecked",
    };
    mockCatalog({
      sprites: {
        sprites: Object.fromEntries(
          Object.entries(states).map(([state, name]) => [
            name,
            {
              file: `${name}.png`,
              base: "carrier",
              family: "naval",
              state,
              states,
              anchor: [0.5, 0.5],
              bow: [0, -1],
              relativeLength: 1.5,
              variant: "hero",
              livery: "gris",
            },
          ]),
        ),
      },
    });
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Sprites (4)" }));
    fireEvent.click(screen.getByRole("article", { name: "carrier" }));
    const dialog = screen.getByRole("dialog", { name: "carrier" });
    expect(within(dialog).getByText("[0.5,0.5]")).toBeTruthy();
    expect(within(dialog).getByText("[0,-1]")).toBeTruthy();
    expect(within(dialog).getByText("gris")).toBeTruthy();
    expect(
      within(dialog)
        .getAllByRole("heading", { name: "carrier" })
        .find((heading) => !heading.classList.contains("sr-only"))
        ?.parentElement?.contains(within(dialog).getByRole("combobox", { name: "Estado" })),
    ).toBe(true);
    for (const state of ["detected", "burning", "wrecked", "normal"]) {
      fireEvent.change(within(dialog).getByRole("combobox", { name: "Estado" }), {
        target: { value: state },
      });
      expect(
        within(dialog)
          .getByRole("img", { name: /Sprite ampliado/ })
          .getAttribute("src"),
      ).toContain(`${states[state as keyof typeof states]}.png`);
    }
    expect(within(dialog).queryByRole("combobox", { name: "Fondo" })).toBeNull();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Ver variante carrier-burning",
      }),
    );
    expect(screen.getByRole("dialog", { name: "carrier-burning" })).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Estado" }) as HTMLSelectElement).value).toBe(
      "burning",
    );
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
  });
  it("deshabilita estados ausentes y permite abrir sprites sin metadatos", async () => {
    mockCatalog({ sprites: [{ id: "jet", file: "jet.png" }] });
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Sprites (1)" }));
    fireEvent.keyDown(screen.getByRole("article", { name: "jet" }), {
      key: "Enter",
    });
    expect(screen.getByRole("option", { name: "En llamas" }).hasAttribute("disabled")).toBe(true);
    const image = screen.getByRole("img", { name: /Sprite ampliado/ });
    fireEvent.error(image);
    expect(screen.getByText("Imagen no disponible: jet.png")).toBeTruthy();
  });
  it("abre todas las tarjetas del prototipo, conserva selección con/sin y descarga al cerrar", async () => {
    mockCatalog();
    render(<SandboxShowcase prototype={prototype} query="" format="16x9" />);
    await screen.findByRole("tab", { name: "Prototipo" });
    fireEvent.click(screen.getByRole("article", { name: "Prototipo completo" }));
    const dialog = screen.getByRole("dialog", { name: "Prototipo completo" });
    const frame = await within(dialog).findByTitle("Vista ampliada de Prototipo completo");
    expect(frame.getAttribute("src")).toContain("index.html?controls=1");
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(document.querySelectorAll("iframe")).toHaveLength(0));
  });
  it("reproduce, pausa, reinicia y busca con el puente del prototipo; ignora mensajes ajenos", async () => {
    mockCatalog();
    render(<SandboxShowcase prototype={prototype} query="" format="16x9" />);
    await screen.findByRole("tab", { name: "Prototipo" });
    fireEvent.click(screen.getByRole("article", { name: "Prototipo completo" }));
    const frame = (await screen.findByTitle(
      "Vista ampliada de Prototipo completo",
    )) as HTMLIFrameElement;
    if (!frame.contentWindow) throw new Error("Falta la ventana del reproductor");
    // Let the asynchronous iframe mount finish installing its message listener.
    await act(async () => {});
    const stageOrigin = new URL(frame.src, window.location.href).origin;
    const send = vi.spyOn(frame.contentWindow, "postMessage");
    const message = (data: unknown, origin = stageOrigin) =>
      fireEvent(
        window,
        new MessageEvent("message", {
          data,
          origin,
          source: frame.contentWindow,
        }),
      );
    message({ type: "nexa-template-ready" }, "https://ajeno.example");
    expect(send).not.toHaveBeenCalled();
    message({ type: "nexa-template-ready" });
    expect(send).toHaveBeenCalledWith(
      { type: "nexa-template-playback", playing: true },
      stageOrigin,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    expect(send).toHaveBeenLastCalledWith(
      { type: "nexa-template-playback", playing: false },
      stageOrigin,
    );
    message({ type: "nexa-template-time", currentTime: 2, duration: 20 });
    fireEvent.change(screen.getByRole("slider", { name: "Progreso de reproducción" }), {
      target: { value: "8" },
    });
    expect(send).toHaveBeenLastCalledWith({ type: "nexa-template-seek", time: 8 }, stageOrigin);
    fireEvent.click(screen.getByRole("button", { name: "Repetir animación" }));
    expect(send).toHaveBeenCalledWith({ type: "nexa-template-seek", time: 0 }, stageOrigin);
  });
});

describe("Catálogo compartido en sandbox", () => {
  const promoted = {
    base: "sandbox/nodehistory",
    components: "_tactico/components.json",
    sprites: "_tactico/sprites/sprites.json",
    spritesDir: "_tactico/sprites/",
    sheet: "_tactico/sprites/hoja.png",
    gallery: "atlas-en-movimiento/work/tactico/demo.html",
  };
  it("carga biblioteca, sprites y hoja desde la base y abre la galería del episodio", async () => {
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.endsWith("info.json")
          ? { catalog: promoted }
          : url.endsWith("components.json")
            ? { components }
            : { sprites: { carrier: { file: "carrier.png" } } },
    }));
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    await openLibrary();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/files/sandbox/nodehistory/_tactico/components.json"),
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/files/sandbox/nodehistory/_tactico/sprites/sprites.json"),
      expect.anything(),
    );
    expect(galleryUrl(prototype.path, promoted, "naval.carrier", "9x16")).toContain(
      "/files/sandbox/nodehistory/atlas-en-movimiento/work/tactico/demo.html?only=naval.carrier",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Sprites (1)" }));
    expect(screen.getByRole("link", { name: /hoja/i }).getAttribute("href")).toContain(
      "/files/sandbox/nodehistory/_tactico/sprites/hoja.png",
    );
    expect(catalogFileUrl(prototype.path, promoted, "_tactico/sprites/carrier.png")).toContain(
      "/files/sandbox/nodehistory/_tactico/sprites/carrier.png",
    );
  });
  it("rechaza bases externas, rutas ascendentes y variantes codificadas", () => {
    for (const base of [
      "nodehistory",
      "/sandbox/nodehistory",
      "sandbox/../../etc",
      "sandbox/nodehistory/..",
      "sandbox/https://host",
      "sandbox/nodehistory\\..",
      "sandbox/nodehistory?x",
      "sandbox/%2e%2e",
    ]) {
      expect(() => readCatalog({ catalog: { ...promoted, base } })).toThrow();
    }
    for (const file of [
      "../outside.json",
      "../../../../etc/passwd",
      "/etc/passwd",
      "https://host/test",
      "a\\b",
      "a?b",
      "a#b",
    ])
      expect(() => readCatalog({ catalog: { ...promoted, components: file } })).toThrow();
  });
  it("conserva las rutas locales cuando el catálogo no declara base", () => {
    expect(catalogFileUrl(prototype.path, catalog, catalog.components)).toContain(
      "/files/sandbox/historia/atlas/engine/tactico/components.json",
    );
  });
});

describe("Vistas y miniaturas declaradas", () => {
  const tabs = [
    {
      id: "textos",
      label: "Textos",
      families: ["caption", "label", "text", "badge", "icon", "intro", "outro"],
    },
    {
      id: "imagenes",
      label: "Imágenes y documentos",
      families: ["portrait", "editorial", "inventory", "photo", "media"],
      components: ["callout.photo"],
    },
    {
      id: "unidades",
      label: "Unidades",
      families: ["naval", "air", "ground", "army", "unit"],
    },
    {
      id: "mapa",
      label: "Mapa y rutas",
      families: ["territory", "flag", "route", "arrow", "front", "range"],
    },
    { id: "efectos", label: "Efectos", families: ["fx", "strike", "trail"] },
    { id: "sitios", label: "Sitios y economía", families: ["site", "money"] },
  ];
  const library = [
    ...components,
    ...[
      "caption.transcript",
      "text.year",
      "portrait.badge",
      "callout.photo",
      "route.sea",
      "fx.fire",
      "site.port",
      "debug.dot",
    ].map((name) => ({ name, summary: `Ejemplo ${name}` })),
  ];
  const declaration = {
    ...catalog,
    thumbs: "work/tactico/thumbs/thumbs.json",
    tabs,
  };
  const thumbs = Object.fromEntries(library.map((item) => [item.name, `${item.name}.jpg`]));
  function setup({ missing = false, failed = false, declared = declaration } = {}) {
    fetchMock.mockImplementation(async (url: string) => {
      if (failed && url.endsWith("thumbs.json")) throw new Error("Network error");
      const data = url.endsWith("info.json")
        ? { catalog: declared }
        : url.endsWith(catalog.components)
          ? { components: library }
          : url.endsWith("thumbs.json")
            ? missing
              ? {}
              : thumbs
            : null;
      return {
        ok: data !== null,
        status: data === null ? 404 : 200,
        json: async () => data,
      };
    });
  }
  it("solo añade pestañas declaradas y cuenta los componentes de cada grupo", async () => {
    setup();
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    for (const name of [
      "Biblioteca (11)",
      "Textos (2)",
      "Imágenes y documentos (2)",
      "Unidades (3)",
      "Mapa y rutas (1)",
      "Efectos (1)",
      "Sitios y economía (1)",
    ])
      expect(await screen.findByRole("tab", { name })).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(10);
    expect(screen.getAllByRole("tab").at(-1)?.textContent).toBe("New componente");
    fireEvent.click(screen.getByRole("tab", { name: "Textos (2)" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: "debug.dot" })).toBeNull();
    expect(screen.queryAllByTitle(/Vista previa/)).toHaveLength(0);
    const image = await screen.findByRole("img", {
      name: "Miniatura de text.year",
    });
    expect(image.getAttribute("src")).toContain("/work/tactico/thumbs/text.year.jpg");
    expect(image.getAttribute("loading")).toBe("lazy");
  });
  it("muestra miniaturas en Biblioteca antes de reproducir y abre el modal al pulsarlas", async () => {
    setup();
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Biblioteca (11)" }));
    fireEvent.click(await screen.findByRole("img", { name: "Miniatura de naval.carrier" }));
    expect(await screen.findByRole("dialog", { name: "naval.carrier" })).toBeTruthy();
    expect(await screen.findByTitle("Vista ampliada de naval.carrier")).toBeTruthy();
  });
  it("abre la biblioteca completa por declaración y usa el mismo fotograma en tarjeta y modal", async () => {
    const configured = { ...declaration, defaultTab: "library" as const, previewReady: true };
    setup({ declared: configured });
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    await screen.findByText("11 de 11 componentes");
    expect(screen.getAllByRole("article")).toHaveLength(11);
    expect(screen.getByRole("tab", { name: "Biblioteca (11)" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
    const poster = await screen.findByAltText("Miniatura de naval.carrier");
    const imageUrl = poster.getAttribute("src");
    fireEvent.click(screen.getByRole("heading", { name: "naval.carrier" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByAltText("Miniatura de naval.carrier").getAttribute("src")).toBe(
      imageUrl,
    );
    const frame = (await within(dialog).findByTitle(
      "Vista ampliada de naval.carrier",
    )) as HTMLIFrameElement;
    fireEvent.load(frame);
    expect(frame.style.opacity).toBe("0");
    act(() =>
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: new URL(frame.src, location.href).origin,
          source: frame.contentWindow,
          data: { type: "nexa-animation-ready" },
        }),
      ),
    );
    expect(frame.style.opacity).toBe("1");
  });
  it("respeta el fotograma blanco aunque la ficha antigua sugiera un fondo oscuro", () => {
    const item = { name: "fx.fire", preview: { bg: "dark" as const, poster: "thumbs/dark.jpg" } };
    const manifest = { "fx.fire": "white/fx.fire.jpg" };
    expect(componentPosterUrl(prototype.path, declaration, item, "white", manifest)).toContain(
      "/work/tactico/thumbs/white/fx.fire.jpg",
    );
    expect(componentPosterUrl(prototype.path, declaration, item, "dark", manifest)).toContain(
      "/thumbs/dark.jpg",
    );
  });
  it("combina grupo, familia y las búsquedas; navega el modal solo por resultados", async () => {
    setup();
    const { rerender } = render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Unidades (3)" }));
    fireEvent.click(screen.getByRole("button", { name: "naval" }));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "mercante" },
    });
    expect(screen.getByText("1 de 3 componentes")).toBeTruthy();
    fireEvent.click(screen.getByRole("heading", { name: "naval.cargo" }));
    const dialog = await screen.findByRole("dialog", { name: "naval.cargo" });
    expect(
      (
        within(dialog).getByRole("button", {
          name: "Siguiente",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    rerender(<SandboxShowcase prototype={prototype} query="inexistente" format="9x16" />);
    expect(screen.getByText("0 de 3 componentes")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Textos (2)" }));
    expect(screen.getByText("0 de 2 componentes")).toBeTruthy();
  });
  it("mantiene la animación si falla un póster sin mensajes de miniatura", async () => {
    setup();
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Unidades (3)" }));
    fireEvent.error(await screen.findByRole("img", { name: "Miniatura de naval.cargo" }));
    intersectAll();
    fireEvent.click(screen.getByRole("button", { name: "Reproducir animación de naval.cargo" }));
    expect(screen.getByTitle("Vista previa de naval.cargo")).toBeTruthy();
    expect(screen.queryByText(/Miniatura no disponible/)).toBeNull();
    expect(screen.getByRole("button", { name: "Detener animación de naval.cargo" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Textos (2)" }));
    expect(screen.queryAllByTitle(/Vista previa/)).toHaveLength(0);
  });
  it("espera el mapa de miniaturas si el nombre no es una ruta válida", () => {
    const item = { name: "fx.?" };
    const config = { ...catalog, thumbs: "showcase/thumbs/thumbs.json" };
    expect(componentPosterUrl("sandbox/historia/atlas", config, item, "white")).toBeUndefined();
    expect(
      componentPosterUrl("sandbox/historia/atlas", config, item, "white", {
        "fx.?": "fx.-3f-.jpg",
      }),
    ).toContain("fx.-3f-.jpg");
  });
  it("resuelve pósters por nombre aunque el manifiesto falle", async () => {
    setup({ failed: true });
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Textos (2)" }));
    expect(
      (await screen.findByRole("img", { name: "Miniatura de text.year" })).getAttribute("src"),
    ).toContain("text.year.jpg");
    expect(screen.queryByText(/No se pudieron cargar las miniaturas/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  });
  it("mantiene accesibles los componentes nuevos y el teclado de pestañas", async () => {
    setup({ missing: true });
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    await screen.findByRole("tab", { name: "Sitios y economía (1)" });
    const tab = await screen.findByRole("tab", { name: "Prototipo" });
    fireEvent.keyDown(tab, { key: "End" });
    expect(document.activeElement?.textContent).toBe("New componente");
    fireEvent.keyDown(screen.getByRole("tab", { name: "New componente" }), { key: "ArrowLeft" });
    expect(document.activeElement?.textContent).toBe("Sitios y economía (1)");
    expect(screen.getByRole("img", { name: "Miniatura de site.port" })).toBeTruthy();
    fireEvent.click(screen.getByRole("heading", { name: "site.port" }));
    expect(await screen.findByRole("dialog", { name: "site.port" })).toBeTruthy();
  });
  it("resuelve miniaturas desde la base y rechaza manifiestos o pestañas inválidos", () => {
    expect(
      thumbnailUrl(
        prototype.path,
        { ...declaration, base: "sandbox/nodehistory" },
        "text.year.jpg",
      ),
    ).toContain("/files/sandbox/nodehistory/work/tactico/thumbs/text.year.jpg");
    for (const file of ["../x.jpg", "https://host/image.jpg", "/file.jpg", "%2e%2e/x.jpg"])
      expect(() => readThumbs({ "text.year": file })).toThrow();
    expect(() => readCatalog({ catalog: { ...declaration, tabs: [...tabs, tabs[0]] } })).toThrow();
    expect(() =>
      readCatalog({
        catalog: {
          ...declaration,
          tabs: [{ id: "library", label: "Duplicada", families: [] }],
        },
      }),
    ).toThrow();
  });
});

describe("Especificaciones de animación", () => {
  it("espera reproducir en tarjetas y modales de sprites, también al cambiar de estado", async () => {
    const states = { normal: "carrier", burning: "carrier-burning" };
    const spriteCatalog = {
      ...catalog,
      animations: "engine/tactico/animations/index.json",
    };
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.endsWith("info.json")
          ? { catalog: spriteCatalog }
          : url.endsWith("sprites.json")
            ? {
                sprites: Object.fromEntries(
                  Object.entries(states).map(([state, name]) => [
                    name,
                    { file: `${name}.png`, state, states },
                  ]),
                ),
              }
            : url.endsWith("components.json")
              ? { components: [] }
              : { animations: [] },
    }));
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Sprites (2)" }));
    intersectAll();
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Reproducir animación de carrier" }));
    expect(screen.getByTitle("Vista previa de carrier").getAttribute("src")).toContain(
      "sprite=carrier",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("heading", { name: "carrier" }));
    const dialog = screen.getByRole("dialog", { name: "carrier" });
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
    expect(within(dialog).getByAltText("Miniatura de carrier")).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Reproducir animación de carrier" }),
    );
    expect(within(dialog).getByTitle("Vista ampliada de carrier")).toBeTruthy();
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Estado" }), {
      target: { value: "burning" },
    });
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Reproducir animación de carrier-burning" }),
    );
    expect(
      within(dialog).getByTitle("Vista ampliada de carrier-burning").getAttribute("src"),
    ).toContain("sprite=carrier-burning");
  });
  it("lee el índice y la ficha desde la API y aplica el fondo y autoplay", async () => {
    const declaration = {
      ...catalog,
      animations: "engine/tactico/animations/index.json",
      thumbs: "work/tactico/thumbs/thumbs.json",
      tabs: [{ id: "efectos", label: "Efectos", families: ["fx"] }],
    };
    const animation = {
      name: "fx.explosion",
      family: "fx",
      description: "Explosión con destello y partículas.",
      file: "fx.explosion.json",
      preview: {
        bg: "dark",
        poster: "work/tactico/thumbs/fx.explosion.jpg",
        autoplay: true,
      },
    };
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.endsWith("info.json")
          ? { catalog: declaration }
          : url.endsWith("index.json")
            ? { animations: [animation] }
            : url.endsWith("fx.explosion.json")
              ? {
                  ...animation,
                  description: "Ficha detallada de explosión.",
                  example: {
                    id: "explosion",
                    type: "fx.explosion",
                    t: 0,
                    dur: 4,
                  },
                  params: {
                    size: {
                      type: "number",
                      default: 90,
                      description: "Radio del efecto",
                    },
                  },
                  states: ["active"],
                  usedBy: ["demo.json"],
                }
              : url.endsWith("components.json")
                ? { components: [{ name: "fx.explosion" }] }
                : {},
    }));
    render(<SandboxShowcase prototype={prototype} query="" format="9x16" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Efectos (1)" }));
    await screen.findByText("Explosión con destello y partículas.");
    intersectAll();
    fireEvent.click(screen.getByRole("button", { name: "Reproducir animación de fx.explosion" }));
    expect(screen.getByTitle("Vista previa de fx.explosion").getAttribute("src")).toContain(
      "bg=dark&autoplay=1&loop=1&bare=1",
    );
    expect(screen.queryByText(/Fondo oscuro para conservar/)).toBeNull();
    expect(screen.queryByRole("group", { name: "Fondo de las vistas previas" })).toBeNull();
    fireEvent.click(screen.getByRole("heading", { name: "fx.explosion" }));
    const dialog = await screen.findByRole("dialog", { name: "fx.explosion" });
    expect(
      within(dialog).getByRole("link", { name: "Especificación JSON" }).getAttribute("href"),
    ).toContain("/engine/tactico/animations/fx.explosion.json");
    expect(await within(dialog).findByText("Ficha detallada de explosión.")).toBeTruthy();
    expect(await within(dialog).findByTitle("Vista ampliada de fx.explosion")).toBeTruthy();
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/engine/tactico/animations/fx.explosion.json"),
      expect.anything(),
    );
  });
});
