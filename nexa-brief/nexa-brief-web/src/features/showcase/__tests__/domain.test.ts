import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  commonItem,
  component,
  context,
  designItem,
  designs,
  unavailableItem,
  videoItem,
} from "../__fixtures__/contracts";
import { ShowcasePreviewError, type ShowcaseRepository } from "../api/showcase-repository";
import { ComponentDetails } from "../components/ComponentDetails";
import { type GridProps, ShowcaseGrid } from "../components/ShowcaseGrid";
import { ShowcaseToolbar, type ToolbarProps } from "../components/ShowcaseToolbar";
import { ProductionLibraryControls } from "../components/ProductionLibraryControls";
import { ItemPreview, StagePreview } from "../components/StagePreview";
import { useLazyStage } from "../hooks/useLazyStage";
import { useShowcaseState } from "../hooks/useShowcaseState";
import { filterItems, resolveSelection } from "../lib/filters";
import { DEFAULT_FORMAT, FORMATS, getFormat, isFormatId } from "../lib/formats";
import { buildPreviewUrl, isolatedPosterUrl } from "../lib/kit-urls";
import type { Design, Item } from "../types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  TestObserver.instances = [];
});

class TestObserver implements IntersectionObserver {
  static instances: TestObserver[] = [];
  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds = [0];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = () => [];
  constructor(
    private callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.rootMargin = options?.rootMargin ?? "0px";
    TestObserver.instances.push(this);
  }
  enter(target: Element, isIntersecting = true) {
    this.callback(
      [
        {
          target,
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
        } as IntersectionObserverEntry,
      ],
      this,
    );
  }
}

function fakeRepository(): ShowcaseRepository {
  return {
    getDesigns: vi.fn(async () => designs),
    getLibrary: vi.fn(async () => [videoItem, unavailableItem]),
    getCatalog: vi.fn(async () => [commonItem, designItem]),
    previewUrl: vi.fn((item) => {
      if (item.designId === null) throw new ShowcasePreviewError("Diseño desconocido");
      return `/stage-fixture.html?item=${encodeURIComponent(item.key)}`;
    }),
  };
}

describe("selección, búsqueda y orden del dominio", () => {
  it("limita el aislamiento al showcase de Imperio y conserva los parámetros geográficos", () => {
    const item = {
      ...designItem,
      designId: "imperio",
      component: {
        ...component,
        name: "imperio.map",
        example: { from: [150, 36, 95, 0], pins: [{ at: [-0.74, 51.99] }] },
      },
    };
    const ctx = {
      designs: [...context.designs, { ...context.designs[0], id: "imperio", family: "imperio" }],
    };
    const before = JSON.stringify(item.component);
    for (const mode of ["card", "modal"] as const) {
      const url = new URL(buildPreviewUrl(item, ctx, mode), location.href);
      expect(url.searchParams.get("isolated")).toBe("1");
      expect(url.searchParams.get("c")).toBe("imperio.map");
    }
    expect(JSON.stringify(item.component)).toBe(before);
    expect(
      new URL(buildPreviewUrl(designItem, context, "card"), location.href).searchParams.has(
        "isolated",
      ),
    ).toBe(false);
    expect(isolatedPosterUrl("imperio", "imperio.map", "9x16")).toContain("imperio.map-9x16.jpg");
    expect(isolatedPosterUrl("binary", "binary.icon", "9x16")).toBeUndefined();
  });
  it("muestra el fotograma de Imperio sin cargar un reproductor hasta pulsar reproducir", () => {
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    vi.stubGlobal("IntersectionObserver", TestObserver);
    const item = {
      ...designItem,
      designId: "imperio",
      component: { ...component, name: "imperio.map" },
    };
    render(createElement(ItemPreview, { item, context, repo: fakeRepository(), format: "9x16" }));
    const image = screen.getByRole("img", { name: "Miniatura de imperio.map" });
    expect(image.getAttribute("src")).toContain("imperio.map-9x16.jpg");
    expect(document.querySelector("iframe")).toBeNull();
    const host = image.closest("[data-animation-active]");
    if (!host) throw Error("Sin contenedor");
    act(() => TestObserver.instances[0].enter(host));
    fireEvent.click(screen.getByRole("button", { name: "Reproducir animación de imperio.map" }));
    const frame = screen.getByTitle("Vista previa de imperio.map") as HTMLIFrameElement;
    fireEvent.load(frame);
    expect(image.style.opacity).toBe("1");
    act(() =>
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: location.origin,
          source: frame.contentWindow,
          data: { type: "nexa-animation-ready" },
        }),
      ),
    );
    expect(image.style.opacity).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Detener animación de imperio.map" }));
    expect(document.querySelector("iframe")).toBeNull();
    expect(image.style.opacity).toBe("1");
  });
  it("presenta un primer fotograma congelado y permite reproducir y detener diseños de producción", () => {
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    vi.stubGlobal("IntersectionObserver", TestObserver);
    const result = render(
      createElement(ItemPreview, {
        item: designItem,
        context,
        repo: fakeRepository(),
        format: "9x16",
      }),
    );
    const host = result.container.querySelector("[data-animation-active]");
    if (!host) throw Error("Sin contenedor");
    act(() => TestObserver.instances[0].enter(host));
    const still = result.container.querySelector('iframe[title^="Fotograma"]');
    expect(still?.getAttribute("src")).toContain("t=0");
    fireEvent.click(
      screen.getByRole("button", { name: `Reproducir animación de ${designItem.component.name}` }),
    );
    expect(screen.getByTitle(`Vista previa de ${designItem.component.name}`)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: `Detener animación de ${designItem.component.name}` }),
    );
    expect(screen.queryByTitle(`Vista previa de ${designItem.component.name}`)).toBeNull();
    expect(result.container.querySelector('iframe[title^="Fotograma"]')).toBeTruthy();
  });
  it("descubre familias distintas del ID y mantiene propios antes de comunes sin mutar entradas", () => {
    const own: Item = {
      ...designItem,
      key: "nuevo",
      designId: "nuevo",
      component: { name: "otra-familia.titulo", params: {} },
    };
    const secondCommon: Item = {
      ...commonItem,
      key: "common-2",
      component: { name: "common.otro", params: {} },
    };
    const duplicate = { ...own, key: "duplicado-estable" };
    const input = [commonItem, own, secondCommon, designItem, duplicate];
    const output = filterItems(input, { kind: "design", id: "nuevo" }, designs, "");
    expect(output).toEqual([own, duplicate, commonItem, secondCommon]);
    expect(input).toEqual([commonItem, own, secondCommon, designItem, duplicate]);
    expect(output[0]).toBe(own);
    expect(filterItems(input, { kind: "design", id: "desconocido" }, designs, "")).toEqual([]);
  });

  it("busca subcadenas en nombre, resumen, tags y video, sin trim ni normalizar tildes", () => {
    const selection = { kind: "design", id: "rough" } as const;
    for (const query of ["TARJ", "DE EJEMPLO", "TEXTO", "ÁMBITO"]) {
      expect(filterItems([designItem], selection, designs, query)).toEqual([designItem]);
    }
    for (const query of ["ambito", " rough.tarjeta", "contenido"]) {
      expect(filterItems([designItem], selection, designs, query)).toEqual([]);
    }
    expect(
      filterItems([videoItem, unavailableItem], { kind: "videos" }, designs, "NODETECH/"),
    ).toEqual([videoItem]);
    expect(filterItems([videoItem], { kind: "videos" }, designs, "texto")).toEqual([]);
    expect(filterItems([unavailableItem], { kind: "videos" }, designs, "sandbox")).toEqual([
      unavailableItem,
    ]);
  });

  it("valida selección y formatos con defaults sin fijar un inventario de diseños", () => {
    expect(resolveSelection({ kind: "design", id: "viejo" }, designs)).toEqual({
      kind: "design",
      id: designs[0].id,
    });
    expect(resolveSelection({ kind: "videos" }, [])).toEqual({ kind: "videos" });
    expect(resolveSelection({ kind: "design", id: "nuevo" }, designs)).toEqual({
      kind: "design",
      id: "nuevo",
    });
    expect(resolveSelection({ kind: "design", id: "viejo" }, [])).toEqual({
      kind: "design",
      id: "",
    });
    expect(DEFAULT_FORMAT).toBe("9x16");
    expect(FORMATS.map(({ id }) => id)).toEqual(["9x16", "16x9"]);
    for (const format of FORMATS) {
      expect(isFormatId(format.id)).toBe(true);
      expect(getFormat(format.id)).toBe(format);
      expect(format.minCardWidth).toBeGreaterThan(0);
    }
    for (const invalid of [null, undefined, "", "9:16", "constructor", {}])
      expect(isFormatId(invalid)).toBe(false);
    expect(getFormat("inválido")).toBe(getFormat(DEFAULT_FORMAT));
  });
});

describe("preferencias de la grilla", () => {
  it("no accede a storage durante SSR", () => {
    const read = vi.spyOn(Storage.prototype, "getItem");
    const write = vi.spyOn(Storage.prototype, "setItem");
    function ServerProbe() {
      const state = useShowcaseState(designs);
      return createElement("p", null, `${state.selection.kind}:${state.format}`);
    }
    expect(renderToString(createElement(ServerProbe))).toContain("design:9x16");
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("restaura después del montaje y espera el índice sin sobrescribir el diseño guardado", () => {
    localStorage.setItem("kit.design", "nuevo");
    localStorage.setItem("kit.orient", "16x9");
    const hook = renderHook(({ list }: { list: Design[] }) => useShowcaseState(list), {
      initialProps: { list: [] as Design[] },
      wrapper: StrictMode,
    });
    expect(localStorage.getItem("kit.design")).toBe("nuevo");
    expect(hook.result.current.format).toBe("16x9");
    hook.rerender({ list: designs });
    expect(hook.result.current.selection).toEqual({ kind: "design", id: "nuevo" });
    act(() => hook.result.current.setQuery("Ámbito "));
    act(() => hook.result.current.setSelection({ kind: "videos" }));
    act(() => hook.result.current.setFormat("9x16"));
    expect(hook.result.current.query).toBe("Ámbito ");
    expect(hook.result.current.format).toBe("9x16");
    expect(localStorage.getItem("kit.design")).toBe("videos");
    expect(localStorage.getItem("kit.orient")).toBe("9x16");
  });

  it("descarta valores inválidos y permite seleccionar sin almacenamiento", () => {
    localStorage.setItem("kit.design", "eliminado");
    localStorage.setItem("kit.orient", "constructor");
    const hook = renderHook(() => useShowcaseState(designs));
    expect(hook.result.current.selection).toEqual({ kind: "design", id: "rough" });
    expect(hook.result.current.format).toBe("9x16");
    act(() => hook.result.current.setFormat("otro"));
    expect(hook.result.current.format).toBe("9x16");
    hook.unmount();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    const blocked = renderHook(() => useShowcaseState(designs));
    act(() => blocked.result.current.setSelection({ kind: "videos" }));
    act(() => blocked.result.current.setFormat("16x9"));
    expect(blocked.result.current.selection).toEqual({ kind: "videos" });
    expect(blocked.result.current.format).toBe("16x9");
  });
});

describe("montaje diferido y replay", () => {
  it("observa con margen 200px, conserva el montaje y limpia al cambiar URL o desmontar", () => {
    vi.stubGlobal("IntersectionObserver", TestObserver);
    const hook = renderHook(({ src }) => useLazyStage(src), { initialProps: { src: "/uno" } });
    const host = document.createElement("div");
    act(() => {
      hook.result.current.hostRef(host);
    });
    const observer = TestObserver.instances[0];
    expect(observer.rootMargin).toBe("200px");
    expect(observer.observe).toHaveBeenCalledWith(host);
    act(() => observer.enter(host, false));
    expect(hook.result.current.shouldMount).toBe(false);
    act(() => observer.enter(host));
    expect(hook.result.current.shouldMount).toBe(true);
    expect(observer.disconnect).toHaveBeenCalled();
    act(() => observer.enter(host, false));
    expect(hook.result.current.shouldMount).toBe(true);
    act(() => hook.result.current.replay());
    expect(hook.result.current.replayKey).toBe(1);
    hook.rerender({ src: "/dos" });
    expect(hook.result.current.shouldMount).toBe(false);
    expect(hook.result.current.replayKey).toBe(0);
    const next = TestObserver.instances.at(-1);
    hook.unmount();
    expect(next?.disconnect).toHaveBeenCalled();
    // Un callback ya encolado de una observación anterior queda inactivo.
    act(() => observer.enter(host));
  });

  it("replay monta antes de la intersección y fallback monta si falta IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", TestObserver);
    const hook = renderHook(() => useLazyStage("/uno"));
    act(() => hook.result.current.replay());
    expect(hook.result.current.shouldMount).toBe(true);
    expect(hook.result.current.replayKey).toBe(1);
    hook.unmount();
    vi.stubGlobal("IntersectionObserver", undefined);
    const fallback = renderHook(() => useLazyStage("/dos"));
    act(() => {
      fallback.result.current.hostRef(document.createElement("div"));
    });
    expect(fallback.result.current.shouldMount).toBe(true);
  });

  it("cambiar formato conserva el iframe; replay reemplaza solo ese iframe", () => {
    vi.stubGlobal("IntersectionObserver", TestObserver);
    const preview = render(
      createElement(StagePreview, {
        src: "/stage-fixture",
        title: "Prueba",
        format: "9x16",
        componentName: "rough.prueba",
      }),
    );
    expect(preview.container.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Repetir animación Prueba" }));
    const frame = screen.getByTitle("Prueba");
    preview.rerender(
      createElement(StagePreview, {
        src: "/stage-fixture",
        title: "Prueba",
        format: "16x9",
        componentName: "rough.prueba",
      }),
    );
    expect(screen.getByTitle("Prueba")).toBe(frame);
    expect(frame.parentElement?.style.aspectRatio).toBe("16 / 9");
    fireEvent.click(screen.getByRole("button", { name: "Repetir animación Prueba" }));
    expect(screen.getByTitle("Prueba")).not.toBe(frame);
  });

  it("informa un componente ausente y permite reintentar sin dejar temporizadores", () => {
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", undefined);
    const preview = render(
      createElement(StagePreview, {
        src: "/stage-fixture",
        title: "Prueba",
        format: "9x16",
        componentName: "rough.ausente",
      }),
    );
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByRole("alert").textContent).toContain("No se pudo cargar");
    fireEvent.click(screen.getByRole("button", { name: "Repetir animación Prueba" }));
    expect(screen.queryByRole("alert")).toBeNull();
    preview.unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

describe("vistas presentacionales con repositorio fake", () => {
  it("toolbar conserva orden y comunica selección, búsqueda, formatos y contador accesibles", () => {
    const props: ToolbarProps = {
      designs,
      selection: { kind: "design", id: "nuevo" },
      query: "",
      format: "9x16",
      count: 2,
      onSelect: vi.fn(),
      onQuery: vi.fn(),
      onFormat: vi.fn(),
    };
    render(createElement(ShowcaseToolbar, props));
    const toggle = screen.getByRole("button", { name: "Diseños" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("region", { name: "Información del diseño" }).textContent).toContain(
      "Nuevo",
    );
    expect(screen.queryByRole("group", { name: "Diseños de producción" })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Nuevo · nuevo" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("group", { name: "Diseños de producción" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Componentes de videos" }));
    expect(props.onSelect).toHaveBeenCalledWith({ kind: "videos" });
    fireEvent.click(screen.getByRole("button", { name: "Prototipo · rough" }));
    expect(props.onSelect).toHaveBeenCalledWith({ kind: "design", id: "rough" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar componentes" }), {
      target: { value: "Ámbito " },
    });
    expect(props.onQuery).toHaveBeenCalledWith("Ámbito ");
    fireEvent.click(screen.getByRole("button", { name: "16:9" }));
    expect(props.onFormat).toHaveBeenCalledWith("16x9");
    expect(screen.getByRole("status").textContent).toBe("2 componentes");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("group", { name: "Diseños de producción" })).toBeNull();
  });

  it("ofrece búsqueda y filtros derivados de los componentes del diseño", () => {
    const items = [
      { ...designItem, component: { ...component, tags: ["mapa", "única"] } },
      {
        ...designItem,
        key: "otra",
        component: { ...component, name: "rough.otra", tags: ["mapa"] },
      },
    ];
    const onQuery = vi.fn(),
      onTag = vi.fn();
    render(
      createElement(ProductionLibraryControls, {
        items,
        query: "",
        onQuery,
        tag: "",
        onTag,
        visibleCount: 2,
        panelId: "library-panel",
      }),
    );
    expect(screen.getByRole("tab", { name: "Biblioteca (2)" })).toBeTruthy();
    expect(screen.getByText("2 de 2 componentes")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar en la biblioteca" }), {
      target: { value: "mapa" },
    });
    expect(onQuery).toHaveBeenCalledWith("mapa");
    fireEvent.click(screen.getByRole("button", { name: "mapa" }));
    expect(onTag).toHaveBeenCalledWith("mapa");
    expect(screen.queryByRole("button", { name: "única" })).toBeNull();
  });

  it("grilla muestra carga, error recuperable y vacío sin montar previews", () => {
    const props: GridProps = {
      items: [designItem],
      format: "9x16",
      state: "loading",
      context,
      repo: fakeRepository(),
      onRetry: vi.fn(),
      onOpen: vi.fn(),
    };
    const grid = render(createElement(ShowcaseGrid, props));
    expect(screen.getByRole("status").textContent).toContain("Cargando");
    grid.rerender(
      createElement(ShowcaseGrid, { ...props, state: "error", error: "Catálogo sin conexión" }),
    );
    expect(screen.getByRole("alert").textContent).toBe("Catálogo sin conexión");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(props.onRetry).toHaveBeenCalledOnce();
    grid.rerender(createElement(ShowcaseGrid, { ...props, state: "empty" }));
    expect(screen.getByRole("status").textContent).toContain("Nada coincide");
    expect(props.repo.previewUrl).not.toHaveBeenCalled();
  });

  it("mantiene metadata y entradas con diagnóstico; abrir no consulta datos ni recarga otros previews", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const repo = fakeRepository();
    const props: GridProps = {
      items: [designItem, commonItem, videoItem, unavailableItem],
      format: "9x16",
      state: "ready",
      context,
      repo,
      onRetry: vi.fn(),
      onOpen: vi.fn(),
    };
    const grid = render(createElement(ShowcaseGrid, props));
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(grid.container.querySelectorAll("iframe")).toHaveLength(3);
    expect(screen.getByRole("status").textContent).toContain(unavailableItem.unavailableReason);
    expect(screen.queryByText("sandbox/ejemplo")).toBeNull();
    expect(screen.getByText("Una tarjeta de ejemplo")).toBeTruthy();
    expect(screen.getByText("ámbito")).toBeTruthy();
    const unavailable = screen.getByRole("article", { name: "desconocido.tarjeta" });
    fireEvent.click(unavailable);
    expect(props.onOpen).not.toHaveBeenCalled();
    const card = screen.getAllByRole("article", { name: "rough.tarjeta" })[1];
    fireEvent.click(card);
    expect(props.onOpen).toHaveBeenCalledWith(videoItem);
    fireEvent.keyDown(card, { key: "Enter" });
    expect(props.onOpen).toHaveBeenCalledTimes(2);
    expect(repo.getCatalog).not.toHaveBeenCalled();
    expect(repo.getLibrary).not.toHaveBeenCalled();
    const frames = [...grid.container.querySelectorAll("iframe")];
    grid.rerender(createElement(ShowcaseGrid, { ...props, format: "16x9" }));
    expect([...grid.container.querySelectorAll("iframe")]).toEqual(frames);
    fireEvent.click(screen.getByRole("button", { name: "Reproducir animación de common.text" }));
    const replayed = [...grid.container.querySelectorAll("iframe")];
    expect(replayed[0]).toBe(frames[0]);
    expect(replayed[1]).not.toBe(frames[1]);
    expect(replayed[2]).toBe(frames[2]);
  });

  it("una URL inválida mantiene la tarjeta y muestra el error del repositorio", () => {
    const repo = fakeRepository();
    vi.mocked(repo.previewUrl).mockImplementation(() => {
      throw new ShowcasePreviewError("Ruta no permitida");
    });
    const grid = render(
      createElement(ShowcaseGrid, {
        items: [videoItem],
        format: "9x16",
        state: "ready",
        context,
        repo,
        onRetry: vi.fn(),
        onOpen: vi.fn(),
      }),
    );
    expect(screen.getByRole("status").textContent).toContain("Ruta no permitida");
    expect(screen.getByRole("heading", { name: "rough.tarjeta" })).toBeDefined();
    expect(grid.container.querySelector("iframe")).toBeNull();
  });

  it("details exporta las props acordadas y presenta JSON heterogéneo, límites, requeridos y ejemplo escapados", () => {
    const enriched = {
      ...component,
      params: {
        ...component.params,
        limite: { type: "number", min: 0, max: 10, default: 0 },
        activo: { type: "boolean", default: false },
        vacio: { type: "custom", default: null, doc: "<script>dato</script>" },
        cadena: { type: "string", default: "" },
      },
    };
    const details = render(
      createElement(ComponentDetails, {
        component: enriched,
        source: videoItem.source,
        mode: "card",
      }),
    );
    expect(screen.getByRole("region", { name: "Parámetros" })).toBeDefined();
    expect(screen.getByText(/· obligatorio/)).toBeDefined();
    expect(screen.getByText("Mínimo: 0")).toBeDefined();
    expect(screen.getByText("Máximo: 10")).toBeDefined();
    expect(screen.getByText(JSON.stringify(component.params.variante.options))).toBeDefined();
    expect(screen.getByText("<script>dato</script>")).toBeDefined();
    expect(details.container.querySelector("script")).toBeNull();
    const example = screen.getByLabelText("Ejemplo de rough.tarjeta");
    expect(JSON.parse(example.textContent ?? "")).toEqual({
      at: "palabras ancla",
      use: component.name,
      params: component.example,
    });
    expect(details.container.querySelector("details")?.open).toBe(false);
    details.rerender(
      createElement(ComponentDetails, {
        component: enriched,
        source: videoItem.source,
        mode: "modal",
      }),
    );
    expect(screen.getByRole("region", { name: "Parámetros" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Ejemplo para storyboard.json" })).toBeDefined();
    expect(details.container.querySelector("details")).toBeNull();
    details.rerender(
      createElement(ComponentDetails, {
        component: { name: "nuevo.vacio", params: {}, example: null },
        mode: "modal",
      }),
    );
    expect(screen.getByText("Sin parámetros.")).toBeDefined();
    expect(
      JSON.parse(screen.getByLabelText("Ejemplo de nuevo.vacio").textContent ?? "").params,
    ).toEqual({});
  });
});
